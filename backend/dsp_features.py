"""Additional EEG features that complete the submitted NeuroViz DSP pipeline.

The legacy feature keys remain owned by ``main.extract_all_features``. This
module only adds missing values and never overwrites an existing result.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy.signal import welch

try:
    import pywt
except ImportError:  # The API remains usable and reports a clear warning.
    pywt = None


BANDS = {
    "Delta": (0.5, 4.0),
    "Theta": (4.0, 8.0),
    "Alpha": (8.0, 12.0),  # Preserve the submitted project's alpha definition.
    "Beta": (13.0, 30.0),
    "Gamma": (30.0, 45.0),
}


def trapezoidal_integral(values: np.ndarray, coordinates: np.ndarray) -> float:
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(values, coordinates))
    return float(np.trapz(values, coordinates))


def _welch_psd(signal: np.ndarray, sampling_rate: float) -> tuple[np.ndarray, np.ndarray]:
    values = np.nan_to_num(np.asarray(signal, dtype=float).reshape(-1))
    if values.size < 2:
        return np.array([], dtype=float), np.array([], dtype=float)
    nperseg = min(values.size, max(8, int(sampling_rate * 2)))
    return welch(values, fs=sampling_rate, nperseg=nperseg)


def spectral_features(signal: np.ndarray, sampling_rate: float) -> dict[str, float]:
    """Return absolute and relative normalized-signal band powers."""
    frequencies, psd = _welch_psd(signal, sampling_rate)
    if frequencies.size == 0:
        return {}

    total_mask = (frequencies >= 0.5) & (frequencies <= min(45.0, sampling_rate / 2.0))
    total_power = trapezoidal_integral(psd[total_mask], frequencies[total_mask])
    output: dict[str, float] = {}

    for band, (low, high) in BANDS.items():
        mask = (frequencies >= low) & (frequencies <= high)
        power = (
            trapezoidal_integral(psd[mask], frequencies[mask])
            if np.count_nonzero(mask) >= 2
            else 0.0
        )
        output[band] = power
        output[f"{band}Relative"] = power / total_power if total_power > 1e-12 else 0.0

    full_mask = (frequencies >= 0.5) & (frequencies <= min(45.0, sampling_rate / 2.0))
    output["DominantFreqFull"] = (
        float(frequencies[full_mask][np.argmax(psd[full_mask])])
        if np.any(full_mask)
        else 0.0
    )
    return output


def wavelet_features(signal: np.ndarray) -> dict[str, float]:
    """Compute total and relative db4 DWT coefficient energies."""
    if pywt is None:
        raise RuntimeError("PyWavelets is not installed")

    values = np.nan_to_num(np.asarray(signal, dtype=float).reshape(-1))
    wavelet = pywt.Wavelet("db4")
    level = min(4, pywt.dwt_max_level(values.size, wavelet.dec_len))
    if level < 1:
        return {"WaveletEnergy": 0.0, "WaveletLevel": 0.0}

    coefficients = pywt.wavedec(values, wavelet=wavelet, level=level)
    energies = [float(np.sum(np.square(coefficients_array))) for coefficients_array in coefficients]
    total_energy = float(sum(energies))
    output = {
        "WaveletEnergy": total_energy,
        "WaveletLevel": float(level),
    }

    labels = [f"cA{level}"] + [f"cD{index}" for index in range(level, 0, -1)]
    for label, energy in zip(labels, energies):
        output[f"WaveletEnergy_{label}"] = energy
        output[f"WaveletRelative_{label}"] = (
            energy / total_energy if total_energy > 1e-12 else 0.0
        )
    return output


def extract_extended_features(
    clean_dict: dict[str, np.ndarray],
    sampling_rate: float,
    filtered_dict: dict[str, np.ndarray] | None = None,
) -> tuple[dict[str, float | None], list[str]]:
    """Add five-band, wavelet, and non-normalized filtered statistics."""
    output: dict[str, float | None] = {}
    warnings: list[str] = []

    for channel, signal in clean_dict.items():
        normalized = np.nan_to_num(np.asarray(signal, dtype=float))
        if normalized.size:
            output[f"{channel}_PeakAbsZ"] = float(np.max(np.abs(normalized)))
            centered = normalized - np.mean(normalized)
            std = float(np.std(centered))
            output[f"{channel}_Kurtosis"] = (
                float(np.mean(np.power(centered / std, 4)))
                if std > 1e-12
                else 0.0
            )

        for name, value in spectral_features(signal, sampling_rate).items():
            output[f"{channel}_{name}"] = value

        try:
            for name, value in wavelet_features(signal).items():
                output[f"{channel}_{name}"] = value
        except RuntimeError as error:
            output[f"{channel}_WaveletEnergy"] = None
            if not warnings:
                warnings.append(f"Wavelet features unavailable: {error}. Install PyWavelets.")

        if filtered_dict and channel in filtered_dict:
            filtered = np.nan_to_num(np.asarray(filtered_dict[channel], dtype=float))
            if filtered.size:
                output[f"{channel}_FilteredMean"] = float(np.mean(filtered))
                output[f"{channel}_FilteredMin"] = float(np.min(filtered))
                output[f"{channel}_FilteredMax"] = float(np.max(filtered))
                output[f"{channel}_FilteredStd"] = float(np.std(filtered))

    return output, warnings


def compute_artifact_metrics(
    clean_dict: dict[str, np.ndarray],
    sampling_rate: float,
) -> dict[str, Any]:
    """Implement the report's threshold flags on normalized channel signals."""
    f8 = np.nan_to_num(np.asarray(clean_dict.get("F8", []), dtype=float))
    t7 = np.nan_to_num(np.asarray(clean_dict.get("T7", []), dtype=float))

    f8_peak_z = float(np.max(np.abs(f8))) if f8.size else 0.0
    ocular_threshold_z = 20.0
    ocular_detected = bool(f8_peak_z > ocular_threshold_z)

    window_size = max(1, int(round(sampling_rate)))
    global_t7_std = float(np.std(t7)) if t7.size else 0.0
    window_stds = [
        float(np.std(t7[start:start + window_size]))
        for start in range(0, t7.size, window_size)
        if t7[start:start + window_size].size >= max(2, window_size // 2)
    ]
    max_window_std = max(window_stds, default=0.0)
    muscle_ratio = max_window_std / global_t7_std if global_t7_std > 1e-12 else 0.0
    muscle_threshold_ratio = 10.0
    muscle_detected = bool(muscle_ratio > muscle_threshold_ratio)

    return {
        "ocular_detected": ocular_detected,
        "muscle_detected": muscle_detected,
        "f8_peak_z": f8_peak_z,
        "ocular_threshold_z": ocular_threshold_z,
        "t7_max_window_std_z": max_window_std,
        "t7_window_to_global_std_ratio": float(muscle_ratio),
        "muscle_threshold_ratio": muscle_threshold_ratio,
        "method": "Report-compatible threshold screening on normalized signals",
        "usage": "Artifact screening only; not artifact removal or medical diagnosis.",
    }


def build_feature_metadata(source_signal_unit: str) -> dict[str, str]:
    return {
        "Mean_Min_Max_Std": "dimensionless Z-score statistics",
        "band_power": "power calculated from each normalized channel",
        "relative_band_power": "band power divided by total 0.5-45 Hz power",
        "wavelet_energy": "sum of squared db4 coefficients on normalized signal",
        "filtered_statistics": source_signal_unit,
    }
