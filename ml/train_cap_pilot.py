from pathlib import Path
import argparse
import json
import warnings

import numpy as np
import pandas as pd

from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import LeaveOneGroupOut
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------

RANDOM_STATE = 42
PREDICTION_THRESHOLD = 0.50

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = PROJECT_ROOT / "ml" / "artifacts" / "cap_epoch_features.csv"
DEFAULT_SCHEMA = PROJECT_ROOT / "ml" / "artifacts" / "cap_feature_schema.json"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "ml" / "artifacts"


# ---------------------------------------------------------
# INPUT AND VALIDATION
# ---------------------------------------------------------

def parse_arguments():
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate CAP A-event epoch classifiers with "
            "leave-one-subject-out validation."
        )
    )
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument(
        "--output-directory",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
    )
    return parser.parse_args()


def load_feature_names(schema_path):
    if not schema_path.exists():
        raise FileNotFoundError(f"Feature schema not found: {schema_path}")

    with schema_path.open("r", encoding="utf-8") as file:
        schema = json.load(file)

    feature_names = (
        schema.get("feature_columns")
        or schema.get("feature_names")
        or schema.get("features")
    )

    if not isinstance(feature_names, list) or not feature_names:
        raise ValueError("The schema contains no feature-column list.")

    if isinstance(feature_names[0], dict):
        feature_names = [
            item["name"] for item in feature_names if "name" in item
        ]

    feature_names = [str(name) for name in feature_names]

    if len(feature_names) != len(set(feature_names)):
        raise ValueError("Duplicate feature names were found in the schema.")

    forbidden = set(schema.get("forbidden_model_inputs", []))
    leaked_columns = sorted(forbidden.intersection(feature_names))

    if leaked_columns:
        raise ValueError(
            "Target-derived metadata appears in the feature list: "
            + ", ".join(leaked_columns)
        )

    return feature_names, schema


def validate_dataset(dataframe, feature_names):
    required_columns = {
        "subject_id",
        "diagnosis",
        "sleep_stage",
        "cap_a_event_present",
    }

    missing_metadata = sorted(required_columns.difference(dataframe.columns))
    missing_features = sorted(set(feature_names).difference(dataframe.columns))

    if missing_metadata:
        raise ValueError(
            "Dataset is missing metadata columns: "
            + ", ".join(missing_metadata)
        )

    if missing_features:
        raise ValueError(
            "Dataset is missing feature columns: "
            + ", ".join(missing_features)
        )

    dataframe = dataframe.copy()
    dataframe["subject_id"] = dataframe["subject_id"].astype(str).str.strip()
    dataframe["diagnosis"] = dataframe["diagnosis"].astype(str).str.strip()
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
        raise ValueError(f"Unexpected CAP labels: {invalid_labels}")

    invalid_stages = sorted(
        set(dataframe["sleep_stage"].unique()).difference({"N2", "N3"})
    )
    if invalid_stages:
        raise ValueError(f"Unexpected sleep stages: {invalid_stages}")

    for feature_name in feature_names:
        dataframe[feature_name] = pd.to_numeric(
            dataframe[feature_name],
            errors="coerce",
        )

    feature_array = dataframe[feature_names].to_numpy(dtype=float)
    missing_values = int(np.isnan(feature_array).sum())
    infinite_values = int(np.isinf(feature_array).sum())

    if missing_values or infinite_values:
        raise ValueError(
            f"Feature matrix has {missing_values} missing and "
            f"{infinite_values} infinite values."
        )

    label_counts = dataframe.groupby(
        ["subject_id", "sleep_stage", "cap_a_event_present"]
    ).size()

    if label_counts.empty or label_counts.nunique() != 1:
        raise ValueError(
            "Dataset must be balanced within subject, stage, and target."
        )

    return dataframe


# ---------------------------------------------------------
# METRICS
# ---------------------------------------------------------

