# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

---

## Purpose

**Domino** is a "second brain" app built by **daily labs**. The core loop:

1. User saves content (links, notes, images, voice memos) by sending a WhatsApp message
2. Backend extracts text, classifies the topic, and generates a rich AI summary via Gemini
3. User accesses everything through a web dashboard — search, browse, chat with their saved items
4. Weekly digest email resurfaces the best of what they've saved
5. "Discover" tab surfaces content recommendations based on their taste profile

The tagline: *"you save things you never revisit. domino turns everything you capture into something that actually compounds."*

WhatsApp is the primary capture interface. The web dashboard is for retrieval and exploration. More capture methods (email, browser extension) are planned.

---

## Repository Structure

```
domino/
  backend/    FastAPI Python backend (deployed to Google Cloud Run)
  frontend/   Next.js 16 frontend (deployed to Vercel)
```

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (Python) |
| Server | Uvicorn (ASGI) |
| ORM | SQLAlchemy 2.x (async) |
| Database (local) | SQLite via aiosqlite |
| Database (prod) | Supabase PostgreSQL via asyncpg |
| AI | Google Gemini (`google-genai`) |
| WhatsApp | Twilio |
| Email | Resend |
| File storage | Google Cloud Storage |
| Auth | Session-based (UUID Bearer tokens) + OTP via WhatsApp |
| URL extraction | trafilatura |
| PDF parsing | pypdf |
| Rate limiting | slowapi |
| Scheduling | croniter |
| Monitoring | Sentry |
| Testing | pytest + pytest-asyncio |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (app router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Components | shadcn/ui (Radix UI primitives) |
| Class utilities | clsx + tailwind-merge + class-variance-authority |

---

## Design System

### Brand Identity
- **Name:** domino (always lowercase)
- **Wordmark class:** `.dn-wordmark` — serif font, weight 800, tight tracking
- **Accent color:** `#ED4715` (burnt orange) — used for primary actions, active states, the wordmark dot
- **Visual motif:** actual domino tiles (the grid on the landing page animates a chain-fall effect)
- **Tone:** lowercase throughout the UI, direct and slightly editorial

### Color Tokens (`globals.css`)
```css
/* Domino v2 design tokens */
--bg:            oklch(0.985 0.008 90)   /* warm off-white page bg */
--bg-deep:       oklch(0.97 0.01 90)     /* slightly deeper bg */
--paper:         oklch(1 0 0)            /* pure white card surface */
--ink:           oklch(0.17 0.012 60)    /* near-black text */
--ink-2:         oklch(0.32 0.012 60)    /* secondary text */
--ink-3:         oklch(0.5 0.012 60)     /* tertiary / muted text */
--ink-4:         oklch(0.68 0.012 60)    /* placeholder / disabled */
--hairline:      oklch(0.88 0.008 80)    /* default border */
--hairline-soft: oklch(0.93 0.008 80)    /* subtle border */

/* Category card tints */
--card-y: oklch(0.965 0.045 100)  /* yellow  */
--card-p: oklch(0.93 0.035 350)   /* pink    */
--card-v: oklch(0.93 0.04 305)    /* violet  */
--card-o: oklch(0.94 0.045 50)    /* orange  */
--card-m: oklch(0.95 0.045 165)   /* mint    */
--card-b: oklch(0.94 0.04 230)    /* blue    */
--card-s: oklch(0.96 0.012 90)    /* stone   */

/* Accent */
--domino-accent:      oklch(0.66 0.19 35)  /* #ED4715 equivalent */
--domino-accent-deep: oklch(0.55 0.17 35)  /* hover/pressed state */
--domino-star:        oklch(0.82 0.16 85)  /* starred item gold */
```

shadcn/ui semantic tokens (`--primary`, `--background`, etc.) also defined in `:root` and `.dark` — `--primary` is `#ED4715` in both modes.

### Typography
| Role | Font | Class |
|---|---|---|
| Wordmark / display | DT Getai Grotesk Display Black (local OTF) | `.font-compagnon` |
| Monospace / code | DraftingMono Regular + Light (local OTF) | `.font-drafting-mono` |
| Body (via Next.js var) | Figtree | `.font-figtree` |
| Serif accent | Newsreader | `var(--font-serif)` |
| Mono accent | JetBrains Mono | `var(--font-jb-mono)` |

### Core CSS Component Classes
All prefixed `dn-` — defined in `frontend/src/app/globals.css`:

| Class | Description |
|---|---|
| `.dn-card` | Item card — 18px radius, subtle shadow, hover lift (-2px translateY) |
| `.dn-masonry` | 2-column masonry grid for item cards |
| `.dn-chip` | Filter pill — 34px height, pill shape, active state fills with `--ink` |
| `.dn-icon-btn` | 28×28px icon button, 8px radius, hover bg |
| `.dn-bottom-nav` | 4-column bottom nav bar with blur backdrop |
| `.dn-tab` | Nav tab item — active color is `--domino-accent` |
| `.dn-fab` | Floating action button — 56×56px, 18px radius, accent bg |
| `.dn-sheet` | Bottom sheet modal — slides up from bottom, 22px top radius |
| `.dn-backdrop` | Dimmed overlay behind sheets |
| `.dn-grabber` | Sheet drag handle indicator |
| `.dn-search-bar` | Pill-shaped search input with focus ring |
| `.dn-hscroll` | Horizontal scrolling row (hidden scrollbar) |

### Animations
- `dnFadeIn` — opacity 0→1, 200ms
- `dnSlideUp` — translateY(110%)→0, 280ms cubic-bezier(.2,.8,.2,1)
- `dnPop` — scale(0.6)→1, 240ms cubic-bezier(.2,.8,.2,1)
- Domino tile fall/rise — chain animation on the landing page grid
- Reduced motion: all animations set to 0.01ms via `prefers-reduced-motion`

### Layout Conventions
- Mobile-first, single-column layout
- Bottom navigation (4 tabs: dashboard, map, discover, me)
- Safe area insets respected (`env(safe-area-inset-bottom)`)
- `overscroll-behavior: none` on body to prevent pull-to-refresh
- Cards use 2-column masonry grid (`.dn-masonry`)
- Background texture: `.bg-check-grid` (dashed grid SVG pattern)

---

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

---

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

**Twilio webhook URL:** `POST /api/v1/sms` — configure this in Twilio console for incoming WhatsApp messages.

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

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Backend | Google Cloud Run | `https://domino-414681726671.us-central1.run.app` |
| Frontend | Vercel (Next.js) | `https://domino.fyi` |
| Database | Cloud SQL (PostgreSQL) | — |
| Media storage | Google Cloud Storage | — |

### Environment Variables

**Frontend (Vercel env vars):**
```
NEXT_PUBLIC_API_URL = https://domino-414681726671.us-central1.run.app
```

**GitHub Actions (weekly digest):**
```
DOMINO_API_URL = https://domino-414681726671.us-central1.run.app
DOMINO_INTERNAL_SECRET = <same value as backend env>
```

**Backend `.env` keys** (see `backend/.env.example` for full list):
- `DATABASE_URL` — Cloud SQL / Postgres connection string
- `GEMINI_API_KEY` — Google Gemini API key
- `BLOOIO_API_KEY`, `BLOOIO_PHONE_NUMBER`, `BLOOIO_WEBHOOK_SECRET` — iMessage / SMS
- `RESEND_API_KEY` — for digest emails
- `GCS_BUCKET_NAME` — for image storage (Cloud Run uses attached service account)
- `DOMINO_INTERNAL_SECRET` — protects `/digest/trigger` endpoint

### CI/CD
- GitHub Actions: push to `staging` branch triggers backend (Cloud Run) + frontend deploy
- Weekly digest: `domino-weekly-digest.yml` calls `POST /api/v1/digest/trigger` with `X-Internal-Secret` header
