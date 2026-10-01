"""Train a match classifier and replace the saved artifact only after a smoke check.

The saved file is not updated if the new model fails compatibility or cannot
separate a relevant sample resume from an irrelevant one. Startup and request
handlers do not call this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
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
from features import FEATURE_NAMES, build_matrix, extract_features
from skill_match import MATCHER_VERSION
from synthetic_data import save_dataset

CANDIDATE_PATH = MODELS_DIR / "match_pipeline.candidate.joblib"
ARCHIVE_DIR = MODELS_DIR / "archive"


def _metrics(y_true, y_pred, y_prob) -> dict:
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, y_prob)), 4) if len(set(y_true)) > 1 else None,
    }


def _group_id(text: str) -> str:
    normalized = " ".join(str(text or "").lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def _prepare_frame(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    required = {"resume_text", "job_text", "label"}
    if not required.issubset(df.columns):
        raise ValueError(f"CSV must contain columns: {required}")
    frame = df.copy()
    frame["label"] = frame["label"].astype(int)
    frame["job_group"] = frame["job_text"].map(_group_id)
    frame["resume_group"] = frame["resume_text"].map(_group_id)
    before = len(frame)
    conflict = frame.groupby(["resume_group", "job_group"])["label"].nunique()
    conflict_keys = set(conflict[conflict > 1].index)
    if conflict_keys:
        mask = frame.apply(lambda row: (row["resume_group"], row["job_group"]) in conflict_keys, axis=1)
        frame = frame.loc[~mask]
    frame = frame.drop_duplicates(subset=["resume_group", "job_group"])
    provenance = {
        "rows_loaded": before,
        "rows_used": int(len(frame)),
        "duplicate_or_conflicting_pairs_removed": int(before - len(frame)),
        "unique_job_descriptions": int(frame["job_group"].nunique()),
        "unique_resumes": int(frame["resume_group"].nunique()),
        "groups_separated": "normalized job description text",
        "generalization_target": "held-out job descriptions from this same file",
        "real_world_accuracy": "unverified",
    }
    return frame, provenance


def _grouped_split(frame: pd.DataFrame, test_size: float, seed: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    if frame["job_group"].nunique() < 3:
        raise ValueError("Need at least 3 distinct job descriptions for a grouped split.")
    for offset in range(25):
        splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed + offset)
        left_idx, right_idx = next(splitter.split(frame, frame["label"], groups=frame["job_group"]))
        left, right = frame.iloc[left_idx], frame.iloc[right_idx]
        if min(len(left), len(right)) == 0:
            continue
        if left["label"].nunique() < 2 or right["label"].nunique() < 2:
            continue
        if set(left["job_group"]).isdisjoint(set(right["job_group"])):
            return left.copy(), right.copy()
    raise ValueError("Could not build a grouped split that keeps both labels and separates job descriptions.")


def _overlap(left: pd.DataFrame, right: pd.DataFrame) -> dict:
    return {
        "shared_job_groups": len(set(left["job_group"]) & set(right["job_group"])),
        "shared_resume_groups": len(set(left["resume_group"]) & set(right["resume_group"])),
    }


def _baseline_tfidf_rule(df_test: pd.DataFrame) -> dict:
    probs = []
    labels = []
    for _, row in df_test.iterrows():
        feats = extract_features(row["resume_text"], row["job_text"], skill_matcher=MATCHER_VERSION)
        prob = 0.5 * float(feats[0]) + 0.5 * float(feats[3])
        probs.append(min(max(prob, 0), 1))
        labels.append(1 if prob >= 0.35 else 0)
    return _metrics(df_test["label"].values, np.array(labels), np.array(probs))


def _load_training_frame(csv_path=None, project_csv: bool = False) -> tuple[pd.DataFrame, str]:
    required = {"resume_text", "job_text", "label"}
    if project_csv:
        path = csv_path or REAL_TRAINING_CSV
        if not path.exists():
            raise ValueError(f"Training CSV not found at {path}.")
        df = pd.read_csv(path)
        if not required.issubset(df.columns):
            raise ValueError(f"CSV must contain columns: {required}")
        if len(df) < MIN_REAL_TRAINING_ROWS:
            raise ValueError(f"This CSV training path expects at least {MIN_REAL_TRAINING_ROWS} rows; found {len(df)}.")
        return df, "project_csv"

    if csv_path:
        df = pd.read_csv(csv_path)
        if not required.issubset(df.columns):
            raise ValueError(f"CSV must contain columns: {required}")
        return df, "custom_csv"

    if not TRAINING_CSV.exists():
        save_dataset(2400)
    return pd.read_csv(TRAINING_CSV), "synthetic"


def _smoke(artifact: dict) -> None:
    if artifact.get("feature_names") != FEATURE_NAMES:
        raise RuntimeError("Smoke check failed: feature order changed.")
    if artifact["model"].n_features_in_ != len(FEATURE_NAMES):
        raise RuntimeError("Smoke check failed: feature count mismatch.")
    if artifact.get("sklearn_version") != sklearn.__version__:
        raise RuntimeError("Smoke check failed: scikit-learn version was not recorded.")
    if artifact.get("skill_matcher") != MATCHER_VERSION:
        raise RuntimeError("Smoke check failed: skill matcher version missing.")
    job = (
        "We need a software engineer with Python, Django, SQL, React, and Docker "
        "to build and deploy a web application."
    )
    relevant = "Software engineer. Python, Django, SQL, React, and Docker in production web applications. " * 4
    irrelevant = "I teach poetry, watercolor, and choral music at a community college and lead weekend workshops. " * 3
    relevant_score = float(artifact["model"].predict_proba(
        extract_features(relevant, job, skill_matcher=MATCHER_VERSION).reshape(1, -1)
    )[0, 1])
    irrelevant_score = float(artifact["model"].predict_proba(
        extract_features(irrelevant, job, skill_matcher=MATCHER_VERSION).reshape(1, -1)
    )[0, 1])
    if not relevant_score > irrelevant_score:
        raise RuntimeError("Smoke check failed: relevant and irrelevant samples were not ordered as expected.")


def _publish(artifact: dict, report: dict, card: dict, evaluation_args: tuple) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, CANDIDATE_PATH)
    loaded = joblib.load(CANDIDATE_PATH)
    _smoke(loaded)
    if MODEL_PATH.exists():
        ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
        previous = "previous"
        try:
            previous_artifact = joblib.load(MODEL_PATH)
            previous = str(previous_artifact.get("version") or previous)
        except Exception:
            previous = "unreadable"
        archive_path = ARCHIVE_DIR / f"match_pipeline_{previous}.joblib"
        if not archive_path.exists():
            shutil.copy2(MODEL_PATH, archive_path)
    shutil.copy2(CANDIDATE_PATH, MODEL_PATH)
    CANDIDATE_PATH.unlink(missing_ok=True)
    METRICS_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    MODEL_CARD_JSON.write_text(json.dumps(card, indent=2), encoding="utf-8")
    save_evaluation(*evaluation_args)


def train_pipeline(
    regenerate_data: bool = True,
    n_samples: int = 2400,
    csv_path=None,
    project_csv: bool = False,
) -> dict:
    use_project = project_csv or os.environ.get("REAL_TRAINING") == "1"
    if use_project:
        df, dataset_kind = _load_training_frame(csv_path=csv_path, project_csv=True)
    elif csv_path:
        df, dataset_kind = _load_training_frame(csv_path=csv_path, project_csv=False)
    elif regenerate_data or not TRAINING_CSV.exists():
        save_dataset(n_samples)
        df = pd.read_csv(TRAINING_CSV)
        dataset_kind = "synthetic"
    else:
        df = pd.read_csv(TRAINING_CSV)
        dataset_kind = "synthetic"

    frame, provenance = _prepare_frame(df)
    provenance["dataset_kind"] = dataset_kind
    provenance["source_file"] = "data/processed/resume_job_pairs.csv" if dataset_kind == "project_csv" else dataset_kind
    provenance["limitation"] = (
        "Labels are project labels, not verified hiring decisions. "
        "Job-description groups are held out, but a high score still does not establish real-world accuracy. "
        "If a simple overlap rule matches the classifier, the labels are explained by those features."
    )
    train_val, test_df = _grouped_split(frame, 0.2, RANDOM_SEED)
    train_df, val_df = _grouped_split(train_val, 0.2, RANDOM_SEED + 1)
    overlap = {
        "train_test": _overlap(train_df, test_df),
        "train_val": _overlap(train_df, val_df),
        "val_test": _overlap(val_df, test_df),
    }
    if any(item["shared_job_groups"] for item in overlap.values()):
        raise RuntimeError("Job descriptions leaked across a split.")

    X_train = build_matrix(train_df, skill_matcher=MATCHER_VERSION)
    X_val = build_matrix(val_df, skill_matcher=MATCHER_VERSION)
    X_test = build_matrix(test_df, skill_matcher=MATCHER_VERSION)
    y_train = train_df["label"].to_numpy()
    y_val = val_df["label"].to_numpy()
    y_test = test_df["label"].to_numpy()

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
        score = f1_score(y_val, val_pred, zero_division=0)
        if score > best_val_f1:
            best_val_f1 = score
            best_name = name
            best_model = model

    test_prob = best_model.predict_proba(X_test)[:, 1]
    test_pred = (test_prob >= 0.5).astype(int)
    test_metrics = _metrics(y_test, test_pred, test_prob)
    baseline_metrics = _baseline_tfidf_rule(test_df)
    importances = None
    if best_name == "random_forest":
        importances = dict(zip(FEATURE_NAMES, best_model.feature_importances_.round(4).tolist()))

    version = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    trained_at = datetime.now(timezone.utc).isoformat()
    artifact = {
        "model": best_model,
        "model_name": best_name,
        "feature_names": FEATURE_NAMES,
        "threshold": 0.5,
        "version": version,
        "trained_on": dataset_kind,
        "sklearn_version": sklearn.__version__,
        "skill_matcher": MATCHER_VERSION,
    }
    report = {
        "trained_at": trained_at,
        "model_name": best_name,
        "version": version,
        "sklearn_version": sklearn.__version__,
        "numpy_version": np.__version__,
        "pandas_version": pd.__version__,
        "skill_matcher": MATCHER_VERSION,
        "feature_names": FEATURE_NAMES,
        "dataset_kind": dataset_kind,
        "dataset_provenance": provenance,
        "split_overlap": overlap,
        "dataset_size": int(len(frame)),
        "train_size": int(len(train_df)),
        "val_size": int(len(val_df)),
        "test_size": int(len(test_df)),
        "test_metrics": test_metrics,
        "baseline_tfidf_rule": baseline_metrics,
        "feature_importances": importances,
        "score_meaning": (
            "Test metrics describe this grouped split of the training file. "
            "They are not a calibrated hiring probability and real-world accuracy is unverified."
        ),
    }
    card = {
        "version": version,
        "model_type": best_name,
        "trained_at": trained_at,
        "sklearn_version": sklearn.__version__,
        "skill_matcher": MATCHER_VERSION,
        "feature_names": FEATURE_NAMES,
        "dataset_size": int(len(frame)),
        "test_samples": int(len(test_df)),
        "test_metrics": test_metrics,
        "baselines": {"tfidf_skill_rule": baseline_metrics},
        "dataset_kind": dataset_kind,
        "dataset_provenance": provenance,
        "split_overlap": overlap,
        "real_world_accuracy": "unverified",
    }
    _publish(artifact, report, card, (best_model, best_name, test_df, baseline_metrics, test_metrics, provenance, overlap))
    return report


def main():
    parser = argparse.ArgumentParser(description="Train the resume-job classifier")
    parser.add_argument("--samples", type=int, default=2400)
    parser.add_argument("--csv", type=str, default=None)
    parser.add_argument(
        "--project-csv",
        action="store_true",
        help="Train on data/processed/resume_job_pairs.csv. This does not mean the labels are real hiring decisions.",
    )
    parser.add_argument("--real-only", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--no-regenerate", action="store_true")
    args = parser.parse_args()
    report = train_pipeline(
        regenerate_data=not args.no_regenerate and not (args.project_csv or args.real_only),
        n_samples=args.samples,
        csv_path=args.csv,
        project_csv=args.project_csv or args.real_only,
    )
    print(json.dumps({k: report[k] for k in ("version", "model_name", "test_metrics", "dataset_provenance", "split_overlap")}, indent=2))


if __name__ == "__main__":
    main()