def calculate_metrics(y_true, y_pred, probabilities):
    y_true = np.asarray(y_true, dtype=int)
    y_pred = np.asarray(y_pred, dtype=int)
    probabilities = np.asarray(probabilities, dtype=float)

    result = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(
            balanced_accuracy_score(y_true, y_pred)
        ),
        "precision": float(
            precision_score(y_true, y_pred, zero_division=0)
        ),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, zero_division=0)),
        "confusion_matrix": confusion_matrix(
            y_true,
            y_pred,
            labels=[0, 1],
        ).tolist(),
    }

    result["roc_auc"] = (
        float(roc_auc_score(y_true, probabilities))
        if len(np.unique(y_true)) == 2
        else None
    )
    return result


def metrics_row(group_data, extra_values):
    metrics = calculate_metrics(
        group_data["cap_a_event_present"],
        group_data["predicted_label"],
        group_data["probability_cap_a"],
    )

    row = dict(extra_values)
    row.update(
        {
            "epochs": int(len(group_data)),
            "positive_epochs": int(group_data["cap_a_event_present"].sum()),
            "negative_epochs": int(
                len(group_data) - group_data["cap_a_event_present"].sum()
            ),
            "accuracy": metrics["accuracy"],
            "balanced_accuracy": metrics["balanced_accuracy"],
            "precision": metrics["precision"],
            "recall": metrics["recall"],
            "f1_score": metrics["f1_score"],
            "roc_auc": metrics["roc_auc"],
            "confusion_matrix": json.dumps(metrics["confusion_matrix"]),
        }
    )
    return row


# ---------------------------------------------------------
# FEATURE IMPORTANCE
# ---------------------------------------------------------

def extract_feature_scores(fitted_pipeline, feature_names):
    classifier = fitted_pipeline.named_steps["classifier"]

    if hasattr(classifier, "coef_"):
        scores = np.abs(classifier.coef_[0])
    elif hasattr(classifier, "feature_importances_"):
        scores = classifier.feature_importances_
    else:
        scores = np.zeros(len(feature_names), dtype=float)

    return pd.DataFrame(
        {
            "feature": feature_names,
            "importance": np.asarray(scores, dtype=float),
        }
    )


# ---------------------------------------------------------
# MODEL EVALUATION
# ---------------------------------------------------------

