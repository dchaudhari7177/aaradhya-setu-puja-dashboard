# Aaradhya Setu · Puja Booking Dashboard

An admin dashboard for running Aaradhya Setu's online puja bookings. Ops staff can find any booking in seconds, see everything about it, and move it through the workflow. Each step sends the devotee a templated WhatsApp update, which is mocked here.

**Assignment:** Option 2, _Full-Stack: Puja Booking Dashboard_ (Next.js, Node.js, MongoDB). I also added the core of Option 3: every status change renders a WhatsApp template with the devotee's name, puja and booking ID, and stores it in a notification history.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · **Firebase (Firestore + Auth)** through the Admin SDK. MongoDB (Mongoose) is supported through the same storage interface and is what runs locally with zero setup.

![Dashboard](docs/screenshots/dashboard.png)

| Booking details                                         | Status change with message preview                   |
| ------------------------------------------------------- | ---------------------------------------------------- |
| ![Booking details](docs/screenshots/booking-detail.png) | ![Status dialog](docs/screenshots/status-dialog.png) |
| **New booking**                                         | **WhatsApp log**                                     |
| ![New booking](docs/screenshots/new-booking.png)        | ![WhatsApp log](docs/screenshots/whatsapp-log.png)   |

| Admin sign-in (Firebase Auth)            | Mobile                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| ![Sign in](docs/screenshots/sign-in.png) | <img src="docs/screenshots/mobile.png" width="260" alt="Mobile layout" /> |

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No database setup is needed. Without `MONGODB_URI`, the dev server starts a real local `mongod` through `mongodb-memory-server`, keeps its data in `.data/mongo` so it survives restarts, and seeds **72 realistic bookings** on first run. The first start downloads the MongoDB binary, which takes about a minute.

| Script                            | What it does                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server          |
| `npm test`                        | 78 tests (Vitest). The contract suite runs against a real mongod |
| `npm run test:emulators`          | Firestore contract suite + Firebase Auth guard on the emulators  |
| `npm run seed`                    | Reset whichever database is configured to the demo data          |
| `npm run make-admin -- <email>`   | Grant dashboard access via the Firebase `admin` custom claim     |
| `npm run lint` / `typecheck`      | ESLint, TypeScript                                               |

### Run on Firebase (Firestore + Auth)

1. In the Firebase console: create a **Firestore** database, enable **Email/Password** under Authentication → Sign-in method, and add an admin user.
2. Project settings → Service accounts → **Generate new private key**; save it as `.secrets/service-account.json` (git-ignored).
3. Copy [`.env.example`](.env.example) to `.env.local` and set `FIREBASE_SERVICE_ACCOUNT_FILE` and the `NEXT_PUBLIC_FIREBASE_*` web config.
4. Grant access: `npm run make-admin -- you@example.com` (sets the `admin` custom claim), or list emails in `ADMIN_EMAILS`. Access is **closed by default**: with neither, nobody can use the API.
5. `npm run dev`. Firestore is selected automatically once the key is present, the empty database is seeded, and the dashboard asks for sign-in.

Deploy [`firestore.rules`](firestore.rules) too: it denies all direct browser access, because every read and write goes through the API. The **Reset demo data** button in the sidebar restores the dataset at any time.

**Demo tips**

- Bookings dated **today** can be taken through the whole workflow.
- Press <kbd>/</kbd> to jump to search. Every filter is kept in the URL, so you can share a filtered view.
- Phone numbers ending in **0000** simulate an undeliverable WhatsApp number. You'll see the failed state and the **Retry** button.

---

## What it does

