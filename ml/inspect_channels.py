from pathlib import Path
from collections import Counter, defaultdict
import csv
import re

import mne


# ---------------------------------------------------------
# PROJECT PATHS
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data" / "cap_sleep" / "raw"
OUTPUT_DIR = PROJECT_ROOT / "ml" / "artifacts"
OUTPUT_FILE = OUTPUT_DIR / "channel_inventory.csv"


# Standard EEG electrode names that may appear in CAP EDFs
EEG_ELECTRODES = (
    "FP1", "FP2",
    "F3", "F4", "F7", "F8", "FZ",
    "C3", "C4", "CZ",
    "P3", "P4", "PZ",
    "O1", "O2",
)


def normalize_channel_name(channel_name):
    """
    Normalize channel names so names such as:
        EEG C3-A2
        eeg c3-a2
        C3_A2

    can be compared consistently.
    """

    name = channel_name.upper().strip()
    name = re.sub(r"^EEG[\s:_-]*", "", name)
    name = name.replace("_", "-")
    name = name.replace(" ", "")

    return name


def is_eeg_channel(channel_name):
    """
    Return True when a channel appears to be an EEG channel.
    EOG, EMG, ECG and respiratory channels are excluded.
    """

    normalized = normalize_channel_name(channel_name)

    excluded_terms = (
        "EOG", "EMG", "ECG", "EKG",
        "RESP", "AIRFLOW", "THOR",
        "ABDO", "SAO2", "SPO2",
        "POSITION", "PLETH",
    )

    if any(term in normalized for term in excluded_terms):
        return False

    return normalized.startswith(EEG_ELECTRODES)


def get_subject_class(subject_id):
    """Determine diagnosis from the CAP filename."""

    subject_id = subject_id.lower()

    if subject_id.startswith("ins"):
        return "insomnia"

    if re.fullmatch(r"n\d+", subject_id):
        return "normal"

    return "unknown"


def format_duration(seconds):
    """Convert seconds into a readable hours/minutes value."""

    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)

    return f"{hours}h {minutes}m"


