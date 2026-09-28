from pathlib import Path
import argparse

import numpy as np
from scipy.signal import welch
from scipy.stats import kurtosis, skew

try:
    from .sleep_preprocessing import (
        iterate_sleep_epochs,
    )
except ImportError:
    from sleep_preprocessing import (
        iterate_sleep_epochs,
    )


# ---------------------------------------------------------
# FREQUENCY BANDS
# ---------------------------------------------------------

SLEEP_FREQUENCY_BANDS = {
    "delta": (0.5, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 12.0),
    "sigma": (12.0, 16.0),
    "beta": (16.0, 30.0),
}

TOTAL_FREQUENCY_RANGE = (0.5, 35.0)
EPSILON = 1e-12


# ---------------------------------------------------------
# NUMERICAL HELPERS
# ---------------------------------------------------------

def trapezoidal_integral(values, coordinates):
    """Support both older and newer NumPy versions."""

    if hasattr(np, "trapezoid"):
        return float(
            np.trapezoid(values, coordinates)
        )

    return float(
        np.trapz(values, coordinates)
    )


def finite_or_zero(value):
    """Replace invalid feature values with zero."""

    value = float(value)

    if np.isfinite(value):
        return value

    return 0.0


def safe_ratio(numerator, denominator):
    """Calculate a ratio without division-by-zero."""

    return finite_or_zero(
        numerator / max(denominator, EPSILON)
    )


def calculate_band_power(
    frequencies,
    power_spectral_density,
    low_frequency,
    high_frequency,
):
    """Integrate PSD within one frequency band."""

    frequency_mask = (
        (frequencies >= low_frequency)
        & (frequencies < high_frequency)
    )

    if np.count_nonzero(frequency_mask) < 2:
        return 0.0

    return trapezoidal_integral(
        power_spectral_density[frequency_mask],
        frequencies[frequency_mask],
    )


# ---------------------------------------------------------
# TIME-DOMAIN FEATURES
# ---------------------------------------------------------

def extract_time_domain_features(signal):
    """Calculate statistical and Hjorth features."""

    signal = np.asarray(
        signal,
        dtype=np.float64,
    ).reshape(-1)

    signal_mean = float(np.mean(signal))
    signal_std = float(np.std(signal))
    signal_variance = float(np.var(signal))
    signal_rms = float(
        np.sqrt(np.mean(np.square(signal)))
    )

    first_difference = np.diff(signal)
    second_difference = np.diff(first_difference)

    first_variance = (
        float(np.var(first_difference))
        if first_difference.size
        else 0.0
    )

    second_variance = (
        float(np.var(second_difference))
        if second_difference.size
        else 0.0
    )

    # Hjorth parameters
    hjorth_activity = signal_variance

    hjorth_mobility = (
        np.sqrt(
            first_variance
            / max(signal_variance, EPSILON)
        )
        if signal_variance > EPSILON
        else 0.0
    )

    derivative_mobility = (
        np.sqrt(
            second_variance
            / max(first_variance, EPSILON)
        )
        if first_variance > EPSILON
        else 0.0
    )

    hjorth_complexity = (
        derivative_mobility
        / max(hjorth_mobility, EPSILON)
        if hjorth_mobility > EPSILON
        else 0.0
    )

    if signal_std > EPSILON:
        signal_skewness = skew(
            signal,
            bias=False,
        )

        signal_kurtosis = kurtosis(
            signal,
            fisher=False,
            bias=False,
        )
    else:
        signal_skewness = 0.0
        signal_kurtosis = 0.0

    line_length = (
        float(np.sum(np.abs(first_difference)))
        if first_difference.size
        else 0.0
    )

    mean_absolute_difference = (
        float(np.mean(np.abs(first_difference)))
        if first_difference.size
        else 0.0
    )

    zero_crossings = (
        np.count_nonzero(
            signal[:-1] * signal[1:] < 0
        )
        if signal.size > 1
        else 0
    )

    zero_crossing_rate = (
        zero_crossings / (signal.size - 1)
        if signal.size > 1
        else 0.0
    )

    return {
        "mean_uv": finite_or_zero(signal_mean),
        "std_uv": finite_or_zero(signal_std),
        "variance_uv2": finite_or_zero(
            signal_variance
        ),
        "rms_uv": finite_or_zero(signal_rms),
        "minimum_uv": finite_or_zero(
            np.min(signal)
        ),
        "maximum_uv": finite_or_zero(
            np.max(signal)
        ),
        "peak_to_peak_uv": finite_or_zero(
            np.ptp(signal)
        ),
        "skewness": finite_or_zero(
            signal_skewness
        ),
        "kurtosis": finite_or_zero(
            signal_kurtosis
        ),
        "line_length_uv": finite_or_zero(
            line_length
        ),
        "mean_absolute_difference_uv": (
            finite_or_zero(
                mean_absolute_difference
            )
        ),
        "zero_crossing_rate": finite_or_zero(
            zero_crossing_rate
        ),
        "hjorth_activity": finite_or_zero(
            hjorth_activity
        ),
        "hjorth_mobility": finite_or_zero(
            hjorth_mobility
        ),
        "hjorth_complexity": finite_or_zero(
            hjorth_complexity
        ),
    }


