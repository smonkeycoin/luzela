# Playwright Setup

## Installed

```txt
@playwright/test
Chromium
```

## Config

`playwright.config.ts` uses:

```txt
baseURL: http://127.0.0.1:3001
webServer: npm run dev -- --hostname 127.0.0.1 --port 3001
browser: chromium
```

## Tests

```txt
tests/e2e/storefront.spec.ts
tests/e2e/admin-auth.spec.ts
tests/e2e/login.spec.ts
tests/e2e/checkout-shell.spec.ts
```

Coverage:

- Storefront loads.
- Products are visible.
- `/admin` without a session redirects to `/auth/login`.
- Login page renders Google button.
- Checkout opens from product CTA without visible JavaScript errors.

Google OAuth real login is intentionally not automated yet because it requires secure credentials and session handling.

## Git Ignore

Ignored:

```txt
playwright-report/
test-results/
```
