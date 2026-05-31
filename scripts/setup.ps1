# One-time / refresh setup: migrate, seed labels, train, CV, report
# Run from repo root: .\scripts\setup.ps1

$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\backend"

if (-not (Test-Path ".\venv\Scripts\python.exe")) {
    Write-Host "Create venv first: python -m venv venv" -ForegroundColor Red
    exit 1
}

& .\venv\Scripts\activate
pip install -q -r requirements.txt pandas

Write-Host "Migrating database..." -ForegroundColor Cyan
python manage.py migrate

Write-Host "Importing seed training data..." -ForegroundColor Cyan
python manage.py import_seed_data

Write-Host "Training on verified labels..." -ForegroundColor Cyan
python manage.py train_ml --real-only

Write-Host "Cross-validation..." -ForegroundColor Cyan
& .\venv\Scripts\python ..\ml\src\cross_validate.py

Write-Host "Generating ML report..." -ForegroundColor Cyan
python manage.py generate_ml_report

Write-Host "Done. Start servers and open http://localhost:5173" -ForegroundColor Green
Set-Location $Root
