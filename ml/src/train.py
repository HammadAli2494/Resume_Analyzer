"""Train supervised match classifier and save artifacts."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from config import (
    METRICS_PATH,
    MIN_REAL_TRAINING_ROWS,
    MODEL_CARD_JSON,
    MODEL_PATH,
    MODELS_DIR,
    RANDOM_SEED,
    REAL_TRAINING_CSV,
    TRAINING_CSV,
)
from evaluate import save_evaluation
from features import FEATURE_NAMES, build_matrix
from synthetic_data import save_dataset


def _metrics(y_true, y_pred, y_prob) -> dict:
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, y_prob)), 4),
    }


def _baseline_tfidf_rule(df_test: pd.DataFrame) -> dict:
    from features import extract_features

    probs = []
    labels = []
    for _, row in df_test.iterrows():
        feats = extract_features(row["resume_text"], row["job_text"])
        prob = 0.5 * feats[0] + 0.5 * feats[3]
        probs.append(min(max(prob, 0), 1))
        labels.append(1 if prob >= 0.35 else 0)
    y_true = df_test["label"].values
    return _metrics(y_true, np.array(labels), np.array(probs))


def _load_training_frame(csv_path=None, real_only: bool = False) -> tuple[pd.DataFrame, str]:
    """Resolve dataset path and validate real-data requirements."""
    use_real = real_only or os.environ.get("REAL_TRAINING") == "1"
    required = {"resume_text", "job_text", "label"}

    if use_real:
        path = Path(csv_path) if csv_path else REAL_TRAINING_CSV
        if not path.exists():
            raise ValueError(
                f"Real training CSV not found at {path}. "
                "Export verified pairs first or run: python manage.py import_seed_data"
            )
        df = pd.read_csv(path)
        if not required.issubset(df.columns):
            raise ValueError(f"CSV must contain columns: {required}")
        if len(df) < MIN_REAL_TRAINING_ROWS:
            raise ValueError(
                f"Real training requires >= {MIN_REAL_TRAINING_ROWS} rows; found {len(df)}."
            )
        df.to_csv(REAL_TRAINING_CSV, index=False)
        return df, "real"

    if csv_path:
        df = pd.read_csv(csv_path)
        if not required.issubset(df.columns):
            raise ValueError(f"CSV must contain columns: {required}")
        df.to_csv(TRAINING_CSV, index=False)
        return df, "custom_csv"

    if not TRAINING_CSV.exists():
        save_dataset(2400)
    return pd.read_csv(TRAINING_CSV), "synthetic"


def train_pipeline(
    regenerate_data: bool = True,
    n_samples: int = 2400,
    csv_path=None,
    real_only: bool = False,
) -> dict:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    use_real = real_only or os.environ.get("REAL_TRAINING") == "1"

    if use_real:
        df, dataset_kind = _load_training_frame(csv_path=csv_path, real_only=True)
    elif csv_path:
        df, dataset_kind = _load_training_frame(csv_path=csv_path, real_only=False)
    elif regenerate_data or not TRAINING_CSV.exists():
        save_dataset(n_samples)
        df = pd.read_csv(TRAINING_CSV)
        dataset_kind = "synthetic"
    else:
        df = pd.read_csv(TRAINING_CSV)
        dataset_kind = "synthetic"

    train_df, temp_df = train_test_split(df, test_size=0.3, random_state=RANDOM_SEED, stratify=df["label"])
    val_df, test_df = train_test_split(temp_df, test_size=0.5, random_state=RANDOM_SEED, stratify=temp_df["label"])

    X_train = build_matrix(train_df, fit=True)
    X_val = build_matrix(val_df)
    X_test = build_matrix(test_df)
    y_train, y_val, y_test = train_df["label"].values, val_df["label"].values, test_df["label"].values

    candidates = {
        "logistic_regression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_SEED)),
        ]),
        "random_forest": RandomForestClassifier(
            n_estimators=120, max_depth=12, class_weight="balanced", random_state=RANDOM_SEED
        ),
    }

    best_name = None
    best_model = None
    best_val_f1 = -1.0

    for name, model in candidates.items():
        model.fit(X_train, y_train)
        val_prob = model.predict_proba(X_val)[:, 1]
        val_pred = (val_prob >= 0.5).astype(int)
        f1 = f1_score(y_val, val_pred, zero_division=0)
        if f1 > best_val_f1:
            best_val_f1 = f1
            best_name = name
            best_model = model

    test_prob = best_model.predict_proba(X_test)[:, 1]
    test_pred = (test_prob >= 0.5).astype(int)
    test_metrics = _metrics(y_test, test_pred, test_prob)
    baseline_metrics = _baseline_tfidf_rule(test_df)

    importances = None
    if best_name == "random_forest":
        importances = dict(zip(FEATURE_NAMES, best_model.feature_importances_.round(4).tolist()))

    artifact = {
        "model": best_model,
        "model_name": best_name,
        "feature_names": FEATURE_NAMES,
        "threshold": 0.5,
        "version": datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"),
        "trained_on": dataset_kind,
    }
    joblib.dump(artifact, MODEL_PATH)

    report = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_name": best_name,
        "version": artifact["version"],
        "dataset_kind": dataset_kind,
        "dataset_size": len(df),
        "train_size": len(train_df),
        "val_size": len(val_df),
        "test_size": len(test_df),
        "test_metrics": test_metrics,
        "baseline_tfidf_rule": baseline_metrics,
        "feature_importances": importances,
        "feature_names": FEATURE_NAMES,
    }
    METRICS_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    MODEL_CARD_JSON.write_text(
        json.dumps({
            "version": artifact["version"],
            "model_type": best_name,
            "trained_at": report["trained_at"],
            "dataset_size": len(df),
            "test_samples": len(test_df),
            "test_metrics": test_metrics,
            "baselines": {"tfidf_cosine": baseline_metrics},
            "dataset_kind": dataset_kind,
        }, indent=2),
        encoding="utf-8",
    )
    save_evaluation(best_model, best_name, test_df, baseline_metrics, test_metrics)

    if use_real or dataset_kind == "real":
        try:
            from cross_validate import run_cross_validation
            cv = run_cross_validation(use_real_csv=True)
            report["cross_validation"] = cv["metrics_mean"]
        except Exception as exc:
            report["cross_validation_error"] = str(exc)

    return report


def main():
    parser = argparse.ArgumentParser(description="Train resume–job match classifier")
    parser.add_argument("--samples", type=int, default=2400, help="Synthetic sample count")
    parser.add_argument("--csv", type=str, default=None, help="Custom CSV path")
    parser.add_argument(
        "--real-only",
        action="store_true",
        help=f"Train only on real labels (>= {MIN_REAL_TRAINING_ROWS} rows in resume_job_pairs.csv)",
    )
    parser.add_argument(
        "--no-regenerate",
        action="store_true",
        help="Skip synthetic regeneration when not using --real-only",
    )
    args = parser.parse_args()

    report = train_pipeline(
        regenerate_data=not args.no_regenerate and not args.real_only,
        n_samples=args.samples,
        csv_path=args.csv,
        real_only=args.real_only,
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
