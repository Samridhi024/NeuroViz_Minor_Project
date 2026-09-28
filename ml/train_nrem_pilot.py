from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

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
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


RANDOM_STATE = 42
PREDICTION_THRESHOLD = 0.50

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_DATASET = (
    PROJECT_ROOT / "ml" / "artifacts" / "nrem_epoch_features.csv"
)

DEFAULT_SCHEMA = (
    PROJECT_ROOT / "ml" / "artifacts" / "nrem_feature_schema.json"
)

DEFAULT_OUTPUT_DIRECTORY = PROJECT_ROOT / "ml" / "artifacts"


def parse_arguments():
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate pilot insomnia-pattern classifiers using "
            "subject-wise cross-validation."
        )
    )

    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET,
        help="Path to nrem_epoch_features.csv",
    )

    parser.add_argument(
        "--schema",
        type=Path,
        default=DEFAULT_SCHEMA,
        help="Path to nrem_feature_schema.json",
    )

    parser.add_argument(
        "--output-directory",
        type=Path,
        default=DEFAULT_OUTPUT_DIRECTORY,
        help="Directory for evaluation outputs",
    )

    return parser.parse_args()


def load_feature_names(schema_path: Path) -> list[str]:
    if not schema_path.exists():
        raise FileNotFoundError(
            f"Feature schema was not found: {schema_path}"
        )

    with schema_path.open("r", encoding="utf-8") as file:
        schema = json.load(file)

    feature_names = None

    for key in ("feature_names", "feature_columns", "features"):
        value = schema.get(key)

        if isinstance(value, list) and value:
            feature_names = value
            break

    if feature_names is None:
        raise ValueError(
            "Could not find feature_names, feature_columns, or features "
            f"in {schema_path.name}."
        )

    # Also support a schema containing:
    # [{"name": "feature_1"}, {"name": "feature_2"}]
    if isinstance(feature_names[0], dict):
        feature_names = [
            item["name"]
            for item in feature_names
            if "name" in item
        ]

    feature_names = [str(name) for name in feature_names]

    if not feature_names:
        raise ValueError("The feature schema contains no feature names.")

    if len(feature_names) != len(set(feature_names)):
        raise ValueError("Duplicate feature names were found in the schema.")

    return feature_names


