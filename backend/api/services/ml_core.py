"""Bridge Django to the trained ML package in /ml."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
ML_SRC = PROJECT_ROOT / "ml" / "src"
if str(ML_SRC) not in sys.path:
    sys.path.insert(0, str(ML_SRC))

from predict import get_evaluation, get_metrics, is_model_available, predict_match  # noqa: E402


def run_ml_prediction(resume_text: str, job_text: str) -> dict | None:
    return predict_match(resume_text, job_text)


def load_ml_metrics() -> dict | None:
    return get_metrics()


def load_ml_evaluation() -> dict | None:
    return get_evaluation()


def run_training(
    regenerate_data: bool = True,
    n_samples: int = 2400,
    csv_path=None,
    real_only: bool = False,
) -> dict:
    from train import train_pipeline  # noqa: E402

    return train_pipeline(
        regenerate_data=regenerate_data,
        n_samples=n_samples,
        csv_path=csv_path,
        real_only=real_only,
    )


def model_ready() -> bool:
    return is_model_available()


def get_ml_model_info() -> dict:
    import json

    metrics = load_ml_metrics()
    card_path = PROJECT_ROOT / "ml" / "models" / "model_card.json"
    card = None
    if card_path.exists():
        card = json.loads(card_path.read_text(encoding="utf-8"))
    return {
        "ml_ready": model_ready(),
        "metrics": metrics,
        "model_card": card,
    }
