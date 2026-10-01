# Build a zip of the project for sharing.
# Excludes secrets, git history, dependencies, virtual environments, and uploads.
$root = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $root "resume-screening-share.zip"
if (Test-Path $destination) { Remove-Item $destination -Force }
Push-Location $root
try {
  tar -a -c -f $destination `
    --exclude=.git `
    --exclude=node_modules `
    --exclude=venv `
    --exclude=.venv `
    --exclude=dist `
    --exclude=__pycache__ `
    --exclude=.env `
    --exclude=backend/.env `
    --exclude=frontend/.env `
    --exclude=ml-service/.env `
    --exclude=backend/uploads `
    --exclude=backend/media `
    --exclude=resume-screening-share.zip `
    .
} finally {
  Pop-Location
}
Write-Output "Wrote $destination"
