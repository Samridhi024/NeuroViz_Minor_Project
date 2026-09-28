from fractions import Fraction
from pathlib import Path
import argparse

import mne
import numpy as np
from scipy.signal import (
    butter,
    detrend,
    filtfilt,
    iirnotch,
    resample_poly,
    sosfiltfilt,
)

try:
    from .eeg_channels import normalize_channel_name
except ImportError:
    from eeg_channels import normalize_channel_name


# ---------------------------------------------------------
# SLEEP PROCESSING CONFIGURATION
# ---------------------------------------------------------

TARGET_SAMPLING_RATE = 128.0
EPOCH_DURATION_SECONDS = 30.0
LOW_CUTOFF_HZ = 0.5
HIGH_CUTOFF_HZ = 35.0
NOTCH_FREQUENCY_HZ = 50.0

# The first model will use this channel
MODEL_CHANNEL = "C4-A1"


# ---------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------

def find_source_channel(raw, required_channel):
    """
    Find the original EDF channel matching a normalized name.

    Example:
        Required: C4-A1
        EDF name: EEG C4-A1
    """

    required_normalized = normalize_channel_name(
        required_channel
    )

    for original_name in raw.ch_names:
        if (
            normalize_channel_name(original_name)
            == required_normalized
        ):
            return original_name

    return None


def resample_signal(
    signal,
    original_sampling_rate,
    target_sampling_rate,
):
    """Resample using an integer polyphase ratio."""

    signal = np.asarray(signal, dtype=np.float64)

    if np.isclose(
        original_sampling_rate,
        target_sampling_rate,
    ):
        return signal.copy()

    ratio = Fraction(
        target_sampling_rate / original_sampling_rate
    ).limit_denominator(1000)

    return resample_poly(
        signal,
        up=ratio.numerator,
        down=ratio.denominator,
    )

def clock_time_to_seconds(time_text):
    """Convert HH:MM:SS into seconds since midnight."""

    hour, minute, second = [
        int(part)
        for part in time_text.split(":")
    ]

    return (
        hour * 3600
        + minute * 60
        + second
    )


def calculate_annotation_start_offset_seconds(
    edf_path,
    annotation_start_time,
):
    """
    Calculate how many seconds after the EDF start
    the first annotation epoch begins.
    """

    edf_path = Path(edf_path)

    raw = mne.io.read_raw_edf(
        edf_path,
        preload=False,
        verbose="ERROR",
    )

    try:
        measurement_date = raw.info.get(
            "meas_date"
        )

        if measurement_date is None:
            raise ValueError(
                f"EDF start time is unavailable: "
                f"{edf_path.name}"
            )

        edf_start_time = (
            measurement_date.strftime(
                "%H:%M:%S"
            )
        )

        edf_start_seconds = (
            clock_time_to_seconds(
                edf_start_time
            )
        )

        annotation_start_seconds = (
            clock_time_to_seconds(
                annotation_start_time
            )
        )

        # Forward difference handles recordings
        # that cross midnight.
        offset_seconds = float(
            (
                annotation_start_seconds
                - edf_start_seconds
            )
            % (24 * 3600)
        )

        sampling_rate = float(
            raw.info["sfreq"]
        )

        duration_seconds = float(
            raw.n_times / sampling_rate
        )

        if offset_seconds >= duration_seconds:
            raise ValueError(
                f"Calculated annotation offset "
                f"{offset_seconds:.1f}s is outside "
                f"the EDF duration "
                f"{duration_seconds:.1f}s."
            )

        return {
            "edf_start_time": (
                edf_start_time
            ),
            "annotation_start_time": (
                annotation_start_time
            ),
            "offset_seconds": (
                offset_seconds
            ),
            "edf_duration_seconds": (
                duration_seconds
            ),
        }

    finally:
        raw.close()

