"""Offline evaluation artifacts: confusion matrix, ROC, errors, model comparison."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, roc_curve
from sklearn.model_selection import train_test_split

from config import EVALUATION_PATH, RANDOM_SEED, TRAINING_CSV
from features import FEATURE_NAMES, build_matrix, extract_features


def build_evaluation_report(
    model,
    model_name: str,
    test_df: pd.DataFrame,
    baseline_metrics: dict,
    test_metrics: dict,
) -> dict:
    X_test = build_matrix(test_df)
    y_true = test_df["label"].values.astype(int)
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    cm = confusion_matrix(y_true, y_pred)
    fpr, tpr, thresholds = roc_curve(y_true, y_prob)
    roc_points = [
        {"fpr": round(float(a), 4), "tpr": round(float(b), 4)}
        for a, b in zip(fpr[:: max(1, len(fpr) // 25)], tpr[:: max(1, len(tpr) // 25)])
    ]

    comparison = [
        {"model": "TF-IDF rule baseline", "f1": baseline_metrics["f1"], "roc_auc": baseline_metrics["roc_auc"]},
        {"model": model_name, "f1": test_metrics["f1"], "roc_auc": test_metrics["roc_auc"]},
    ]

    errors = []
    test_df = test_df.reset_index(drop=True)
    for i in range(len(test_df)):
        if y_pred[i] == y_true[i]:
            continue
        row = test_df.iloc[i]
        feats = extract_features(row["resume_text"], row["job_text"])
        errors.append({
            "type": "false_positive" if y_pred[i] == 1 else "false_negative",
            "true_label": int(y_true[i]),
            "predicted_prob": round(float(y_prob[i]), 3),
            "role": row.get("role", ""),
            "resume_snippet": row["resume_text"][:200],
            "job_snippet": row["job_text"][:200],
            "top_features": dict(zip(FEATURE_NAMES, feats.round(3).tolist())),
        })
        if len(errors) >= 20:
            break

    label_counts = test_df["label"].value_counts().to_dict()
    return {
        "confusion_matrix": {
            "labels": ["Not fit (0)", "Good fit (1)"],
            "matrix": cm.tolist(),
            "tn": int(cm[0, 0]),
            "fp": int(cm[0, 1]),
            "fn": int(cm[1, 0]),
            "tp": int(cm[1, 1]),
        },
        "roc_curve": roc_points,
        "model_comparison": comparison,
        "error_analysis": errors,
        "test_class_balance": {str(k): int(v) for k, v in label_counts.items()},
    }


def save_evaluation(model, model_name: str, test_df: pd.DataFrame, baseline_metrics: dict, test_metrics: dict) -> dict:
    report = build_evaluation_report(model, model_name, test_df, baseline_metrics, test_metrics)
    EVALUATION_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def load_evaluation() -> dict | None:
    if not EVALUATION_PATH.exists():
        return None
    return json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
