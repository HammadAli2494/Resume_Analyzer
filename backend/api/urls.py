from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .auth_views import LoginView, MeView, RegisterView
from .views import (
    AnalyzeResumeView,
    HealthView,
    JobBatchScreenView,
    JobDetailView,
    JobExportCsvView,
    JobListCreateView,
    MLModelInfoView,
    ScreeningHistoryView,
)
from .views_ml import MLCvReportView, MLEvaluationView, MLMetricsView
from .views_training import (
    ExportAndTrainView,
    TrainingImportCSVView,
    TrainingPairListCreateView,
    TrainingStatsView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("analyze/", AnalyzeResumeView.as_view(), name="analyze"),
    path("history/", ScreeningHistoryView.as_view(), name="history"),
    path("ml/info/", MLModelInfoView.as_view(), name="ml-info"),
    path("ml/metrics/", MLMetricsView.as_view(), name="ml-metrics"),
    path("ml/cv-report/", MLCvReportView.as_view(), name="ml-cv-report"),
    path("ml/evaluation/", MLEvaluationView.as_view(), name="ml-evaluation"),
    path("jobs/", JobListCreateView.as_view(), name="job-list"),
    path("jobs/<int:job_id>/", JobDetailView.as_view(), name="job-detail"),
    path("jobs/<int:job_id>/screen/", JobBatchScreenView.as_view(), name="job-batch-screen"),
    path("jobs/<int:job_id>/export.csv", JobExportCsvView.as_view(), name="job-export-csv"),
    path("training/pairs/", TrainingPairListCreateView.as_view(), name="training-pairs"),
    path("training/import-csv/", TrainingImportCSVView.as_view(), name="training-import-csv"),
    path("training/stats/", TrainingStatsView.as_view(), name="training-stats"),
    path("training/export-and-train/", ExportAndTrainView.as_view(), name="training-export-train"),
]
