"""Load the saved classifier and score one resume against one job.

The live artifact is a feature-matrix classifier, currently a random forest.
It is used only when its feature list, feature count, and scikit-learn version
match this process. Otherwise scoring continues without the classifier.
Nothing in this module trains a model.
"""

from __future__ import annotations

import json
import warnings

import joblib
import sklearn
from sklearn.exceptions import InconsistentVersionWarning

from config import CV_REPORT_PATH, EVALUATION_PATH, METRICS_PATH, MODEL_CARD_JSON, resolve_model_path
from features import FEATURE_NAMES, extract_features
from skill_match import LEGACY_MATCHER, MATCHER_VERSION

_artifact = None
_loaded = False
_problem = "Classifier has not been loaded."

_SUPPORTED_MATCHERS = {LEGACY_MATCHER, MATCHER_VERSION}


def _read_json(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def incompatibility_reason() -> str | None:
    _load()
    if _artifact is None:
        return _problem
    return None


def _check_artifact(artifact, warnings_seen: list) -> str | None:
    if not isinstance(artifact, dict):
        return "Classifier file has an unexpected format."
    if any(item.category is InconsistentVersionWarning for item in warnings_seen):
        return "Classifier was saved with a different scikit-learn version."
    model = artifact.get("model")
    if model is None:
        return "Classifier file does not contain the expected model."
    names = list(artifact.get("feature_names") or [])
    if names != FEATURE_NAMES:
        return "Classifier features do not match this service."
    expected = getattr(model, "n_features_in_", None)
    if expected != len(FEATURE_NAMES):
        return "Classifier feature count does not match this service."
    recorded = artifact.get("sklearn_version")
    if recorded and recorded != sklearn.__version__:
        return "Classifier scikit-learn version does not match this environment."
    matcher = artifact.get("skill_matcher") or LEGACY_MATCHER
    if matcher not in _SUPPORTED_MATCHERS:
        return "Classifier skill features are not supported by this service."
    return None


def _load():
    global _artifact, _loaded, _problem
    if _loaded:
        return _artifact
    _loaded = True
    path = resolve_model_path()
    if not path.exists():
        _problem = "No classifier file is available."
        _artifact = None
        return None
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", InconsistentVersionWarning)
        try:
            artifact = joblib.load(path)
        except Exception:
            _problem = "The classifier file could not be read."
            _artifact = None
            return None
    reason = _check_artifact(artifact, caught)
    if reason:
        _problem = reason
        _artifact = None
        return None
    _problem = ""
    _artifact = artifact
    return _artifact


def is_model_available() -> bool:
    return _load() is not None


def get_metrics() -> dict | None:
    return _read_json(METRICS_PATH)


def get_evaluation() -> dict | None:
    return _read_json(EVALUATION_PATH)


def get_model_card() -> dict | None:
    return _read_json(MODEL_CARD_JSON)


def get_cv_report() -> dict | None:
    return _read_json(CV_REPORT_PATH)


def _pack(prob: float, artifact: dict, features: dict, model_name: str) -> dict:
    threshold = float(artifact.get("threshold", 0.5))
    label = int(prob >= threshold)
    fit = "Good fit" if label == 1 else "Weak fit"
    return {
        "ml_available": True,
        "ml_model_name": model_name,
        "ml_model_version": str(artifact.get("version", "1")),
        "ml_match_probability": round(prob * 100, 1),
        "ml_predicted_label": label,
        "ml_predicted_fit": fit,
        "ml_prediction": fit,
    }


def predict_match(resume_text: str, job_text: str) -> dict | None:
    artifact = _load()
    if not artifact:
        return None
    matcher = artifact.get("skill_matcher") or LEGACY_MATCHER
    try:
        vector = extract_features(resume_text, job_text, skill_matcher=matcher)
        if vector.shape[0] != len(FEATURE_NAMES):
            return None
        named = dict(zip(FEATURE_NAMES, vector.round(4).tolist()))
        probability = float(artifact["model"].predict_proba(vector.reshape(1, -1))[0, 1])
    except Exception:
        return None
    return _pack(probability, artifact, named, artifact.get("model_name", "classifier"))
