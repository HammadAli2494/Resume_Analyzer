# Deploy online (Netlify + Render)

This app has two parts:

| Part | Host | Why |
|------|------|-----|
| **React UI** | [Netlify](https://www.netlify.com) | Static Vite build |
| **Django + ML API** | [Render](https://render.com) | Python, file uploads, scikit-learn, spaCy |

Netlify alone cannot run Django or your ML model.

---

## Before you start

1. Push the project to **GitHub** (do not commit `backend/venv`, `frontend/node_modules`, or secrets).
2. Optional: commit a trained model so the first deploy is faster:
   - Run locally: `python manage.py train_ml --real-only`
   - Temporarily allow `ml/models/match_pipeline.joblib` in git, or rely on `build.sh` to train on Render (slower, ~5–10 min).

---

## Step 1 — Deploy the API on Render

1. Go to [render.com](https://render.com) → **Sign up** → **New** → **Blueprint** (or **Web Service**).
2. Connect your GitHub repo.
3. If using **`render.yaml`** in the repo root: Render creates the web service + free Postgres.
4. Set environment variable **`CORS_ALLOWED_ORIGINS`** after you have your Netlify URL:
   ```
   https://your-app-name.netlify.app
   ```
   (comma-separate multiple origins; no trailing slash on paths)

5. Wait for deploy. Copy your API URL, e.g.:
   ```
   https://resume-screening-api.onrender.com
   ```

6. Test: open `https://YOUR-API.onrender.com/api/health/` — should return JSON `"status": "ok"`.

**Manual setup (no Blueprint):**

- Root directory: `backend`
- Build command: `chmod +x build.sh && ./build.sh`
- Start command: `gunicorn resume_screening.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
- Add env vars from `render.yaml` (`DJANGO_PRODUCTION=1`, `DEBUG=0`, generated `SECRET_KEY`, etc.)

**Note:** Free Render services spin down after inactivity; first request may take 30–60 seconds.

---

## Step 2 — Deploy the frontend on Netlify

1. Go to [netlify.com](https://www.netlify.com) → **Add new site** → **Import from Git**.
2. Select your repo.
3. Netlify reads **`netlify.toml`** automatically:
   - Base directory: `frontend`
   - Build: `npm ci && npm run build`
   - Publish: `dist`
4. **Site settings → Environment variables** → add:

   | Key | Value |
   |-----|--------|
   | `VITE_API_URL` | `https://YOUR-API.onrender.com/api` |

   Use your real Render URL; must end with `/api`.

5. **Deploy site**.

6. Open `https://your-app.netlify.app` → try **Analyze**.

7. Go back to Render → set **`CORS_ALLOWED_ORIGINS`** to your Netlify URL → **Redeploy** API if you had CORS errors.

---

## Step 3 — Verify

- [ ] `https://YOUR-API.onrender.com/api/health/` works
- [ ] Netlify site loads
- [ ] Analyze upload works (wake Render first if cold start)
- [ ] Login / Jobs work (uses Postgres on Render)

---

## Optional env vars (Render)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | LLM coaching on analyze |
| `CORS_ALLOWED_ORIGINS` | Netlify URL(s) |

---

## Alternatives

| Frontend | Backend |
|----------|---------|
| Vercel | Same Render API + `VITE_API_URL` |
| Cloudflare Pages | Same Render API |
| Render static site | Single platform: deploy both on Render (no Netlify) |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error in browser | Set `CORS_ALLOWED_ORIGINS` on Render to exact Netlify URL |
| Network error / 502 | Render cold start; wait and retry |
| ML not available | Check Render build logs for `train_ml`; ensure `ml/models/` exists after build |
| 500 on training page | Run migrations: should run in `build.sh` |
| Works locally, not online | Confirm `VITE_API_URL` includes `https://` and `/api` |

---

## Cost

- **Netlify** free tier: fine for portfolio static sites.
- **Render** free tier: web + Postgres; sleeps when idle.

For a serious demo, consider Render **Starter** ($7/mo) to avoid sleep.
