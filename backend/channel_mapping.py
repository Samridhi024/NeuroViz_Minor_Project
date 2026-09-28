"""Safe EEG channel resolution for labelled and generic CSV/TXT files.

Column order alone is never treated as evidence of electrode identity. Explicit
labels are preferred, verified dataset profiles are supported, and ambiguous
generic files require a user-provided mapping.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import re
from typing import Iterable


REQUIRED_CHANNELS = ("T7", "F8")
SUPPORTED_CHANNELS = ("T7", "F8", "F3", "F4", "Cz", "P4")

CHANNEL_ALIASES = {
    "T7": ("T7", "T3"),
    "F8": ("F8",),
    "F3": ("F3",),
    "F4": ("F4",),
    "Cz": ("CZ",),
    "P4": ("P4",),
}


class ChannelMappingRequired(ValueError):
    """Raised when electrode identity cannot be determined safely."""

    def __init__(self, columns: list[str], message: str):
        super().__init__(message)
        self.columns = columns
        self.message = message

    def as_detail(self) -> dict:
        return {
            "code": "CHANNEL_MAPPING_REQUIRED",
            "message": self.message,
            "available_columns": self.columns,
            "required_channels": list(REQUIRED_CHANNELS),
            "optional_channels": ["Cz", "P4", "F3", "F4"],
        }


@dataclass(frozen=True)
class ChannelMappingResult:
    channels: dict[str, str]
    source: str
    confidence: str
    profile: str | None = None

    def as_response(self) -> dict:
        return {
            "channels": self.channels,
            "source": self.source,
            "confidence": self.confidence,
            "profile": self.profile,
        }


def _clean_column(column: object) -> str:
    return re.sub(r"\s+", " ", str(column).strip())


def _contains_electrode_label(column: str, aliases: Iterable[str]) -> bool:
    cleaned = _clean_column(column).upper()
    return any(
        re.search(rf"(?<![A-Z0-9]){re.escape(alias)}(?![A-Z0-9])", cleaned)
        for alias in aliases
    )


def _column_lookup(columns: list[str]) -> dict[str, str]:
    """Map whitespace-normalized names back to their original pandas labels."""
    return {_clean_column(column).casefold(): column for column in columns}


def _validate_mapping(mapping: dict, columns: list[str]) -> dict[str, str]:
    lookup = _column_lookup(columns)
    resolved: dict[str, str] = {}

    for raw_channel, raw_column in mapping.items():
        channel = str(raw_channel).strip()
        if channel not in SUPPORTED_CHANNELS or raw_column in (None, ""):
            continue
        column = lookup.get(_clean_column(raw_column).casefold())
        if column is None:
            raise ChannelMappingRequired(
                columns,
                f"Mapped column '{raw_column}' was not found in the uploaded file.",
            )
        resolved[channel] = column

    missing = [channel for channel in REQUIRED_CHANNELS if channel not in resolved]
    if missing:
        raise ChannelMappingRequired(
            columns,
            f"Select columns for the required channels: {', '.join(missing)}.",
        )
    if len(set(resolved.values())) != len(resolved):
        raise ChannelMappingRequired(
            columns,
            "Each electrode must be mapped to a different data column.",
        )
    return resolved


def _parse_manual_mapping(manual_mapping: str, columns: list[str]) -> dict[str, str]:
    try:
        parsed = json.loads(manual_mapping)
    except (TypeError, json.JSONDecodeError) as error:
        raise ChannelMappingRequired(columns, "The submitted channel mapping is invalid JSON.") from error
    if not isinstance(parsed, dict):
        raise ChannelMappingRequired(columns, "The channel mapping must be a JSON object.")
    return _validate_mapping(parsed, columns)


def _detect_labelled_channels(columns: list[str]) -> dict[str, str]:
    detected: dict[str, str] = {}
    for channel, aliases in CHANNEL_ALIASES.items():
        matches = [column for column in columns if _contains_electrode_label(column, aliases)]
        if len(matches) == 1:
            detected[channel] = matches[0]
    return detected


def _physionet_auditory_profile(columns: list[str], filename: str) -> dict[str, str] | None:
    """Resolve the documented OpenBCI order for PhysioNet auditory-eeg v1.0.0."""
    filename_matches = re.fullmatch(
        r"s\d{2}_ex\d{2}(?:_s\d{2})?\.(?:txt|csv)",
        filename.lower(),
    )
    lookup = _column_lookup(columns)
    required_generic_names = [f"exg channel {index}" for index in range(4)]
    if not filename_matches or not all(name in lookup for name in required_generic_names):
        return None
    return {
        "P4": lookup["exg channel 0"],
        "Cz": lookup["exg channel 1"],
        "F8": lookup["exg channel 2"],
        "T7": lookup["exg channel 3"],
    }


def resolve_channel_mapping(
    columns: Iterable[object],
    filename: str,
    manual_mapping: str | None = None,
) -> ChannelMappingResult:
    """Resolve electrode labels without relying on arbitrary column positions."""
    original_columns = [str(column) for column in columns]

    if manual_mapping:
        return ChannelMappingResult(
            channels=_parse_manual_mapping(manual_mapping, original_columns),
            source="user_provided",
            confidence="confirmed",
        )

    labelled = _detect_labelled_channels(original_columns)
    if all(channel in labelled for channel in REQUIRED_CHANNELS):
        return ChannelMappingResult(
            channels=labelled,
            source="column_labels",
            confidence="high",
        )

    profile_mapping = _physionet_auditory_profile(original_columns, filename)
    if profile_mapping:
        return ChannelMappingResult(
            channels=profile_mapping,
            source="verified_dataset_profile",
            confidence="high",
            profile="physionet_auditory_eeg_v1",
        )

    numeric_columns = [
        column
        for column in original_columns
        if not any(token in _clean_column(column).casefold() for token in ("sample", "time", "accel", "other"))
    ]
    raise ChannelMappingRequired(
        numeric_columns or original_columns,
        "The EEG columns do not identify their electrode positions. Confirm the mapping before analysis.",
    )
