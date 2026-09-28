from pathlib import Path
import json
import re
import sys

import mne


# ---------------------------------------------------------
# CHANNEL DEFINITIONS
# ---------------------------------------------------------

SCALP_ELECTRODES = {
    "FP1", "FP2",
    "F1", "F2", "F3", "F4", "F7", "F8", "FZ",
    "C3", "C4", "CZ",
    "P3", "P4", "P7", "P8", "PZ",
    "O1", "O2", "OZ",
    "T3", "T4", "T5", "T6", "T7", "T8",
}

EOG_TERMS = {
    "EOG", "ROC", "LOC", "LEOG", "REOG",
}

EMG_TERMS = {
    "EMG", "CHIN", "MENTALIS", "TIBIAL",
    "SX1", "SX2", "DX1", "DX2",
}

ECG_TERMS = {
    "ECG", "EKG",
}

RESPIRATORY_TERMS = {
    "RESP", "AIRFLOW", "FLUSSO",
    "TORACE", "THOR", "ADDOME", "ABDO",
    "SAO2", "SPO2", "PLETH",
}


# ---------------------------------------------------------
# CHANNEL NORMALIZATION
# ---------------------------------------------------------

def normalize_channel_name(channel_name):
    """
    Convert channel names into a consistent format.

    Examples:
        EEG C4-A1 -> C4-A1
        eeg c4_a1 -> C4-A1
        Fp2 - F4  -> FP2-F4
    """

    name = str(channel_name).upper().strip()

    # Normalize different dash characters
    name = name.replace("–", "-")
    name = name.replace("—", "-")
    name = name.replace("_", "-")

    # Remove an optional EEG prefix
    name = re.sub(r"^EEG[\s:_-]*", "", name)

    # Remove spaces
    name = re.sub(r"\s+", "", name)

    # Replace repeated hyphens with one hyphen
    name = re.sub(r"-+", "-", name)

    return name.strip("-")


def contains_any_term(channel_name, terms):
    normalized = normalize_channel_name(channel_name)

    return any(
        term in normalized
        for term in terms
    )


# ---------------------------------------------------------
# CHANNEL CLASSIFICATION
# ---------------------------------------------------------

def is_eeg_channel(channel_name):
    """
    Detect EEG channels using their electrode labels.

    Examples detected:
        T7
        EEG F3
        C4-A1
        F4-C4
        C4-P4
        P4-O2
        F8-T4
    """

    normalized = normalize_channel_name(channel_name)

    # Reject known non-EEG channels first
    excluded_terms = (
        EOG_TERMS
        | EMG_TERMS
        | ECG_TERMS
        | RESPIRATORY_TERMS
    )

    if contains_any_term(normalized, excluded_terms):
        return False

    # The first electrode in a derivation identifies
    # whether it is an EEG channel.
    first_electrode = normalized.split("-")[0]

    return first_electrode in SCALP_ELECTRODES


def classify_channel(channel_name):
    """Classify an EDF channel into its signal category."""

    if is_eeg_channel(channel_name):
        return "EEG"

    if contains_any_term(channel_name, EOG_TERMS):
        return "EOG"

    if contains_any_term(channel_name, EMG_TERMS):
        return "EMG"

    if contains_any_term(channel_name, ECG_TERMS):
        return "ECG"

    if contains_any_term(channel_name, RESPIRATORY_TERMS):
        return "RESPIRATORY"

    return "AUXILIARY"


# ---------------------------------------------------------
# EDF INSPECTION
# ---------------------------------------------------------

def inspect_edf_channels(edf_path):
    """
    Inspect an EDF without loading the complete recording
    into memory.
    """

    edf_path = Path(edf_path)

    if not edf_path.exists():
        raise FileNotFoundError(
            f"EDF file was not found: {edf_path}"
        )

    if edf_path.suffix.lower() != ".edf":
        raise ValueError(
            "Only EDF files are supported by this function."
        )

    raw = None

    try:
        raw = mne.io.read_raw_edf(
            edf_path,
            preload=False,
            verbose="ERROR",
        )

        sampling_frequency = float(raw.info["sfreq"])
        duration_seconds = float(
            raw.n_times / sampling_frequency
        )

        channel_groups = {
            "EEG": [],
            "EOG": [],
            "EMG": [],
            "ECG": [],
            "RESPIRATORY": [],
            "AUXILIARY": [],
        }

        normalized_lookup = {}

        for original_name in raw.ch_names:
            normalized_name = normalize_channel_name(
                original_name
            )

            channel_type = classify_channel(original_name)

            channel_information = {
                "original_name": original_name,
                "normalized_name": normalized_name,
                "type": channel_type,
            }

            channel_groups[channel_type].append(
                channel_information
            )

            # Preserve the original EDF name required by MNE
            normalized_lookup.setdefault(
                normalized_name,
                original_name,
            )

        sleep_model_source = normalized_lookup.get("C4-A1")

        return {
            "file_name": edf_path.name,
            "file_size_mb": round(
                edf_path.stat().st_size / (1024 * 1024),
                2,
            ),
            "sampling_frequency_hz": sampling_frequency,
            "duration_seconds": round(duration_seconds, 2),
            "duration_hours": round(
                duration_seconds / 3600,
                3,
            ),
            "number_of_channels": len(raw.ch_names),
            "number_of_eeg_channels": len(
                channel_groups["EEG"]
            ),
            "channel_groups": channel_groups,
            "normalized_lookup": normalized_lookup,

            # The first sleep model will require C4-A1
            "sleep_model": {
                "required_channel": "C4-A1",
                "source_channel": sleep_model_source,
                "compatible": sleep_model_source is not None,
            },
        }

    finally:
        if raw is not None:
            raw.close()


# ---------------------------------------------------------
# COMMAND-LINE TEST
# ---------------------------------------------------------

def main():
    if len(sys.argv) != 2:
        print(
            "Usage:\n"
            "python backend\\eeg_channels.py "
            "data\\cap_sleep\\raw\\ins1.edf"
        )
        raise SystemExit(1)

    result = inspect_edf_channels(sys.argv[1])

    print(
        json.dumps(
            result,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()