# ---------------------------------------------------------
# FREQUENCY-DOMAIN FEATURES
# ---------------------------------------------------------

def extract_frequency_domain_features(
    signal,
    sampling_rate,
):
    """Calculate EEG spectral features using Welch PSD."""

    signal = np.asarray(
        signal,
        dtype=np.float64,
    ).reshape(-1)

    nperseg = min(
        signal.size,
        int(round(sampling_rate * 4)),
    )

    if nperseg < 32:
        raise ValueError(
            "Signal is too short for spectral analysis."
        )

    frequencies, psd = welch(
        signal,
        fs=sampling_rate,
        window="hann",
        nperseg=nperseg,
        noverlap=nperseg // 2,
        detrend="constant",
        scaling="density",
    )

    total_low, total_high = (
        TOTAL_FREQUENCY_RANGE
    )

    total_power = calculate_band_power(
        frequencies,
        psd,
        total_low,
        total_high,
    )

    features = {
        "total_power_uv2": finite_or_zero(
            total_power
        ),
        "log_total_power": finite_or_zero(
            np.log10(total_power + EPSILON)
        ),
    }

    band_powers = {}

    for band_name, (
        low_frequency,
        high_frequency,
    ) in SLEEP_FREQUENCY_BANDS.items():

        power = calculate_band_power(
            frequencies,
            psd,
            low_frequency,
            high_frequency,
        )

        band_powers[band_name] = power

        features[
            f"{band_name}_power_uv2"
        ] = finite_or_zero(power)

        features[
            f"log_{band_name}_power"
        ] = finite_or_zero(
            np.log10(power + EPSILON)
        )

        features[
            f"relative_{band_name}_power"
        ] = safe_ratio(
            power,
            total_power,
        )

    valid_mask = (
        (frequencies >= total_low)
        & (frequencies <= total_high)
    )

    valid_frequencies = frequencies[valid_mask]
    valid_psd = psd[valid_mask]

    if valid_psd.size and np.sum(valid_psd) > 0:
        dominant_frequency = float(
            valid_frequencies[
                np.argmax(valid_psd)
            ]
        )

        normalized_psd = (
            valid_psd
            / np.sum(valid_psd)
        )

        spectral_entropy = -float(
            np.sum(
                normalized_psd
                * np.log2(
                    normalized_psd + EPSILON
                )
            )
        )

        maximum_entropy = np.log2(
            normalized_psd.size
        )

        if maximum_entropy > 0:
            spectral_entropy /= maximum_entropy

        cumulative_power = np.cumsum(
            valid_psd
        )

        cumulative_power /= (
            cumulative_power[-1]
        )

        median_index = int(
            np.searchsorted(
                cumulative_power,
                0.50,
            )
        )

        edge_index = int(
            np.searchsorted(
                cumulative_power,
                0.95,
            )
        )

        median_index = min(
            median_index,
            valid_frequencies.size - 1,
        )

        edge_index = min(
            edge_index,
            valid_frequencies.size - 1,
        )

        median_frequency = float(
            valid_frequencies[median_index]
        )

        spectral_edge_95 = float(
            valid_frequencies[edge_index]
        )

    else:
        dominant_frequency = 0.0
        spectral_entropy = 0.0
        median_frequency = 0.0
        spectral_edge_95 = 0.0

    features.update(
        {
            "dominant_frequency_hz": (
                finite_or_zero(
                    dominant_frequency
                )
            ),
            "median_frequency_hz": (
                finite_or_zero(
                    median_frequency
                )
            ),
            "spectral_edge_95_hz": (
                finite_or_zero(
                    spectral_edge_95
                )
            ),
            "spectral_entropy": (
                finite_or_zero(
                    spectral_entropy
                )
            ),
            "theta_alpha_ratio": safe_ratio(
                band_powers["theta"],
                band_powers["alpha"],
            ),
            "beta_alpha_ratio": safe_ratio(
                band_powers["beta"],
                band_powers["alpha"],
            ),
            "delta_beta_ratio": safe_ratio(
                band_powers["delta"],
                band_powers["beta"],
            ),
            "sigma_total_ratio": safe_ratio(
                band_powers["sigma"],
                total_power,
            ),
        }
    )

    return features


# ---------------------------------------------------------
# QUALITY SCREENING
# ---------------------------------------------------------

