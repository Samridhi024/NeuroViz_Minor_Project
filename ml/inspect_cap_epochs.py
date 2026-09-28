from pathlib import Path
import argparse
import re
import sys

import mne
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
    time_to_seconds,
)

from sleep_preprocessing import (
    EPOCH_DURATION_SECONDS,
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
    / "cap_epoch_inventory.csv"
)

SELECTED_STAGES = (
    "N2",
    "N3",
)

CAP_EVENT_NAMES = {
    "MCAP-A1",
    "MCAP-A2",
    "MCAP-A3",
}

SUBJECT_PATTERN = re.compile(
    r"^(ins|n)(\d+)$",
    re.IGNORECASE,
)


# ---------------------------------------------------------
# SUBJECT HELPERS
# ---------------------------------------------------------

def get_subject_information(edf_path):
    subject_id = Path(edf_path).stem.lower()

    match = SUBJECT_PATTERN.fullmatch(
        subject_id
    )

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

    return (
        class_order,
        information["number"],
    )


# ---------------------------------------------------------
# TIMELINE VALIDATION
# ---------------------------------------------------------

def circular_time_difference_seconds(
    first_seconds,
    second_seconds,
):
    """
    Find the shortest difference between two
    times of day while handling midnight.
    """

    difference = abs(
        float(first_seconds)
        - float(second_seconds)
    )

    return min(
        difference,
        24 * 3600 - difference,
    )


def inspect_edf_timeline(
    edf_path,
    annotation_start_time,
):
    """
    Read only the EDF header and compare the
    EDF start time with the annotation start.
    """

    raw = mne.io.read_raw_edf(
        edf_path,
        preload=False,
        verbose="ERROR",
    )

    try:
        sampling_rate = float(
            raw.info["sfreq"]
        )

        duration_seconds = float(
            raw.n_times / sampling_rate
        )

        total_complete_epochs = int(
            duration_seconds
            // EPOCH_DURATION_SECONDS
        )

        measurement_date = raw.info.get(
            "meas_date"
        )

        edf_start_time = None
        start_difference_seconds = None

        if measurement_date is not None:
            edf_start_time = (
                measurement_date.strftime(
                    "%H:%M:%S"
                )
            )

            start_difference_seconds = (
                circular_time_difference_seconds(
                    time_to_seconds(
                        edf_start_time
                    ),
                    time_to_seconds(
                        annotation_start_time
                    ),
                )
            )

        return {
            "sampling_rate": sampling_rate,
            "duration_seconds": (
                duration_seconds
            ),
            "total_complete_epochs": (
                total_complete_epochs
            ),
            "edf_start_time": edf_start_time,
            "start_difference_seconds": (
                start_difference_seconds
            ),
        }

    finally:
        raw.close()


# ---------------------------------------------------------
# CAP-TO-EPOCH ALIGNMENT
# ---------------------------------------------------------

def build_overlapping_cap_events_by_epoch(
    annotation_result,
):
    """
    Map CAP A events to every 30-second epoch
    that they overlap.

    This is more accurate than considering only
    the epoch in which the event starts.
    """

    cap_events_by_epoch = {}

    for event in annotation_result[
        "cap_events"
    ]:
        event_name = event["event"]

        if event_name not in CAP_EVENT_NAMES:
            continue

        event_start = float(
            event["relative_start_seconds"]
        )

        event_end = float(
            event["relative_end_seconds"]
        )

        if event_end <= 0:
            continue

        first_epoch = max(
            0,
            int(
                event_start
                // EPOCH_DURATION_SECONDS
            ),
        )

        # Subtract a tiny value so that an event ending
        # exactly on a boundary is not added to the
        # following epoch.
        last_epoch = max(
            first_epoch,
            int(
                (event_end - 1e-9)
                // EPOCH_DURATION_SECONDS
            ),
        )

        for epoch_index in range(
            first_epoch,
            last_epoch + 1,
        ):
            epoch_start = (
                epoch_index
                * EPOCH_DURATION_SECONDS
            )

            epoch_end = (
                epoch_start
                + EPOCH_DURATION_SECONDS
            )

            overlap_start = max(
                epoch_start,
                event_start,
            )

            overlap_end = min(
                epoch_end,
                event_end,
            )

            overlap_seconds = max(
                0.0,
                overlap_end - overlap_start,
            )

            if overlap_seconds <= 0:
                continue

            if epoch_index not in cap_events_by_epoch:
                cap_events_by_epoch[
                    epoch_index
                ] = []

            cap_events_by_epoch[
                epoch_index
            ].append(
                {
                    "event": event_name,
                    "overlap_seconds": (
                        overlap_seconds
                    ),
                }
            )

    return cap_events_by_epoch


# ---------------------------------------------------------
# SUBJECT INSPECTION
# ---------------------------------------------------------

