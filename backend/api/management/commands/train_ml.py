from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Train the supervised resume–job match classifier (saves to ml/models/)"

    def add_arguments(self, parser):
        parser.add_argument("--samples", type=int, default=2400)
        parser.add_argument("--csv", type=str, default=None, help="Custom training CSV path")
        parser.add_argument(
            "--real-only",
            action="store_true",
            help="Train only on exported real labels (resume_job_pairs.csv, >= 50 rows)",
        )

    def handle(self, *args, **options):
        import sys
        from pathlib import Path

        project_root = Path(__file__).resolve().parents[4]
        sys.path.insert(0, str(project_root / "ml" / "src"))
        from train import train_pipeline

        report = train_pipeline(
            regenerate_data=options["csv"] is None and not options["real_only"],
            n_samples=options["samples"],
            csv_path=options["csv"],
            real_only=options["real_only"],
        )
        self.stdout.write(self.style.SUCCESS(
            f"Trained {report['model_name']} | Test F1={report['test_metrics']['f1']} "
            f"| ROC-AUC={report['test_metrics']['roc_auc']}"
        ))
