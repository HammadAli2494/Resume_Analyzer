import csv
from pathlib import Path

from django.core.management.base import BaseCommand

from api.models import TrainingPair


class Command(BaseCommand):
    help = "Import hand-crafted real seed pairs from ml/data/real_seed_pairs.csv"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing import-sourced verified pairs before import",
        )

    def handle(self, *args, **options):
        project_root = Path(__file__).resolve().parents[4]
        seed_path = project_root / "ml" / "data" / "real_seed_pairs.csv"
        if not seed_path.exists():
            self.stderr.write(self.style.ERROR(f"Seed file not found: {seed_path}"))
            return

        if options["clear"]:
            deleted, _ = TrainingPair.objects.filter(
                source=TrainingPair.Source.IMPORT,
                is_verified=True,
            ).delete()
            self.stdout.write(f"Cleared {deleted} prior import rows.")

        created = 0
        skipped = 0
        with seed_path.open(newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            required = {"resume_text", "job_text", "label"}
            if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
                self.stderr.write(self.style.ERROR(f"CSV must include: {required}"))
                return

            for row in reader:
                resume = (row.get("resume_text") or "").strip()
                job = (row.get("job_text") or "").strip()
                if not resume or not job:
                    skipped += 1
                    continue
                try:
                    label = int(row.get("label", -1))
                except (TypeError, ValueError):
                    skipped += 1
                    continue
                if label not in (0, 1):
                    skipped += 1
                    continue

                TrainingPair.objects.create(
                    resume_text=resume,
                    job_text=job,
                    label=label,
                    role=(row.get("role") or "").strip()[:128],
                    source=TrainingPair.Source.IMPORT,
                    is_verified=True,
                )
                created += 1

        total = TrainingPair.objects.filter(is_verified=True).count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {created} seed pairs (skipped {skipped}). "
                f"Total verified: {total}."
            )
        )
