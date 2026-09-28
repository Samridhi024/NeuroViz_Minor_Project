from pathlib import Path
import json

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
from sklearn.model_selection import (
    StratifiedGroupKFold,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]

ARTIFACT_DIR = (
    PROJECT_ROOT
    / "ml"
    / "artifacts"
)

FEATURE_FILE = (
    ARTIFACT_DIR
    / "epoch_features.csv"
)

SCHEMA_FILE = (
    ARTIFACT_DIR
    / "feature_schema.json"
)

METRICS_FILE = (
    ARTIFACT_DIR
    / "pilot_model_metrics.json"
)

PREDICTIONS_FILE = (
    ARTIFACT_DIR
    / "pilot_subject_predictions.csv"
)


# ---------------------------------------------------------
# DATA VALIDATION
# ---------------------------------------------------------

def load_and_validate_dataset():
    """Load and verify the generated feature dataset."""

    if not FEATURE_FILE.exists():
        raise FileNotFoundError(
            f"Feature CSV was not found:\n"
            f"{FEATURE_FILE}"
        )

    if not SCHEMA_FILE.exists():
        raise FileNotFoundError(
            f"Feature schema was not found:\n"
            f"{SCHEMA_FILE}"
        )

    dataframe = pd.read_csv(FEATURE_FILE)

    with SCHEMA_FILE.open(
        "r",
        encoding="utf-8",
    ) as schema_file:
        schema = json.load(schema_file)

    feature_columns = schema[
        "feature_columns"
    ]

    missing_columns = [
        column
        for column in feature_columns
        if column not in dataframe.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing feature columns: "
            f"{missing_columns}"
        )

    required_metadata = {
        "subject_id",
        "diagnosis",
        "diagnosis_label",
    }

    missing_metadata = (
        required_metadata
        - set(dataframe.columns)
    )

    if missing_metadata:
        raise ValueError(
            f"Missing metadata columns: "
            f"{sorted(missing_metadata)}"
        )

    # A subject must never have multiple labels
    labels_per_subject = (
        dataframe
        .groupby("subject_id")[
            "diagnosis_label"
        ]
        .nunique()
    )

    invalid_subjects = (
        labels_per_subject[
            labels_per_subject != 1
        ]
        .index
        .tolist()
    )

    if invalid_subjects:
        raise ValueError(
            "Subjects with inconsistent labels: "
            f"{invalid_subjects}"
        )

    X = dataframe[
        feature_columns
    ].to_numpy(dtype=np.float64)

    y = dataframe[
        "diagnosis_label"
    ].to_numpy(dtype=np.int64)

    groups = dataframe[
        "subject_id"
    ].astype(str).to_numpy()

    if np.isnan(X).any():
        raise ValueError(
            "Feature dataset contains NaN."
        )

    if np.isinf(X).any():
        raise ValueError(
            "Feature dataset contains infinity."
        )

    unique_classes = np.unique(y)

    if len(unique_classes) != 2:
        raise ValueError(
            "Exactly two classes are required."
        )

    subjects_per_class = (
        dataframe[
            [
                "subject_id",
                "diagnosis_label",
            ]
        ]
        .drop_duplicates()
        .groupby("diagnosis_label")
        .size()
    )

    if subjects_per_class.min() < 3:
        raise ValueError(
            "Pilot validation requires at least "
            "three subjects in each class."
        )

    print("=" * 75)
    print("PILOT DATASET VALIDATION")
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
        f"Missing feature values: "
        f"{int(dataframe[feature_columns].isna().sum().sum())}"
    )
    print(
        f"Duplicate complete rows: "
        f"{int(dataframe.duplicated().sum())}"
    )

    print("\nSubjects by class:")
    print(subjects_per_class.to_string())

    return (
        dataframe,
        feature_columns,
        X,
        y,
        groups,
    )


# ---------------------------------------------------------
# METRICS
# ---------------------------------------------------------

