"""5-fold cross-validation — run: python ml/src/cross_validate.py"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_validate, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import CV_REPORT_PATH, RANDOM_SEED, REAL_TRAINING_CSV, TRAINING_CSV, MIN_REAL_TRAINING_ROWS
from features import build_matrix


def run_cross_validation(n_splits: int = 5, use_real_csv: bool = True) -> dict:
    path = REAL_TRAINING_CSV if use_real_csv and REAL_TRAINING_CSV.exists() else TRAINING_CSV
    if not path.exists():
        raise FileNotFoundError(f"No dataset at {path}. Run import_seed_data and export first.")

    df = pd.read_csv(path)
    if len(df) < MIN_REAL_TRAINING_ROWS:
        raise ValueError(f"Need >= {MIN_REAL_TRAINING_ROWS} rows, got {len(df)}")

    X = build_matrix(df, fit=True)
    y = df["label"].values.astype(int)

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_SEED)),
    ])

    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_SEED)
    scores = cross_validate(
        model, X, y, cv=cv,
        scoring=["accuracy", "precision", "recall", "f1", "roc_auc"],
    )

    report = {
        "n_splits": n_splits,
        "dataset_path": str(path),
        "dataset_size": len(df),
        "metrics_mean": {
            "accuracy": round(float(np.mean(scores["test_accuracy"])), 4),
            "precision": round(float(np.mean(scores["test_precision"])), 4),
            "recall": round(float(np.mean(scores["test_recall"])), 4),
            "f1": round(float(np.mean(scores["test_f1"])), 4),
            "roc_auc": round(float(np.mean(scores["test_roc_auc"])), 4),
        },
        "metrics_std": {
            "f1": round(float(np.std(scores["test_f1"])), 4),
            "roc_auc": round(float(np.std(scores["test_roc_auc"])), 4),
        },
    }

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    CV_REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    r = run_cross_validation()
    print(json.dumps(r, indent=2))
