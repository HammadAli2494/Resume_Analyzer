"""Grouped cross-validation for the project CSV.

Run from ml-service: python training/cross_validate.py

Folds keep a job description entirely on one side. This is not an independent
hiring evaluation, and it is not the saved model's holdout score.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import CV_REPORT_PATH, MIN_REAL_TRAINING_ROWS, MODELS_DIR, RANDOM_SEED, REAL_TRAINING_CSV, TRAINING_CSV
from features import build_matrix
from skill_match import MATCHER_VERSION


def _group_id(text: str) -> str:
    normalized = " ".join(str(text or "").lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def run_cross_validation(n_splits: int = 4, use_project_csv: bool = True) -> dict:
    path = REAL_TRAINING_CSV if use_project_csv and REAL_TRAINING_CSV.exists() else TRAINING_CSV
    if not path.exists():
        raise FileNotFoundError(f"No dataset at {path}.")

    df = pd.read_csv(path)
    if len(df) < MIN_REAL_TRAINING_ROWS and path == REAL_TRAINING_CSV:
        raise ValueError(f"Need >= {MIN_REAL_TRAINING_ROWS} rows, got {len(df)}")
    df = df.copy()
    df["job_group"] = df["job_text"].map(_group_id)
    groups = df["job_group"].to_numpy()
    unique_groups = int(df["job_group"].nunique())
    splits = min(n_splits, unique_groups)
    if splits < 2:
        raise ValueError("Need at least 2 job-description groups.")

    X = build_matrix(df, skill_matcher=MATCHER_VERSION)
    y = df["label"].to_numpy().astype(int)
    folder = GroupKFold(n_splits=splits)
    fold_scores = []
    for train_idx, test_idx in folder.split(X, y, groups):
        if len(set(y[train_idx])) < 2 or len(set(y[test_idx])) < 2:
            continue
        model = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_SEED)),
        ])
        model.fit(X[train_idx], y[train_idx])
        probability = model.predict_proba(X[test_idx])[:, 1]
        predicted = (probability >= 0.5).astype(int)
        fold_scores.append({
            "accuracy": accuracy_score(y[test_idx], predicted),
            "precision": precision_score(y[test_idx], predicted, zero_division=0),
            "recall": recall_score(y[test_idx], predicted, zero_division=0),
            "f1": f1_score(y[test_idx], predicted, zero_division=0),
            "roc_auc": roc_auc_score(y[test_idx], probability),
        })
    if not fold_scores:
        raise ValueError("Grouped folds did not contain both labels.")
    report = {
        "n_splits": splits,
        "splitter": "GroupKFold",
        "groups_separated": "normalized job description text",
        "dataset_path_name": path.name,
        "dataset_size": int(len(df)),
        "unique_job_descriptions": unique_groups,
        "model": "logistic_regression",
        "skill_matcher": MATCHER_VERSION,
        "note": (
            "GroupKFold on this project CSV. Job descriptions are not shared across a fold. "
            "Resume text may still overlap. This is not real-world hiring accuracy and it is "
            "not the holdout score of the saved classifier."
        ),
        "real_world_accuracy": "unverified",
        "folds_used": len(fold_scores),
        "metrics_mean": {
            key: round(float(np.mean([row[key] for row in fold_scores])), 4)
            for key in ("accuracy", "precision", "recall", "f1", "roc_auc")
        },
        "metrics_std": {
            "f1": round(float(np.std([row["f1"] for row in fold_scores])), 4),
            "roc_auc": round(float(np.std([row["roc_auc"] for row in fold_scores])), 4),
        },
    }
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    CV_REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(run_cross_validation(), indent=2))
