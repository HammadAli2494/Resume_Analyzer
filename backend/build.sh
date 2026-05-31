#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python -m spacy download en_core_web_sm

python manage.py migrate --noinput
python manage.py import_seed_data || true

# Train if no model artifact (first deploy); skip if joblib already present
if [ ! -f "../ml/models/match_pipeline.joblib" ]; then
  python manage.py train_ml --real-only || true
fi

python manage.py collectstatic --noinput
