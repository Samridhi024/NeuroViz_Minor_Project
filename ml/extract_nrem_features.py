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

DATA_DIR = (
    PROJECT_ROOT
    / "data"
    / "cap_sleep"
    / "raw"
)

OUTPUT_DIR = (
    PROJECT_ROOT
    / "ml"
    / "artifacts"
)

OUTPUT_CSV = (
    OUTPUT_DIR
    / "nrem_epoch_features.csv"
)

SCHEMA_FILE = (
    OUTPUT_DIR
    / "nrem_feature_schema.json"
)

SELECTED_STAGES = ("N2", "N3")

SUBJECT_PATTERN = re.compile(
    r"^(ins|n)(\d+)$",
    re.IGNORECASE,
)


# ---------------------------------------------------------
# SUBJECT HELPERS
# ---------------------------------------------------------

def get_subject_information(edf_path):
    subject_id = edf_path.stem.lower()
    match = SUBJECT_PATTERN.fullmatch(subject_id)

    if match is None:
        return None

    is_insomnia = (
        match.group(1).lower() == "ins"
    )

    return {
        "subject_id": subject_id,
        "diagnosis": (
            "insomnia"
            if is_insomnia
            else "normal"
        ),
        "diagnosis_label": (
            1 if is_insomnia else 0
        ),
        "number": int(match.group(2)),
    }


def subject_sort_key(edf_path):
    information = get_subject_information(
        edf_path
    )

    class_order = (
        0
        if information["diagnosis"] == "normal"
        else 1
    )

    return class_order, information["number"]


# ---------------------------------------------------------
# EPOCH SELECTION
# ---------------------------------------------------------

def evenly_select_epochs(
    candidate_indices,
    required_count,
):
    """
    Select epochs across the complete night rather
    than taking consecutive epochs from the beginning.
    """

    candidate_indices = sorted(
        set(candidate_indices)
    )

    if len(candidate_indices) < required_count:
        raise ValueError(
            f"Only {len(candidate_indices)} "
            f"candidate epochs are available, but "
            f"{required_count} are required."
        )

    positions = np.linspace(
        0,
        len(candidate_indices) - 1,
        num=required_count,
    )

    positions = np.rint(
        positions
    ).astype(int)

    selected = [
        candidate_indices[position]
        for position in positions
    ]

    if len(set(selected)) != required_count:
        raise RuntimeError(
            "Epoch selection created duplicate indices."
        )

    return selected


def select_stage_balanced_epochs(
    stage_by_epoch,
    epochs_per_stage,
):
    """Select equal numbers of N2 and N3 epochs."""

    selected_indices = []
    selected_stage_lookup = {}

    for sleep_stage in SELECTED_STAGES:
        candidates = [
            epoch_index
            for epoch_index, stage
            in stage_by_epoch.items()
            if stage == sleep_stage
        ]

        selected_for_stage = (
            evenly_select_epochs(
                candidates,
                epochs_per_stage,
            )
        )

        for epoch_index in selected_for_stage:
            selected_indices.append(
                epoch_index
            )

            selected_stage_lookup[
                epoch_index
            ] = sleep_stage

    return (
        sorted(selected_indices),
        selected_stage_lookup,
    )


# ---------------------------------------------------------
# SUBJECT FEATURE EXTRACTION
# ---------------------------------------------------------

