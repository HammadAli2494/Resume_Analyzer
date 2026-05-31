"""Export verified training pairs and trigger real-data training."""

from __future__ import annotations

import csv
from pathlib import Path

from ..models import TrainingPair

PROJECT_ROOT = Path(__file__).resolve().parents[3]
REAL_TRAINING_CSV = PROJECT_ROOT / "ml" / "data" / "processed" / "resume_job_pairs.csv"
MIN_REAL_ROWS = 50


def export_verified_pairs() -> tuple[Path, int]:
    """Write verified TrainingPair rows to resume_job_pairs.csv."""
    pairs = TrainingPair.objects.filter(is_verified=True).order_by("id")
    REAL_TRAINING_CSV.parent.mkdir(parents=True, exist_ok=True)

    with REAL_TRAINING_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["resume_text", "job_text", "label", "role", "source"],
        )
        writer.writeheader()
        count = 0
        for pair in pairs:
            writer.writerow(
                {
                    "resume_text": pair.resume_text,
                    "job_text": pair.job_text,
                    "label": pair.label,
                    "role": pair.role or "",
                    "source": pair.source,
                }
            )
            count += 1

    return REAL_TRAINING_CSV, count


def run_real_training() -> dict:
    """Export verified pairs and train only on real labels."""
    csv_path, row_count = export_verified_pairs()
    if row_count < MIN_REAL_ROWS:
        raise ValueError(
            f"Need at least {MIN_REAL_ROWS} verified training pairs; found {row_count}. "
            "Add labels via UI, import CSV, or run: python manage.py import_seed_data"
        )

    from .ml_core import run_training

    return run_training(
        regenerate_data=False,
        csv_path=str(csv_path),
        real_only=True,
    )


def training_stats() -> dict:
    verified = TrainingPair.objects.filter(is_verified=True)
    total_verified = verified.count()
    label_1 = verified.filter(label=1).count()
    label_0 = verified.filter(label=0).count()
    by_source = {
        source: TrainingPair.objects.filter(is_verified=True, source=source).count()
        for source, _ in TrainingPair.Source.choices
    }
    return {
        "total_verified": total_verified,
        "label_1": label_1,
        "label_0": label_0,
        "by_source": by_source,
        "min_required_for_training": MIN_REAL_ROWS,
        "ready_for_training": total_verified >= MIN_REAL_ROWS,
        "export_path": str(REAL_TRAINING_CSV.relative_to(PROJECT_ROOT)),
    }
