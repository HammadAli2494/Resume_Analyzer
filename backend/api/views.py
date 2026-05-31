import csv
import logging

from django.conf import settings
from django.core.files.base import ContentFile
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from pdfminer.pdfparser import PDFSyntaxError
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CandidateScreening, JobPosting
from .serializers import CandidateScreeningSerializer, JobPostingSerializer
from .services.ml_core import get_ml_model_info
from .services.screening import screen_uploaded_file

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = (".pdf", ".docx")


def _valid_resume_file(upload) -> bool:
    return upload.name.lower().endswith(ALLOWED_EXTENSIONS)


def _user_jobs(user):
    return JobPosting.objects.filter(owner=user)


def _get_job_for_user(user, job_id):
    return get_object_or_404(_user_jobs(user), pk=job_id)


def _clean_result(result: dict) -> dict:
    return {k: v for k, v in result.items() if k != "_file_bytes"}


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        ml = get_ml_model_info()
        return Response({
            "status": "ok",
            "service": "resume-screening-api",
            "version": "4.0-ml",
            "llm_enabled": bool(getattr(settings, "OPENAI_API_KEY", "")),
            "ml_ready": ml.get("ml_ready", False),
        })


class MLModelInfoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(get_ml_model_info())


class AnalyzeResumeView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        resume_file = request.FILES.get("resume")
        job_description = request.data.get("job_description", "").strip()
        job_id = request.data.get("job_id")
        save = request.data.get("save", "false").lower() in ("true", "1", "yes")

        if not resume_file:
            return Response({"error": "Please upload a resume file."}, status=400)
        if not _valid_resume_file(resume_file):
            return Response({"error": "Supported formats: PDF and DOCX."}, status=400)
        if not job_description:
            return Response({"error": "Please provide a job description."}, status=400)

        try:
            result = screen_uploaded_file(resume_file, resume_file.name, job_description)
            clean = _clean_result(result)

            if request.user.is_authenticated and (save or job_id):
                job = None
                if job_id:
                    job = _get_job_for_user(request.user, job_id)
                _save_screening(
                    job=job,
                    result=clean,
                    user=request.user,
                    file_bytes=result.get("_file_bytes"),
                    filename=result.get("resume_filename"),
                )
                clean["saved"] = True

            return Response(clean)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)
        except (PDFSyntaxError, OSError):
            return Response({"error": "Invalid or corrupted file."}, status=400)
        except Exception as exc:
            logger.exception("Resume analysis failed")
            message = str(exc) if settings.DEBUG else "Failed to process the resume."
            return Response({"error": message}, status=500)


class JobListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def get(self, request):
        jobs = _user_jobs(request.user)
        return Response(JobPostingSerializer(jobs, many=True).data)

    def post(self, request):
        title = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        if not title or not description:
            return Response({"error": "title and description are required."}, status=400)
        job = JobPosting.objects.create(
            owner=request.user,
            title=title,
            description=description,
        )
        return Response(JobPostingSerializer(job).data, status=201)


class JobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = _get_job_for_user(request.user, job_id)
        data = JobPostingSerializer(job).data
        candidates = CandidateScreening.objects.filter(job=job)
        data["rankings"] = CandidateScreeningSerializer(
            candidates, many=True, context={"request": request}
        ).data
        return Response(data)

    def delete(self, request, job_id):
        job = _get_job_for_user(request.user, job_id)
        job.delete()
        return Response(status=204)


class JobBatchScreenView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, job_id):
        job = _get_job_for_user(request.user, job_id)
        files = request.FILES.getlist("resumes")
        if not files:
            single = request.FILES.get("resume")
            if single:
                files = [single]
        if not files:
            return Response({"error": "Upload at least one resume (PDF or DOCX)."}, status=400)

        results = []
        errors = []
        for f in files:
            if not _valid_resume_file(f):
                errors.append({"file": f.name, "error": "Unsupported format"})
                continue
            try:
                result = screen_uploaded_file(f, f.name, job.description)
                screening = _save_screening(
                    job=job,
                    result=_clean_result(result),
                    user=request.user,
                    file_bytes=result.get("_file_bytes"),
                    filename=result.get("resume_filename"),
                )
                results.append(
                    CandidateScreeningSerializer(
                        screening, context={"request": request}
                    ).data
                )
            except ValueError as exc:
                errors.append({"file": f.name, "error": str(exc)})
            except Exception as exc:
                logger.exception("Batch screen failed for %s", f.name)
                errors.append({
                    "file": f.name,
                    "error": str(exc) if settings.DEBUG else "Processing failed",
                })

        results.sort(key=lambda x: x["resume_score"], reverse=True)
        return Response({
            "job_id": job.id,
            "job_title": job.title,
            "screened": len(results),
            "failed": len(errors),
            "rankings": results,
            "errors": errors,
        })


class JobExportCsvView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = _get_job_for_user(request.user, job_id)
        candidates = CandidateScreening.objects.filter(job=job)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="job_{job_id}_rankings.csv"'
        writer = csv.writer(response)
        writer.writerow([
            "Rank",
            "Candidate",
            "Filename",
            "Resume Score",
            "Match %",
            "Keyword %",
            "Semantic %",
            "Skill Coverage %",
            "Matched Skills",
            "Missing Skills",
        ])
        for i, c in enumerate(candidates, start=1):
            data = c.result_data or {}
            writer.writerow([
                i,
                c.candidate_name,
                c.resume_filename,
                c.resume_score,
                c.match_percentage,
                c.keyword_score,
                c.semantic_score,
                c.skill_coverage,
                "; ".join(data.get("matched_skills", [])),
                "; ".join(data.get("missing_skills", [])),
            ])
        return response


class ScreeningHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = CandidateScreening.objects.filter(screened_by=request.user).order_by("-created_at")[:50]
        return Response(
            CandidateScreeningSerializer(qs, many=True, context={"request": request}).data
        )


def _save_screening(
    *,
    job: JobPosting | None,
    result: dict,
    user=None,
    file_bytes: bytes | None = None,
    filename: str | None = None,
) -> CandidateScreening:
    screening = CandidateScreening.objects.create(
        job=job,
        screened_by=user,
        candidate_name=result.get("candidate_name", ""),
        resume_filename=result.get("resume_filename", filename or ""),
        match_percentage=result["match_percentage"],
        keyword_score=result["keyword_score"],
        semantic_score=result["semantic_score"],
        resume_score=result["resume_score"],
        skill_coverage=result["skill_coverage"],
        result_data=result,
    )
    if file_bytes and filename:
        screening.resume_file.save(filename, ContentFile(file_bytes), save=True)
    return screening