def extract_subject_nrem_features(
    edf_path,
    epochs_per_stage,
):
    information = get_subject_information(
        edf_path
    )

    annotation_path = (
        edf_path.with_suffix(".txt")
    )

    if not annotation_path.exists():
        raise FileNotFoundError(
            f"Annotation missing for "
            f"{edf_path.name}"
        )

    annotations = parse_sleep_annotations(
        annotation_path
    )

    alignment = (
        calculate_annotation_start_offset_seconds(
            edf_path=edf_path,
            annotation_start_time=(
                annotations[
                    "recording_start_time"
                ]
            ),
        )
    )

    annotation_offset_seconds = (
        alignment["offset_seconds"]
    )

    stage_by_epoch = build_stage_by_epoch(
        annotations
    )

    available_aligned_seconds = max(
        0.0,
        alignment["edf_duration_seconds"]
        - annotation_offset_seconds,
    )

    total_complete_aligned_epochs = int(
        np.floor(
            available_aligned_seconds
            / EPOCH_DURATION_SECONDS
            + 1e-9
        )
    )

    excluded_incomplete_epochs = sorted(
        epoch_index
        for epoch_index in stage_by_epoch
        if (
            epoch_index < 0
            or epoch_index
            >= total_complete_aligned_epochs
        )
    )

    # Annotation reports can contain a final stage
    # whose 30-second interval extends past the EDF.
    # Exclude it before selecting balanced epochs.
    stage_by_epoch = {
        epoch_index: sleep_stage
        for epoch_index, sleep_stage
        in stage_by_epoch.items()
        if (
            0
            <= epoch_index
            < total_complete_aligned_epochs
        )
    }

    (
        selected_indices,
        stage_lookup,
    ) = select_stage_balanced_epochs(
        stage_by_epoch,
        epochs_per_stage,
    )

    print("\n" + "=" * 75)
    print(
        f"SUBJECT: "
        f"{information['subject_id']}"
    )
    print(
        f"DIAGNOSIS: "
        f"{information['diagnosis']}"
    )
    print(
        f"EDF start time: "
        f"{alignment['edf_start_time']}"
    )
    print(
        f"Annotation start time: "
        f"{alignment['annotation_start_time']}"
    )
    print(
        f"Annotation offset: "
        f"{annotation_offset_seconds:.1f} seconds"
    )
    print(
        f"Complete aligned epochs: "
        f"{total_complete_aligned_epochs}"
    )
    print(
        f"Incomplete/out-of-range annotation "
        f"epochs excluded: "
        f"{len(excluded_incomplete_epochs)}"
    )
    print(
        f"Selected N2 epochs: "
        f"{epochs_per_stage}"
    )
    print(
        f"Selected N3 epochs: "
        f"{epochs_per_stage}"
    )
    print("=" * 75)

    rows = []
    rejected = 0
    start_time = time.time()

    epoch_generator = iterate_sleep_epochs(
        edf_path=edf_path,
        required_channel=MODEL_CHANNEL,
        selected_epoch_indices=(
            selected_indices
        ),
        recording_start_offset_seconds=(
            annotation_offset_seconds
        ),
    )

    try:
        for epoch in epoch_generator:
            epoch_index = epoch["epoch_index"]

            filtered_signal = epoch[
                "filtered_signal_microvolts"
            ]

            quality = evaluate_epoch_quality(
                filtered_signal
            )

            if not quality["quality_pass"]:
                rejected += 1
                continue

            features = (
                extract_sleep_epoch_features(
                    filtered_signal,
                    epoch[
                        "processed_sampling_rate"
                    ],
                )
            )

            row = {
                "subject_id": (
                    information["subject_id"]
                ),
                "diagnosis": (
                    information["diagnosis"]
                ),
                "diagnosis_label": (
                    information[
                        "diagnosis_label"
                    ]
                ),
                "recording_file": edf_path.name,
                "annotation_file": (
                    annotation_path.name
                ),
                "epoch_index": epoch_index,
                "epoch_start_seconds": (
                    epoch["start_seconds"]
                ),
                "annotation_epoch_start_seconds": (
                    epoch[
                        "annotation_relative_start_seconds"
                    ]
                ),
                "annotation_start_offset_seconds": (
                    epoch[
                        "recording_start_offset_seconds"
                    ]
                ),
                "sleep_stage": (
                    stage_lookup[epoch_index]
                ),
                "channel": (
                    epoch[
                        "normalized_channel"
                    ]
                ),
                "original_sampling_rate": (
                    epoch[
                        "original_sampling_rate"
                    ]
                ),
                "processed_sampling_rate": (
                    epoch[
                        "processed_sampling_rate"
                    ]
                ),
                "quality_pass": True,
                "quality_reason": (
                    quality["quality_reason"]
                ),
            }

            row.update(features)
            rows.append(row)

    finally:
        epoch_generator.close()

    elapsed = time.time() - start_time

    stage_counts = Counter(
        row["sleep_stage"]
        for row in rows
    )

    print(f"Accepted rows: {len(rows)}")
    print(f"Rejected rows: {rejected}")
    print(f"Accepted N2: {stage_counts['N2']}")
    print(f"Accepted N3: {stage_counts['N3']}")
    print(f"Time: {elapsed:.1f} seconds")

    return rows, rejected


# ---------------------------------------------------------
# DATASET CREATION
# ---------------------------------------------------------

