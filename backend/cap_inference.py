from pathlib import Path
import argparse
import json
import sys

import joblib
import numpy as np
import pandas as pd


# ---------------------------------------------------------
# PROJECT IMPORTS
# ---------------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

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
    calculate_annotation_start_offset_seconds,
    iterate_sleep_epochs,
)


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------

DEFAULT_MODEL_PATH = (
    PROJECT_ROOT
    / "ml"
    / "artifacts"
    / "cap_research_model.joblib"
)

SUPPORTED_STAGES = ("N2", "N3")
MAX_PREVIEW_POINTS = 600


# ---------------------------------------------------------
# MODEL LOADING
# ---------------------------------------------------------

def load_cap_model(model_path=DEFAULT_MODEL_PATH):
    """
    Load the trusted local research-model bundle.

    Never use this function to load a model uploaded by a user,
    because joblib files can execute Python code while loading.
    """

    model_path = Path(model_path)

    if not model_path.exists():
        raise FileNotFoundError(
            f"CAP research model not found: {model_path}. "
            "Run ml/train_cap_research_model.py first."
        )

    bundle = joblib.load(model_path)

    required_keys = {
        "model",
        "feature_columns",
        "decision_threshold",
        "model_channel",
        "selected_stages",
        "processed_sampling_rate",
        "epoch_duration_seconds",
    }

    if not isinstance(bundle, dict):
        raise ValueError("The CAP model artifact is not a model bundle.")

    missing_keys = sorted(required_keys.difference(bundle))

    if missing_keys:
        raise ValueError(
            "CAP model bundle is missing: " + ", ".join(missing_keys)
        )

    feature_columns = bundle["feature_columns"]

    if not isinstance(feature_columns, list) or not feature_columns:
        raise ValueError("Model bundle contains no feature-column order.")

    if len(feature_columns) != len(set(feature_columns)):
        raise ValueError("Model bundle contains duplicate feature names.")

    return bundle


# ---------------------------------------------------------
# DATA SELECTION
# ---------------------------------------------------------

def evenly_limit_indices(epoch_indices, maximum_epochs):
    """Optionally select epochs distributed across the full night."""

    epoch_indices = sorted(set(int(index) for index in epoch_indices))

    if maximum_epochs is None or maximum_epochs >= len(epoch_indices):
        return epoch_indices

    if maximum_epochs <= 0:
        raise ValueError("maximum_epochs must be greater than zero.")

    positions = np.linspace(
        0,
        len(epoch_indices) - 1,
        num=maximum_epochs,
    )
    positions = np.rint(positions).astype(int)
    selected = [epoch_indices[position] for position in positions]

    if len(set(selected)) != maximum_epochs:
        raise RuntimeError("Epoch limiting created duplicate indices.")

    return selected


def prepare_aligned_stage_epochs(edf_path, annotation_result, stages):
    """Create valid annotation-aligned N2/N3 epoch indices."""

    alignment = calculate_annotation_start_offset_seconds(
        edf_path=edf_path,
        annotation_start_time=annotation_result["recording_start_time"],
    )

    offset_seconds = float(alignment["offset_seconds"])
    available_seconds = max(
        0.0,
        float(alignment["edf_duration_seconds"]) - offset_seconds,
    )
    total_complete_aligned_epochs = int(
        np.floor(available_seconds / EPOCH_DURATION_SECONDS + 1e-9)
    )

    unfiltered_stage_by_epoch = build_stage_by_epoch(annotation_result)

    excluded_indices = sorted(
        epoch_index
        for epoch_index in unfiltered_stage_by_epoch
        if not (0 <= epoch_index < total_complete_aligned_epochs)
    )

    stage_by_epoch = {
        epoch_index: sleep_stage
        for epoch_index, sleep_stage in unfiltered_stage_by_epoch.items()
        if (
            0 <= epoch_index < total_complete_aligned_epochs
            and sleep_stage in stages
        )
    }

    return {
        "alignment": alignment,
        "total_complete_aligned_epochs": total_complete_aligned_epochs,
        "excluded_annotation_epoch_indices": excluded_indices,
        "stage_by_epoch": stage_by_epoch,
    }


# ---------------------------------------------------------
# VISUALIZATION PREVIEW
# ---------------------------------------------------------

