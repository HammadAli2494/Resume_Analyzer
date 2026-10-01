# Resume screening

A recruiter signs in, saves a job, uploads PDF or DOCX resumes, and reviews how relevant each resume is to that job. Scores support human review. They do not accept or reject anyone.

## Stack

```
React (Vite)  →  Express  →  MongoDB
                    ↓
               FastAPI  →  saved scikit-learn model
```

The browser talks only to Express. Express checks ownership, stores jobs and analyses, and calls the Python service for text extraction and scoring. The Python service should stay on a private network. If it must be reachable beyond that network, set the same `ML_INTERNAL_TOKEN` on Express and FastAPI. CORS is not access control.

| Layer | Tested in this workspace |
| --- | --- |
| Frontend | React 18.3, Vite 6.4, Tailwind 3.4, Framer Motion 13 |
| API | Node.js 24.14.1, Express 4.21, Mongoose 8.9 |
| Database | MongoDB on `127.0.0.1:27017` |
| Scoring | Python 3.14.4, FastAPI 0.142, scikit-learn 1.9.1, pdfplumber 0.11, python-docx 1.2 |

Node.js 20+ and the pinned Python packages in `ml-service/requirements.txt` are the setup these commands were run with. The saved classifier was trained with scikit-learn 1.9.1 and is not loaded on a different scikit-learn version.

## What the score means

The job match score blends keyword overlap, required-skill coverage, and, when the classifier loads, an uncalibrated classifier signal. Wording overlap is separate and is lexical, not semantic. Experience and education are shown for reviewers and are not scored. See `docs/ML.md`.

Required skills are matched with an explicit alias list (`MongoDB` / `Mongo DB`, `React` / `React.js`, `Node.js` / `NodeJS`, `Express` / `Express.js`, `PostgreSQL` / `Postgres`, and others) plus boundary-aware matching for other names. `Java` is not `JavaScript`, `C` is not `C++` or `C#`, and `SQL` is not `MySQL`. A phrase such as “no experience with Python, React, or SQL” is not counted as evidence for those skills. A later positive mention still counts. This is not full language understanding. Limits are listed in `ml-service/training/skill_match.py`.

Editing requirements stores a new job version. Rankings and CSV export default to the current version. Older analyses stay attached to the snapshot they were scored against and are not mixed into that ranking.

Candidate names start from the file name. The screen says so. A recruiter can replace the name; that replacement is labeled as entered by the recruiter.

## Local setup

Use three terminals from the repository root. Commands are for Windows PowerShell.

MongoDB must already be running locally. These commands do not install or reset it.

### 1. Scoring service

```powershell
cd ml-service
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\uvicorn.exe app.main:app --port 8000
```

### 2. API

```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```

Put a long random `JWT_SECRET` in `backend/.env` (at least 16 characters; 32 in production). Point `MONGODB_URI` at a running MongoDB. Do not commit `.env`.

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, create an account, and sign in. Every job and analysis requires an account.

## Demo workflow

1. Register and sign in.
2. Create a job with a description, required skills, an experience requirement, and optional education.
3. Open the job and upload a text-based PDF or DOCX.
4. Compare job match, keyword overlap, skill coverage, and matched or missing skills.
5. Export the current version as CSV, or open History to see the saved version.
6. Edit requirements. The new version is ranked on its own. Older results remain available in the version list.
7. Sign out. The previous token stops working.

## Tests

Automated tests use MongoDB database `resume_screening_test` only. They drop that database. They do not connect to the database named in `backend/.env` unless that name is already `resume_screening_test`.

```powershell
cd ml-service
.\venv\Scripts\python.exe -m unittest discover -s tests

cd ..\backend
npm test
```

The Python suite covers skill aliases, DOCX tables, PDF errors, and scoring-service token behavior. The Node suite covers auth, ownership, job versions, duplicate uploads, partial saves, CSV formula neutralization, and health when the database or scoring service is unavailable.

## Production

Set real hosts before starting. Production does not fall back to localhost for the API’s scoring URL or allowed browser origin, and it requires `ML_INTERNAL_TOKEN` (at least 16 characters) on both the API and the scoring service.

```powershell
cd frontend
$env:VITE_API_URL = "https://your-api-host/api"
npm install
npm run build
```

Serve `frontend/dist`. The app uses client routes (`/login`, `/jobs`, `/jobs/:id`, `/history`). The static host must return `index.html` for those paths. Vite preview does this. A typical nginx rule is `try_files $uri $uri/ /index.html;`.

```powershell
cd backend
$env:NODE_ENV = "production"
$env:PORT = "5000"
$env:MONGODB_URI = "mongodb://your-host:27017/resume_screening"
$env:JWT_SECRET = "long-random-secret"
$env:ML_SERVICE_URL = "http://your-ml-host:8000"
$env:ML_INTERNAL_TOKEN = "long-random-token"
$env:CLIENT_URL = "https://your-frontend-host"
npm install
npm start
```

