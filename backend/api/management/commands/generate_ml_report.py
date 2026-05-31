import json
from pathlib import Path

from django.core.management.base import BaseCommand

PROJECT_ROOT = Path(__file__).resolve().parents[4]


class Command(BaseCommand):
    help = "Generate docs/ML_REPORT.md from model_card.json and cv_report.json"

    def handle(self, *args, **options):
        card_path = PROJECT_ROOT / "ml" / "models" / "model_card.json"
        metrics_path = PROJECT_ROOT / "ml" / "models" / "metrics.json"
        cv_path = PROJECT_ROOT / "ml" / "models" / "cv_report.json"
        out_path = PROJECT_ROOT / "docs" / "ML_REPORT.md"

        if card_path.exists():
            card = json.loads(card_path.read_text(encoding="utf-8"))
        elif metrics_path.exists():
            card = json.loads(metrics_path.read_text(encoding="utf-8"))
        else:
            self.stderr.write("Train first: python manage.py train_ml --real-only")
            return
        cv = json.loads(cv_path.read_text(encoding="utf-8")) if cv_path.exists() else None
        tm = card.get("test_metrics", {})
        bl = card.get("baselines", {}).get("tfidf_cosine", {})

        lines = [
            "# ML Evaluation Report",
            "",
            "Auto-generated from held-out test set and cross-validation.",
            "",
            "## Dataset",
            f"- Total samples: **{card.get('dataset_size', 'N/A')}**",
            f"- Test samples: **{card.get('test_samples', 'N/A')}**",
            f"- Model: **{card.get('model_type', card.get('model_name', 'classifier'))}**",
            f"- Trained at: {card.get('trained_at', 'N/A')}",
            "",
            "## Test set metrics (classifier)",
            "",
            "| Metric | Value |",
            "|--------|-------|",
            f"| Accuracy | {tm.get('accuracy', 'N/A')} |",
            f"| Precision | {tm.get('precision', 'N/A')} |",
            f"| Recall | {tm.get('recall', 'N/A')} |",
            f"| F1 | **{tm.get('f1', 'N/A')}** |",
            f"| ROC-AUC | **{tm.get('roc_auc', 'N/A')}** |",
            "",
            "## Baseline (TF-IDF cosine rule)",
            "",
            f"- Baseline F1: **{bl.get('f1', 'N/A')}**",
            f"- Baseline accuracy: {bl.get('accuracy', 'N/A')}",
            "",
        ]

        if cv:
            m, s = cv["metrics_mean"], cv.get("metrics_std", {})
            lines += [
                "## 5-fold cross-validation",
                "",
                f"- Mean F1: **{m['f1']}** (± {s.get('f1', 0)})",
                f"- Mean ROC-AUC: **{m['roc_auc']}** (± {s.get('roc_auc', 0)})",
                "",
            ]

        lines += [
            "## Conclusion",
            "",
            "The classifier is trained on verified resume–job labels. "
            "Improve F1 by adding more manually labeled pairs via `/labeling` and retraining.",
            "",
        ]

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text("\n".join(lines), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Wrote {out_path}"))