def downsample_signal(signal, sampling_rate, maximum_points=MAX_PREVIEW_POINTS):
    signal = np.asarray(signal, dtype=np.float64).reshape(-1)

    if signal.size == 0:
        return {"time_seconds": [], "values": []}

    number_of_points = min(signal.size, int(maximum_points))
    indices = np.linspace(
        0,
        signal.size - 1,
        num=number_of_points,
    )
    indices = np.unique(np.rint(indices).astype(int))

    return {
        "time_seconds": [
            float(index / sampling_rate) for index in indices
        ],
        "values": [float(signal[index]) for index in indices],
    }


def create_signal_preview(epoch, sleep_stage):
    raw_microvolts = (
        np.asarray(epoch["raw_signal_volts"], dtype=np.float64)
        * 1_000_000.0
    )
    filtered_microvolts = np.asarray(
        epoch["filtered_signal_microvolts"],
        dtype=np.float64,
    )

    raw_preview = downsample_signal(
        raw_microvolts,
        epoch["original_sampling_rate"],
    )
    filtered_preview = downsample_signal(
        filtered_microvolts,
        epoch["processed_sampling_rate"],
    )

    return {
        "epoch_index": int(epoch["epoch_index"]),
        "sleep_stage": sleep_stage,
        "edf_start_seconds": float(epoch["start_seconds"]),
        "duration_seconds": float(EPOCH_DURATION_SECONDS),
        "channel": epoch["normalized_channel"],
        "raw_signal": {
            "units": "microvolts",
            "sampling_rate": float(epoch["original_sampling_rate"]),
            **raw_preview,
        },
        "cleaned_signal": {
            "units": "microvolts",
            "sampling_rate": float(epoch["processed_sampling_rate"]),
            **filtered_preview,
        },
    }


# ---------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------

def summarize_prediction_rows(prediction_rows, threshold):
    dataframe = pd.DataFrame(prediction_rows)

    if dataframe.empty:
        raise ValueError("No accepted epochs were available for prediction.")

    def summarize_group(group):
        scores = group["cap_like_score"].to_numpy(dtype=float)
        predicted = group["predicted_cap_a_like"].to_numpy(dtype=int)

        return {
            "evaluated_epochs": int(len(group)),
            "mean_cap_like_score": float(np.mean(scores)),
            "median_cap_like_score": float(np.median(scores)),
            "score_standard_deviation": float(np.std(scores)),
            "predicted_cap_a_like_epochs": int(np.sum(predicted)),
            "predicted_cap_a_like_epoch_fraction": float(np.mean(predicted)),
        }

    overall = summarize_group(dataframe)
    by_stage = {
        stage: summarize_group(stage_data)
        for stage, stage_data in dataframe.groupby("sleep_stage")
    }

    overall["decision_threshold"] = float(threshold)
    return overall, by_stage


# ---------------------------------------------------------
# COMPLETE INFERENCE
# ---------------------------------------------------------

