# Foundation validation

Verified locally on 2026-10-14 with Node 24.19.0, npm 11.9.0, and Chromium 153.0.8010.0 via Playwright. The environment's standard browser download returned a truncated archive; a separately extracted Chromium binary was used with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. That test-only browser is not a project dependency or runtime asset. CI installs the standard Playwright Chromium build.

| Check                         | Actual result                                      |
| ----------------------------- | -------------------------------------------------- |
| ESLint                        | Passed, no warnings/errors                         |
| TypeScript / Vue SFC checking | Passed (standalone typecheck and production build) |
| Vitest                        | 32 tests passed across 6 files                     |
| Production build              | Passed; manifest and service worker generated      |
| Production browser scenarios  | 8 Playwright scenarios passed                      |
| Netlify configuration         | TOML parsed; SPA redirect present                  |
| Whitespace/diff check         | Passed                                             |

## Automated coverage

- Empty workspace and first-run setup; existing records/preferences after database reconnection; full persistent-profile browser restart with a running timer.
- Client/project persistence, archive/history retention, protected deletion, manual entry editing, rate snapshots, currency precision, and reserved invoice locks.
- Draft reload recovery, pending-write cancellation after a save, discard behavior, and user-visible autosave state.
- Exact start/pause/resume/stop calculations, long suspension policy, negative/large clock discrepancies, reviewed durations, concurrent starts/stops, independent database connections, and live two-tab behavior.
- Plain/encrypted backup round trips; salt/nonce randomness; wrong passphrases/corruption; unsupported versions; duplicate IDs/invalid relationships; maximum size limits; atomic rollback after an injected restore failure; and all-store clearing.
- Honest failure feedback for injected quota errors; invalid stored records; missing workspace identity; unavailable IndexedDB; unavailable storage estimates.
- Light/dark theme persistence; 320px layouts without page overflow; reduced-motion mode; keyboard skip navigation; modal focus restoration/cancellation; typed confirmation before destructive clearing.
- Offline cold route navigation to a route not previously visited; local writes and reload while offline after application caching.
- Waiting-update guard with an uncommitted form draft (Vue component test using the PWA registration mock).

## Limits of this verification

Firefox, Safari, native installation prompts, actual physical sleep/wake, and a real two-version service-worker deployment have not been exercised locally. Timer sleep/clock policies are covered by deterministic service tests; controlled update acceptance is covered at the component level. The app was not deployed to Netlify, so hosting behavior there is configured rather than claimed as deployed. The browser grant/denial of persistent storage remains browser-controlled.

The first schema is version 1. No prior production schema exists, so there is no v0-to-v1 application migration to test. Future schema upgrades must add transactional migration tests rather than rewriting the v1 declaration. Abrupt shutdown can interrupt an uncommitted draft's 250ms debounce or a pending IndexedDB transaction.
