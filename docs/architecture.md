# Foundation architecture

Vue 3 Composition API and strict TypeScript, Vite, Vue Router 4, SCSS, Dexie/IndexedDB, Zod, and lucide-vue-next. Custom native forms and dialogs need no additional primitive library. Pinia stores transient feedback; it does not duplicate persistent records.

## Data flow

`Vue form → Zod/service validation → Dexie transaction → liveQuery → reactive view`

`database/schema.ts` defines records and validation. `database/db.ts` declares schema v1, opens/writability-checks the database, validates restored records/relationships, and timestamps successful mutations. A failed write rejects; feedback appears only after a successful commit. Local corruption produces a recovery screen and keeps original records available. Validated backup replacement can recover from bad records if storage remains writable.

`services/records.ts` owns workspace, entity, preference, and draft mutations. Projects refer to stable client UUIDs; entries and the singleton timer refer to project UUIDs. Deletion of clients with projects and projects with work is blocked. Archival retains history. Drafts associated with deleted records are removed. Invoice IDs reserve future associations; assigned entries are locked against editing/deletion.

`services/timer.ts` owns the `current` singleton, transactional transitions, revision-based stale-operation rejection, accumulated milliseconds, and rate snapshots. One transaction stops a session, inserts its historical entry, and removes the singleton. Two tabs cannot both start or stop the same session successfully. Dexie live queries update other tabs automatically.

`services/backup.ts` reads consistent snapshots and validates them before restoration. Restore is a single transaction over every store: clear and replacement succeed or roll back together. An imported timer receives a new revision so stale timer actions cannot apply to it. No cryptographic keys or passphrases enter any object store.

`composables/draft.ts` serializes debounced form writes, indicates draft status, recovers supported form keys, flushes ordinary route exits, and cancels obsolete drafts before record commits. Abrupt browser shutdown is not a reliable write event; the debounce and pending-transaction limitation is documented in the README.

## Object stores

| Store       | Key / query indexes                    | Responsibility                                                       |
| ----------- | -------------------------------------- | -------------------------------------------------------------------- |
| workspace   | `local`                                | Name, currency, optional default rate, creation timestamp            |
| clients     | UUID / name                            | Client identity, contact, address, defaults, notes                   |
| projects    | UUID / clientId, status, name          | Relationships, billing, rate/fee, budgets, archival                  |
| timeEntries | UUID / projectId, startedAt, invoiceId | Historical sessions, UTC timestamps, duration, rate snapshot         |
| activeTimer | `current`                              | Running/paused state, accumulated time, revision UUID                |
| settings    | `preferences`                          | Theme, date display, selected project, last route, list filters/sort |
| drafts      | stable form key / kind, entityId       | Versioned recoverable unsaved fields                                 |
| metadata    | `local`                                | Last successful mutation and requested backup download               |

Amounts use integer currency minor units. Supported currencies are USD/EUR/GBP/CAD/AUD/JPY/CHF/SEK, including JPY's zero-decimal precision. Financial estimates never combine currencies. Dates are stored as UTC epoch milliseconds and rendered in local time.

## Schema changes

Version 1 is the first production schema; there is no earlier production schema to migrate. Add `version(2).stores(...).upgrade(transaction => ...)` for future changes. Do not edit the v1 declaration in place. Test migrations with an explicitly created v1 database and verify rollback after failure. Blocked opens surface recovery guidance; never delete the database to repair a migration error.

## Offline and deployment

`vite-plugin-pwa` precaches the built shell, lazy route chunks, CSS, local WOFF2 fonts, and icons. IndexedDB retains records independently. The update prompt leaves a waiting service worker alone until the user accepts; updates are blocked while an active timer or saved drafts exist. Users finish the session and save/discard drafts, then request the update. No automatic reload interrupts work.

Netlify rewrites deep links to `index.html`, serves the service worker without long-term caching, and adds a self-origin CSP. Inline styles are permitted for Vue rendering; inline/external scripts are not. All core functionality is local, and no secrets or environment keys are required.

## Browser constraints

Use modern browsers on HTTPS/localhost. Install availability and persistent-storage grants are browser decisions. Private browsing may be temporary. Live clock drift checks compare wall time with a monotonic clock and can conservatively flag sleep on platforms where the monotonic clock pauses. Closed-browser clock corrections are indistinguishable from some legitimate absences; review the duration manually. Large datasets currently load into reactive arrays; indexed query/pagination work can be added when real usage calls for it. Form edits across tabs follow last-committed-write behavior; timer commands receive stronger revision protection.

## Primary references

- [Dexie transactions](<https://dexie.org/docs/Dexie/Dexie.transaction()>)
- [Dexie liveQuery](<https://dexie.org/docs/liveQuery()>)
- [Vite PWA controlled update prompts](https://vite-pwa-org.netlify.app/guide/prompt-for-update)
- [IndexedDB shutdown behavior](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [Storage persistence requests](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
- [Web Crypto key derivation](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)
