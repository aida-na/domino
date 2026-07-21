# App Store assets & submission

Brand artwork for App Store Connect submission.

| File | Size | Use |
|---|---|---|
| `AppStoreIcon-1024.png` | 1024×1024 | **App Icon** — App Store Connect → App Information |
| `MarketingHero-1024x764.png` | 1024×764 | Optional marketing / screenshot backdrop |

The live app icon is also wired in `Domino/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png`.

---

## Prerequisites (code — done in repo)

- [x] Bundle IDs: `fyi.domino.app` + `fyi.domino.app.share`
- [x] Associated Domains, App Groups, Keychain Sharing entitlements
- [x] AASA route at `frontend/src/app/.well-known/apple-app-site-association/route.ts`
- [x] Privacy manifest `PrivacyInfo.xcprivacy`
- [x] Export compliance: `ITSAppUsesNonExemptEncryption = false`
- [x] Privacy policy + FAQ mention iOS app / share extension
- [x] Support URL: `https://domino.fyi/faq`

---

## 1. Universal links (must be live before TestFlight QA)

Apple requires AASA at **HTTP 200 with no redirects** on every domain listed in entitlements.

```bash
# Both must return 200 + application/json (not 307/301/404)
curl -sI https://domino.fyi/.well-known/apple-app-site-association
curl -sI https://www.domino.fyi/.well-known/apple-app-site-association
curl -s https://domino.fyi/.well-known/apple-app-site-association
```

If apex still 307s to www:

```bash
# Option A — Vercel UI: Project domino-8x3a → Settings → Domains →
#   edit domino.fyi → remove redirect so both hostnames serve the app.

# Option B — API script (needs VERCEL_TOKEN):
cd frontend && chmod +x scripts/fix-aasa-domains.sh
VERCEL_TOKEN=xxx ./scripts/fix-aasa-domains.sh
```

Until apex is fixed, set Cloud Run / backend `FRONTEND_URL=https://www.domino.fyi` so magic
links land on www (where AASA can return 200 after deploy).

Redeploy the frontend after merging the AASA route. Apple CDN cache: reinstall the app
(or wait up to ~1 week) to refresh AASA.

---

## 2. Apple Developer / App Store Connect

1. Create app record with bundle ID `fyi.domino.app`
2. Register App ID + share extension `fyi.domino.app.share`
3. Enable: Associated Domains, App Groups (`group.fyi.domino.app`), Keychain Sharing
4. Create App Store listing (name: **domino**, primary category e.g. Productivity)

---

## 3. Build & TestFlight

On a Mac with **full Xcode** (not Command Line Tools only):

```bash
cd ios
xcodegen generate
chmod +x scripts/testflight.sh
./scripts/testflight.sh
```

Upload IPA via Transporter (or the `altool` command printed by the script). Add internal testers.

**Device QA checklist**

- [ ] OTP / password / magic-link sign-in
- [ ] Magic link opens app (universal link), not only Safari
- [ ] Dashboard load, star/delete, add item
- [ ] Share extension: Safari → Share → save to domino (after main-app sign-in)
- [ ] Sign out / sign back in

---

## 4. App Store Connect metadata

| Field | Value |
|---|---|
| Privacy Policy URL | `https://domino.fyi/privacy` |
| Support URL | `https://domino.fyi/faq` |
| Marketing URL | `https://domino.fyi` (optional) |
| Screenshots | Required: 6.7" and 6.5" iPhone; add iPad if shipping iPad |
| App Icon 1024 | Upload `AppStoreIcon-1024.png` (no transparency / rounded corners) |
| Subtitle | e.g. `your second brain via imessage` |
| Keywords | `second brain,bookmarks,notes,imessage,links,digest` |
| Description | Capture via iMessage + Safari share; browse/search/chat on iOS |
| Age rating | Complete questionnaire (no UGC social feed → typically 4+) |
| App Privacy | Phone #, email (optional), user content, product interaction — not used for tracking |
| Encryption | Uses only standard HTTPS → declare exempt / Info.plist already set |

