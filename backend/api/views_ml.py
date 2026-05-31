import json
from pathlib import Path

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.ml_core import load_ml_evaluation, load_ml_metrics, model_ready

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ML_MODELS = PROJECT_ROOT / "ml" / "models"
CV_REPORT_PATH = ML_MODELS / "cv_report.json"


class MLCvReportView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not CV_REPORT_PATH.exists():
            return Response({"error": "Run: python manage.py train_ml --real-only"}, status=404)
        return Response(json.loads(CV_REPORT_PATH.read_text(encoding="utf-8")))


class MLMetricsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "model_trained": model_ready(),
            "metrics": load_ml_metrics(),
        })


class MLEvaluationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        evaluation = load_ml_evaluation()
        if not evaluation:
            return Response(
                {"error": "No evaluation artifacts. Run: python manage.py train_ml --real-only"},
                status=404,
            )
        return Response({
            "model_trained": model_ready(),
            "metrics": load_ml_metrics(),
            "evaluation": evaluation,
        })