def build_nrem_dataset(epochs_per_stage):
    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"Dataset directory not found: "
            f"{DATA_DIR}"
        )

    edf_files = sorted(
        [
            path
            for path in DATA_DIR.glob("*.edf")
            if get_subject_information(path)
            is not None
        ],
        key=subject_sort_key,
    )

    if not edf_files:
        raise FileNotFoundError(
            "No supported EDF files were found."
        )

    all_rows = []
    total_rejected = 0

    for edf_path in edf_files:
        subject_rows, rejected = (
            extract_subject_nrem_features(
                edf_path,
                epochs_per_stage,
            )
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
        "epoch_start_seconds",
        "annotation_epoch_start_seconds",
        "annotation_start_offset_seconds",
        "sleep_stage",
        "channel",
        "original_sampling_rate",
        "processed_sampling_rate",
        "quality_pass",
        "quality_reason",
    }

    feature_columns = [
        column
        for column in dataframe.columns
        if column not in metadata_columns
    ]

    feature_values = dataframe[
        feature_columns
    ].to_numpy(dtype=np.float64)

    if not np.all(np.isfinite(feature_values)):
        raise ValueError(
            "NREM feature dataset contains "
            "invalid numerical values."
        )

    subject_stage_counts = (
        dataframe
        .groupby(
            [
                "subject_id",
                "diagnosis",
                "sleep_stage",
            ]
        )
        .size()
    )

    expected_per_subject = (
        epochs_per_stage
        * len(SELECTED_STAGES)
    )

    rows_per_subject = (
        dataframe
        .groupby("subject_id")
        .size()
    )

    invalid_subjects = rows_per_subject[
        rows_per_subject
        != expected_per_subject
    ]

    if not invalid_subjects.empty:
        raise ValueError(
            "Some subjects do not have the expected "
            "number of accepted epochs:\n"
            f"{invalid_subjects}"
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    dataframe.to_csv(
        OUTPUT_CSV,
        index=False,
    )

    schema = {
        "schema_version": 3,
        "dataset_type": (
            "stage_balanced_nrem_eeg"
        ),
        "model_channel": MODEL_CHANNEL,
        "selected_stages": list(
            SELECTED_STAGES
        ),
        "epochs_per_stage_per_subject": (
            epochs_per_stage
        ),
        "epoch_duration_seconds": (
            EPOCH_DURATION_SECONDS
        ),
        "processed_sampling_rate": (
            TARGET_SAMPLING_RATE
        ),
        "feature_count": len(
            feature_columns
        ),
        "feature_columns": feature_columns,
        "number_of_rows": len(dataframe),
        "number_of_subjects": int(
            dataframe[
                "subject_id"
            ].nunique()
        ),
        "total_rejected_epochs": (
            total_rejected
        ),
        "annotation_usage": (
            "Annotations select N2/N3 epochs only. "
            "EDF samples are shifted by the exact "
            "annotation-start offset. CAP event "
            "values are not model inputs."
        ),
        "alignment_method": (
            "Forward time-of-day difference between "
            "the EDF header start and the first "
            "sleep-stage annotation, applied at "
            "sample level."
        ),
    }

    with SCHEMA_FILE.open(
        "w",
        encoding="utf-8",
    ) as schema_file:
        json.dump(
            schema,
            schema_file,
            indent=2,
        )

    print("\n" + "=" * 75)
    print("NREM FEATURE DATASET COMPLETED")
    print("=" * 75)
    print(f"Rows: {len(dataframe)}")
    print(
        f"Subjects: "
        f"{dataframe['subject_id'].nunique()}"
    )
    print(
        f"Features: "
        f"{len(feature_columns)}"
    )
    print(
        f"Rejected epochs: "
        f"{total_rejected}"
    )

    print("\nRows by subject and stage:")
    print(subject_stage_counts.to_string())

    print(
        f"\nDataset saved to:\n"
        f"{OUTPUT_CSV}"
    )

    print(
        f"\nSchema saved to:\n"
        f"{SCHEMA_FILE}"
    )


# ---------------------------------------------------------
# COMMAND LINE
# ---------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Create a stage-balanced NREM "
            "EEG feature dataset."
        )
    )

    parser.add_argument(
        "--epochs-per-stage",
        type=int,
        default=120,
        help=(
            "Number of N2 and N3 epochs "
            "selected per subject."
        ),
    )

    arguments = parser.parse_args()

    build_nrem_dataset(
        epochs_per_stage=(
            arguments.epochs_per_stage
        )
    )


if __name__ == "__main__":
    main()