def calculate_metrics(
    true_labels,
    predicted_labels,
    probabilities,
):
    """Calculate binary classification metrics."""

    results = {
        "accuracy": float(
            accuracy_score(
                true_labels,
                predicted_labels,
            )
        ),
        "balanced_accuracy": float(
            balanced_accuracy_score(
                true_labels,
                predicted_labels,
            )
        ),
        "precision": float(
            precision_score(
                true_labels,
                predicted_labels,
                zero_division=0,
            )
        ),
        "recall": float(
            recall_score(
                true_labels,
                predicted_labels,
                zero_division=0,
            )
        ),
        "f1_score": float(
            f1_score(
                true_labels,
                predicted_labels,
                zero_division=0,
            )
        ),
        "confusion_matrix": (
            confusion_matrix(
                true_labels,
                predicted_labels,
                labels=[0, 1],
            )
            .astype(int)
            .tolist()
        ),
    }

    if len(np.unique(true_labels)) == 2:
        results["roc_auc"] = float(
            roc_auc_score(
                true_labels,
                probabilities,
            )
        )
    else:
        results["roc_auc"] = None

    return results


# ---------------------------------------------------------
# MODEL EVALUATION
# ---------------------------------------------------------

def evaluate_model(
    model_name,
    model,
    dataframe,
    X,
    y,
    groups,
):
    """
    Evaluate a model using subject-wise validation.

    No epoch belonging to one subject can appear
    in both training and validation.
    """

    cross_validator = StratifiedGroupKFold(
        n_splits=3,
        shuffle=True,
        random_state=42,
    )

    epoch_predictions = []
    fold_details = []

    print("\n" + "=" * 75)
    print(f"MODEL: {model_name}")
    print("=" * 75)

    for fold_number, (
        training_indices,
        validation_indices,
    ) in enumerate(
        cross_validator.split(
            X,
            y,
            groups=groups,
        ),
        start=1,
    ):
        training_subjects = sorted(
            np.unique(
                groups[training_indices]
            ).tolist()
        )

        validation_subjects = sorted(
            np.unique(
                groups[validation_indices]
            ).tolist()
        )

        overlapping_subjects = (
            set(training_subjects)
            & set(validation_subjects)
        )

        if overlapping_subjects:
            raise RuntimeError(
                "Subject leakage detected: "
                f"{sorted(overlapping_subjects)}"
            )

        print(f"\nFold {fold_number}")
        print(
            f"Training subjects: "
            f"{training_subjects}"
        )
        print(
            f"Validation subjects: "
            f"{validation_subjects}"
        )
        print(
            f"Overlap: "
            f"{sorted(overlapping_subjects)}"
        )

        fold_model = clone(model)

        fold_model.fit(
            X[training_indices],
            y[training_indices],
        )

        class_labels = fold_model.classes_

        positive_class_index = int(
            np.where(class_labels == 1)[0][0]
        )

        probabilities = (
            fold_model.predict_proba(
                X[validation_indices]
            )[:, positive_class_index]
        )

        predicted_labels = (
            probabilities >= 0.5
        ).astype(int)

        validation_metadata = (
            dataframe
            .iloc[validation_indices][
                [
                    "subject_id",
                    "diagnosis",
                    "diagnosis_label",
                    "epoch_index",
                ]
            ]
            .reset_index(drop=True)
        )

        validation_metadata[
            "probability_insomnia"
        ] = probabilities

        validation_metadata[
            "predicted_label"
        ] = predicted_labels

        validation_metadata[
            "fold"
        ] = fold_number

        epoch_predictions.append(
            validation_metadata
        )

        fold_details.append(
            {
                "fold": fold_number,
                "training_subjects": (
                    training_subjects
                ),
                "validation_subjects": (
                    validation_subjects
                ),
                "subject_overlap": (
                    sorted(overlapping_subjects)
                ),
                "training_epochs": int(
                    len(training_indices)
                ),
                "validation_epochs": int(
                    len(validation_indices)
                ),
            }
        )

    all_epoch_predictions = pd.concat(
        epoch_predictions,
        ignore_index=True,
    )

    # Aggregate epoch predictions to one result
    # for each independent subject.
    subject_predictions = (
        all_epoch_predictions
        .groupby(
            [
                "subject_id",
                "diagnosis",
                "diagnosis_label",
            ],
            as_index=False,
        )
        .agg(
            probability_insomnia=(
                "probability_insomnia",
                "mean",
            ),
            epoch_count=(
                "epoch_index",
                "count",
            ),
            fold=(
                "fold",
                "first",
            ),
        )
    )

    subject_predictions[
        "predicted_label"
    ] = (
        subject_predictions[
            "probability_insomnia"
        ] >= 0.5
    ).astype(int)

    subject_predictions[
        "predicted_diagnosis"
    ] = subject_predictions[
        "predicted_label"
    ].map(
        {
            0: "normal-pattern",
            1: "insomnia-pattern",
        }
    )

    subject_metrics = calculate_metrics(
        subject_predictions[
            "diagnosis_label"
        ].to_numpy(),
        subject_predictions[
            "predicted_label"
        ].to_numpy(),
        subject_predictions[
            "probability_insomnia"
        ].to_numpy(),
    )

    epoch_metrics = calculate_metrics(
        all_epoch_predictions[
            "diagnosis_label"
        ].to_numpy(),
        all_epoch_predictions[
            "predicted_label"
        ].to_numpy(),
        all_epoch_predictions[
            "probability_insomnia"
        ].to_numpy(),
    )

    print("\nSubject predictions:")

    print(
        subject_predictions[
            [
                "subject_id",
                "diagnosis",
                "probability_insomnia",
                "predicted_diagnosis",
                "fold",
            ]
        ].to_string(
            index=False,
            float_format=lambda value: (
                f"{value:.4f}"
            ),
        )
    )

    print("\nSubject-level metrics:")

    for metric_name, value in (
        subject_metrics.items()
    ):
        print(
            f"  {metric_name}: {value}"
        )

    return {
        "model_name": model_name,
        "folds": fold_details,
        "subject_metrics": subject_metrics,
        "epoch_metrics": epoch_metrics,
        "subject_predictions": (
            subject_predictions
        ),
    }


