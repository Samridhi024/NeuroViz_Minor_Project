from collections import Counter, defaultdict
from pathlib import Path
import argparse
import re


# ---------------------------------------------------------
# EVENT AND STAGE DEFINITIONS
# ---------------------------------------------------------

EVENT_PATTERN = re.compile(
    r"^\s*"
    r"(?P<header_stage>\S+)"
    r"\s+"
    r"(?:(?P<position>.*?)\s+)?"
    r"(?P<time>\d{1,2}:\d{2}:\d{2})"
    r"\s+"
    r"(?P<event>SLEEP-[A-Z0-9]+|MCAP-A[123])"
    r"\s+"
    r"(?P<duration>\d+(?:\.\d+)?)"
    r"\s+"
    r"(?P<location>.+?)"
    r"\s*$",
    re.IGNORECASE,
)


STAGE_MAPPING = {
    "SLEEP-S0": "W",
    "SLEEP-S1": "N1",
    "SLEEP-S2": "N2",

    # CAP uses the older R&K S3/S4 division.
    # Both correspond to modern deep N3 sleep.
    "SLEEP-S3": "N3",
    "SLEEP-S4": "N3",

    "SLEEP-REM": "REM",
    "SLEEP-UNSCORED": "UNSCORED",
}


NREM_STAGES = {
    "N1",
    "N2",
    "N3",
}


# ---------------------------------------------------------
# TIME CONVERSION
# ---------------------------------------------------------

def time_to_seconds(time_text):
    """Convert hh:mm:ss into seconds since midnight."""

    hour, minute, second = [
        int(part)
        for part in time_text.split(":")
    ]

    return (
        hour * 3600
        + minute * 60
        + second
    )


def unwrap_event_times(events):
    """
    Make event times continuous when a recording crosses midnight.

    Example:
        23:59:58 -> 86398
        00:00:28 -> 86428
    """

    day_offset = 0
    previous_seconds = None

    for event in events:
        seconds_of_day = time_to_seconds(
            event["time"]
        )

        continuous_seconds = (
            seconds_of_day + day_offset
        )

        # A large backwards jump means midnight passed.
        if (
            previous_seconds is not None
            and continuous_seconds
            < previous_seconds - 12 * 3600
        ):
            day_offset += 24 * 3600

            continuous_seconds = (
                seconds_of_day + day_offset
            )

        event["continuous_seconds"] = (
            continuous_seconds
        )

        previous_seconds = continuous_seconds


# ---------------------------------------------------------
# ANNOTATION PARSING
# ---------------------------------------------------------

