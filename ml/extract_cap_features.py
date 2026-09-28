from pathlib import Path
from collections import Counter
import argparse
import json
import re
import sys
import time

import numpy as np
import pandas as pd


# ---------------------------------------------------------
# PROJECT IMPORTS
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sleep_annotations import (
    build_stage_by_epoch,
    parse_sleep_annotations,
)

from sleep_features import (
    evaluate_epoch_quality,
    extract_sleep_epoch_features,
)

from sleep_preprocessing import (
    EPOCH_DURATION_SECONDS,
    MODEL_CHANNEL,
    TARGET_SAMPLING_RATE,
    calculate_annotation_start_offset_seconds,
    iterate_sleep_epochs,
)


# ---------------------------------------------------------
# PATHS AND CONFIGURATION
# ---------------------------------------------------------

DATA_DIR = PROJECT_ROOT / "data" / "cap_sleep" / "raw"
OUTPUT_DIR = PROJECT_ROOT / "ml" / "artifacts"
OUTPUT_CSV = OUTPUT_DIR / "cap_epoch_features.csv"
SCHEMA_FILE = OUTPUT_DIR / "cap_feature_schema.json"

SELECTED_STAGES = ("N2", "N3")
CAP_EVENT_NAMES = ("MCAP-A1", "MCAP-A2", "MCAP-A3")
DEFAULT_EPOCHS_PER_LABEL_PER_STAGE = 40

SUBJECT_PATTERN = re.compile(
    r"^(ins|n)(\d+)$",
    re.IGNORECASE,
)


# ---------------------------------------------------------
# SUBJECT HELPERS
# ---------------------------------------------------------

def get_subject_information(edf_path):
    subject_id = Path(edf_path).stem.lower()
    match = SUBJECT_PATTERN.fullmatch(subject_id)

    if match is None:
        return None

    is_insomnia = match.group(1).lower() == "ins"

    return {
        "subject_id": subject_id,
        "diagnosis": "insomnia" if is_insomnia else "normal",
        "diagnosis_label": 1 if is_insomnia else 0,
        "number": int(match.group(2)),
    }


def subject_sort_key(edf_path):
    information = get_subject_information(edf_path)
    class_order = 0 if information["diagnosis"] == "normal" else 1
    return class_order, information["number"]


# ---------------------------------------------------------
# CAP EVENT ALIGNMENT
# ---------------------------------------------------------

