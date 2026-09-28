from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import platform

import joblib
import numpy as np
import pandas as pd
import sklearn

from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------

RANDOM_STATE = 42
PREDICTION_THRESHOLD = 0.50
MODEL_VERSION = "1.0.0-research"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = PROJECT_ROOT / "ml" / "artifacts"

DEFAULT_DATASET = ARTIFACT_DIR / "cap_epoch_features.csv"
DEFAULT_SCHEMA = ARTIFACT_DIR / "cap_feature_schema.json"
DEFAULT_PILOT_METRICS = ARTIFACT_DIR / "cap_pilot_metrics.json"

DEFAULT_MODEL_OUTPUT = ARTIFACT_DIR / "cap_research_model.joblib"
DEFAULT_METADATA_OUTPUT = ARTIFACT_DIR / "cap_research_model_metadata.json"
DEFAULT_COEFFICIENT_OUTPUT = ARTIFACT_DIR / "cap_research_model_coefficients.csv"


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def parse_arguments():
    parser = argparse.ArgumentParser(
        description=(
            "Train and save the research-only CAP A-event "
            "Logistic Regression model."
        )
    )
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument(
        "--pilot-metrics",
        type=Path,
        default=DEFAULT_PILOT_METRICS,
    )
    parser.add_argument(
        "--model-output",
        type=Path,
        default=DEFAULT_MODEL_OUTPUT,
    )
    parser.add_argument(
        "--metadata-output",
        type=Path,
        default=DEFAULT_METADATA_OUTPUT,
    )
    parser.add_argument(
        "--coefficient-output",
        type=Path,
        default=DEFAULT_COEFFICIENT_OUTPUT,
    )
    return parser.parse_args()


def sha256_file(file_path):
    digest = hashlib.sha256()
    with Path(file_path).open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_json(file_path, required=True):
    file_path = Path(file_path)
    if not file_path.exists():
        if required:
            raise FileNotFoundError(f"Required file not found: {file_path}")
        return None
    with file_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_feature_names(schema):
    feature_names = (
        schema.get("feature_columns")
        or schema.get("feature_names")
        or schema.get("features")
    )

    if not isinstance(feature_names, list) or not feature_names:
        raise ValueError("Feature columns were not found in the schema.")

    if isinstance(feature_names[0], dict):
        feature_names = [
            item["name"] for item in feature_names if "name" in item
        ]

    feature_names = [str(name) for name in feature_names]

    if len(feature_names) != len(set(feature_names)):
        raise ValueError("Duplicate feature names exist in the schema.")

    forbidden_inputs = set(schema.get("forbidden_model_inputs", []))
    leaked_columns = sorted(forbidden_inputs.intersection(feature_names))

    if leaked_columns:
        raise ValueError(
            "Target-derived metadata is present in the feature schema: "
            + ", ".join(leaked_columns)
        )

    return feature_names


def validate_dataset(dataframe, feature_names):
    required_columns = {
        "subject_id",
        "sleep_stage",
        "cap_a_event_present",
    }

    missing_columns = sorted(required_columns.difference(dataframe.columns))
    missing_features = sorted(set(feature_names).difference(dataframe.columns))

    if missing_columns:
        raise ValueError(
            "Dataset is missing required columns: "
            + ", ".join(missing_columns)
        )
    if missing_features:
        raise ValueError(
            "Dataset is missing model features: "
            + ", ".join(missing_features)
        )

    dataframe = dataframe.copy()
    dataframe["subject_id"] = dataframe["subject_id"].astype(str).str.strip()
    dataframe["sleep_stage"] = (
        dataframe["sleep_stage"].astype(str).str.strip().str.upper()
    )
    dataframe["cap_a_event_present"] = pd.to_numeric(
        dataframe["cap_a_event_present"],
        errors="raise",
    ).astype(int)

    invalid_labels = sorted(
        set(dataframe["cap_a_event_present"].unique()).difference({0, 1})
    )
    if invalid_labels:
        raise ValueError(f"Unexpected target values: {invalid_labels}")

    for feature_name in feature_names:
        dataframe[feature_name] = pd.to_numeric(
            dataframe[feature_name],
            errors="coerce",
        )

    feature_values = dataframe[feature_names].to_numpy(dtype=np.float64)
    missing_count = int(np.isnan(feature_values).sum())
    infinite_count = int(np.isinf(feature_values).sum())

    if missing_count or infinite_count:
        raise ValueError(
            f"Feature matrix contains {missing_count} missing and "
            f"{infinite_count} infinite values."
        )

    if dataframe["subject_id"].nunique() < 2:
        raise ValueError("At least two independent subjects are required.")

    if dataframe["cap_a_event_present"].nunique() != 2:
        raise ValueError("Both CAP-positive and CAP-negative rows are required.")

    return dataframe