| Requirement                                                | Where                                                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Booking ID, devotee, puja, date, amount, status table      | Dashboard table, with a card layout on mobile                                                                                          |
| Searchable                                                 | One search box matches booking ID, devotee name, **phone (any spacing)**, puja, temple or city. It is debounced and runs on the server |
| Filters / sorting                                          | Status tabs **with live counts**, puja filter, date range plus _Today / Next 7 days / Last 7 days_, sortable columns, pagination       |
| Booking details view                                       | `/bookings/:id`: stepper with timestamps, puja / devotee / sankalp cards, activity timeline, WhatsApp thread                           |
| Status changes: Pending, Confirmed, In Progress, Completed | One-click advance from the table (optimistic, rolls back on error) or a dialog on the details page. Moving back requires a reason      |
| Backend APIs with persistence                              | REST route handlers → service layer → **Firestore** (Admin SDK, transactions) or MongoDB (Mongoose), behind one repository interface   |
| Admin access                                               | Firebase Auth sign-in; every API route verifies the ID token and an admin allow-list, and the history records who made each change     |
| Responsive interface                                       | Sidebar on desktop, drawer and cards on mobile; tested at 390 px and 1440 px                                                           |
| _Option 3 extras_                                          | Templated WhatsApp messages (mock provider), notification history in the DB, resend, global log                                        |

Also included: KPI cards and a workflow pipeline bar, a new booking form with a live message preview, CSV export of the current filter, and skeleton, empty and error states throughout.

---

## Architecture

```mermaid
flowchart LR
  UI["React client components<br/>(table, details, form)"] -- "fetch JSON + Firebase ID token" --> API["Route handlers<br/>/api/bookings/..."]
  UI -. sign in .-> FA["Firebase Auth"]
  API -- verifyIdToken --> FA
  API --> SVC["bookings-service<br/>workflow rules · notifications"]
  SVC --> REPO{{"BookingRepository<br/>(port)"}}
  SVC --> WA["MessagingProvider<br/>MockWhatsApp"]
  REPO --> F[(Firestore<br/>Admin SDK)]
  REPO --> M[(MongoDB<br/>Mongoose)]
  REPO --> MEM[(In-memory<br/>tests)]
```

```
src/
  app/                 pages + REST route handlers (app/api/**/route.ts)
  components/          UI: bookings table, details, status dialog, WhatsApp thread, form
  lib/domain/          shared by server and client: types, workflow rules, templates, Zod schemas, query logic
  server/
    bookings-service.ts  business rules (transitions, pandit assignment, notify)
    repository.ts        storage port + ConflictError
    adapters/            mongo.ts · firestore.ts · memory.ts
    whatsapp.ts          messaging port + mock provider
    seed-data.ts         deterministic demo data, relative to today
tests/                 domain · service · repository contract · API
```

### API

All errors share one shape: `{ "error": { "code", "message", "details?" } }`.

| Method & path                              | Purpose                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `GET /api/bookings`                        | `q, status, puja, from, to, sort, order, page, pageSize` → `{ items, total, totalPages, counts }`         |
| `POST /api/bookings`                       | Create (starts `Pending`, sends "booking received") → `201` + `Location`                                  |
| `GET /api/bookings/:id`                    | Booking + its WhatsApp messages                                                                           |
| `PATCH /api/bookings/:id/status`           | `{ status, expectedStatus, note?, pandit?, videoUrl? }` → `200`, or `409` stale, `422` invalid transition |
| `GET/POST /api/bookings/:id/notifications` | Message history / resend the current stage's message                                                      |
| `GET /api/bookings/export`                 | CSV of everything matching the same filters                                                               |
| `GET /api/stats`                           | KPI numbers                                                                                               |
| `GET /api/notifications`                   | Latest messages across bookings                                                                           |
| `GET /api/health`, `POST /api/demo/reset`  | Driver + row count; restore demo data                                                                     |

```bash
curl -X PATCH localhost:3000/api/bookings/AS-100042/status \
  -H 'content-type: application/json' \
  -d '{"status":"Confirmed","expectedStatus":"Pending"}'
```

---

## Decisions worth explaining

