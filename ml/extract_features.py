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
# IMPORT BACKEND PROCESSING MODULES
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sleep_preprocessing import (
    EPOCH_DURATION_SECONDS,
    MODEL_CHANNEL,
    TARGET_SAMPLING_RATE,
    iterate_sleep_epochs,
)

from sleep_features import (
    evaluate_epoch_quality,
    extract_sleep_epoch_features,
)


# ---------------------------------------------------------
# FILE PATHS
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
    / "epoch_features.csv"
)

SCHEMA_FILE = (
    OUTPUT_DIR
    / "feature_schema.json"
)


# ---------------------------------------------------------
# SUBJECT LABELS
# ---------------------------------------------------------

SUBJECT_PATTERN = re.compile(
    r"^(ins|n)(\d+)$",
    re.IGNORECASE,
)


def get_subject_information(edf_path):
    """
    Extract the subject and diagnosis from the filename.

    ins1 -> insomnia, label 1
    n1   -> normal, label 0
    """

    subject_id = edf_path.stem.lower()

    match = SUBJECT_PATTERN.fullmatch(
        subject_id
    )

    if not match:
        return None

    prefix = match.group(1).lower()

    if prefix == "ins":
        diagnosis = "insomnia"
        diagnosis_label = 1
    else:
        diagnosis = "normal"
        diagnosis_label = 0

    return {
        "subject_id": subject_id,
        "diagnosis": diagnosis,
        "diagnosis_label": diagnosis_label,
    }


def subject_sort_key(edf_path):
    """Sort normal and insomnia files numerically."""

    information = get_subject_information(
        edf_path
    )

    if information is None:
        return 99, 99

    match = SUBJECT_PATTERN.fullmatch(
        information["subject_id"]
    )

    prefix = match.group(1).lower()
    number = int(match.group(2))

    class_order = 0 if prefix == "n" else 1

    return class_order, number


# ---------------------------------------------------------
# SUBJECT PROCESSING
# ---------------------------------------------------------

