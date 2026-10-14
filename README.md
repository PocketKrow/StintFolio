# StintFolio

**Every session, accounted for.** A PocketRelik Tool.

A working local-first freelancer application: clients, projects, persistent timers, manual timesheets, and a transparent Data & Storage center. No account, backend, cloud database, analytics, or automatic device sync.

## Run locally

Use Node **22.12+** (Node 24 recommended) and npm.

```bash
git clone https://github.com/PocketKrow/StintFolio.git
cd StintFolio
git switch feat/local-first-foundation
npm ci
npm run dev
```

Open the localhost address printed by Vite. No `.env`, keys, database server, or external account is needed. Keep the hostname and port consistent: `localhost` and `127.0.0.1`, or different ports, have separate IndexedDB workspaces.

For the production PWA, use:

```bash
npm run build
npm run preview
```

The development server intentionally does not install a service worker. Production caching works on HTTPS and localhost after the initial successful cache. You can also deploy the `dist` directory to a static HTTPS host. `netlify.toml` supplies SPA redirects, CSP, and security headers; copy equivalent settings when using another host.

## What works

- Compact account-free onboarding, automatic workspace recovery, route restoration, and persisted preferences.
- Client CRUD with contact information, billing address, currency, optional default rate, and notes.
- Hourly/fixed-fee projects, client association, budgets/estimated hours, archive/reactivate, and historical sessions.
- Start/pause/resume/stop timers, cross-tab singleton protection, persistent rate snapshots, and explicit clock reviews.
- Manual entry creation, editing, and deletion with validation and future invoice-lock fields.
- Overview metrics based on real records, with monetary estimates separated by currency.
- Debounced recoverable client/project/entry drafts; save-state feedback and explicit discard.
- Light, dark, and system themes; responsive navigation, keyboard controls, reduced motion, and local fonts.
- Actual origin, database/schema, record counts, storage estimates, persistent-storage requests, and browser inspection guidance.
- Versioned plain JSON and passphrase-encrypted backups, preview/confirmation, atomic replacement, recovery from invalid local records, and confirmed workspace clearing.
- Installable production PWA with cached application assets and controlled update prompts.

## Data ownership

IndexedDB database: **StintFolioDB**, schema **1**. Data belongs to this website origin and this browser profile. It is not inherently encrypted or password-protected. A shared unlocked profile exposes the workspace to other users of that profile. Clearing site data or losing the device can erase it. Persistent-storage permission reduces automatic eviction risk; it is not a backup.

Export in **Data & Storage** regularly. Changing devices, browsers, ports, or deployment domains requires **export on the old origin → import on the new origin**. JSON is readable; encrypted backups require their original passphrase. The website can request a download but cannot verify that you retained the file.

## Timer policy

A running session counts wall-clock time, including sleep, tab suspension, and browser closure. Paused time is excluded. Intervals update the display only. Transitions and session creation are IndexedDB transactions; a UUID revision rejects stale-tab operations. A running segment over 24 hours, a backwards clock, or a detected live clock discrepancy requires an explicit total-duration review. The review pauses the session.

Clock adjustments while the browser is closed cannot always be distinguished from actual time away. Use **Review duration** when necessary. Historical rates/currencies are captured at start (manual entries at save), and changing defaults does not rewrite past value. Fixed-fee project totals are not converted to hourly earnings. Dashboard time spanning days is allocated proportionally over the session timestamp span because v1 does not retain individual pause intervals.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright checks the production preview: full browser-profile restart recovery, competing tabs, encrypted export/restore, drafts, manual entries, theme recovery, 320px layouts, offline deep links/reads/writes, quota failure feedback, and unavailable IndexedDB. CI runs the same checks. An existing Chromium executable can be used via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for restricted test environments.

See [architecture](docs/architecture.md), [backup format](docs/backup-format.md), and [validation notes](docs/validation.md) for policies and actual verification results.

## Foundation boundaries

Invoice generation/PDFs, payment processing, taxes, advanced financial reports, accounts, cloud sync, collaboration, and native packaging are deliberately deferred. There are no dead invoice/report navigation items. Storage APIs, install UI, and persistent-storage permission vary by browser. Final input during an abrupt shutdown can precede the 250ms draft debounce; only committed writes are guaranteed by application state. Backup imports are limited to 10 MiB.
