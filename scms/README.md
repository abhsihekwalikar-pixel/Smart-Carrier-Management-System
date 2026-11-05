# SCMS – Smart Career Management System

React + Vite + TypeScript + Tailwind frontend, FastAPI + SQLAlchemy backend (SQLite locally, MySQL in production), JWT access/refresh tokens, RBAC.

## Run locally (two terminals)
**Backend**
```
cd backend
python -m venv venv
venv\Scripts\activate          (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env         (Mac/Linux: cp .env.example .env)
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs
**Frontend** (project root)
```
npm install
npm run dev
```
Open http://localhost:5173. Super Admin: `admin@scms.com` / `Admin@123` (change via `.env` before first run).

> If you ran an earlier version, delete `backend/scms.db` once: the tables changed.

## Typical walkthrough
1. Register an **Organization** and a **Student** (separate browsers or private window).
2. Sign in as Super Admin -> **Organizations** -> Approve.
3. Organization: create a **Certificate template** (optionally upload a signature) -> **Generate** (single, or bulk CSV with an `email` column) -> download the PDF (contains a QR + Verification ID).
4. Anyone: open `/verify/<ID>` (or scan the QR) to verify. Organization can **Revoke**.
5. Student: build or upload a **Resume** (versions, AI enhance, PDF), generate a **Portfolio** from a prompt/resume, publish it at `/p/<slug>`, download issued documents.
6. Super Admin: users, RBAC matrix, templates, AI configuration (enable/disable, tone), analytics, audit logs.

## Tests
```
cd backend
python test_api.py && python test_features.py
```
## Production
`docker compose up --build` (needs `SECRET_KEY` and `ADMIN_PASSWORD` in a `.env` file) -> http://localhost:8080. Put it behind HTTPS and restrict CORS origins in `backend/app/main.py`.

## Notes
- AI features use a rule-based generator on the server (no external LLM). Admin can disable it or change its tone.
- Resume upload parsing is heuristic (reads Skills/Education/Experience/Projects headings); users can correct everything in the editor.
- Uploaded signatures are stored in the database as images (max ~400 KB).