---

## 5. App Review notes (paste into Connect)

```
domino is an iMessage-first second brain. Capture works via iMessage; this iOS app is for
retrieval (browse, search, chat) and includes a Safari share extension.

Demo login (password tab on the login screen):
  Phone: <YOUR_REVIEW_PHONE>
  Password: <YOUR_REVIEW_PASSWORD>

Please use the Password segment (not iMessage OTP). Create this account ahead of submission
and keep the password set.

Share extension: sign into the main app first, then in Safari use Share → "save to domino".

Universal links: https://domino.fyi/dashboard?token=… signs the user in (also works as
domino://dashboard?token=…).
```

Create the review account before submitting and fill in the placeholders above.

---

## Pre-launch checklist (security + compliance)

### Backend (production Cloud Run)

- [ ] Set `ENVIRONMENT=production` and `DEBUG=false` (CI sets these on deploy)
- [ ] Rotate all secrets if they were ever exposed in logs
- [ ] Run `backend/scripts/setup-gcp-secrets.sh` then `--bind` to move secrets to GCP Secret Manager
- [ ] Confirm `BLOOIO_WEBHOOK_SECRET` and `DOMINO_INTERNAL_SECRET` are set (app refuses to boot without them in prod)
- [ ] Create **App Review demo account** with password login (see §5)
- [ ] Deploy latest backend to prod (`push to main` or `workflow_dispatch`)

### Staging (optional but recommended)

- [ ] Deploy `domino-api-staging` Cloud Run service with **separate database**
- [ ] Set GitHub secret `STAGING_API_URL` for frontend staging builds
- [ ] iOS **Debug** builds point to staging (`ios/Config/Debug.xcconfig`)

### iOS

- [ ] **Release** builds → production API (`ios/Config/Release.xcconfig`)
- [ ] **Debug** builds → staging API (or `127.0.0.1:8000` in Simulator)
- [ ] Run `xcodegen generate` after xcconfig changes
- [ ] Device QA: OTP login, password login, share extension, sign out, delete account, export data
- [ ] Rebuild TestFlight: `cd ios && ./scripts/testflight.sh`

### App Store Connect

- [ ] Screenshots (6.7" + 6.5" required)
- [ ] Privacy nutrition labels match `frontend/src/app/privacy/page.tsx`
- [ ] App Review notes + demo credentials (§5)

### User data endpoints (implemented)

| Endpoint | Purpose |
|---|---|
| `GET /auth/me/export` | JSON export (CCPA right to access) |
| `POST /auth/me/delete` | Account + all saves deletion |

Web: **me → share & export**. iOS: **profile → export / delete account**.

---

## 6. Production env (backend)

On Cloud Run (production), set:

```
ENVIRONMENT=production
DEBUG=false
FRONTEND_URL=https://www.domino.fyi
```

Use `backend/scripts/setup-gcp-secrets.sh` for `DATABASE_URL`, `GEMINI_API_KEY`, `BLOOIO_*`, `RESEND_API_KEY`, `DOMINO_INTERNAL_SECRET`, and `SECRET_KEY`.

```bash
cd backend
./scripts/setup-gcp-secrets.sh --enable-api   # once: enable Secret Manager API
./scripts/setup-gcp-secrets.sh --import      # copy existing Cloud Run env vars → secrets
./scripts/setup-gcp-secrets.sh --bind          # remove plain env vars, attach secret refs
```

If `--bind` fails with "already been set with a different type", the script now removes plain env vars first. If Secret Manager API is disabled, run `--enable-api` first (or enable via [GCP console](https://console.developers.google.com/apis/api/secretmanager.googleapis.com/overview?project=domino-500918)).

---

## 7. Submit

1. Select the TestFlight build
2. Complete all required metadata + privacy nutrition labels
3. Attach review notes + demo credentials
4. Submit for review