def validate_dataset(
    dataframe: pd.DataFrame,
    feature_names: list[str],
) -> pd.DataFrame:
    required_columns = {
        "subject_id",
        "diagnosis",
        "diagnosis_label",
        "sleep_stage",
    }

    missing_metadata = sorted(
        required_columns.difference(dataframe.columns)
    )

    if missing_metadata:
        raise ValueError(
            "Dataset is missing metadata columns: "
            + ", ".join(missing_metadata)
        )

    missing_features = sorted(
        set(feature_names).difference(dataframe.columns)
    )

    if missing_features:
        raise ValueError(
            "Dataset is missing feature columns: "
            + ", ".join(missing_features)
        )

    dataframe = dataframe.copy()

    dataframe["subject_id"] = (
        dataframe["subject_id"].astype(str).str.strip()
    )

    dataframe["diagnosis"] = (
        dataframe["diagnosis"].astype(str).str.strip().str.lower()
    )

    dataframe["sleep_stage"] = (
        dataframe["sleep_stage"].astype(str).str.strip().str.upper()
    )

    dataframe["diagnosis_label"] = pd.to_numeric(
        dataframe["diagnosis_label"],
        errors="raise",
    ).astype(int)

    invalid_labels = sorted(
        set(dataframe["diagnosis_label"].unique()).difference({0, 1})
    )

    if invalid_labels:
        raise ValueError(
            f"Unexpected diagnosis labels: {invalid_labels}. "
            "Expected normal=0 and insomnia=1."
        )

    normal_labels = set(
        dataframe.loc[
            dataframe["diagnosis"] == "normal",
            "diagnosis_label",
        ].unique()
    )

    insomnia_labels = set(
        dataframe.loc[
            dataframe["diagnosis"] == "insomnia",
            "diagnosis_label",
        ].unique()
    )

    if normal_labels != {0}:
        raise ValueError(
            f"Normal recordings should have label 0, found {normal_labels}."
        )

    if insomnia_labels != {1}:
        raise ValueError(
            "Insomnia recordings should have label 1, "
            f"found {insomnia_labels}."
        )

    invalid_stages = sorted(
        set(dataframe["sleep_stage"].unique()).difference({"N2", "N3"})
    )

    if invalid_stages:
        raise ValueError(
            f"Unexpected sleep stages: {invalid_stages}. "
            "This pilot expects only N2 and N3."
        )

    for feature_name in feature_names:
        dataframe[feature_name] = pd.to_numeric(
            dataframe[feature_name],
            errors="coerce",
        )

    feature_array = dataframe[feature_names].to_numpy(dtype=float)

    missing_values = int(np.isnan(feature_array).sum())
    infinite_values = int(np.isinf(feature_array).sum())

    if missing_values:
        raise ValueError(
            f"Feature matrix contains {missing_values} missing values."
        )

    if infinite_values:
        raise ValueError(
            f"Feature matrix contains {infinite_values} infinite values."
        )

    subject_diagnosis_counts = (
        dataframe.groupby("subject_id")["diagnosis"].nunique()
    )

    inconsistent_subjects = subject_diagnosis_counts[
        subject_diagnosis_counts != 1
    ]

    if not inconsistent_subjects.empty:
        raise ValueError(
            "Some subjects have more than one diagnosis: "
            + ", ".join(inconsistent_subjects.index)
        )

    subject_label_counts = (
        dataframe.groupby("subject_id")["diagnosis_label"].nunique()
    )

    inconsistent_labels = subject_label_counts[
        subject_label_counts != 1
    ]

    if not inconsistent_labels.empty:
        raise ValueError(
            "Some subjects have more than one diagnosis label: "
            + ", ".join(inconsistent_labels.index)
        )

    return dataframe


def calculate_subject_metrics(
    subject_predictions: pd.DataFrame,
) -> dict:
    y_true = subject_predictions["diagnosis_label"].to_numpy(dtype=int)
    y_pred = subject_predictions["predicted_label"].to_numpy(dtype=int)
    probabilities = subject_predictions[
        "probability_insomnia"
    ].to_numpy(dtype=float)

    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(
            balanced_accuracy_score(y_true, y_pred)
        ),
        "precision": float(
            precision_score(
                y_true,
                y_pred,
                zero_division=0,
            )
        ),
        "recall": float(
            recall_score(
                y_true,
                y_pred,
                zero_division=0,
            )
        ),
        "f1_score": float(
            f1_score(
                y_true,
                y_pred,
                zero_division=0,
            )
        ),
        "confusion_matrix": confusion_matrix(
            y_true,
            y_pred,
            labels=[0, 1],
        ).tolist(),
    }

    if len(np.unique(y_true)) == 2:
        metrics["roc_auc"] = float(
            roc_auc_score(y_true, probabilities)
        )
    else:
        metrics["roc_auc"] = None

    return metrics


def extract_feature_scores(
    fitted_pipeline: Pipeline,
    feature_names: list[str],
) -> pd.DataFrame:
    classifier = fitted_pipeline.named_steps["classifier"]

    if hasattr(classifier, "coef_"):
        raw_scores = np.abs(classifier.coef_[0])
    elif hasattr(classifier, "feature_importances_"):
        raw_scores = classifier.feature_importances_
    else:
        raw_scores = np.zeros(len(feature_names), dtype=float)

    return pd.DataFrame(
        {
            "feature": feature_names,
            "importance": np.asarray(raw_scores, dtype=float),
        }
    )