def extract_pilot_summary(pilot_metrics):
    if not pilot_metrics:
        return None

    model_results = pilot_metrics.get("models", {}).get(
        "Logistic Regression"
    )
    if not model_results:
        return None

    return {
        "validation_method": pilot_metrics.get("validation"),
        "pooled_held_out_epoch_metrics": model_results.get(
            "pooled_held_out_epoch_metrics"
        ),
        "macro_subject_metrics": model_results.get("macro_subject_metrics"),
    }


# ---------------------------------------------------------
# TRAINING
# ---------------------------------------------------------

def main():
    arguments = parse_arguments()

    dataset_path = arguments.dataset.resolve()
    schema_path = arguments.schema.resolve()
    pilot_metrics_path = arguments.pilot_metrics.resolve()
    model_output = arguments.model_output.resolve()
    metadata_output = arguments.metadata_output.resolve()
    coefficient_output = arguments.coefficient_output.resolve()

    if not dataset_path.exists():
        raise FileNotFoundError(f"CAP dataset not found: {dataset_path}")

    schema = load_json(schema_path, required=True)
    pilot_metrics = load_json(pilot_metrics_path, required=False)
    feature_names = load_feature_names(schema)
    dataframe = validate_dataset(pd.read_csv(dataset_path), feature_names)

    X = dataframe[feature_names]
    y = dataframe["cap_a_event_present"]

    model = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "classifier",
                LogisticRegression(
                    max_iter=5000,
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
    )

    model.fit(X, y)

    positive_class_index = list(model.classes_).index(1)
    training_probabilities = model.predict_proba(X)[:, positive_class_index]
    training_predictions = (
        training_probabilities >= PREDICTION_THRESHOLD
    ).astype(int)

    # These are resubstitution metrics, used only as a technical
    # sanity check. They are not validation performance.
    training_fit_metrics = {
        "accuracy": float(accuracy_score(y, training_predictions)),
        "precision": float(
            precision_score(y, training_predictions, zero_division=0)
        ),
        "recall": float(recall_score(y, training_predictions, zero_division=0)),
        "f1_score": float(f1_score(y, training_predictions, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, training_probabilities)),
        "confusion_matrix": confusion_matrix(
            y,
            training_predictions,
            labels=[0, 1],
        ).tolist(),
        "warning": (
            "Calculated on the same rows used to fit the model; "
            "do not report these as validation metrics."
        ),
    }

    coefficient_values = model.named_steps["classifier"].coef_[0]
    coefficients = pd.DataFrame(
        {
            "feature": feature_names,
            "standardized_coefficient": coefficient_values,
            "absolute_coefficient": np.abs(coefficient_values),
            "direction": np.where(
                coefficient_values >= 0,
                "toward-cap-a-present",
                "toward-no-cap-a-event",
            ),
        }
    ).sort_values("absolute_coefficient", ascending=False)
    coefficients.insert(0, "rank", np.arange(len(coefficients)) + 1)

    pilot_summary = extract_pilot_summary(pilot_metrics)
    created_at = datetime.now(timezone.utc).isoformat()

    model_bundle = {
        "model": model,
        "model_version": MODEL_VERSION,
        "model_type": "StandardScaler + LogisticRegression",
        "feature_columns": feature_names,
        "feature_count": len(feature_names),
        "target_column": "cap_a_event_present",
        "positive_class": 1,
        "negative_class": 0,
        "decision_threshold": PREDICTION_THRESHOLD,
        "model_channel": schema.get("model_channel", "C4-A1"),
        "selected_stages": schema.get("selected_stages", ["N2", "N3"]),
        "epoch_duration_seconds": schema.get("epoch_duration_seconds", 30.0),
        "processed_sampling_rate": schema.get("processed_sampling_rate", 128.0),
        "created_at_utc": created_at,
        "output_name": "CAP-like activity score",
        "scope": "research-only",
    }

    class_stage_counts = (
        dataframe.groupby(["sleep_stage", "cap_a_event_present"])
        .size()
        .reset_index(name="rows")
        .to_dict(orient="records")
    )

    metadata = {
        "model_version": MODEL_VERSION,
        "created_at_utc": created_at,
        "model_type": "StandardScaler + LogisticRegression",
        "model_channel": model_bundle["model_channel"],
        "target_column": "cap_a_event_present",
        "target_definition": schema.get("target_definition"),
        "output_name": "CAP-like activity score",
        "decision_threshold": PREDICTION_THRESHOLD,
        "training_rows": int(len(dataframe)),
        "training_subject_count": int(dataframe["subject_id"].nunique()),
        "training_subjects": sorted(dataframe["subject_id"].unique().tolist()),
        "selected_stages": model_bundle["selected_stages"],
        "class_and_stage_counts": class_stage_counts,
        "feature_count": len(feature_names),
        "feature_columns": feature_names,
        "dataset_sha256": sha256_file(dataset_path),
        "schema_sha256": sha256_file(schema_path),
        "pilot_validation": pilot_summary,
        "training_fit_sanity_metrics": training_fit_metrics,
        "probability_warning": (
            "The model was trained on an artificially balanced dataset. "
            "predict_proba output is a model score and is not a calibrated "
            "clinical probability or official CAP rate."
        ),
        "clinical_scope": (
            "Research prototype for identifying 30-second N2/N3 epochs "
            "with CAP A-like EEG patterns. It is not a medical diagnosis, "
            "official CAP scoring system, or insomnia-risk estimator."
        ),
        "inference_requirement": (
            "C4-A1 EDF EEG plus a paired sleep-stage annotation TXT file. "
            "CAP annotations must not be used as inference inputs."
        ),
        "software": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__,
            "joblib": joblib.__version__,
        },
    }

    for output_path in (model_output, metadata_output, coefficient_output):
        output_path.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(model_bundle, model_output)
    coefficients.to_csv(coefficient_output, index=False)
    with metadata_output.open("w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=2)

    print("=" * 79)
    print("CAP RESEARCH MODEL TRAINING COMPLETED")
    print("=" * 79)
    print(f"Rows: {len(dataframe)}")
    print(f"Subjects: {dataframe['subject_id'].nunique()}")
    print(f"Features: {len(feature_names)}")
    print(f"Model: StandardScaler + LogisticRegression")
    print(f"Channel: {model_bundle['model_channel']}")
    print(f"Stages: {model_bundle['selected_stages']}")

    if pilot_summary:
        print("\nHeld-out pilot validation retained in metadata:")
        pooled = pilot_summary.get("pooled_held_out_epoch_metrics") or {}
        macro = pilot_summary.get("macro_subject_metrics") or {}
        print(f"  Pooled accuracy: {pooled.get('accuracy')}")
        print(f"  Pooled ROC-AUC: {pooled.get('roc_auc')}")
        print(f"  Macro subject ROC-AUC: {macro.get('roc_auc')}")
    else:
        print("\nPilot metrics file was unavailable or incompatible.")

    print("\nTop 10 standardized coefficients:")
    print(
        coefficients[
            ["rank", "feature", "standardized_coefficient", "direction"]
        ]
        .head(10)
        .to_string(index=False, float_format=lambda value: f"{value:.6f}")
    )

    print(f"\nModel bundle saved to:\n{model_output}")
    print(f"\nModel metadata saved to:\n{metadata_output}")
    print(f"\nCoefficient report saved to:\n{coefficient_output}")
    print(
        "\nResearch prototype only. Model scores are not calibrated "
        "clinical probabilities or official CAP rate."
    )


if __name__ == "__main__":
    main()