def preprocess_sleep_epoch(
    raw_signal_volts,
    original_sampling_rate,
    target_sampling_rate=TARGET_SAMPLING_RATE,
):
    """
    Clean one sleep EEG epoch.

    Pipeline:
        1. Replace invalid values
        2. Remove linear trend
        3. Resample to 128 Hz
        4. Apply 50 Hz notch filter
        5. Apply 0.5-35 Hz band-pass filter
        6. Convert volts to microvolts
        7. Create a normalized visualization copy

    Returns:
        filtered_microvolts:
            Used for ML feature extraction.

        normalized_signal:
            Used for normalized visualization.
    """

    signal = np.asarray(
        raw_signal_volts,
        dtype=np.float64,
    ).reshape(-1)

    if signal.size < 32:
        raise ValueError(
            "The epoch is too short for filtering."
        )

    signal = np.nan_to_num(
        signal,
        nan=0.0,
        posinf=0.0,
        neginf=0.0,
    )

    # Remove constant and linear drift
    signal = detrend(signal, type="linear")

    # Make every recording use the same sampling rate
    signal = resample_signal(
        signal,
        original_sampling_rate,
        target_sampling_rate,
    )

    nyquist = target_sampling_rate / 2.0

    if HIGH_CUTOFF_HZ >= nyquist:
        raise ValueError(
            "High cutoff must be below the Nyquist frequency."
        )

    # Remove Indian mains interference at 50 Hz
    if NOTCH_FREQUENCY_HZ < nyquist:
        notch_b, notch_a = iirnotch(
            w0=NOTCH_FREQUENCY_HZ,
            Q=30.0,
            fs=target_sampling_rate,
        )

        signal = filtfilt(
            notch_b,
            notch_a,
            signal,
        )

    # Stable Butterworth band-pass filter
    bandpass_sos = butter(
        N=4,
        Wn=[LOW_CUTOFF_HZ, HIGH_CUTOFF_HZ],
        btype="bandpass",
        fs=target_sampling_rate,
        output="sos",
    )

    filtered_volts = sosfiltfilt(
        bandpass_sos,
        signal,
    )

    # MNE returns EEG signals in volts.
    # Microvolts are easier to understand and use as features.
    filtered_microvolts = filtered_volts * 1_000_000.0

    filtered_mean = float(
        np.mean(filtered_microvolts)
    )

    filtered_std = float(
        np.std(filtered_microvolts)
    )

    if filtered_std > 1e-12:
        normalized_signal = (
            filtered_microvolts - filtered_mean
        ) / filtered_std
    else:
        normalized_signal = np.zeros_like(
            filtered_microvolts
        )

    return filtered_microvolts, normalized_signal


# ---------------------------------------------------------
# EDF EPOCH GENERATOR
# ---------------------------------------------------------

def iterate_sleep_epochs(
    edf_path,
    required_channel=MODEL_CHANNEL,
    epoch_duration_seconds=EPOCH_DURATION_SECONDS,
    target_sampling_rate=TARGET_SAMPLING_RATE,
    minimum_recording_hours=4.0,
    selected_epoch_indices=None,
    recording_start_offset_seconds=0.0,
):
    """
    Read and process annotation-aligned epochs.

    recording_start_offset_seconds specifies how
    many seconds after the EDF start the annotation
    timeline begins.

    The complete EDF is never loaded into RAM.
    """

    edf_path = Path(edf_path)

    if not edf_path.exists():
        raise FileNotFoundError(
            f"EDF file not found: {edf_path}"
        )

    recording_start_offset_seconds = float(
        recording_start_offset_seconds
    )

    if (
        not np.isfinite(
            recording_start_offset_seconds
        )
        or recording_start_offset_seconds < 0
    ):
        raise ValueError(
            "recording_start_offset_seconds "
            "must be a finite non-negative value."
        )

    raw = mne.io.read_raw_edf(
        edf_path,
        preload=False,
        verbose="ERROR",
    )

    try:
        original_sampling_rate = float(
            raw.info["sfreq"]
        )

        duration_seconds = float(
            raw.n_times
            / original_sampling_rate
        )

        minimum_seconds = (
            minimum_recording_hours
            * 3600
        )

        if duration_seconds < minimum_seconds:
            raise ValueError(
                f"Recording is only "
                f"{duration_seconds / 3600:.2f} "
                f"hours. At least "
                f"{minimum_recording_hours:.1f} "
                f"hours are required."
            )

        source_channel = find_source_channel(
            raw,
            required_channel,
        )

        if source_channel is None:
            available_channels = ", ".join(
                raw.ch_names
            )

            raise ValueError(
                f"Required sleep channel "
                f"'{required_channel}' was not found. "
                f"Available channels: "
                f"{available_channels}"
            )

        raw_epoch_samples = int(
            round(
                original_sampling_rate
                * epoch_duration_seconds
            )
        )

        offset_samples = int(
            round(
                recording_start_offset_seconds
                * original_sampling_rate
            )
        )

        if offset_samples >= raw.n_times:
            raise ValueError(
                "Annotation start offset is "
                "outside the EDF recording."
            )

        available_samples = (
            raw.n_times
            - offset_samples
        )

        total_complete_epochs = int(
            available_samples
            // raw_epoch_samples
        )

        if total_complete_epochs <= 0:
            raise ValueError(
                "No complete annotation-aligned "
                "epochs are available."
            )

        if selected_epoch_indices is None:
            epoch_indices = range(
                total_complete_epochs
            )

        else:
            requested_indices = sorted(
                {
                    int(index)
                    for index
                    in selected_epoch_indices
                }
            )

            invalid_indices = [
                index
                for index
                in requested_indices
                if (
                    index < 0
                    or index
                    >= total_complete_epochs
                )
            ]

            if invalid_indices:
                raise ValueError(
                    "Requested annotation epochs "
                    "are outside the aligned EDF "
                    "recording. First invalid "
                    f"indices: {invalid_indices[:10]}. "
                    f"Available aligned epochs: "
                    f"{total_complete_epochs}."
                )

            epoch_indices = (
                requested_indices
            )

        for epoch_index in epoch_indices:
            start_sample = (
                offset_samples
                + epoch_index
                * raw_epoch_samples
            )

            stop_sample = (
                start_sample
                + raw_epoch_samples
            )

            raw_epoch_volts = raw.get_data(
                picks=[source_channel],
                start=start_sample,
                stop=stop_sample,
            )[0]

            (
                filtered_microvolts,
                normalized_signal,
            ) = preprocess_sleep_epoch(
                raw_epoch_volts,
                original_sampling_rate,
                target_sampling_rate,
            )

            actual_start_seconds = float(
                start_sample
                / original_sampling_rate
            )

            actual_end_seconds = float(
                stop_sample
                / original_sampling_rate
            )

            annotation_relative_start = float(
                epoch_index
                * epoch_duration_seconds
            )

            yield {
                # Epoch number relative to the first
                # annotation stage.
                "epoch_index": (
                    epoch_index
                ),

                # Actual position inside the EDF.
                "start_seconds": (
                    actual_start_seconds
                ),
                "end_seconds": (
                    actual_end_seconds
                ),

                # Position relative to the annotation
                # timeline.
                "annotation_relative_start_seconds": (
                    annotation_relative_start
                ),
                "recording_start_offset_seconds": (
                    recording_start_offset_seconds
                ),

                "source_channel": (
                    source_channel
                ),
                "normalized_channel": (
                    normalize_channel_name(
                        source_channel
                    )
                ),
                "original_sampling_rate": (
                    original_sampling_rate
                ),
                "processed_sampling_rate": (
                    target_sampling_rate
                ),
                "raw_signal_volts": (
                    raw_epoch_volts
                ),
                "filtered_signal_microvolts": (
                    filtered_microvolts
                ),
                "normalized_signal": (
                    normalized_signal
                ),
            }

    finally:
        raw.close()


