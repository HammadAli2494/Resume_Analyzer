"""Load trained classifier and predict resume–job match."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np

from config import EVALUATION_PATH, METRICS_PATH, resolve_model_path
from features import FEATURE_NAMES, extract_features

_artifact = None


def _load():
    global _artifact
    if _artifact is None:
        path = resolve_model_path()
        if not path.exists():
            return None
        _artifact = joblib.load(path)
    return _artifact


def is_model_available() -> bool:
    return resolve_model_path().exists()


def get_metrics() -> dict | None:
    if not METRICS_PATH.exists():
        return None
    return json.loads(METRICS_PATH.read_text(encoding="utf-8"))


def get_evaluation() -> dict | None:
    if not EVALUATION_PATH.exists():
        return None
    return json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))


def predict_match(resume_text: str, job_text: str) -> dict | None:
    artifact = _load()
    if not artifact:
        return None

    model = artifact.get("model")
    if model is None:
        # Old joblib layout (vectorizer + classifier only) — retrain with train_ml
        return None

    X = extract_features(resume_text, job_text).reshape(1, -1)
    prob = float(model.predict_proba(X)[0, 1])
    threshold = artifact.get("threshold", 0.5)
    label = int(prob >= threshold)

    feat_dict = dict(zip(FEATURE_NAMES, extract_features(resume_text, job_text).round(4).tolist()))

    return {
        "ml_available": True,
        "ml_model_name": artifact.get("model_name", "classifier"),
        "ml_model_version": artifact["version"],
        "ml_match_probability": round(prob * 100, 1),
        "ml_predicted_label": label,
        "ml_predicted_fit": "Good fit" if label == 1 else "Weak fit",
        "ml_confidence": round(max(prob, 1 - prob) * 100, 1),
        "ml_features": feat_dict,
    }