def analyze_cap_like_activity(
    edf_path,
    annotation_path,
    model_path=DEFAULT_MODEL_PATH,
    maximum_epochs=None,
    include_epoch_predictions=True,
):
    """
    Analyze CAP A-like EEG patterns in aligned N2/N3 epochs.

    The annotation file supplies sleep-stage timing only.
    Its CAP labels are deliberately not used for prediction.
    """

    edf_path = Path(edf_path)
    annotation_path = Path(annotation_path)

    if not edf_path.exists():
        raise FileNotFoundError(f"EDF file not found: {edf_path}")

    if not annotation_path.exists():
        raise FileNotFoundError(
            f"Sleep-stage annotation file not found: {annotation_path}"
        )

    bundle = load_cap_model(model_path)
    model = bundle["model"]
    feature_columns = list(bundle["feature_columns"])
    threshold = float(bundle["decision_threshold"])
    model_channel = str(bundle["model_channel"])
    model_stages = tuple(str(stage) for stage in bundle["selected_stages"])

    unsupported_stages = sorted(set(model_stages).difference(SUPPORTED_STAGES))

    if unsupported_stages:
        raise ValueError(
            "Model contains unsupported stages: " + ", ".join(unsupported_stages)
        )

    annotation_result = parse_sleep_annotations(annotation_path)

    aligned = prepare_aligned_stage_epochs(
        edf_path,
        annotation_result,
        model_stages,
    )
    stage_by_epoch = aligned["stage_by_epoch"]

    if not stage_by_epoch:
        raise ValueError(
            "No complete N2/N3 epochs were found after EDF/TXT alignment."
        )

    all_candidate_indices = sorted(stage_by_epoch)
    selected_indices = evenly_limit_indices(
        all_candidate_indices,
        maximum_epochs,
    )

    feature_rows = []
    epoch_metadata = []
    rejected_epochs = []
    signal_preview = None

    epoch_generator = iterate_sleep_epochs(
        edf_path=edf_path,
        required_channel=model_channel,
        epoch_duration_seconds=float(bundle["epoch_duration_seconds"]),
        target_sampling_rate=float(bundle["processed_sampling_rate"]),
        selected_epoch_indices=selected_indices,
        recording_start_offset_seconds=float(
            aligned["alignment"]["offset_seconds"]
        ),
    )

    try:
        for epoch in epoch_generator:
            epoch_index = int(epoch["epoch_index"])
            sleep_stage = stage_by_epoch[epoch_index]
            filtered_signal = epoch["filtered_signal_microvolts"]
            quality = evaluate_epoch_quality(filtered_signal)

            if not quality["quality_pass"]:
                rejected_epochs.append(
                    {
                        "epoch_index": epoch_index,
                        "sleep_stage": sleep_stage,
                        "reason": quality["quality_reason"],
                    }
                )
                continue

            extracted_features = extract_sleep_epoch_features(
                filtered_signal,
                epoch["processed_sampling_rate"],
            )

            missing_features = [
                name for name in feature_columns if name not in extracted_features
            ]

            if missing_features:
                raise ValueError(
                    "Feature extractor is missing model inputs: "
                    + ", ".join(missing_features)
                )

            ordered_features = {
                name: float(extracted_features[name]) for name in feature_columns
            }

            if not np.all(np.isfinite(list(ordered_features.values()))):
                rejected_epochs.append(
                    {
                        "epoch_index": epoch_index,
                        "sleep_stage": sleep_stage,
                        "reason": "non_finite_extracted_feature",
                    }
                )
                continue

            feature_rows.append(ordered_features)
            epoch_metadata.append(
                {
                    "epoch_index": epoch_index,
                    "sleep_stage": sleep_stage,
                    "annotation_start_seconds": float(
                        epoch["annotation_relative_start_seconds"]
                    ),
                    "edf_start_seconds": float(epoch["start_seconds"]),
                }
            )

            if signal_preview is None:
                signal_preview = create_signal_preview(epoch, sleep_stage)

    finally:
        epoch_generator.close()

    if not feature_rows:
        raise ValueError("Every selected N2/N3 epoch failed quality screening.")

    feature_frame = pd.DataFrame(feature_rows, columns=feature_columns)
    positive_class_index = list(model.classes_).index(1)
    probabilities = model.predict_proba(feature_frame)[:, positive_class_index]
    predicted_labels = (probabilities >= threshold).astype(int)

    prediction_rows = []

    for metadata, probability, predicted_label in zip(
        epoch_metadata,
        probabilities,
        predicted_labels,
    ):
        prediction_rows.append(
            {
                **metadata,
                "cap_like_score": float(probability),
                "predicted_cap_a_like": int(predicted_label),
                "predicted_label": (
                    "cap-a-like" if predicted_label == 1 else "no-cap-a-like"
                ),
            }
        )

    overall_summary, stage_summary = summarize_prediction_rows(
        prediction_rows,
        threshold,
    )

    candidate_counts_by_stage = {
        stage: int(
            sum(1 for current_stage in stage_by_epoch.values() if current_stage == stage)
        )
        for stage in model_stages
    }

    result = {
        "analysis_type": "research-cap-a-like-epoch-analysis",
        "recording": {
            "edf_file": edf_path.name,
            "annotation_file": annotation_path.name,
            "patient_name": annotation_result.get("patient_name"),
            "recording_date": annotation_result.get("recording_date"),
            "channel": model_channel,
        },
        "alignment": {
            "edf_start_time": aligned["alignment"]["edf_start_time"],
            "annotation_start_time": aligned["alignment"][
                "annotation_start_time"
            ],
            "annotation_offset_seconds": float(
                aligned["alignment"]["offset_seconds"]
            ),
            "complete_aligned_epochs": int(
                aligned["total_complete_aligned_epochs"]
            ),
            "excluded_incomplete_annotation_epochs": int(
                len(aligned["excluded_annotation_epoch_indices"])
            ),
        },
        "model": {
            "model_version": bundle.get("model_version"),
            "model_type": bundle.get("model_type"),
            "feature_count": len(feature_columns),
            "decision_threshold": threshold,
            "score_is_calibrated_clinical_probability": False,
        },
        "analysis": {
            "candidate_nrem_epochs": int(len(all_candidate_indices)),
            "candidate_epochs_by_stage": candidate_counts_by_stage,
            "selected_epochs": int(len(selected_indices)),
            "evaluated_epochs": int(len(prediction_rows)),
            "rejected_epochs": int(len(rejected_epochs)),
            "partial_analysis": maximum_epochs is not None
            and len(selected_indices) < len(all_candidate_indices),
            "overall": overall_summary,
            "by_stage": stage_summary,
        },
        "signal_preview": signal_preview,
        "quality_rejections": rejected_epochs,
        "methodology": {
            "sleep_stage_annotations_used": True,
            "cap_annotation_labels_used_for_prediction": False,
            "eeg_features_used": True,
        },
        "limitations": [
            "Research prototype trained on six independent subjects.",
            "Scores are not calibrated clinical probabilities.",
            "Predicted CAP-like epoch fraction is not official CAP rate.",
            "This output must not be used as a diagnosis or insomnia-risk estimate.",
        ],
    }

    if include_epoch_predictions:
        result["epoch_predictions"] = prediction_rows

    return result


