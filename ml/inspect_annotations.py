from pathlib import Path
import re
import sys

import pandas as pd


# ---------------------------------------------------------
# IMPORT BACKEND ANNOTATION MODULE
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sleep_annotations import (
    build_cap_events_by_epoch,
    parse_sleep_annotations,
    summarize_annotations,
)


# ---------------------------------------------------------
# PATHS
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

OUTPUT_FILE = (
    OUTPUT_DIR
    / "annotation_inventory.csv"
)


SUBJECT_PATTERN = re.compile(
    r"^(ins|n)(\d+)$",
    re.IGNORECASE,
)


def get_subject_details(txt_path):
    """Get subject diagnosis from its filename."""

    subject_id = txt_path.stem.lower()

    match = SUBJECT_PATTERN.fullmatch(
        subject_id
    )

    if not match:
        return None

    diagnosis = (
        "insomnia"
        if match.group(1).lower() == "ins"
        else "normal"
    )

    return {
        "subject_id": subject_id,
        "diagnosis": diagnosis,
        "number": int(match.group(2)),
    }


def annotation_sort_key(txt_path):
    details = get_subject_details(txt_path)

    if details is None:
        return 99, 99

    class_order = (
        0
        if details["diagnosis"] == "normal"
        else 1
    )

    return class_order, details["number"]


def inspect_all_annotations():
    """Inspect every normal/insomnia annotation."""

    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"Dataset folder not found:\n{DATA_DIR}"
        )

    annotation_files = sorted(
        [
            path
            for path in DATA_DIR.glob("*.txt")
            if get_subject_details(path)
            is not None
        ],
        key=annotation_sort_key,
    )

    if not annotation_files:
        raise FileNotFoundError(
            "No supported annotation files found."
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    rows = []

    for annotation_path in annotation_files:
        details = get_subject_details(
            annotation_path
        )

        print(
            f"Inspecting "
            f"{annotation_path.name}..."
        )

        try:
            result = parse_sleep_annotations(
                annotation_path
            )

            summary = summarize_annotations(
                result
            )

            cap_by_epoch = (
                build_cap_events_by_epoch(
                    result
                )
            )

            stage_counts = summary[
                "stage_counts"
            ]

            cap_counts = summary[
                "cap_event_counts"
            ]

            cap_durations = summary[
                "cap_a_duration_seconds"
            ]

            total_stage_epochs = len(
                result["sleep_stage_events"]
            )

            row = {
                "subject_id": (
                    details["subject_id"]
                ),
                "diagnosis": (
                    details["diagnosis"]
                ),
                "recording_start_time": (
                    result[
                        "recording_start_time"
                    ]
                ),
                "total_stage_epochs": (
                    total_stage_epochs
                ),
                "annotation_hours": round(
                    total_stage_epochs
                    * 30
                    / 3600,
                    3,
                ),
                "wake_epochs": (
                    stage_counts.get("W", 0)
                ),
                "n1_epochs": (
                    stage_counts.get("N1", 0)
                ),
                "n2_epochs": (
                    stage_counts.get("N2", 0)
                ),
                "n3_epochs": (
                    stage_counts.get("N3", 0)
                ),
                "rem_epochs": (
                    stage_counts.get("REM", 0)
                ),
                "unscored_epochs": (
                    stage_counts.get(
                        "UNSCORED",
                        0,
                    )
                ),
                "nrem_epochs": (
                    summary["nrem_epochs"]
                ),
                "cap_a1_count": (
                    cap_counts.get(
                        "MCAP-A1",
                        0,
                    )
                ),
                "cap_a2_count": (
                    cap_counts.get(
                        "MCAP-A2",
                        0,
                    )
                ),
                "cap_a3_count": (
                    cap_counts.get(
                        "MCAP-A3",
                        0,
                    )
                ),
                "cap_a1_duration_seconds": (
                    cap_durations.get(
                        "MCAP-A1",
                        0.0,
                    )
                ),
                "cap_a2_duration_seconds": (
                    cap_durations.get(
                        "MCAP-A2",
                        0.0,
                    )
                ),
                "cap_a3_duration_seconds": (
                    cap_durations.get(
                        "MCAP-A3",
                        0.0,
                    )
                ),
                "epochs_with_cap_events": (
                    len(cap_by_epoch)
                ),
                "alignment_errors": (
                    summary[
                        "alignment_error_count"
                    ]
                ),
                "unparsed_event_lines": (
                    summary[
                        "unparsed_event_line_count"
                    ]
                ),
                "status": "success",
            }

        except Exception as error:
            row = {
                "subject_id": (
                    details["subject_id"]
                ),
                "diagnosis": (
                    details["diagnosis"]
                ),
                "status": f"error: {error}",
            }

        rows.append(row)

    dataframe = pd.DataFrame(rows)

    dataframe.to_csv(
        OUTPUT_FILE,
        index=False,
    )

    display_columns = [
        "subject_id",
        "diagnosis",
        "annotation_hours",
        "wake_epochs",
        "n1_epochs",
        "n2_epochs",
        "n3_epochs",
        "rem_epochs",
        "nrem_epochs",
        "cap_a1_count",
        "cap_a2_count",
        "cap_a3_count",
        "alignment_errors",
        "unparsed_event_lines",
        "status",
    ]

    available_display_columns = [
        column
        for column in display_columns
        if column in dataframe.columns
    ]

    print("\n" + "=" * 120)
    print("ANNOTATION INVENTORY")
    print("=" * 120)

    print(
        dataframe[
            available_display_columns
        ].to_string(index=False)
    )

    successful = dataframe[
        dataframe["status"] == "success"
    ]

    print("\n" + "=" * 120)
    print("MINIMUM AVAILABLE EPOCHS")
    print("=" * 120)

    if not successful.empty:
        print(
            f"Minimum N1 epochs: "
            f"{int(successful['n1_epochs'].min())}"
        )
        print(
            f"Minimum N2 epochs: "
            f"{int(successful['n2_epochs'].min())}"
        )
        print(
            f"Minimum N3 epochs: "
            f"{int(successful['n3_epochs'].min())}"
        )
        print(
            f"Minimum total NREM epochs: "
            f"{int(successful['nrem_epochs'].min())}"
        )

    print(
        f"\nInventory saved to:\n"
        f"{OUTPUT_FILE}"
    )


if __name__ == "__main__":
    inspect_all_annotations()