def evaluate_model(
    model_name: str,
    model_template: Pipeline,
    dataframe: pd.DataFrame,
    feature_names: list[str],
    splits,
):
    all_subject_predictions = []
    all_stage_predictions = []
    fold_feature_scores = []

    X = dataframe[feature_names]
    y = dataframe["diagnosis_label"]
    groups = dataframe["subject_id"]

    print()
    print("=" * 79)
    print(f"MODEL: {model_name}")
    print("=" * 79)

    for fold_number, (train_indices, validation_indices) in enumerate(
        splits,
        start=1,
    ):
        training_data = dataframe.iloc[train_indices].copy()
        validation_data = dataframe.iloc[validation_indices].copy()

        training_subjects = sorted(
            training_data["subject_id"].unique().tolist()
        )

        validation_subjects = sorted(
            validation_data["subject_id"].unique().tolist()
        )

        overlap = sorted(
            set(training_subjects).intersection(validation_subjects)
        )

        print()
        print(f"Fold {fold_number}")
        print(f"Training subjects:   {training_subjects}")
        print(f"Validation subjects: {validation_subjects}")
        print(f"Subject overlap:     {overlap}")

        if overlap:
            raise RuntimeError(
                "Subject leakage detected in cross-validation."
            )

        model = clone(model_template)

        model.fit(
            X.iloc[train_indices],
            y.iloc[train_indices],
        )

        positive_class_index = list(model.classes_).index(1)

        validation_probabilities = model.predict_proba(
            X.iloc[validation_indices]
        )[:, positive_class_index]

        validation_data["probability_insomnia"] = (
            validation_probabilities
        )

        validation_data["fold"] = fold_number
        validation_data["model"] = model_name

        # Aggregate epoch predictions into one prediction per subject.
        subject_predictions = (
            validation_data.groupby("subject_id", as_index=False)
            .agg(
                diagnosis=("diagnosis", "first"),
                diagnosis_label=("diagnosis_label", "first"),
                probability_insomnia=(
                    "probability_insomnia",
                    "mean",
                ),
                epoch_probability_std=(
                    "probability_insomnia",
                    "std",
                ),
                evaluated_epochs=("probability_insomnia", "size"),
            )
        )

        subject_predictions["predicted_label"] = (
            subject_predictions["probability_insomnia"]
            >= PREDICTION_THRESHOLD
        ).astype(int)

        subject_predictions["predicted_diagnosis"] = np.where(
            subject_predictions["predicted_label"] == 1,
            "insomnia-pattern",
            "normal-pattern",
        )

        subject_predictions["fold"] = fold_number
        subject_predictions["model"] = model_name

        # Keep separate N2 and N3 probabilities for analysis.
        stage_predictions = (
            validation_data.groupby(
                [
                    "subject_id",
                    "diagnosis",
                    "diagnosis_label",
                    "sleep_stage",
                ],
                as_index=False,
            )
            .agg(
                probability_insomnia=(
                    "probability_insomnia",
                    "mean",
                ),
                epoch_probability_std=(
                    "probability_insomnia",
                    "std",
                ),
                evaluated_epochs=("probability_insomnia", "size"),
            )
        )

        stage_predictions["fold"] = fold_number
        stage_predictions["model"] = model_name

        stage_wide = stage_predictions.pivot(
            index="subject_id",
            columns="sleep_stage",
            values="probability_insomnia",
        ).reset_index()

        stage_wide = stage_wide.rename(
            columns={
                "N2": "n2_probability_insomnia",
                "N3": "n3_probability_insomnia",
            }
        )

        subject_predictions = subject_predictions.merge(
            stage_wide,
            on="subject_id",
            how="left",
        )

        if {
            "n2_probability_insomnia",
            "n3_probability_insomnia",
        }.issubset(subject_predictions.columns):
            subject_predictions["n3_minus_n2_probability"] = (
                subject_predictions["n3_probability_insomnia"]
                - subject_predictions["n2_probability_insomnia"]
            )

        feature_scores = extract_feature_scores(
            model,
            feature_names,
        )

        feature_scores["fold"] = fold_number
        feature_scores["model"] = model_name

        fold_feature_scores.append(feature_scores)
        all_subject_predictions.append(subject_predictions)
        all_stage_predictions.append(stage_predictions)

    subject_predictions = pd.concat(
        all_subject_predictions,
        ignore_index=True,
    )

    stage_predictions = pd.concat(
        all_stage_predictions,
        ignore_index=True,
    )

    feature_scores = pd.concat(
        fold_feature_scores,
        ignore_index=True,
    )

    feature_ranking = (
        feature_scores.groupby("feature", as_index=False)
        .agg(
            mean_importance=("importance", "mean"),
            importance_std=("importance", "std"),
        )
        .sort_values(
            "mean_importance",
            ascending=False,
        )
        .reset_index(drop=True)
    )

    feature_ranking["rank"] = (
        np.arange(len(feature_ranking)) + 1
    )

    feature_ranking["model"] = model_name

    metrics = calculate_subject_metrics(subject_predictions)

    print()
    print("Subject predictions:")

    display_columns = [
        "subject_id",
        "diagnosis",
        "probability_insomnia",
        "n2_probability_insomnia",
        "n3_probability_insomnia",
        "predicted_diagnosis",
        "fold",
    ]

    display_columns = [
        column
        for column in display_columns
        if column in subject_predictions.columns
    ]

    print(
        subject_predictions[display_columns].to_string(
            index=False,
            float_format=lambda value: f"{value:.4f}",
        )
    )

    print()
    print("Subject-level metrics:")

    for metric_name, metric_value in metrics.items():
        print(f"  {metric_name}: {metric_value}")

    print()
    print("Top 10 features:")

    print(
        feature_ranking[
            ["rank", "feature", "mean_importance"]
        ]
        .head(10)
        .to_string(
            index=False,
            float_format=lambda value: f"{value:.6f}",
        )
    )

    return {
        "metrics": metrics,
        "subject_predictions": subject_predictions,
        "stage_predictions": stage_predictions,
        "feature_ranking": feature_ranking,
    }