def parse_sleep_annotations(annotation_path):
    """Parse a CAP RemLogic TXT annotation file."""

    annotation_path = Path(annotation_path)

    if not annotation_path.exists():
        raise FileNotFoundError(
            f"Annotation file was not found: "
            f"{annotation_path}"
        )

    patient_name = None
    recording_date = None
    table_started = False

    events = []
    unparsed_event_lines = []

    with annotation_path.open(
        "r",
        encoding="utf-8",
        errors="replace",
    ) as annotation_file:

        for line_number, original_line in enumerate(
            annotation_file,
            start=1,
        ):
            line = original_line.strip()

            if line.lower().startswith("patient:"):
                patient_name = line.split(
                    ":",
                    maxsplit=1,
                )[1].strip()

            if line.lower().startswith(
                "recording date:"
            ):
                recording_date = line.split(
                    ":",
                    maxsplit=1,
                )[1].strip()

            if (
                line.lower().startswith(
                    "sleep stage"
                )
                and "time" in line.lower()
                and "event" in line.lower()
            ):
                table_started = True
                continue

            if not table_started or not line:
                continue

            match = EVENT_PATTERN.match(line)

            if match is None:
                if (
                    "SLEEP-" in line.upper()
                    or "MCAP-" in line.upper()
                ):
                    unparsed_event_lines.append(
                        {
                            "line_number": line_number,
                            "content": line,
                        }
                    )

                continue

            event_name = (
                match.group("event")
                .upper()
            )

            duration_seconds = float(
                match.group("duration")
            )

            event = {
                "line_number": line_number,
                "header_stage": (
                    match.group("header_stage")
                ),
                "position": (
                    match.group("position").strip()
                    if match.group("position")
                    else None
                ),
                "time": match.group("time"),
                "event": event_name,
                "duration_seconds": (
                    duration_seconds
                ),
                "location": (
                    match.group("location").strip()
                ),
                "event_type": (
                    "sleep_stage"
                    if event_name.startswith(
                        "SLEEP-"
                    )
                    else "cap_phase"
                ),
            }

            if event["event_type"] == "sleep_stage":
                event["sleep_stage"] = (
                    STAGE_MAPPING.get(
                        event_name,
                        "UNKNOWN",
                    )
                )
            else:
                event["sleep_stage"] = None

            events.append(event)

    if not events:
        raise ValueError(
            "No annotation events could be parsed."
        )

    unwrap_event_times(events)

    sleep_stage_events = [
        event
        for event in events
        if event["event_type"]
        == "sleep_stage"
    ]

    cap_events = [
        event
        for event in events
        if event["event_type"]
        == "cap_phase"
    ]

    if not sleep_stage_events:
        raise ValueError(
            "No sleep-stage events were found."
        )

    # The first scored 30-second stage corresponds
    # to the beginning of the EDF recording.
    recording_start_seconds = (
        sleep_stage_events[0][
            "continuous_seconds"
        ]
    )

    for event in events:
        event["relative_start_seconds"] = float(
            event["continuous_seconds"]
            - recording_start_seconds
        )

        event["relative_end_seconds"] = float(
            event["relative_start_seconds"]
            + event["duration_seconds"]
        )

        if event["event_type"] == "sleep_stage":
            epoch_position = (
                event["relative_start_seconds"]
                / 30.0
            )

            nearest_epoch = int(
                round(epoch_position)
            )

            event["epoch_index"] = nearest_epoch

            event["alignment_error_seconds"] = (
                abs(
                    event[
                        "relative_start_seconds"
                    ]
                    - nearest_epoch * 30.0
                )
            )
        else:
            event["epoch_index"] = None
            event[
                "alignment_error_seconds"
            ] = None

    return {
        "file_name": annotation_path.name,
        "patient_name": patient_name,
        "recording_date": recording_date,
        "recording_start_time": (
            sleep_stage_events[0]["time"]
        ),
        "events": events,
        "sleep_stage_events": (
            sleep_stage_events
        ),
        "cap_events": cap_events,
        "unparsed_event_lines": (
            unparsed_event_lines
        ),
    }


# ---------------------------------------------------------
# STAGE LOOKUP
# ---------------------------------------------------------

def build_stage_by_epoch(annotation_result):
    """Create epoch_index -> sleep stage mapping."""

    stage_by_epoch = {}

    for event in annotation_result[
        "sleep_stage_events"
    ]:
        epoch_index = event["epoch_index"]

        if epoch_index < 0:
            continue

        stage_by_epoch[epoch_index] = (
            event["sleep_stage"]
        )

    return stage_by_epoch


def build_cap_events_by_epoch(annotation_result):
    """
    Associate CAP A events with their containing
    30-second epoch.
    """

    cap_by_epoch = defaultdict(list)

    for event in annotation_result["cap_events"]:
        relative_start = event[
            "relative_start_seconds"
        ]

        if relative_start < 0:
            continue

        epoch_index = int(
            relative_start // 30
        )

        cap_by_epoch[epoch_index].append(
            {
                "event": event["event"],
                "duration_seconds": (
                    event["duration_seconds"]
                ),
                "relative_start_seconds": (
                    relative_start
                ),
                "location": event["location"],
            }
        )

    return dict(cap_by_epoch)


# ---------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------