def evaluate_model(model_name, model_template, dataframe, feature_names):
    X = dataframe[feature_names]
    y = dataframe["cap_a_event_present"]
    groups = dataframe["subject_id"]

    cross_validator = LeaveOneGroupOut()
    prediction_frames = []
    feature_score_frames = []

    print("\n" + "=" * 79)
    print(f"MODEL: {model_name}")
    print("=" * 79)

    for fold_number, (train_indices, validation_indices) in enumerate(
        cross_validator.split(X, y, groups=groups),
        start=1,
    ):
        training_subjects = sorted(
            dataframe.iloc[train_indices]["subject_id"].unique().tolist()
        )
        validation_subjects = sorted(
            dataframe.iloc[validation_indices]["subject_id"].unique().tolist()
        )
        overlap = sorted(set(training_subjects).intersection(validation_subjects))

        print(f"\nFold {fold_number}")
        print(f"Training subjects: {training_subjects}")
        print(f"Validation subject: {validation_subjects}")
        print(f"Subject overlap: {overlap}")

        if overlap:
            raise RuntimeError("Subject leakage detected.")

        model = clone(model_template)
        model.fit(X.iloc[train_indices], y.iloc[train_indices])

        positive_class_index = list(model.classes_).index(1)
        probabilities = model.predict_proba(
            X.iloc[validation_indices]
        )[:, positive_class_index]

        validation_data = dataframe.iloc[validation_indices].copy()
        validation_data["probability_cap_a"] = probabilities
        validation_data["predicted_label"] = (
            validation_data["probability_cap_a"] >= PREDICTION_THRESHOLD
        ).astype(int)
        validation_data["predicted_cap_label"] = np.where(
            validation_data["predicted_label"] == 1,
            "cap-a-present",
            "no-cap-a-event",
        )
        validation_data["fold"] = fold_number
        validation_data["model"] = model_name

        output_columns = [
            "model",
            "fold",
            "subject_id",
            "diagnosis",
            "recording_file",
            "epoch_index",
            "sleep_stage",
            "cap_a_event_present",
            "cap_label",
            "probability_cap_a",
            "predicted_label",
            "predicted_cap_label",
        ]
        output_columns = [
            column for column in output_columns if column in validation_data.columns
        ]
        prediction_frames.append(validation_data[output_columns])

        scores = extract_feature_scores(model, feature_names)
        scores["fold"] = fold_number
        scores["model"] = model_name
        feature_score_frames.append(scores)

    predictions = pd.concat(prediction_frames, ignore_index=True)
    fold_scores = pd.concat(feature_score_frames, ignore_index=True)

    pooled_metrics = calculate_metrics(
        predictions["cap_a_event_present"],
        predictions["predicted_label"],
        predictions["probability_cap_a"],
    )

    subject_rows = []
    for subject_id, group_data in predictions.groupby("subject_id"):
        subject_rows.append(
            metrics_row(
                group_data,
                {
                    "model": model_name,
                    "subject_id": subject_id,
                    "diagnosis": group_data["diagnosis"].iloc[0],
                },
            )
        )
    subject_metrics = pd.DataFrame(subject_rows)

    stage_rows = []
    for sleep_stage, group_data in predictions.groupby("sleep_stage"):
        stage_rows.append(
            metrics_row(
                group_data,
                {"model": model_name, "sleep_stage": sleep_stage},
            )
        )
    stage_metrics = pd.DataFrame(stage_rows)

    macro_subject_metrics = {
        metric_name: float(subject_metrics[metric_name].mean())
        for metric_name in (
            "accuracy",
            "balanced_accuracy",
            "precision",
            "recall",
            "f1_score",
            "roc_auc",
        )
    }

    feature_ranking = (
        fold_scores.groupby("feature", as_index=False)
        .agg(
            mean_importance=("importance", "mean"),
            importance_std=("importance", "std"),
        )
        .sort_values("mean_importance", ascending=False)
        .reset_index(drop=True)
    )
    feature_ranking.insert(0, "rank", np.arange(len(feature_ranking)) + 1)
    feature_ranking["model"] = model_name

    print("\nPer-subject metrics:")
    print(
        subject_metrics[
            [
                "subject_id",
                "diagnosis",
                "accuracy",
                "balanced_accuracy",
                "precision",
                "recall",
                "f1_score",
                "roc_auc",
            ]
        ].to_string(index=False, float_format=lambda value: f"{value:.4f}")
    )

    print("\nPooled held-out-epoch metrics:")
    for metric_name, metric_value in pooled_metrics.items():
        print(f"  {metric_name}: {metric_value}")

    print("\nMacro average across held-out subjects:")
    for metric_name, metric_value in macro_subject_metrics.items():
        print(f"  {metric_name}: {metric_value}")

    print("\nMetrics by sleep stage:")
    print(
        stage_metrics[
            [
                "sleep_stage",
                "accuracy",
                "balanced_accuracy",
                "precision",
                "recall",
                "f1_score",
                "roc_auc",
            ]
        ].to_string(index=False, float_format=lambda value: f"{value:.4f}")
    )

    print("\nTop 10 features:")
    print(
        feature_ranking[["rank", "feature", "mean_importance"]]
        .head(10)
        .to_string(index=False, float_format=lambda value: f"{value:.6f}")
    )

    return {
        "pooled_metrics": pooled_metrics,
        "macro_subject_metrics": macro_subject_metrics,
        "predictions": predictions,
        "subject_metrics": subject_metrics,
        "stage_metrics": stage_metrics,
        "feature_ranking": feature_ranking,
    }


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():
    arguments = parse_arguments()
    dataset_path = arguments.dataset.resolve()
    schema_path = arguments.schema.resolve()
    output_directory = arguments.output_directory.resolve()

    if not dataset_path.exists():
        raise FileNotFoundError(f"CAP feature dataset not found: {dataset_path}")

    feature_names, schema = load_feature_names(schema_path)
    dataframe = validate_dataset(pd.read_csv(dataset_path), feature_names)
    output_directory.mkdir(parents=True, exist_ok=True)

    number_of_subjects = int(dataframe["subject_id"].nunique())

    print("=" * 79)
    print("CAP A-EVENT PILOT VALIDATION")
    print("=" * 79)
    print(f"Rows: {len(dataframe)}")
    print(f"Subjects: {number_of_subjects}")
    print(f"Features: {len(feature_names)}")
    print(f"Target: cap_a_event_present")
    print(f"Validation: LeaveOneGroupOut by subject_id")
    print(f"Folds: {number_of_subjects}")
    print(f"Decision threshold: {PREDICTION_THRESHOLD:.2f}")
    print(f"Missing feature values: 0")
    print(f"Infinite feature values: 0")
    print(f"Duplicate complete rows: {dataframe.duplicated().sum()}")

    print("\nRows by subject, stage, and target:")
    print(
        dataframe.groupby(
            ["subject_id", "sleep_stage", "cap_a_event_present"]
        ).size()
    )

    if number_of_subjects < 10:
        warnings.warn(
            "Only six independent subjects are available. Results are "
            "pilot estimates and must not be treated as clinical performance.",
            RuntimeWarning,
        )

    models = {
        "Logistic Regression": Pipeline(
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
        ),
        "Random Forest": Pipeline(
            [
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=500,
                        max_depth=10,
                        min_samples_leaf=5,
                        class_weight="balanced_subsample",
                        random_state=RANDOM_STATE,
                        n_jobs=-1,
                    ),
                )
            ]
        ),
    }

    metrics_output = {
        "dataset": str(dataset_path),
        "schema": str(schema_path),
        "rows": int(len(dataframe)),
        "subjects": number_of_subjects,
        "features": int(len(feature_names)),
        "target": "cap_a_event_present",
        "target_definition": schema.get("target_definition"),
        "validation": "LeaveOneGroupOut grouped by subject_id",
        "decision_threshold": PREDICTION_THRESHOLD,
        "models": {},
        "warning": (
            "Pilot research evaluation only. This detects 30-second epochs "
            "overlapping CAP A annotations; it is not official CAP rate or "
            "a medical diagnosis."
        ),
    }

    prediction_frames = []
    subject_metric_frames = []
    stage_metric_frames = []
    feature_ranking_frames = []

    for model_name, model_template in models.items():
        result = evaluate_model(
            model_name,
            model_template,
            dataframe,
            feature_names,
        )

        metrics_output["models"][model_name] = {
            "pooled_held_out_epoch_metrics": result["pooled_metrics"],
            "macro_subject_metrics": result["macro_subject_metrics"],
        }
        prediction_frames.append(result["predictions"])
        subject_metric_frames.append(result["subject_metrics"])
        stage_metric_frames.append(result["stage_metrics"])
        feature_ranking_frames.append(result["feature_ranking"])

    metrics_path = output_directory / "cap_pilot_metrics.json"
    predictions_path = output_directory / "cap_pilot_epoch_predictions.csv"
    subject_metrics_path = output_directory / "cap_pilot_subject_metrics.csv"
    stage_metrics_path = output_directory / "cap_pilot_stage_metrics.csv"
    rankings_path = output_directory / "cap_pilot_feature_rankings.csv"

    with metrics_path.open("w", encoding="utf-8") as file:
        json.dump(metrics_output, file, indent=2)

    pd.concat(prediction_frames, ignore_index=True).to_csv(
        predictions_path,
        index=False,
    )
    pd.concat(subject_metric_frames, ignore_index=True).to_csv(
        subject_metrics_path,
        index=False,
    )
    pd.concat(stage_metric_frames, ignore_index=True).to_csv(
        stage_metrics_path,
        index=False,
    )
    pd.concat(feature_ranking_frames, ignore_index=True).to_csv(
        rankings_path,
        index=False,
    )

    print("\n" + "=" * 79)
    print("CAP PILOT VALIDATION COMPLETED")
    print("=" * 79)
    print(f"Metrics: {metrics_path}")
    print(f"Epoch predictions: {predictions_path}")
    print(f"Subject metrics: {subject_metrics_path}")
    print(f"Stage metrics: {stage_metrics_path}")
    print(f"Feature rankings: {rankings_path}")
    print("\nNo deployable model was saved.")


if __name__ == "__main__":
    main()