def main():
    args = parse_arguments()

    dataset_path = args.dataset.resolve()
    schema_path = args.schema.resolve()
    output_directory = args.output_directory.resolve()

    if not dataset_path.exists():
        raise FileNotFoundError(
            f"NREM feature dataset was not found: {dataset_path}"
        )

    output_directory.mkdir(parents=True, exist_ok=True)

    feature_names = load_feature_names(schema_path)

    dataframe = pd.read_csv(dataset_path)

    dataframe = validate_dataset(
        dataframe,
        feature_names,
    )

    subject_table = (
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

    subjects_per_class = (
        subject_table.groupby("diagnosis_label")["subject_id"].nunique()
    )

    if len(subjects_per_class) != 2:
        raise ValueError(
            "Both normal and insomnia subjects are required."
        )

    minimum_subjects_in_class = int(subjects_per_class.min())

    if minimum_subjects_in_class < 2:
        raise ValueError(
            "At least two subjects per diagnosis are required."
        )

    number_of_splits = min(3, minimum_subjects_in_class)

    print("=" * 79)
    print("STAGE-BALANCED NREM PILOT VALIDATION")
    print("=" * 79)
    print(f"Rows: {len(dataframe)}")
    print(f"Subjects: {dataframe['subject_id'].nunique()}")
    print(f"Features: {len(feature_names)}")
    print(f"Cross-validation folds: {number_of_splits}")
    print(f"Decision threshold: {PREDICTION_THRESHOLD:.2f}")
    print(f"Missing feature values: 0")
    print(f"Infinite feature values: 0")
    print(f"Duplicate complete rows: {dataframe.duplicated().sum()}")

    print()
    print("Subjects by diagnosis:")

    print(
        subject_table.groupby(
            ["diagnosis_label", "diagnosis"]
        )["subject_id"].nunique()
    )

    print()
    print("Epoch rows by subject and stage:")

    print(
        dataframe.groupby(
            ["subject_id", "diagnosis", "sleep_stage"]
        ).size()
    )

    if dataframe["subject_id"].nunique() < 10:
        warnings.warn(
            "Only six independent subjects are currently available. "
            "The results are pilot estimates and must not be deployed "
            "or interpreted as clinical performance.",
            RuntimeWarning,
        )

    X = dataframe[feature_names]
    y = dataframe["diagnosis_label"]
    groups = dataframe["subject_id"]

    cross_validator = StratifiedGroupKFold(
        n_splits=number_of_splits,
        shuffle=True,
        random_state=RANDOM_STATE,
    )

    splits = list(
        cross_validator.split(
            X,
            y,
            groups=groups,
        )
    )

    models = {
        "Logistic Regression": Pipeline(
            steps=[
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
            steps=[
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
                ),
            ]
        ),
    }

    metrics_output = {
        "dataset": str(dataset_path),
        "schema": str(schema_path),
        "rows": int(len(dataframe)),
        "subjects": int(dataframe["subject_id"].nunique()),
        "features": int(len(feature_names)),
        "cross_validation": {
            "method": "StratifiedGroupKFold",
            "group": "subject_id",
            "folds": number_of_splits,
            "shuffle": True,
            "random_state": RANDOM_STATE,
        },
        "aggregation": (
            "Mean epoch probability per validation subject"
        ),
        "decision_threshold": PREDICTION_THRESHOLD,
        "models": {},
        "warning": (
            "Pilot validation only. Six subjects are insufficient "
            "for deployment or clinical claims."
        ),
    }

    subject_prediction_frames = []
    stage_prediction_frames = []
    feature_ranking_frames = []

    for model_name, model_template in models.items():
        result = evaluate_model(
            model_name=model_name,
            model_template=model_template,
            dataframe=dataframe,
            feature_names=feature_names,
            splits=splits,
        )

        metrics_output["models"][model_name] = result["metrics"]

        subject_prediction_frames.append(
            result["subject_predictions"]
        )

        stage_prediction_frames.append(
            result["stage_predictions"]
        )

        feature_ranking_frames.append(
            result["feature_ranking"]
        )

    subject_predictions = pd.concat(
        subject_prediction_frames,
        ignore_index=True,
    )

    stage_predictions = pd.concat(
        stage_prediction_frames,
        ignore_index=True,
    )

    feature_rankings = pd.concat(
        feature_ranking_frames,
        ignore_index=True,
    )

    metrics_path = (
        output_directory / "nrem_pilot_metrics.json"
    )

    subject_predictions_path = (
        output_directory / "nrem_pilot_subject_predictions.csv"
    )

    stage_predictions_path = (
        output_directory / "nrem_pilot_stage_predictions.csv"
    )

    feature_rankings_path = (
        output_directory / "nrem_pilot_feature_rankings.csv"
    )

    with metrics_path.open("w", encoding="utf-8") as file:
        json.dump(
            metrics_output,
            file,
            indent=2,
        )

    subject_predictions.to_csv(
        subject_predictions_path,
        index=False,
    )

    stage_predictions.to_csv(
        stage_predictions_path,
        index=False,
    )

    feature_rankings.to_csv(
        feature_rankings_path,
        index=False,
    )

    print()
    print("=" * 79)
    print("NREM PILOT VALIDATION COMPLETED")
    print("=" * 79)
    print(f"Metrics: {metrics_path}")
    print(f"Subject predictions: {subject_predictions_path}")
    print(f"Stage predictions: {stage_predictions_path}")
    print(f"Feature rankings: {feature_rankings_path}")
    print()
    print(
        "No deployable model was saved. More independent subjects "
        "are required before final training."
    )


if __name__ == "__main__":
    main()