def summarize_annotations(annotation_result):
    """Generate stage and CAP summary statistics."""

    stage_counts = Counter(
        event["sleep_stage"]
        for event in annotation_result[
            "sleep_stage_events"
        ]
    )

    cap_counts = Counter(
        event["event"]
        for event in annotation_result[
            "cap_events"
        ]
    )

    cap_durations = defaultdict(float)

    for event in annotation_result["cap_events"]:
        cap_durations[event["event"]] += (
            event["duration_seconds"]
        )

    nrem_epochs = sum(
        count
        for stage, count in stage_counts.items()
        if stage in NREM_STAGES
    )

    scored_epochs = sum(
        count
        for stage, count in stage_counts.items()
        if stage != "UNSCORED"
    )

    alignment_errors = [
        event
        for event in annotation_result[
            "sleep_stage_events"
        ]
        if event["alignment_error_seconds"]
        > 0.01
    ]

    return {
        "stage_counts": dict(stage_counts),
        "stage_hours": {
            stage: round(
                count * 30 / 3600,
                3,
            )
            for stage, count
            in stage_counts.items()
        },
        "scored_epochs": scored_epochs,
        "nrem_epochs": nrem_epochs,
        "cap_event_counts": dict(cap_counts),
        "cap_a_duration_seconds": {
            event_name: round(
                duration,
                3,
            )
            for event_name, duration
            in cap_durations.items()
        },
        "alignment_error_count": len(
            alignment_errors
        ),
        "unparsed_event_line_count": len(
            annotation_result[
                "unparsed_event_lines"
            ]
        ),
    }


# ---------------------------------------------------------
# COMMAND-LINE TEST
# ---------------------------------------------------------

def print_annotation_test(annotation_path):
    """Test and display parsed annotation information."""

    result = parse_sleep_annotations(
        annotation_path
    )

    summary = summarize_annotations(result)

    stage_by_epoch = build_stage_by_epoch(
        result
    )

    cap_by_epoch = (
        build_cap_events_by_epoch(result)
    )

    print("=" * 72)
    print("CAP SLEEP ANNOTATION TEST")
    print("=" * 72)
    print(f"File: {result['file_name']}")
    print(
        f"Patient: "
        f"{result['patient_name']}"
    )
    print(
        f"Recording date: "
        f"{result['recording_date']}"
    )
    print(
        f"Recording start: "
        f"{result['recording_start_time']}"
    )
    print(
        f"Sleep-stage events: "
        f"{len(result['sleep_stage_events'])}"
    )
    print(
        f"CAP events: "
        f"{len(result['cap_events'])}"
    )
    print(
        f"Parsed stage epochs: "
        f"{len(stage_by_epoch)}"
    )
    print(
        f"Epochs containing CAP events: "
        f"{len(cap_by_epoch)}"
    )

    print("\nSleep-stage counts:")

    for stage, count in (
        summary["stage_counts"].items()
    ):
        print(
            f"  {stage:<10} "
            f"{count:>5} epochs"
        )

    print("\nSleep-stage duration:")

    for stage, hours in (
        summary["stage_hours"].items()
    ):
        print(
            f"  {stage:<10} "
            f"{hours:>7.3f} hours"
        )

    print("\nCAP event counts:")

    for event_name, count in (
        summary[
            "cap_event_counts"
        ].items()
    ):
        duration = summary[
            "cap_a_duration_seconds"
        ].get(event_name, 0.0)

        print(
            f"  {event_name:<10} "
            f"{count:>5} events | "
            f"{duration:.1f} seconds"
        )

    print(
        f"\nNREM epochs: "
        f"{summary['nrem_epochs']}"
    )
    print(
        f"Alignment errors: "
        f"{summary['alignment_error_count']}"
    )
    print(
        f"Unparsed event lines: "
        f"{summary['unparsed_event_line_count']}"
    )

    print("\nFirst 10 scored epochs:")

    for epoch_index in sorted(
        stage_by_epoch
    )[:10]:
        print(
            f"  Epoch {epoch_index:<5} "
            f"{stage_by_epoch[epoch_index]}"
        )

    if result["unparsed_event_lines"]:
        print("\nUnparsed lines:")

        for problem in result[
            "unparsed_event_lines"
        ][:10]:
            print(
                f"  Line "
                f"{problem['line_number']}: "
                f"{problem['content']}"
            )

    print("\n" + "=" * 72)
    print("ANNOTATION TEST COMPLETED")
    print("=" * 72)


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Parse CAP RemLogic sleep "
            "annotation files."
        )
    )

    parser.add_argument(
        "annotation_path",
        help="Path to a CAP TXT annotation.",
    )

    arguments = parser.parse_args()

    print_annotation_test(
        arguments.annotation_path
    )


if __name__ == "__main__":
    main()