def extract_subject_features(
    edf_path,
    maximum_epochs,
    minimum_recording_hours,
):
    """Extract feature rows from one EDF recording."""

    subject_information = (
        get_subject_information(edf_path)
    )

    if subject_information is None:
        print(
            f"Skipping unsupported filename: "
            f"{edf_path.name}"
        )
        return [], 0

    annotation_path = (
        edf_path.with_suffix(".txt")
    )

    print("\n" + "=" * 78)
    print(
        f"SUBJECT: "
        f"{subject_information['subject_id']}"
    )
    print(
        f"CLASS:   "
        f"{subject_information['diagnosis']}"
    )
    print(
        f"EDF:     {edf_path.name}"
    )
    print(
        f"ANNOTATION: "
        f"{annotation_path.exists()}"
    )
    print("=" * 78)

    if not annotation_path.exists():
        print(
            "WARNING: Corresponding annotation "
            "file was not found."
        )

    subject_rows = []
    rejected_epochs = 0
    start_time = time.time()

    epoch_generator = iterate_sleep_epochs(
        edf_path=edf_path,
        required_channel=MODEL_CHANNEL,
        minimum_recording_hours=(
            minimum_recording_hours
        ),
    )

    try:
        for epoch in epoch_generator:
            filtered_signal = epoch[
                "filtered_signal_microvolts"
            ]

            quality = evaluate_epoch_quality(
                filtered_signal
            )

            if not quality["quality_pass"]:
                rejected_epochs += 1
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
                    subject_information[
                        "subject_id"
                    ]
                ),
                "diagnosis": (
                    subject_information[
                        "diagnosis"
                    ]
                ),
                "diagnosis_label": (
                    subject_information[
                        "diagnosis_label"
                    ]
                ),
                "recording_file": edf_path.name,
                "annotation_found": (
                    annotation_path.exists()
                ),
                "epoch_index": (
                    epoch["epoch_index"]
                ),
                "epoch_start_seconds": (
                    epoch["start_seconds"]
                ),
                "epoch_end_seconds": (
                    epoch["end_seconds"]
                ),
                "channel": (
                    epoch["normalized_channel"]
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
            subject_rows.append(row)

            accepted_count = len(subject_rows)

            if accepted_count % 100 == 0:
                elapsed = time.time() - start_time

                print(
                    f"Accepted epochs: "
                    f"{accepted_count} | "
                    f"Rejected: "
                    f"{rejected_epochs} | "
                    f"Elapsed: "
                    f"{elapsed:.1f}s"
                )

            if (
                maximum_epochs is not None
                and accepted_count
                >= maximum_epochs
            ):
                break

    finally:
        epoch_generator.close()

    elapsed = time.time() - start_time

    print(
        f"\nCompleted "
        f"{subject_information['subject_id']}"
    )
    print(
        f"Accepted epochs: "
        f"{len(subject_rows)}"
    )
    print(
        f"Rejected epochs: "
        f"{rejected_epochs}"
    )
    print(
        f"Processing time: "
        f"{elapsed:.1f} seconds"
    )

    return subject_rows, rejected_epochs


# ---------------------------------------------------------
# COMPLETE DATASET EXTRACTION
# ---------------------------------------------------------

def build_feature_dataset(
    maximum_epochs_per_subject,
    minimum_recording_hours,
):
    """Build the epoch-level ML training dataset."""

    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"Dataset directory not found:\n"
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
            f"No supported EDF recordings "
            f"were found in:\n{DATA_DIR}"
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("=" * 78)
    print("NEUROVIZ SLEEP FEATURE DATASET")
    print("=" * 78)
    print(f"Dataset directory: {DATA_DIR}")
    print(f"EDF recordings: {len(edf_files)}")
    print(
        f"Maximum epochs per subject: "
        f"{maximum_epochs_per_subject}"
    )
    print(
        f"Minimum recording duration: "
        f"{minimum_recording_hours} hours"
    )
    print(f"Model channel: {MODEL_CHANNEL}")
    print(
        f"Processed sampling rate: "
        f"{TARGET_SAMPLING_RATE} Hz"
    )

    all_rows = []
    processing_errors = []
    total_rejected = 0

    for edf_path in edf_files:
        try:
            subject_rows, rejected_count = (
                extract_subject_features(
                    edf_path=edf_path,
                    maximum_epochs=(
                        maximum_epochs_per_subject
                    ),
                    minimum_recording_hours=(
                        minimum_recording_hours
                    ),
                )
            )

            all_rows.extend(subject_rows)
            total_rejected += rejected_count

        except Exception as error:
            error_message = (
                f"{edf_path.name}: {error}"
            )

            processing_errors.append(
                error_message
            )

            print(
                f"\nERROR processing "
                f"{edf_path.name}"
            )
            print(error)

    if not all_rows:
        raise RuntimeError(
            "No valid feature rows were generated."
        )

    dataframe = pd.DataFrame(all_rows)

    metadata_columns = {
        "subject_id",
        "diagnosis",
        "diagnosis_label",
        "recording_file",
        "annotation_found",
        "epoch_index",
        "epoch_start_seconds",
        "epoch_end_seconds",
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

    # Confirm every feature used by ML is numeric
    for column in feature_columns:
        dataframe[column] = pd.to_numeric(
            dataframe[column],
            errors="coerce",
        )

    invalid_feature_count = int(
        dataframe[feature_columns]
        .isna()
        .sum()
        .sum()
    )

    if invalid_feature_count > 0:
        raise ValueError(
            f"Generated features contain "
            f"{invalid_feature_count} invalid values."
        )

    numeric_values = dataframe[
        feature_columns
    ].to_numpy(dtype=np.float64)

    if not np.all(np.isfinite(numeric_values)):
        raise ValueError(
            "Generated features contain "
            "infinite values."
        )

    subject_class_table = (
        dataframe[
            [
                "subject_id",
                "diagnosis",
                "diagnosis_label",
            ]
        ]
        .drop_duplicates()
        .sort_values("subject_id")
    )

    subject_class_counts = Counter(
        subject_class_table["diagnosis"]
    )

    if len(subject_class_counts) < 2:
        raise ValueError(
            "Both normal and insomnia subjects "
            "are required."
        )

    dataframe.to_csv(
        OUTPUT_CSV,
        index=False,
    )

    schema = {
        "schema_version": 1,
        "model_channel": MODEL_CHANNEL,
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
        "metadata_columns": sorted(
            metadata_columns
        ),
        "number_of_rows": len(dataframe),
        "number_of_subjects": int(
            dataframe["subject_id"].nunique()
        ),
        "subject_class_counts": dict(
            subject_class_counts
        ),
        "maximum_epochs_per_subject": (
            maximum_epochs_per_subject
        ),
        "minimum_recording_hours": (
            minimum_recording_hours
        ),
        "total_rejected_epochs": (
            total_rejected
        ),
        "processing_errors": (
            processing_errors
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

    print("\n" + "=" * 78)
    print("FEATURE DATASET COMPLETED")
    print("=" * 78)
    print(
        f"Rows generated: "
        f"{len(dataframe)}"
    )
    print(
        f"Subjects: "
        f"{dataframe['subject_id'].nunique()}"
    )
    print(
        f"Feature columns: "
        f"{len(feature_columns)}"
    )
    print(
        f"Rejected epochs: "
        f"{total_rejected}"
    )

    print("\nRows by subject:")

    rows_by_subject = (
        dataframe
        .groupby(
            [
                "subject_id",
                "diagnosis",
            ]
        )
        .size()
    )

    print(rows_by_subject.to_string())

    if processing_errors:
        print("\nProcessing errors:")

        for error in processing_errors:
            print(f"  - {error}")

    print(
        f"\nTraining CSV saved to:\n"
        f"{OUTPUT_CSV}"
    )

    print(
        f"\nFeature schema saved to:\n"
        f"{SCHEMA_FILE}"
    )


# ---------------------------------------------------------
# COMMAND-LINE INTERFACE
# ---------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Extract sleep EEG training features "
            "from CAP EDF recordings."
        )
    )

    parser.add_argument(
        "--max-epochs-per-subject",
        type=int,
        default=120,
        help=(
            "Maximum accepted epochs extracted "
            "from each subject. Use 0 for all epochs."
        ),
    )

    parser.add_argument(
        "--minimum-hours",
        type=float,
        default=4.0,
        help=(
            "Reject incomplete recordings shorter "
            "than this duration."
        ),
    )

    arguments = parser.parse_args()

    maximum_epochs = (
        None
        if arguments.max_epochs_per_subject == 0
        else arguments.max_epochs_per_subject
    )

    build_feature_dataset(
        maximum_epochs_per_subject=(
            maximum_epochs
        ),
        minimum_recording_hours=(
            arguments.minimum_hours
        ),
    )


if __name__ == "__main__":
    main()