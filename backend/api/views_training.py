import csv
import io

from django.db.models import Q
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TrainingPair
from .serializers_training import TrainingPairCreateSerializer, TrainingPairSerializer
from .services.training_export import export_verified_pairs, run_real_training, training_stats


class TrainingPairListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/training/pairs/ — list and create manual labels."""

    queryset = TrainingPair.objects.all()
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TrainingPairCreateSerializer
        return TrainingPairSerializer

    def get_queryset(self):
        qs = TrainingPair.objects.all()
        verified = self.request.query_params.get("verified")
        label = self.request.query_params.get("label")
        source = self.request.query_params.get("source")
        if verified in ("true", "1"):
            qs = qs.filter(is_verified=True)
        elif verified in ("false", "0"):
            qs = qs.filter(is_verified=False)
        if label in ("0", "1"):
            qs = qs.filter(label=int(label))
        if source:
            qs = qs.filter(source=source)
        search = self.request.query_params.get("q")
        if search:
            qs = qs.filter(
                Q(resume_text__icontains=search)
                | Q(job_text__icontains=search)
                | Q(role__icontains=search)
            )
        return qs


class TrainingImportCSVView(APIView):
    """POST /api/training/import-csv/ — upload resume_text, job_text, label CSV."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        csv_file = request.FILES.get("file") or request.FILES.get("dataset")
        if not csv_file or not csv_file.name.lower().endswith(".csv"):
            return Response({"error": "Upload a .csv file (field name: file)."}, status=400)

        try:
            text = csv_file.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            required = {"resume_text", "job_text", "label"}
            if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
                return Response(
                    {"error": f"CSV must include columns: {', '.join(sorted(required))}"},
                    status=400,
                )

            created = 0
            skipped = 0
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
                    created_by=request.user,
                )
                created += 1

            return Response({"created": created, "skipped": skipped})
        except UnicodeDecodeError:
            return Response({"error": "CSV must be UTF-8 encoded."}, status=400)
        except Exception as exc:
            return Response({"error": str(exc)}, status=400)


class TrainingStatsView(APIView):
    """GET /api/training/stats/ — verified counts by label."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(training_stats())


class ExportAndTrainView(APIView):
    """POST /api/training/export-and-train/ — export verified CSV and run train.py."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            stats = training_stats()
            if not stats["ready_for_training"]:
                return Response(
                    {
                        "error": (
                            f"Need at least {stats['min_required_for_training']} verified pairs; "
                            f"found {stats['total_verified']}."
                        ),
                        "exported_rows": stats["total_verified"],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            report = run_real_training()
            return Response(
                {
                    "status": "trained_on_real_data",
                    "exported_rows": stats["total_verified"],
                    "export_path": stats["export_path"],
                    "model_name": report["model_name"],
                    "test_metrics": report["test_metrics"],
                    "baseline": report["baseline_tfidf_rule"],
                    "dataset_size": report["dataset_size"],
                }
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