# ---------------------------------------------------------
# COMMAND-LINE TEST
# ---------------------------------------------------------

def test_preprocessing(
    edf_path,
    number_of_epochs,
):
    """Process a few epochs and print verification values."""

    print("=" * 72)
    print("SLEEP EEG PREPROCESSING TEST")
    print("=" * 72)
    print(f"EDF file: {edf_path}")
    print(f"Required channel: {MODEL_CHANNEL}")
    print(
        f"Target sampling rate: "
        f"{TARGET_SAMPLING_RATE} Hz"
    )
    print(
        f"Epoch duration: "
        f"{EPOCH_DURATION_SECONDS} seconds"
    )

    processed_count = 0

    epoch_generator = iterate_sleep_epochs(
        edf_path=edf_path,
    )

    try:
        for epoch in epoch_generator:
            filtered = epoch[
                "filtered_signal_microvolts"
            ]

            normalized = epoch[
                "normalized_signal"
            ]

            print("\n" + "-" * 72)
            print(
                f"Epoch: {epoch['epoch_index']}"
            )
            print(
                f"Time: "
                f"{epoch['start_seconds']:.1f}s"
                f" - "
                f"{epoch['end_seconds']:.1f}s"
            )
            print(
                f"Source channel: "
                f"{epoch['source_channel']}"
            )
            print(
                f"Original sampling rate: "
                f"{epoch['original_sampling_rate']} Hz"
            )
            print(
                f"Processed sampling rate: "
                f"{epoch['processed_sampling_rate']} Hz"
            )
            print(
                f"Processed samples: "
                f"{len(filtered)}"
            )
            print(
                f"Filtered mean: "
                f"{np.mean(filtered):.6f} µV"
            )
            print(
                f"Filtered standard deviation: "
                f"{np.std(filtered):.6f} µV"
            )
            print(
                f"Filtered minimum: "
                f"{np.min(filtered):.6f} µV"
            )
            print(
                f"Filtered maximum: "
                f"{np.max(filtered):.6f} µV"
            )
            print(
                f"Normalized mean: "
                f"{np.mean(normalized):.6f}"
            )
            print(
                f"Normalized standard deviation: "
                f"{np.std(normalized):.6f}"
            )
            print(
                f"Contains NaN: "
                f"{np.isnan(filtered).any()}"
            )
            print(
                f"Contains infinity: "
                f"{np.isinf(filtered).any()}"
            )

            processed_count += 1

            if processed_count >= number_of_epochs:
                break

    finally:
        epoch_generator.close()

    print("\n" + "=" * 72)
    print(
        f"Successfully processed "
        f"{processed_count} epochs."
    )
    print("=" * 72)


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Test the NeuroViz sleep "
            "preprocessing pipeline."
        )
    )

    parser.add_argument(
        "edf_path",
        help="Path to the CAP EDF recording.",
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=3,
        help="Number of epochs to test.",
    )

    arguments = parser.parse_args()

    test_preprocessing(
        arguments.edf_path,
        arguments.epochs,
    )


if __name__ == "__main__":
    main()