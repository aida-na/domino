# Local QA runbook (~10 min)

Use this before TestFlight / App Store submission. **Delete account** and **export** buttons already ship on iOS (profile) and web (me → share & export).

## 0. Pick your API target

| Target | Backend | iOS build | OTP without SMS |
|---|---|---|---|
| **Local server** | `uvicorn app.main:app --reload` + `.env.local` (`DEBUG=true`) | Debug xcconfig → `127.0.0.1:8000` | `dev_code` in `/auth/otp/request` JSON |
| **Staging** | `domino-api-staging` (Debug default) | Debug build | `scripts/local_qa.py peek-otp` via Cloud SQL proxy |
| **Production** | Release / TestFlight | Release xcconfig | Real iMessage only (App Review account uses password) |

Cloud SQL from Mac:

```bash
# Install once: brew install cloud-sql-proxy
cloud-sql-proxy domino-500918:us-central1:domino-db --port 5433
# In another terminal, export DATABASE_URL with proxy host 127.0.0.1:5433
```

## 1. Start local stack (recommended for OTP without phone)

```bash
# backend/.env — set DEBUG=true, ENVIRONMENT=development, DAILY_NEW_USER_LIMIT=0
# Optional: BLOOIO_API_KEY= (empty) so OTP prints in uvicorn console
cd backend && uvicorn app.main:app --reload

cd frontend && echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local && npm run dev
```

iOS Simulator: in `ios/Config/Debug.xcconfig` uncomment:

```
API_BASE_URL = http:/$()/127.0.0.1:8000/api/v1
```

Then `cd ios && xcodegen generate` and run from Xcode.

## 2. Flow checklist

### A. OTP login (fresh signup)

```bash
# Erase your number first (prod/staging DB via proxy, or local Postgres)
cd backend
python scripts/local_qa.py delete-user +13392081349
```

1. Login screen → enter phone → request code  
2. **Local DEBUG:** read `dev_code` from curl or Network tab:
   ```bash
   curl -s -X POST http://localhost:8000/api/v1/auth/otp/request \
     -H 'Content-Type: application/json' \
     -d '{"phone":"+13392081349"}' | jq
   ```
3. Enter code → optional password setup → dashboard  
4. Confirm onboarding sheet if first visit

### B. Password login

1. me → edit profile → set password (min 8 chars)  
2. Sign out (profile → sign out)  
3. Login → **password** tab → phone + password

### C. Magic link / universal link

```bash
# With DEBUG backend — link returned in JSON:
curl -s -X POST http://localhost:8000/api/v1/auth/magic-link \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+13392081349"}' | jq -r .dev_link

# Or print without SMS:
python scripts/local_qa.py magic-link +13392081349 --frontend-url http://localhost:3000
```

- **Web:** open `http://localhost:3000/dashboard?token=<uuid>` → auto sign-in  
- **iOS device:** use `https://www.domino.fyi/dashboard?token=…` (universal link) or `domino://dashboard?token=…`  
- **Simulator:** `xcrun simctl openurl booted 'domino://dashboard?token=UUID'`

### D. Share extension (Safari → save)

Requires **physical device** or Simulator with signed-in main app (Keychain + App Group).

1. Sign in on main app first  
2. Safari → any page → Share → **save to domino**  
3. Confirm item appears on dashboard

### E. Export data

- **iOS:** profile → export → share JSON file  
- **Web:** me → export  

Or API: `GET /api/v1/auth/me/export` with Bearer session token.

### F. Delete account (throwaway number)

Use a fake/test number (e.g. `+15550001234`) — not your personal line.

1. Register via OTP (local `dev_code`)  
2. profile → **delete account** → type `delete` → confirm  
3. Verify sign-out and number cannot log in again

### G. Sign out / sign back in

profile → sign out → password or OTP login again.

## 3. App Review demo account (production)

Apple reviewers use **password login** (not OTP). Create on **production** DB:

```bash
cloud-sql-proxy domino-500918:us-central1:domino-db --port 5433
export DATABASE_URL='postgresql+asyncpg://USER:PASS@127.0.0.1:5433/domino'

cd backend
python scripts/local_qa.py setup-review-account '+1YOUR_REVIEW_PHONE' 'YourReviewPass1!' \
  --frontend-url https://www.domino.fyi --reseed
```

Then paste phone + password into `ios/AppStore/README.md` §5 and App Store Connect review notes.

Sample saves seeded: PG essay link, inbox note, domino FAQ link.

## 4. Quick API smoke (curl)

```bash
BASE=http://localhost:8000/api/v1
PHONE='+15550009999'

# OTP signup
CODE=$(curl -s -X POST $BASE/auth/otp/request -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" | jq -r .dev_code)
TOKEN=$(curl -s -X POST $BASE/auth/otp/verify -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}" | jq -r .access_token)

curl -s $BASE/auth/me -H "Authorization: Bearer $TOKEN" | jq
curl -s $BASE/auth/me/export -H "Authorization: Bearer $TOKEN" | jq .item_count
```
