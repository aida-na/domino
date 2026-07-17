# Playwright smoke tests

```bash
# against local next dev (starts automatically)
npm run test:e2e

# against production
PLAYWRIGHT_BASE_URL=https://www.domino.fyi npm run test:e2e
```

`login.spec.ts` checks OTP-first login UI and the landing → login CTA. It does **not** send real OTPs.
