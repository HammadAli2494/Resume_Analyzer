# Machine learning guide

## What the model does

A binary classifier predicts whether a **resume** is a good fit for a **job description**. Features combine TF-IDF cosine similarity, character n-grams, semantic embedding distance, and spaCy-extracted skill overlap.

## Train

From the repo root (uses the backend virtualenv):

```powershell
cd backend
.\venv\Scripts\activate
pip install pandas scikit-learn joblib
python manage.py train_ml --real-only
```

Or run the pipeline directly:

```powershell
backend\venv\Scripts\python ml\src\train.py
```

### Outputs

| File | Purpose |
|------|---------|
| `ml/models/match_pipeline.joblib` | Production model |
| `ml/models/model_card.json` | F1, precision, recall, ROC-AUC |
| `ml/data/processed/resume_job_pairs.csv` | Exported labeled pairs |

## Improve quality (portfolio tip)

Synthetic and seed data are fine for demos; for credible metrics:

1. Label **100+ real** resume–job pairs in **Label Data** (mark verified)
2. `python manage.py train_ml --real-only`
3. Review **Evaluation** and `python manage.py generate_ml_report`

## CSV format (import)

Columns: `resume_text`, `job_text`, `label` (`1` = fit, `0` = not fit), optional `role`.

## Cross-validation

```powershell
backend\venv\Scripts\python ml\src\cross_validate.py
```

## One-shot setup script

```powershell
.\scripts\setup.ps1
```

Runs migrate, seed import, train on verified labels, cross-validation, and report generation.