def build_overlapping_cap_events_by_epoch(annotation_result):
    """
    Associate every CAP A event with each 30-second
    annotation epoch that it overlaps.

    The target means "annotated CAP A event present in
    this epoch". It is not the official clinical CAP rate.
    """

    cap_events_by_epoch = {}

    for event in annotation_result["cap_events"]:
        event_name = event["event"]

        if event_name not in CAP_EVENT_NAMES:
            continue

        event_start = float(event["relative_start_seconds"])
        event_end = float(event["relative_end_seconds"])

        if event_end <= 0 or event_end <= event_start:
            continue

        first_epoch = max(
            0,
            int(event_start // EPOCH_DURATION_SECONDS),
        )

        # An event ending exactly on a boundary must not be
        # assigned to the following epoch.
        last_epoch = max(
            first_epoch,
            int((event_end - 1e-9) // EPOCH_DURATION_SECONDS),
        )

        for epoch_index in range(first_epoch, last_epoch + 1):
            epoch_start = epoch_index * EPOCH_DURATION_SECONDS
            epoch_end = epoch_start + EPOCH_DURATION_SECONDS

            overlap_start = max(epoch_start, event_start)
            overlap_end = min(epoch_end, event_end)
            overlap_seconds = max(0.0, overlap_end - overlap_start)

            if overlap_seconds <= 0:
                continue

            cap_events_by_epoch.setdefault(epoch_index, []).append(
                {
                    "event": event_name,
                    "overlap_seconds": float(overlap_seconds),
                    "event_relative_start_seconds": event_start,
                    "event_duration_seconds": float(
                        event["duration_seconds"]
                    ),
                }
            )

    return cap_events_by_epoch


# ---------------------------------------------------------
# BALANCED EPOCH SELECTION
# ---------------------------------------------------------

def evenly_select_epochs(candidate_indices, required_count):
    """Select deterministic epochs spread across the night."""

    candidate_indices = sorted(set(candidate_indices))

    if required_count <= 0:
        raise ValueError("required_count must be greater than zero.")

    if len(candidate_indices) < required_count:
        raise ValueError(
            f"Only {len(candidate_indices)} candidate epochs are "
            f"available, but {required_count} are required."
        )

    positions = np.linspace(
        0,
        len(candidate_indices) - 1,
        num=required_count,
    )

    positions = np.rint(positions).astype(int)
    selected = [candidate_indices[position] for position in positions]

    if len(set(selected)) != required_count:
        raise RuntimeError("Epoch selection created duplicate indices.")

    return selected


def select_balanced_cap_epochs(
    stage_by_epoch,
    cap_events_by_epoch,
    epochs_per_label_per_stage,
):
    """
    Select equal CAP-positive and CAP-negative epochs
    separately inside N2 and N3.
    """

    selected_indices = []
    selected_metadata = {}
    availability = {}

    cap_epoch_indices = set(cap_events_by_epoch)

    for sleep_stage in SELECTED_STAGES:
        stage_indices = {
            epoch_index
            for epoch_index, current_stage in stage_by_epoch.items()
            if current_stage == sleep_stage
        }

        positive_candidates = sorted(stage_indices & cap_epoch_indices)
        negative_candidates = sorted(stage_indices - cap_epoch_indices)

        availability[sleep_stage] = {
            "positive": len(positive_candidates),
            "negative": len(negative_candidates),
        }

        selected_positive = evenly_select_epochs(
            positive_candidates,
            epochs_per_label_per_stage,
        )

        selected_negative = evenly_select_epochs(
            negative_candidates,
            epochs_per_label_per_stage,
        )

        for epoch_index in selected_positive:
            selected_indices.append(epoch_index)
            selected_metadata[epoch_index] = {
                "sleep_stage": sleep_stage,
                "cap_a_event_present": 1,
                "cap_label": "cap-a-present",
            }

        for epoch_index in selected_negative:
            selected_indices.append(epoch_index)
            selected_metadata[epoch_index] = {
                "sleep_stage": sleep_stage,
                "cap_a_event_present": 0,
                "cap_label": "no-cap-a-event",
            }

    if len(selected_indices) != len(set(selected_indices)):
        raise RuntimeError("The balanced selection contains duplicate epochs.")

    return sorted(selected_indices), selected_metadata, availability


# ---------------------------------------------------------
# SUBJECT FEATURE EXTRACTION
# ---------------------------------------------------------

def extract_subject_cap_features(edf_path, epochs_per_label_per_stage):
    information = get_subject_information(edf_path)
    annotation_path = edf_path.with_suffix(".txt")

    if information is None:
        raise ValueError(f"Unsupported subject name: {edf_path.stem}")

    if not annotation_path.exists():
        raise FileNotFoundError(f"Annotation missing for {edf_path.name}")

    annotations = parse_sleep_annotations(annotation_path)

    alignment = calculate_annotation_start_offset_seconds(
        edf_path=edf_path,
        annotation_start_time=annotations["recording_start_time"],
    )

    annotation_offset_seconds = float(alignment["offset_seconds"])
    available_aligned_seconds = max(
        0.0,
        float(alignment["edf_duration_seconds"])
        - annotation_offset_seconds,
    )

    total_complete_aligned_epochs = int(
        np.floor(
            available_aligned_seconds / EPOCH_DURATION_SECONDS + 1e-9
        )
    )

    unfiltered_stage_by_epoch = build_stage_by_epoch(annotations)

    excluded_incomplete_epochs = sorted(
        epoch_index
        for epoch_index in unfiltered_stage_by_epoch
        if not (0 <= epoch_index < total_complete_aligned_epochs)
    )

    stage_by_epoch = {
        epoch_index: sleep_stage
        for epoch_index, sleep_stage in unfiltered_stage_by_epoch.items()
        if 0 <= epoch_index < total_complete_aligned_epochs
    }

    cap_events_by_epoch = build_overlapping_cap_events_by_epoch(annotations)

    # Remove CAP mappings outside the complete aligned EEG range.
    cap_events_by_epoch = {
        epoch_index: events
        for epoch_index, events in cap_events_by_epoch.items()
        if 0 <= epoch_index < total_complete_aligned_epochs
    }

    (
        selected_indices,
        selected_metadata,
        availability,
    ) = select_balanced_cap_epochs(
        stage_by_epoch=stage_by_epoch,
        cap_events_by_epoch=cap_events_by_epoch,
        epochs_per_label_per_stage=epochs_per_label_per_stage,
    )

    print("\n" + "=" * 79)
    print(f"SUBJECT: {information['subject_id']}")
    print(f"DIAGNOSIS METADATA: {information['diagnosis']}")
    print(f"EDF start time: {alignment['edf_start_time']}")
    print(f"Annotation start time: {alignment['annotation_start_time']}")
    print(f"Annotation offset: {annotation_offset_seconds:.1f} seconds")
    print(f"Complete aligned epochs: {total_complete_aligned_epochs}")
    print(
        "Incomplete/out-of-range annotation epochs excluded: "
        f"{len(excluded_incomplete_epochs)}"
    )

    for sleep_stage in SELECTED_STAGES:
        print(
            f"Available {sleep_stage}: "
            f"CAP-positive={availability[sleep_stage]['positive']}, "
            f"CAP-negative={availability[sleep_stage]['negative']}"
        )

    print(
        f"Selected per stage: {epochs_per_label_per_stage} positive + "
        f"{epochs_per_label_per_stage} negative"
    )
    print("=" * 79)

    rows = []
    rejected = 0
    start_time = time.time()

    epoch_generator = iterate_sleep_epochs(
        edf_path=edf_path,
        required_channel=MODEL_CHANNEL,
        selected_epoch_indices=selected_indices,
        recording_start_offset_seconds=annotation_offset_seconds,
    )

    try:
        for epoch in epoch_generator:
            epoch_index = epoch["epoch_index"]
            target_metadata = selected_metadata[epoch_index]
            filtered_signal = epoch["filtered_signal_microvolts"]
            quality = evaluate_epoch_quality(filtered_signal)

            if not quality["quality_pass"]:
                rejected += 1
                continue

            features = extract_sleep_epoch_features(
                filtered_signal,
                epoch["processed_sampling_rate"],
            )

            overlapping_events = cap_events_by_epoch.get(epoch_index, [])
            cap_subtypes = sorted(
                {event["event"] for event in overlapping_events},
                key=CAP_EVENT_NAMES.index,
            )
            cap_overlap_seconds = min(
                EPOCH_DURATION_SECONDS,
                sum(event["overlap_seconds"] for event in overlapping_events),
            )

            row = {
                "subject_id": information["subject_id"],
                "diagnosis": information["diagnosis"],
                "diagnosis_label": information["diagnosis_label"],
                "recording_file": edf_path.name,
                "annotation_file": annotation_path.name,
                "epoch_index": epoch_index,
                "edf_epoch_start_seconds": epoch["start_seconds"],
                "annotation_epoch_start_seconds": epoch[
                    "annotation_relative_start_seconds"
                ],
                "annotation_start_offset_seconds": epoch[
                    "recording_start_offset_seconds"
                ],
                "sleep_stage": target_metadata["sleep_stage"],
                "cap_a_event_present": target_metadata[
                    "cap_a_event_present"
                ],
                "cap_label": target_metadata["cap_label"],
                "cap_subtypes": "|".join(cap_subtypes),
                "cap_event_count": len(overlapping_events),
                "cap_overlap_seconds": float(cap_overlap_seconds),
                "channel": epoch["normalized_channel"],
                "original_sampling_rate": epoch["original_sampling_rate"],
                "processed_sampling_rate": epoch["processed_sampling_rate"],
                "quality_pass": True,
                "quality_reason": quality["quality_reason"],
            }

            row.update(features)
            rows.append(row)

    finally:
        epoch_generator.close()

    elapsed = time.time() - start_time
    counts = Counter(
        (row["sleep_stage"], row["cap_a_event_present"])
        for row in rows
    )

    print(f"Accepted rows: {len(rows)}")
    print(f"Rejected rows: {rejected}")

    for sleep_stage in SELECTED_STAGES:
        print(
            f"Accepted {sleep_stage}: "
            f"positive={counts[(sleep_stage, 1)]}, "
            f"negative={counts[(sleep_stage, 0)]}"
        )

    print(f"Time: {elapsed:.1f} seconds")

    expected_rows = (
        len(SELECTED_STAGES) * 2 * epochs_per_label_per_stage
    )

    if len(rows) != expected_rows:
        raise ValueError(
            f"{information['subject_id']} produced {len(rows)} accepted "
            f"rows; {expected_rows} were expected. Quality rejection may "
            "require reserve-epoch selection."
        )

    return rows, rejected


# ---------------------------------------------------------
# DATASET CREATION
# ---------------------------------------------------------

def build_cap_dataset(epochs_per_label_per_stage):
    if not DATA_DIR.exists():
        raise FileNotFoundError(f"Dataset directory not found: {DATA_DIR}")

    edf_files = sorted(
        [
            path
            for path in DATA_DIR.glob("*.edf")
            if get_subject_information(path) is not None
        ],
        key=subject_sort_key,
    )

    if not edf_files:
        raise FileNotFoundError("No supported EDF files were found.")

    all_rows = []
    total_rejected = 0

    for edf_path in edf_files:
        subject_rows, rejected = extract_subject_cap_features(
            edf_path,
            epochs_per_label_per_stage,
        )
        all_rows.extend(subject_rows)
        total_rejected += rejected

    dataframe = pd.DataFrame(all_rows)

    metadata_columns = {
        "subject_id",
        "diagnosis",
        "diagnosis_label",
        "recording_file",
        "annotation_file",
        "epoch_index",
        "edf_epoch_start_seconds",
        "annotation_epoch_start_seconds",
        "annotation_start_offset_seconds",
        "sleep_stage",
        "cap_a_event_present",
        "cap_label",
        "cap_subtypes",
        "cap_event_count",
        "cap_overlap_seconds",
        "channel",
        "original_sampling_rate",
        "processed_sampling_rate",
        "quality_pass",
        "quality_reason",
    }

    feature_columns = [
        column for column in dataframe.columns if column not in metadata_columns
    ]

    feature_values = dataframe[feature_columns].to_numpy(dtype=np.float64)

    if not np.all(np.isfinite(feature_values)):
        raise ValueError("CAP feature dataset contains invalid numerical values.")

    expected_rows_per_subject = (
        len(SELECTED_STAGES) * 2 * epochs_per_label_per_stage
    )
    rows_per_subject = dataframe.groupby("subject_id").size()
    invalid_subjects = rows_per_subject[
        rows_per_subject != expected_rows_per_subject
    ]

    if not invalid_subjects.empty:
        raise ValueError(
            "Some subjects do not have the expected number of rows:\n"
            f"{invalid_subjects}"
        )

    group_counts = dataframe.groupby(
        ["subject_id", "sleep_stage", "cap_a_event_present"]
    ).size()

    if not (group_counts == epochs_per_label_per_stage).all():
        raise ValueError(
            "The final dataset is not balanced by subject, stage, and label."
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dataframe.to_csv(OUTPUT_CSV, index=False)

    schema = {
        "schema_version": 1,
        "dataset_type": "balanced_cap_a_event_epoch_eeg",
        "model_channel": MODEL_CHANNEL,
        "target_column": "cap_a_event_present",
        "target_definition": (
            "1 when an expert-annotated MCAP-A1/A2/A3 event overlaps "
            "the 30-second NREM epoch; otherwise 0."
        ),
        "selected_stages": list(SELECTED_STAGES),
        "epochs_per_label_per_stage_per_subject": epochs_per_label_per_stage,
        "epoch_duration_seconds": EPOCH_DURATION_SECONDS,
        "processed_sampling_rate": TARGET_SAMPLING_RATE,
        "feature_count": len(feature_columns),
        "feature_columns": feature_columns,
        "number_of_rows": len(dataframe),
        "number_of_subjects": int(dataframe["subject_id"].nunique()),
        "total_rejected_epochs": total_rejected,
        "grouping_requirement": (
            "All evaluation splits must group by subject_id."
        ),
        "forbidden_model_inputs": [
            "diagnosis",
            "diagnosis_label",
            "sleep_stage",
            "cap_label",
            "cap_subtypes",
            "cap_event_count",
            "cap_overlap_seconds",
        ],
        "clinical_scope": (
            "Research-only CAP A-event epoch detection. This is not the "
            "official CAP rate and is not a medical diagnosis."
        ),
        "alignment_method": (
            "Forward EDF-to-annotation start offset applied at sample level."
        ),
    }

    with SCHEMA_FILE.open("w", encoding="utf-8") as schema_file:
        json.dump(schema, schema_file, indent=2)

    print("\n" + "=" * 79)
    print("CAP A-EVENT FEATURE DATASET COMPLETED")
    print("=" * 79)
    print(f"Rows: {len(dataframe)}")
    print(f"Subjects: {dataframe['subject_id'].nunique()}")
    print(f"Features: {len(feature_columns)}")
    print(f"Rejected epochs: {total_rejected}")
    print("\nRows by subject, stage, and target:")
    print(group_counts.to_string())
    print(f"\nDataset saved to:\n{OUTPUT_CSV}")
    print(f"\nSchema saved to:\n{SCHEMA_FILE}")


# ---------------------------------------------------------
# COMMAND LINE
# ---------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Create an aligned, subject/stage-balanced CAP A-event "
            "EEG feature dataset."
        )
    )

    parser.add_argument(
        "--epochs-per-label-per-stage",
        type=int,
        default=DEFAULT_EPOCHS_PER_LABEL_PER_STAGE,
        help=(
            "CAP-positive and CAP-negative epochs selected separately "
            "inside N2 and N3 for each subject."
        ),
    )

    arguments = parser.parse_args()
    build_cap_dataset(arguments.epochs_per_label_per_stage)


if __name__ == "__main__":
    main()