- **Auth is enforced on the server, not just hidden in the UI.** The browser signs in with Firebase Auth and sends its ID token on every request. Each API route verifies the token with the Admin SDK (signature, expiry, project), then requires an `admin` custom claim or a listed email. Because the Firebase web API key is public, anyone can create an account in the project, so access is **closed by default**: `401` with no token, `403` for any account that hasn't been granted admin. Firestore rules deny all direct client access; only the server, through the Admin SDK, touches the database.
- **The workflow is a state machine.** Bookings move one step at a time, so a devotee always gets the four messages in order. An admin can move one step back to fix a mistake, but only with a note. Rollbacks are recorded in the history and **never** message the devotee.
- **A puja can't start before its date.** Moving to _In Progress_ is refused until the puja date (in IST). The UI shows "Starts 12 Dec" instead of a button.
- **Concurrent edits are safe.** A status change includes `expectedStatus`. The update is a compare-and-set (`findOneAndUpdate({ bookingId, status: expected })` in Mongo, a transaction in Firestore). If two admins click at once, one wins and the other gets `409` with the current booking. A test races two updates to prove it.
- **Booking IDs come from an atomic counter.** `AS-100001`, `AS-100002`, … are allocated with `$inc` on a counter document, so concurrent creates never collide. This is tested too. The IDs are short enough to read out on a phone call.
- **Puja dates are calendar dates.** They're stored as `"YYYY-MM-DD"` strings, not timestamps. A puja happens on a day in India, so this avoids a UTC conversion shifting it to the day before. "Today" is computed in IST.
- **Storage sits behind a port.** The service only knows `BookingRepository`. The deployed app uses Firestore; MongoDB (which the brief names) runs locally with zero setup. The same contract suite runs against the in-memory reference, a real mongod and the Firestore emulator, and checks that search, sorting, pagination, counts, KPIs and export match exactly across all three.
- **Mongo design:** indexes back the default views (newest first, by status, by puja date), and one aggregation produces the status-tab counts. Two denormalised keys (`statusRank` and a lower-cased name) let "sort by status" follow the workflow and "sort by devotee" ignore case.
- **Firestore trade-off:** Firestore has no substring search and needs a composite index for every filter and sort combination. For an internal dashboard with thousands of rows, the adapter reads the collection and applies the shared, tested query logic. Past that scale, search should move to a search index.
- **Messaging is behind a port.** `MockWhatsAppProvider` stands in for Meta's Cloud API or Gupshup. Every attempt is stored, failures included, so a delivery problem never blocks the status change. Templates use `{{name}}` placeholders that map directly to WhatsApp Business templates, and a missing value falls back to readable text instead of showing `{{videoUrl}}`.
- **One validation source.** The same Zod schemas validate API input and give the form instant feedback. Phone numbers in any common format are normalised to E.164.
- **Small details:** filters live in the URL, the CSV export guards against formula injection without mangling `+91…` numbers, and the Next.js 16 Cache Components boundaries are set up so the static shell prerenders and data streams in.

## Tests

```
tests/domain.test.ts               workflow rules, templates, validation, INR/IST formatting, CSV
tests/service.test.ts              full workflow → 4 messages in order, rollback is silent, failed delivery + resend
tests/repository.contract.test.ts  memory vs real MongoDB (and Firestore on the emulator): 13 list queries, KPIs, export, ID race, status race
tests/auth.emulator.test.ts        Firebase Auth emulator: 401 no/forged token, 403 non-admin, 200 + audit name for admins
tests/api.test.ts                  route handlers: 200/201/400/404/409/422 and the error contract
```

CI (GitHub Actions) runs Prettier, ESLint, type-check, the unit/contract tests, the Firebase emulator suite and a production build on every push.

## With more time

- Roles on top of sign-in (ops vs. pandit coordinators), managed with Firebase custom claims
- Real WhatsApp Cloud API with approved templates, plus delivery receipts by webhook
- An outbox, so a status change and its notification are written atomically and retried in the background
- Cursor pagination and a search index for large datasets
- Ingesting new bookings from the Shopify storefront through an order webhook