Set `TRUST_PROXY` to `1` only when a single reverse proxy sits in front of Express. Leave it unset otherwise. Do not enable it so that clients can spoof their address.

```powershell
cd ml-service
.\venv\Scripts\activate
$env:ML_ENV = "production"
$env:ML_INTERNAL_TOKEN = "long-random-token"
$env:PORT = "8000"
.\venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000
```

Bind the scoring service to a private address. The website does not call it directly.

Health checks:

- `GET /api/health/live` on the API returns 200 when the process is up.
- `GET /api/health/ready` returns 200 only when MongoDB is connected and the classifier loaded. It returns 503 when the database or scoring service is down (`unavailable`) or when scoring is up without the classifier (`degraded`, `keyword_only`).
- `GET /live` on the scoring service is process liveness and does not require the shared token.
- `GET /ready` on the scoring service requires the token when `ML_INTERNAL_TOKEN` is set.

Recruiter screens do not show these operational details. A failed analysis says “Analysis is temporarily unavailable. Please try again.”

On a standalone local MongoDB, saves and deletes use compensating cleanup because multi-document transactions are unavailable. A replica set uses transactions. Duplicate screenings are blocked by a unique index when no duplicate groups already exist. If duplicates are already stored, the API logs a warning and does not delete them. See `backend/scripts/report-duplicate-analyses.js`.

## Environment variable names

`backend/.env`

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `ML_SERVICE_URL`
- `ML_INTERNAL_TOKEN` (required in production; optional locally)
- `CLIENT_URL`
- `CLIENT_ORIGINS` (optional extra browser origins, comma-separated)
- `MAX_UPLOAD_MB`
- `NODE_ENV`
- `TRUST_PROXY` (optional; set only for the real proxy hop count)

`frontend` build

- `VITE_API_URL` (required for a production build; local `npm run dev` uses `http://localhost:5000/api` when it is unset)

`ml-service`

- `PORT`
- `MAX_UPLOAD_MB`
- `ML_CORS_ORIGINS` (optional; leave empty so browsers are not invited)
- `ML_INTERNAL_TOKEN`
- `ML_ENV` (`production` requires the token)

Placeholder files: `backend/.env.example`, `frontend/.env.example`, `ml-service/.env.example`.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Create an account |
| POST | `/api/auth/login` | No | Return a JWT |
| GET | `/api/auth/me` | Yes | Current user |
| POST | `/api/auth/logout` | Yes | Invalidate that token |
| GET, POST | `/api/jobs` | Yes | List or create jobs |
| GET, PATCH, DELETE | `/api/jobs/:id` | Yes | View, edit, or delete a job |
| POST | `/api/jobs/:id/archive` | Yes | Archive or restore |
| POST | `/api/jobs/:id/screen` | Yes | Analyze PDF or DOCX resumes |
| PATCH | `/api/jobs/:id/analyses/:analysisId` | Yes | Correct the displayed candidate name |
| GET | `/api/jobs/:id/export.csv` | Yes | Download rankings for one version |
| GET | `/api/history` | Yes | Saved analyses |
| GET | `/api/dashboard` | Yes | Counts for the signed-in user |
| GET | `/api/health/live` | No | Process is up |
| GET | `/api/health/ready` | No | Database and classifier readiness |

Authentication uses the `Authorization: Bearer` header, not cookies. Logout increments a token version, so the previous JWT stops working.

Pass `?version=` on the job and export routes to read an older snapshot. The default is the current version.

## Security notes

- Passwords are hashed with bcrypt.
- Users can read and change only their own jobs, resumes, and analyses.
- Uploads are PDF or DOCX, size-limited, and checked for a PDF or ZIP signature. Bytes stay in memory. Extracted text is stored with the analysis and removed when that job is deleted. Resume text is not written to logs.
- CSV export prefixes cells that could be interpreted as formulas.
- Rate limits apply to the API and to login outside the automated test run.
- CORS in production uses `CLIENT_URL` and `CLIENT_ORIGINS` only.
- OCR is not implemented. Scanned PDFs are rejected with that limitation stated.

## Share a copy

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-share.ps1
```

The zip excludes `.git`, `node_modules`, virtual environments, `dist`, `__pycache__`, `.env` files, and local uploads. It keeps `.env.example` files. Do not add secrets before sending it.

## Limits and remaining work

- The published 1.0 metrics are from 16 job descriptions in a project CSV whose labels are separable by overlap features. Real-world hiring accuracy is unverified.
- Skill matching uses an alias list and phrase boundaries, not a general language model.
- Text-based PDFs and DOCX files are supported, including DOCX tables, nested tables, headers, and footers. Scanned pages are not.
- Parsing limits: 8 MB upload by default, 30 PDF pages, 20 MB decompressed DOCX, 200,000 extracted characters.
- Uploaded files are not kept on disk. Extracted text is capped and stored until the job is deleted.