def evaluate_epoch_quality(signal):
    """
    Apply conservative engineering-quality checks.

    These are not medical diagnostic thresholds.
    """

    signal = np.asarray(
        signal,
        dtype=np.float64,
    ).reshape(-1)

    rejection_reasons = []

    if signal.size == 0:
        rejection_reasons.append(
            "empty_signal"
        )

        return {
            "quality_pass": False,
            "quality_reason": "|".join(
                rejection_reasons
            ),
        }

    if not np.all(np.isfinite(signal)):
        rejection_reasons.append(
            "non_finite_values"
        )

    finite_signal = np.nan_to_num(signal)

    signal_std = float(
        np.std(finite_signal)
    )

    maximum_absolute_amplitude = float(
        np.max(np.abs(finite_signal))
    )

    if signal_std < 0.1:
        rejection_reasons.append(
            "near_flat_signal"
        )

    if maximum_absolute_amplitude > 1000.0:
        rejection_reasons.append(
            "extreme_amplitude"
        )

    return {
        "quality_pass": (
            len(rejection_reasons) == 0
        ),
        "quality_reason": (
            "|".join(rejection_reasons)
            if rejection_reasons
            else "accepted"
        ),
    }


# ---------------------------------------------------------
# COMPLETE FEATURE EXTRACTION
# ---------------------------------------------------------

def extract_sleep_epoch_features(
    filtered_signal_microvolts,
    sampling_rate,
):
    """Extract every feature for one cleaned epoch."""

    signal = np.asarray(
        filtered_signal_microvolts,
        dtype=np.float64,
    ).reshape(-1)

    if signal.size < 32:
        raise ValueError(
            "Epoch is too short for feature extraction."
        )

    if not np.all(np.isfinite(signal)):
        raise ValueError(
            "Epoch contains NaN or infinite values."
        )

    features = {}

    features.update(
        extract_time_domain_features(signal)
    )

    features.update(
        extract_frequency_domain_features(
            signal,
            sampling_rate,
        )
    )

    return features


# ---------------------------------------------------------
# COMMAND-LINE TEST
# ---------------------------------------------------------

def test_feature_extraction(
    edf_path,
    number_of_epochs,
):
    """Extract features from a few epochs."""

    print("=" * 72)
    print("SLEEP EEG FEATURE EXTRACTION TEST")
    print("=" * 72)
    print(f"EDF file: {edf_path}")

    epoch_generator = iterate_sleep_epochs(
        edf_path
    )

    processed_count = 0

    try:
        for epoch in epoch_generator:
            signal = epoch[
                "filtered_signal_microvolts"
            ]

            features = (
                extract_sleep_epoch_features(
                    signal,
                    epoch[
                        "processed_sampling_rate"
                    ],
                )
            )

            quality = evaluate_epoch_quality(
                signal
            )

            numeric_values = np.asarray(
                list(features.values()),
                dtype=np.float64,
            )

            print("\n" + "-" * 72)
            print(
                f"Epoch: {epoch['epoch_index']}"
            )
            print(
                f"Quality: "
                f"{quality['quality_pass']}"
            )
            print(
                f"Quality reason: "
                f"{quality['quality_reason']}"
            )
            print(
                f"Standard deviation: "
                f"{features['std_uv']:.4f} µV"
            )
            print(
                f"Delta power: "
                f"{features['delta_power_uv2']:.4f}"
            )
            print(
                f"Theta power: "
                f"{features['theta_power_uv2']:.4f}"
            )
            print(
                f"Alpha power: "
                f"{features['alpha_power_uv2']:.4f}"
            )
            print(
                f"Sigma power: "
                f"{features['sigma_power_uv2']:.4f}"
            )
            print(
                f"Beta power: "
                f"{features['beta_power_uv2']:.4f}"
            )
            print(
                f"Dominant frequency: "
                f"{features['dominant_frequency_hz']:.4f} Hz"
            )
            print(
                f"Spectral entropy: "
                f"{features['spectral_entropy']:.4f}"
            )
            print(
                f"All features finite: "
                f"{np.all(np.isfinite(numeric_values))}"
            )
            print(
                f"Feature count: "
                f"{len(features)}"
            )

            processed_count += 1

            if processed_count >= number_of_epochs:
                break

    finally:
        epoch_generator.close()

    print("\n" + "=" * 72)
    print(
        f"Successfully extracted features "
        f"from {processed_count} epochs."
    )
    print("=" * 72)


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Test NeuroViz sleep EEG "
            "feature extraction."
        )
    )

    parser.add_argument(
        "edf_path",
        help="Path to a CAP EDF file.",
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=3,
        help="Number of epochs to test.",
    )

    arguments = parser.parse_args()

    test_feature_extraction(
        arguments.edf_path,
        arguments.epochs,
    )


if __name__ == "__main__":
    main()