# ---------------------------------------------------------
# COMMAND-LINE TEST
# ---------------------------------------------------------

def print_result_summary(result):
    recording = result["recording"]
    alignment = result["alignment"]
    analysis = result["analysis"]
    overall = analysis["overall"]

    print("=" * 79)
    print("CAP A-LIKE INFERENCE TEST")
    print("=" * 79)
    print(f"EDF: {recording['edf_file']}")
    print(f"Annotation: {recording['annotation_file']}")
    print(f"Channel: {recording['channel']}")
    print(f"EDF start: {alignment['edf_start_time']}")
    print(f"Annotation start: {alignment['annotation_start_time']}")
    print(f"Offset: {alignment['annotation_offset_seconds']:.1f} seconds")
    print(f"Candidate N2/N3 epochs: {analysis['candidate_nrem_epochs']}")
    print(f"Selected epochs: {analysis['selected_epochs']}")
    print(f"Evaluated epochs: {analysis['evaluated_epochs']}")
    print(f"Rejected epochs: {analysis['rejected_epochs']}")
    print(f"Mean CAP-like score: {overall['mean_cap_like_score']:.4f}")
    print(f"Median CAP-like score: {overall['median_cap_like_score']:.4f}")
    print(
        "Predicted CAP A-like epoch fraction: "
        f"{overall['predicted_cap_a_like_epoch_fraction']:.4f}"
    )

    print("\nBy stage:")
    for stage, stage_result in analysis["by_stage"].items():
        print(
            f"  {stage}: epochs={stage_result['evaluated_epochs']}, "
            f"mean_score={stage_result['mean_cap_like_score']:.4f}, "
            "predicted_fraction="
            f"{stage_result['predicted_cap_a_like_epoch_fraction']:.4f}"
        )

    print("\nResearch-only result; not official CAP rate or diagnosis.")


def main():
    parser = argparse.ArgumentParser(
        description="Run research CAP A-like inference on EDF plus TXT."
    )
    parser.add_argument("edf_path", type=Path)
    parser.add_argument("annotation_path", type=Path)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument(
        "--max-epochs",
        type=int,
        default=None,
        help="Optional evenly distributed subset for a quick test.",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        default=None,
        help="Optional path for the complete JSON result.",
    )
    parser.add_argument(
        "--no-epoch-predictions",
        action="store_true",
        help="Exclude the per-epoch list from JSON output.",
    )
    arguments = parser.parse_args()

    result = analyze_cap_like_activity(
        edf_path=arguments.edf_path,
        annotation_path=arguments.annotation_path,
        model_path=arguments.model,
        maximum_epochs=arguments.max_epochs,
        include_epoch_predictions=not arguments.no_epoch_predictions,
    )

    print_result_summary(result)

    if arguments.json_output is not None:
        output_path = arguments.json_output.resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as file:
            json.dump(result, file, indent=2)
        print(f"\nJSON result saved to:\n{output_path}")


if __name__ == "__main__":
    main()