def inspect_edf_files():
    """Inspect EDF headers without loading entire recordings into memory."""

    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"Dataset folder was not found:\n{DATA_DIR}"
        )

    edf_files = sorted(DATA_DIR.glob("*.edf"))

    if not edf_files:
        raise FileNotFoundError(
            f"No EDF files were found in:\n{DATA_DIR}"
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    inventory_rows = []
    channel_counts = Counter()
    class_channel_presence = defaultdict(Counter)
    successfully_read_subjects = []

    print("=" * 80)
    print("CAP SLEEP DATABASE — CHANNEL INSPECTION")
    print("=" * 80)
    print(f"Dataset folder: {DATA_DIR}")
    print(f"EDF files found: {len(edf_files)}")

    for edf_path in edf_files:
        subject_id = edf_path.stem
        diagnosis = get_subject_class(subject_id)
        annotation_path = edf_path.with_suffix(".txt")

        print("\n" + "-" * 80)
        print(f"Subject: {subject_id}")
        print(f"Class:   {diagnosis}")
        print(f"File:    {edf_path.name}")

        raw = None

        try:
            # preload=False means the complete recording is not loaded into RAM
            raw = mne.io.read_raw_edf(
                edf_path,
                preload=False,
                verbose="ERROR",
            )

            sampling_frequency = float(raw.info["sfreq"])
            duration_seconds = raw.n_times / sampling_frequency
            file_size_mb = edf_path.stat().st_size / (1024 * 1024)

            normalized_channels = [
                normalize_channel_name(channel)
                for channel in raw.ch_names
            ]

            eeg_channels = [
                normalize_channel_name(channel)
                for channel in raw.ch_names
                if is_eeg_channel(channel)
            ]

            unique_eeg_channels = sorted(set(eeg_channels))

            print(f"Size:              {file_size_mb:.2f} MB")
            print(f"Sampling frequency:{sampling_frequency:.2f} Hz")
            print(f"Duration:          {format_duration(duration_seconds)}")
            print(f"Total channels:    {len(raw.ch_names)}")
            print(f"Annotation found:  {annotation_path.exists()}")

            print("\nDetected EEG channels:")

            if unique_eeg_channels:
                for channel in unique_eeg_channels:
                    print(f"  - {channel}")
            else:
                print("  No standard EEG channels were recognized.")

            print("\nAll original EDF channels:")

            for original_channel in raw.ch_names:
                print(f"  - {original_channel}")

            successfully_read_subjects.append(subject_id)

            # Count a channel only once for each subject
            for channel in unique_eeg_channels:
                channel_counts[channel] += 1
                class_channel_presence[diagnosis][channel] += 1

            inventory_rows.append(
                {
                    "subject_id": subject_id,
                    "diagnosis": diagnosis,
                    "edf_file": edf_path.name,
                    "annotation_file": (
                        annotation_path.name
                        if annotation_path.exists()
                        else ""
                    ),
                    "annotation_found": annotation_path.exists(),
                    "file_size_mb": round(file_size_mb, 2),
                    "sampling_frequency_hz": sampling_frequency,
                    "duration_seconds": round(duration_seconds, 2),
                    "duration_hours": round(duration_seconds / 3600, 3),
                    "number_of_channels": len(raw.ch_names),
                    "eeg_channels": " | ".join(unique_eeg_channels),
                    "all_channels": " | ".join(normalized_channels),
                    "status": "success",
                }
            )

        except Exception as error:
            print(f"ERROR: Could not inspect {edf_path.name}")
            print(error)

            inventory_rows.append(
                {
                    "subject_id": subject_id,
                    "diagnosis": diagnosis,
                    "edf_file": edf_path.name,
                    "annotation_file": (
                        annotation_path.name
                        if annotation_path.exists()
                        else ""
                    ),
                    "annotation_found": annotation_path.exists(),
                    "file_size_mb": round(
                        edf_path.stat().st_size / (1024 * 1024),
                        2,
                    ),
                    "sampling_frequency_hz": "",
                    "duration_seconds": "",
                    "duration_hours": "",
                    "number_of_channels": "",
                    "eeg_channels": "",
                    "all_channels": "",
                    "status": f"error: {error}",
                }
            )

        finally:
            if raw is not None:
                raw.close()

    fieldnames = [
        "subject_id",
        "diagnosis",
        "edf_file",
        "annotation_file",
        "annotation_found",
        "file_size_mb",
        "sampling_frequency_hz",
        "duration_seconds",
        "duration_hours",
        "number_of_channels",
        "eeg_channels",
        "all_channels",
        "status",
    ]

    with OUTPUT_FILE.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=fieldnames,
        )

        writer.writeheader()
        writer.writerows(inventory_rows)

    print("\n" + "=" * 80)
    print("COMMON CHANNEL SUMMARY")
    print("=" * 80)

    successful_count = len(successfully_read_subjects)

    if successful_count == 0:
        print("No EDF file could be inspected successfully.")
        return

    print(
        f"\nChannels found in all "
        f"{successful_count} successfully read recordings:"
    )

    common_channels = sorted(
        channel
        for channel, count in channel_counts.items()
        if count == successful_count
    )

    if common_channels:
        for channel in common_channels:
            print(f"  - {channel}")
    else:
        print("  No identical EEG channel exists across every recording.")

    print("\nOverall EEG channel availability:")

    for channel, count in channel_counts.most_common():
        print(
            f"  {channel:<20} "
            f"{count}/{successful_count} recordings"
        )

    print("\nAvailability by diagnosis:")

    for diagnosis, counts in class_channel_presence.items():
        class_total = sum(
            1
            for row in inventory_rows
            if row["diagnosis"] == diagnosis
            and row["status"] == "success"
        )

        print(f"\n{diagnosis.upper()} ({class_total} recordings)")

        for channel, count in counts.most_common():
            print(
                f"  {channel:<20} "
                f"{count}/{class_total}"
            )

    print("\n" + "=" * 80)
    print("INSPECTION COMPLETED")
    print("=" * 80)
    print(f"CSV report saved to:\n{OUTPUT_FILE}")


if __name__ == "__main__":
    inspect_edf_files()