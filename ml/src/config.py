from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ML_ROOT / "data"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = ML_ROOT / "models"

TRAINING_CSV = PROCESSED_DIR / "training_pairs.csv"
REAL_TRAINING_CSV = PROCESSED_DIR / "resume_job_pairs.csv"
MIN_REAL_TRAINING_ROWS = 50
MODEL_FILENAMES = ("match_pipeline.joblib", "match_classifier.joblib")


def resolve_model_path() -> Path:
    for name in MODEL_FILENAMES:
        path = MODELS_DIR / name
        if path.exists():
            return path
    return MODELS_DIR / MODEL_FILENAMES[0]


MODEL_PATH = MODELS_DIR / MODEL_FILENAMES[0]
METRICS_PATH = MODELS_DIR / "metrics.json"
EVALUATION_PATH = MODELS_DIR / "evaluation.json"
MODEL_CARD_JSON = MODELS_DIR / "model_card.json"
CV_REPORT_PATH = MODELS_DIR / "cv_report.json"

RANDOM_SEED = 42
TEST_SIZE = 0.15
VAL_SIZE = 0.15

SKILL_LIST = [
    "python", "java", "javascript", "sql", "django", "react", "machine learning",
    "deep learning", "pandas", "numpy", "tensorflow", "pytorch", "scikit-learn",
    "aws", "docker", "kubernetes", "nlp", "data science", "statistics", "excel",
    "spark", "tableau", "communication", "leadership", "agile", "git",
]