def inspect_subject(edf_path):
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

    stage_by_epoch = build_stage_by_epoch(
        annotations
    )

    cap_by_epoch = (
        build_overlapping_cap_events_by_epoch(
            annotations
        )
    )

    timeline = inspect_edf_timeline(
        edf_path,
        annotations[
            "recording_start_time"
        ],
    )

    total_edf_epochs = timeline[
        "total_complete_epochs"
    ]

    valid_stage_by_epoch = {
        epoch_index: stage
        for epoch_index, stage
        in stage_by_epoch.items()
        if (
            0
            <= epoch_index
            < total_edf_epochs
        )
    }

    out_of_bounds_stage_epochs = (
        len(stage_by_epoch)
        - len(valid_stage_by_epoch)
    )

    rows = []

    for sleep_stage in SELECTED_STAGES:
        stage_indices = {
            epoch_index
            for epoch_index, stage
            in valid_stage_by_epoch.items()
            if stage == sleep_stage
        }

        cap_positive_indices = (
            stage_indices.intersection(
                cap_by_epoch.keys()
            )
        )

        cap_negative_indices = (
            stage_indices.difference(
                cap_by_epoch.keys()
            )
        )

        total_stage_epochs = len(
            stage_indices
        )

        positive_fraction = (
            len(cap_positive_indices)
            / total_stage_epochs
            if total_stage_epochs
            else 0.0
        )

        rows.append(
            {
                "subject_id": (
                    information["subject_id"]
                ),
                "diagnosis": (
                    information["diagnosis"]
                ),
                "sleep_stage": sleep_stage,
                "cap_positive_epochs": len(
                    cap_positive_indices
                ),
                "cap_negative_epochs": len(
                    cap_negative_indices
                ),
                "total_stage_epochs": (
                    total_stage_epochs
                ),
                "cap_positive_fraction": (
                    positive_fraction
                ),
                "edf_start_time": timeline[
                    "edf_start_time"
                ],
                "annotation_start_time": (
                    annotations[
                        "recording_start_time"
                    ]
                ),
                "start_difference_seconds": (
                    timeline[
                        "start_difference_seconds"
                    ]
                ),
                "total_edf_epochs": (
                    total_edf_epochs
                ),
                "out_of_bounds_stage_epochs": (
                    out_of_bounds_stage_epochs
                ),
                "unparsed_event_lines": len(
                    annotations[
                        "unparsed_event_lines"
                    ]
                ),
            }
        )

    return rows


# ---------------------------------------------------------
# COMPLETE INVENTORY
# ---------------------------------------------------------

def build_inventory(
    data_directory,
    output_csv,
):
    if not data_directory.exists():
        raise FileNotFoundError(
            f"Dataset directory not found: "
            f"{data_directory}"
        )

    edf_files = sorted(
        [
            path
            for path
            in data_directory.glob("*.edf")
            if get_subject_information(path)
            is not None
        ],
        key=subject_sort_key,
    )

    if not edf_files:
        raise FileNotFoundError(
            "No supported EDF recordings "
            "were found."
        )

    all_rows = []
    failures = []

    for edf_path in edf_files:
        print(
            f"Inspecting "
            f"{edf_path.stem}..."
        )

        try:
            rows = inspect_subject(
                edf_path
            )

            all_rows.extend(rows)

        except Exception as error:
            failures.append(
                {
                    "subject_id": (
                        edf_path.stem.lower()
                    ),
                    "error": str(error),
                }
            )

            print(
                f"  FAILED: {error}"
            )

    if not all_rows:
        raise RuntimeError(
            "No CAP epoch inventories "
            "were generated."
        )

    dataframe = pd.DataFrame(
        all_rows
    )

    output_csv.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    dataframe.to_csv(
        output_csv,
        index=False,
    )

    print("\n" + "=" * 105)
    print("CAP A-EVENT EPOCH INVENTORY")
    print("=" * 105)

    display_columns = [
        "subject_id",
        "diagnosis",
        "sleep_stage",
        "cap_positive_epochs",
        "cap_negative_epochs",
        "cap_positive_fraction",
        "start_difference_seconds",
        "out_of_bounds_stage_epochs",
    ]

    print(
        dataframe[
            display_columns
        ].to_string(
            index=False,
            float_format=(
                lambda value: f"{value:.3f}"
            ),
        )
    )

    print(
        "\nMinimum available epochs "
        "across every subject:"
    )

    minimum_counts = (
        dataframe
        .groupby("sleep_stage")[
            [
                "cap_positive_epochs",
                "cap_negative_epochs",
            ]
        ]
        .min()
    )

    print(
        minimum_counts.to_string()
    )

    missing_edf_start = (
        dataframe[
            "edf_start_time"
        ]
        .isna()
        .any()
    )

    known_differences = (
        dataframe[
            "start_difference_seconds"
        ]
        .dropna()
    )

    maximum_difference = (
        float(
            known_differences.max()
        )
        if not known_differences.empty
        else None
    )

    maximum_out_of_bounds = int(
        dataframe[
            "out_of_bounds_stage_epochs"
        ].max()
    )

    maximum_unparsed = int(
        dataframe[
            "unparsed_event_lines"
        ].max()
    )

    print("\nTimeline validation:")
    print(
        f"  EDF start time unavailable: "
        f"{missing_edf_start}"
    )
    print(
        f"  Maximum known start difference: "
        f"{maximum_difference}"
    )
    print(
        f"  Maximum out-of-bounds stage "
        f"epochs: {maximum_out_of_bounds}"
    )
    print(
        f"  Maximum unparsed event lines: "
        f"{maximum_unparsed}"
    )

    if failures:
        print("\nFailures:")

        for failure in failures:
            print(
                f"  {failure['subject_id']}: "
                f"{failure['error']}"
            )

    print(
        f"\nInventory saved to:\n"
        f"{output_csv}"
    )


# ---------------------------------------------------------
# COMMAND LINE
# ---------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Inspect N2/N3 epochs with and "
            "without overlapping CAP A events."
        )
    )

    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DATA_DIR,
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_CSV,
    )

    arguments = parser.parse_args()

    build_inventory(
        data_directory=(
            arguments.data_dir.resolve()
        ),
        output_csv=(
            arguments.output.resolve()
        ),
    )


if __name__ == "__main__":
    main()