# ---------------------------------------------------------
# MAIN TRAINING TEST
# ---------------------------------------------------------

def main():
    (
        dataframe,
        feature_columns,
        X,
        y,
        groups,
    ) = load_and_validate_dataset()

    models = {
        "Logistic Regression": Pipeline(
            steps=[
                (
                    "scaler",
                    StandardScaler(),
                ),
                (
                    "classifier",
                    LogisticRegression(
                        class_weight="balanced",
                        max_iter=5000,
                        random_state=42,
                    ),
                ),
            ]
        ),

        "Random Forest": (
            RandomForestClassifier(
                n_estimators=300,
                min_samples_leaf=5,
                class_weight=(
                    "balanced_subsample"
                ),
                random_state=42,
                n_jobs=-1,
            )
        ),
    }

    complete_metrics = {
        "evaluation_type": (
            "pilot_subject_wise_cross_validation"
        ),
        "warning": (
            "Pilot results use six subjects and "
            "the first 120 epochs per subject. "
            "They are not final clinical results."
        ),
        "number_of_rows": int(
            len(dataframe)
        ),
        "number_of_subjects": int(
            dataframe[
                "subject_id"
            ].nunique()
        ),
        "number_of_features": int(
            len(feature_columns)
        ),
        "models": {},
    }

    all_subject_predictions = []

    for model_name, model in models.items():
        evaluation = evaluate_model(
            model_name=model_name,
            model=model,
            dataframe=dataframe,
            X=X,
            y=y,
            groups=groups,
        )

        complete_metrics["models"][
            model_name
        ] = {
            "folds": evaluation["folds"],
            "subject_metrics": (
                evaluation["subject_metrics"]
            ),
            "epoch_metrics": (
                evaluation["epoch_metrics"]
            ),
        }

        model_predictions = (
            evaluation[
                "subject_predictions"
            ].copy()
        )

        model_predictions[
            "model"
        ] = model_name

        all_subject_predictions.append(
            model_predictions
        )

    combined_predictions = pd.concat(
        all_subject_predictions,
        ignore_index=True,
    )

    combined_predictions.to_csv(
        PREDICTIONS_FILE,
        index=False,
    )

    with METRICS_FILE.open(
        "w",
        encoding="utf-8",
    ) as metrics_file:
        json.dump(
            complete_metrics,
            metrics_file,
            indent=2,
        )

    print("\n" + "=" * 75)
    print("PILOT TRAINING COMPLETED")
    print("=" * 75)

    print(
        f"Metrics saved to:\n"
        f"{METRICS_FILE}"
    )

    print(
        f"\nSubject predictions saved to:\n"
        f"{PREDICTIONS_FILE}"
    )

    print(
        "\nDo not deploy a pilot model. "
        "Final training requires more subjects "
        "and representative sleep epochs."
    )


if __name__ == "__main__":
    main()