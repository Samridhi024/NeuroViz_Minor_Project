"""Backward-compatible FAA provenance and quality metadata for NeuroViz.

The submitted project keeps ``features['Alpha_Asymmetry']`` as its legacy FAA
value. This module does not replace that value. It records which electrodes
were used and computes an additional comparison from filtered, non-Z-scored
signals for future ML experiments.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy.signal import butter, detrend, filtfilt, iirnotch, welch


EPSILON = 1e-10


def _trapezoidal_integral(values: np.ndarray, coordinates: np.ndarray) -> float:
    """Use the available NumPy API without requiring a package upgrade."""
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(values, coordinates))
    return float(np.trapz(values, coordinates))


def _has_usable_signal(data_dict: dict[str, np.ndarray], channel: str) -> bool:
    signal = data_dict.get(channel)
    if signal is None:
        return False
    values = np.asarray(signal, dtype=float)
    finite_values = values[np.isfinite(values)]
    return finite_values.size >= 32 and float(np.std(finite_values)) > 1e-12


def _select_channel_pair(data_dict: dict[str, np.ndarray]) -> tuple[str, str, str] | None:
    """Prefer the report's F3/F4 pair and retain its T7/F8 fallback."""
    if _has_usable_signal(data_dict, "F3") and _has_usable_signal(data_dict, "F4"):
        return "F3", "F4", "standard_frontal"
    if _has_usable_signal(data_dict, "T7") and _has_usable_signal(data_dict, "F8"):
        return "T7", "F8", "fallback_two_channel"
    return None


def _filtered_alpha_power(signal: np.ndarray, sampling_rate: float) -> float:
    values = np.asarray(signal, dtype=float).reshape(-1)
    values = np.nan_to_num(values, nan=0.0, posinf=0.0, neginf=0.0)

    nyquist = sampling_rate / 2.0
    high_cut = min(45.0, nyquist * 0.95)
    if sampling_rate <= 1 or high_cut <= 0.5:
        raise ValueError("Sampling rate is too low for FAA alpha-band processing.")

    processed = detrend(values)
    if 50.0 < nyquist:
        notch_b, notch_a = iirnotch(50.0, 30.0, fs=sampling_rate)
        processed = filtfilt(notch_b, notch_a, processed)

    band_b, band_a = butter(
        4,
        [0.5 / nyquist, high_cut / nyquist],
        btype="bandpass",
    )
    processed = filtfilt(band_b, band_a, processed)

    frequencies, psd = welch(
        processed,
        fs=sampling_rate,
        nperseg=min(len(processed), max(64, int(sampling_rate * 2))),
    )
    alpha_mask = (frequencies >= 8.0) & (frequencies <= 12.0)
    if np.count_nonzero(alpha_mask) < 2:
        return 0.0
    return _trapezoidal_integral(psd[alpha_mask], frequencies[alpha_mask])


def build_faa_details(
    data_dict: dict[str, np.ndarray],
    sampling_rate: float,
    legacy_score: float | None,
) -> dict[str, Any]:
    """Describe legacy FAA and add a non-breaking unscaled comparison value."""
    selected_pair = _select_channel_pair(data_dict)
    if selected_pair is None:
        return {
            "legacy_score": legacy_score,
            "legacy_key": "Alpha_Asymmetry",
            "pair_used": [],
            "pair_label": "Unavailable",
            "mode": "unavailable",
            "standard_frontal_pair": False,
            "corrected_unscaled_score": None,
            "quality_note": "A complete F3/F4 or T7/F8 pair was not available.",
            "usage": "Research and wellness display only; not a medical diagnosis.",
        }

    left_channel, right_channel, mode = selected_pair
    corrected_score: float | None = None
    calculation_warning: str | None = None

    try:
        left_alpha = _filtered_alpha_power(data_dict[left_channel], sampling_rate)
        right_alpha = _filtered_alpha_power(data_dict[right_channel], sampling_rate)
        corrected_score = float(
            np.log(max(right_alpha, EPSILON)) - np.log(max(left_alpha, EPSILON))
        )
    except Exception as error:
        # Metadata must never cause the already-submitted /analyze workflow to fail.
        calculation_warning = f"Additional unscaled FAA calculation unavailable: {error}"

    is_standard = mode == "standard_frontal"
    details: dict[str, Any] = {
        "legacy_score": legacy_score,
        "legacy_key": "Alpha_Asymmetry",
        "pair_used": [left_channel, right_channel],
        "pair_label": f"{left_channel}/{right_channel}",
        "mode": mode,
        "standard_frontal_pair": is_standard,
        "corrected_unscaled_score": corrected_score,
        "corrected_method": "filtered non-Z-scored alpha log difference",
        "quality_note": (
            "Standard homologous frontal pair used."
            if is_standard
            else "Report-compatible T7/F8 fallback used; T7 and F8 are not a homologous frontal pair."
        ),
        "usage": "Research and wellness display only; not a medical diagnosis.",
    }
    if calculation_warning:
        details["calculation_warning"] = calculation_warning
    return details
