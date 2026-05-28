# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Domino is a "second brain" app. Users save content (links, notes, images, voice) via WhatsApp and access it through a web dashboard. The backend processes content with Gemini AI (summarization, topic classification, chat).

## Repository Structure

```
domino/
  backend/    FastAPI Python backend
  frontend/   Next.js 16 frontend
```

## Development Commands

### Backend (run from `backend/`)

```bash
pip install -r requirements.txt          # Install deps
uvicorn app.main:app --reload            # Start dev server on :8000
pytest                                   # Run all tests
pytest tests/path/to/test_file.py        # Run a single test file
pytest -k "test_name"                    # Run a specific test
```

Copy `backend/.env.example` to `backend/.env` and fill in values. Without Twilio credentials, WhatsApp messages print to console instead of sending.

### Frontend (run from `frontend/`)

```bash
npm install       # Install deps
npm run dev       # Start dev server on :3000 (webpack mode)
npm run build     # Production build
npm run lint      # ESLint
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local` to proxy API calls to the local backend.

## Architecture

### Backend

**FastAPI** with async SQLAlchemy. Database schema is created at startup via raw SQL in `app/main.py` lifespan — there are no Alembic migrations.

- `app/core/config.py` — Pydantic settings loaded from `.env`. Default DB is SQLite (`domino.db`); production uses Supabase PostgreSQL.
- `app/api/endpoints/auth.py` — Session-based auth. Sessions are UUID rows in `domino_sessions`; the UUID is the Bearer token. Also handles OTP (WhatsApp 6-digit code) and optional password login.
- `app/api/endpoints/webhook.py` — Twilio inbound WhatsApp handler. Dispatches to handlers for save, login, delete, list, settings, email collection, image, and voice. Also exposes `/digest/trigger` (internal, protected by `DOMINO_INTERNAL_SECRET`).
- `app/api/endpoints/items.py` — CRUD for saved items.
- `app/services/processor.py` — Content pipeline: `detect_input_type` → extract text (trafilatura for URLs, pypdf for PDFs) → Gemini for topic classification and rich summarization (summary + key_ideas).
- `app/services/gemini_client.py` — Gemini API wrapper. `DEFAULT_GEMINI_MODEL` is used throughout.
- `app/services/digest.py` — Weekly digest emails via Resend.
- `app/services/scheduler.py` — Processes due reminders.
- `app/services/storage.py` — GCS image uploads (Twilio media URLs expire).
- `app/services/chat.py` — RAG-style chat against saved items.

**Auth flow:** OTP request → WhatsApp code → verify → creates `domino_sessions` row → UUID returned as `access_token` → used as `Authorization: Bearer <uuid>` on all subsequent requests.

### Frontend

**Next.js 16** app router with TypeScript and Tailwind CSS v4.

- `src/features/domino/domino-api.ts` — All API calls in one object (`dominoApi`). API base is `/api/v1`; Next.js rewrites proxy to `NEXT_PUBLIC_API_URL`.
- `src/features/domino/domino-auth-context.tsx` — `DominoAuthProvider` stores session token + phone in `localStorage`. Exposes `useDominoAuth()` hook.
- `src/features/domino/domino-protected-route.tsx` — Redirects unauthenticated users to `/login`.
- `src/features/domino/domino-app-shell.tsx` — Main layout shell for authenticated pages.
- `src/components/ui/` — shadcn/ui components (Button, etc.).
- Pages: `/` (landing), `/login`, `/verify`, `/dashboard`, `/map`, `/discover`, `/me`, `/faq`, `/privacy`, `/terms`.

**API proxy:** `next.config.ts` rewrites `/api/v1/:path*` to `${NEXT_PUBLIC_API_URL}/api/v1/:path*`, so frontend code always calls `/api/v1/...` regardless of environment.

### Database Schema

Tables (all prefixed `domino_`): `users`, `items`, `otps`, `sessions`, `messages`, `reminders`, `waitlist`. `domino_users.phone` (E.164 format) is the FK used across all tables.

## Deployment

- **Backend:** Google Cloud Run (Docker). `PORT` env var sets the uvicorn port.
- **Frontend:** Vercel (inferred from CORS regex `^https://domino[a-z0-9\-]*\.vercel\.app$`).
- **CI:** GitHub Actions. Push to `staging` branch triggers deploy to Cloud Run staging + Vercel build.
- **Weekly digest:** GitHub Actions workflow (`domino-weekly-digest.yml`) calls `POST /api/v1/digest/trigger` with `X-Internal-Secret` header.
