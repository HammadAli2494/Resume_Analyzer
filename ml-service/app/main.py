import logging
import os
import secrets
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.services.analyze import analyze_resume, model_info
from app.services.parse import extension_of, extract_text, validate_upload

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")

MAX_BYTES = int(os.getenv("MAX_UPLOAD_MB", "8")) * 1024 * 1024


def _authorize(request: Request) -> None:
    expected = os.getenv("ML_INTERNAL_TOKEN", "").strip()
    production = os.getenv("ML_ENV", "").lower() == "production"
    if production and len(expected) < 16:
        raise HTTPException(status_code=503, detail="Analysis is temporarily unavailable. Please try again.")
    if not expected:
        return
    provided = request.headers.get("x-internal-token", "")
    if len(provided) != len(expected) or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Not authorized.")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    info = model_info()
    logger.info("Classifier loaded" if info.get("ml_ready") else "Classifier not loaded; keyword and skill scoring still available")
    yield


app = FastAPI(title="Resume Screening ML Service", version="1.0.0", lifespan=lifespan)
# The API calls this service from the server. Browsers are not given an origin unless ML_CORS_ORIGINS is set.
_cors = [item.strip() for item in os.getenv("ML_CORS_ORIGINS", "").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_error(_request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return JSONResponse({"error": detail}, status_code=exc.status_code)


@app.exception_handler(Exception)
async def unhandled(_request, exc: Exception):
    logger.exception("Unhandled ML service error")
    return JSONResponse({"error": "Analysis failed."}, status_code=500)


def _split_skills(raw: str) -> list[str]:
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


@app.get("/live")
def live():
    return {"status": "live"}


@app.get("/ready")
def ready(request: Request):
    _authorize(request)
    info = model_info()
    if info.get("ml_ready"):
        return {"status": "ok", "ready": True, "scoring": "ml"}
    return JSONResponse(
        {"status": "degraded", "ready": False, "scoring": "keyword_only"},
        status_code=503,
    )


@app.get("/health")
def health(request: Request):
    return ready(request)


@app.get("/model-info")
def model_information(request: Request):
    _authorize(request)
    info = model_info()
    return {
        "ml_ready": info["ml_ready"],
        "metrics": info["metrics"],
        "model_card": info["model_card"],
    }


@app.get("/metrics")
def metrics(request: Request):
    _authorize(request)
    info = model_info()
    if not info["metrics"]:
        raise HTTPException(status_code=404, detail="Model metrics are not available.")
    return {"model_trained": info["ml_ready"], "metrics": info["metrics"]}


@app.get("/cv-report")
def cv_report(request: Request):
    _authorize(request)
    report = model_info().get("cv_report")
    if not report:
        raise HTTPException(status_code=404, detail="Cross-validation report is not available.")
    return report


@app.post("/analyze")
async def analyze(
    request: Request,
    resume: UploadFile = File(...),
    job_description: str = Form(""),
    required_skills: str = Form(""),
    experience_requirements: str = Form(""),
    education_requirements: str = Form(""),
):
    _authorize(request)
    description = (job_description or "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="Job description is required.")

    payload = await resume.read()
    try:
        safe_name = validate_upload(
            resume.filename or "resume",
            resume.content_type,
            len(payload),
            MAX_BYTES,
        )
        resume_text = extract_text(payload, safe_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Could not read resume")
        raise HTTPException(status_code=400, detail="Invalid or corrupted file.") from exc

    try:
        result = analyze_resume(
            resume_text,
            description,
            _split_skills(required_skills),
            experience_requirements,
            education_requirements,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    stem = safe_name.rsplit(".", 1)[0]
    result["candidate_name"] = stem.replace("_", " ").replace("-", " ").strip()
    result["candidate_name_source"] = "filename"
    result["resume_filename"] = safe_name
    return result
