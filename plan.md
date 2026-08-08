# Project 9 — Iris Referral Matching: Build Plan

## Goals

1. **Ingest referrals from email.** DCS sends Kidtraks notification emails; there is no API. We simulate this locally by delivering `referral_emails.json` into **Mailpit** via SMTP and reading them back over the Mailpit REST API.
2. **Parse semi-structured emails** into referral records — structured fields (case number, referral ID, service, county, start date, children) plus soft preferences from the free-text `Notes` line (bilingual need, evenings/weekends).
3. **Build a correct, testable decision engine** applying Iris's real rules:
   - Role + education eligibility per `service_role_matrix.csv` (set membership — Family Preservation and FCT accept two roles)
   - The 12-family DCS cap as the hard capacity gate
   - The 20-hour rule is **unmeasurable** — the engine must say so, never fake it
   - Insurance/Medicaid/group referrals are a supervisor judgment call — surface, don't automate
4. **Supervisor approval screen** — recommendation with rationale, runners-up, soft-preference tradeoffs made visible, and approve / override / decline actions.
5. **Collaborative case editing.** Each case is a YORM-backed Yjs document — two supervisors can triage the same referral live with presence, while SQL projections keep the queue and KPIs queryable.
6. **Honest outcomes.** Three distinct results: **Match**, **No capacity** (eligible staff all at cap), **No eligible staff** (staffing gap). Declines are a KPI Iris reports — count them per week by service line.
7. **A test suite proving all of it** against known scenarios in the data.

**The win** (from the project pack): a correct decision engine, a supervisor approval screen, and an honest account of what cannot be computed from current data.

## Stack

- **Vite + React + TypeScript** — required by `@mieweb/ui` and `@esheet/*`
- **[@mieweb/ui](https://github.com/mieweb/ui)** — component library for all UI. Import `@mieweb/ui/styles.css`; style only with `--mieweb-*` design tokens (never generic `--card`/`--border` vars)
- **[eSheet](https://github.com/mieweb/esheet)** (`@esheet/renderer`, `@esheet/core`) — the **case sheet**: the referral/case record rendered as a form definition
- **[YORM](https://github.com/mieweb/yorm)** (`@yorm/core`, `@yorm/yjs`, `@yorm/hono`, `@yorm/drizzle`) — each case is a canonical collaborative Yjs document; YORM projects it into SQLite tables for queue and KPI queries. ⚠️ YORM has **no npm release** — vendor it as a git submodule (`vendor/yorm`) and link via workspace, exactly as YORM's own demo vendors `@mieweb/ui`
- **Hono** — backend (YORM's transport layer); REST + Yjs WebSocket
- **Drizzle ORM + SQLite (`better-sqlite3`)** — YORM's implemented persistence backend; also used directly for reference data (staff, services) that doesn't need CRDT. DB file: `data/iris.db` (git-ignored)
- **Mailpit** — local SMTP + web UI + REST API (`brew install mailpit` or Docker)
- **Vitest** — unit and scenario tests

## Architecture

```
referral_emails.json → seed script → SMTP :1025 → Mailpit
                                                     │  REST /api/v1/messages
                                                     ▼
                              ingest → parser → decision engine → case Y.Doc (YORM room per case)
                                                                        │
                                          YORM projections ▼ (SQLite via Drizzle)
                                          queue / decisions / kpi tables ← SQL GROUP BY
                                                                        │
                      React UI (@mieweb/ui): queue, case detail (eSheet), approve/override/decline
                      ↔ y-websocket: two supervisors see the same case live (collab editing)
```

**Why YORM here:** the case (referral + decision + supervisor notes) is one canonical collaborative document — two staff can triage the same referral simultaneously with CRDT merge — while the queue list and the declines-per-week KPI stay ordinary SQL over projection tables.

**DB rule:** app code never imports `better-sqlite3` directly — only the Drizzle `db` from `src/db/` and YORM stores. That keeps the database swappable (Postgres is YORM's next backend).

**Fallback rule (hackathon insurance):** the decision engine and parser are pure and framework-free. If YORM integration stalls past midday, fall back to plain Drizzle tables for the case record and keep collab as a stretch goal — nothing in M2–M4 changes.

---

## Milestones & Checklist

Rules for the junior dev:
- Work top to bottom. Check off items as you complete them (`[x]`).
- **Commit at the end of every milestone** with the message given.
- If a rule is ambiguous, read `approval_rules.md` — it wins over this file.
- Never hard-code the response deadline (48h vs 72h vs "3 business days" is deliberately unsettled — make it a config value).

### Milestone 0 — Scaffolding
> Commit: `M0: project scaffolding — vite+react, vitest, mieweb ui, yorm vendored, mailpit config`

- [ ] `npm create vite@latest app` (React + TypeScript). Keep data files at repo root.
- [ ] Add `vitest` and a passing smoke test (`expect(true).toBe(true)`).
- [ ] Add `@mieweb/ui` and import `@mieweb/ui/styles.css` in `main.tsx`. Render one `@mieweb/ui` component to prove the tokens load.
- [ ] Add `@esheet/renderer` + `@esheet/core`.
- [ ] Vendor YORM: `git submodule add https://github.com/mieweb/yorm vendor/yorm`, build it, and link `@yorm/*` via workspace/file deps (mirror YORM's own `examples/patient-collab-demo` setup).
- [ ] Add `hono`, `drizzle-orm`, `better-sqlite3`, `drizzle-kit` (dev). Create `drizzle.config.ts` pointing at `src/db/schema.ts` and `data/iris.db`.
- [ ] Add `.gitignore` (node_modules, dist, data/*.db).
- [ ] Add `npm run mailpit` script (or a `docker-compose.yml`) that starts Mailpit with SMTP on `:1025` and UI/API on `:8025`.
- [ ] Verify: `npm run dev`, `npm test`, and Mailpit UI at http://localhost:8025 all work.

### Milestone 1 — Email seeding into Mailpit
> Commit: `M1: seed script delivers referral emails into mailpit`

- [ ] Write `scripts/seed-mailpit.ts`: read `referral_emails.json`, send each as a real email over SMTP to `localhost:1025` (use `nodemailer`). Preserve `from`, `to`, `subject`, `body`, `message_id`, and set the `Date` header from `received_at`.
- [ ] `npm run seed` script.
- [ ] Verify: all 30 messages visible in the Mailpit UI.
- [ ] Test: seed script is idempotent-friendly (document that re-seeding duplicates; add `npm run seed:fresh` that calls Mailpit's delete-all API first).

### Milestone 2 — Ingest + parser
> Commit: `M2: mailpit ingest and referral parser with tests`

- [ ] `src/ingest.ts`: fetch messages from Mailpit REST API (`GET /api/v1/messages`, then message detail). Dedupe by `Message-ID`.
- [ ] `src/parser.ts`: parse the body into a typed `Referral`:
  - `caseNumber`, `referralId`, `service`, `county`, `region`, `fcmName`, `fcmPhone`, `requestedStartDate`, `childrenInHome` — from labelled lines
  - `notes` — raw prose
  - `preferences` — extracted from notes: `{ bilingual?: boolean, language?: string, availability?: ('Evenings'|'Weekends')[], expedite?: boolean }`. Keyword rules are fine (e.g. /bilingual|spanish/i, /evenings?/i, /weekends?/i, /expedite|permanency hearing/i). Note in a comment this is the step a model would own in production.
- [ ] Parser must be tolerant: unknown lines ignored, missing fields become `undefined` and flagged in `parseWarnings[]` — never throw on a well-formed email.
- [ ] Tests (`parser.test.ts`):
  - [ ] All 30 emails parse with zero warnings
  - [ ] Every parsed `service` exists in `service_role_matrix.csv`
  - [ ] A referral mentioning "Evenings and weekends preferred" yields those preferences
  - [ ] A mangled body (missing Service line) produces a warning, not a crash

### Milestone 3 — Database schema, YORM mapping + data loaders
> Commit: `M3: drizzle schema, yorm case mapping, roster and service matrix loaders with tests`

- [ ] `src/db/schema.ts` — Drizzle tables:
  - **Reference (plain Drizzle, no CRDT):** `staff` (mirrors `staff_roster.csv`; `counties_served`, `languages`, `availability` as JSON columns; `active` as boolean) and `services` (service, minimum education set, eligible role set — JSON columns)
  - **YORM projections (owned by the case mapping):** `cases` (message_id unique, parsed fields, status `pending|approved|overridden|declined`, assigned staff FK, decidedBy/decidedAt, decline reason), `case_decisions` (outcome, recommended staff FK, runners-up JSON, rationale JSON, unknowns JSON, `requiresSupervisorJudgment`)
- [ ] `src/case-doc.ts` — the canonical **case document** shape (one Y.Doc per referral): parsed referral + engine decision + supervisor state + notes. Define the eSheet form definition for it in `src/case-sheet.ts` so the renderer and the doc share field names.
- [ ] `src/db/mapping.ts` — YORM `defineMapping('iris.Case', v1)`: project the case doc into `cases` + `case_decisions` (forward-only; `one(...)` + `many(...)`, stable keys from `message_id`).
- [ ] `src/db/index.ts` — the only file that touches `better-sqlite3`; exports the Drizzle `db`. Use `drizzle-kit push` for schema sync.
- [ ] `src/db/import.ts`: import `staff_roster.csv` and `service_role_matrix.csv` (split `|` lists; parse `eligible_roles` on " or " into a role **set**; same for education). `npm run db:import`.
- [ ] Tests (in-memory SQLite — pass `:memory:` to the same factory):
  - [ ] 38 staff load; S001 is inactive; S006 has 13 of 12 families (over cap — real data, keep it)
  - [ ] Family Preservation and FCT each yield **two** eligible roles
  - [ ] Education parsing handles `HS Diploma/GED or BA` and `Master's or BA`
  - [ ] Re-running the import is idempotent (upsert on staff_id / service name)
  - [ ] Mapping golden test: a sample case doc → expected `cases` + `case_decisions` rows; second projection is idempotent

### Milestone 4 — Decision engine
> Commit: `M4: decision engine — eligibility, capacity, ranking, honest gaps`

This is the core. Pure functions, no I/O.

- [ ] `src/engine.ts` — `match(referral, staff, matrix, config) => Decision`:
  - [ ] **Gate 1 — active**: `active_flag === true`
  - [ ] **Gate 2 — role eligibility**: staff role ∈ service's eligible role set AND education meets the service minimum (define an education ladder: HS Diploma/GED < BA < Master's; an "or" minimum passes if any listed level is met)
  - [ ] **Gate 3 — county**: staff serves the referral county
  - [ ] **Gate 4 — capacity**: `current_families_assigned < max_families_dcs` (the 12-family cap). Staff at or over cap are excluded with reason `at_capacity`
  - [ ] **Judgment-call services** (Insurance/Medicaid Referrals, Substance Abuse Group): still compute candidates but set `requiresSupervisorJudgment: true` with the reason — do not auto-recommend
  - [ ] **Ranking** of survivors on soft preferences: language match, availability match, then most headroom (fewest current families). Ties broken deterministically (staff_id)
  - [ ] **Output**: `{ outcome: 'match' | 'no_capacity' | 'no_eligible_staff', recommended?, runnersUp[], rationale[], unknowns[] }`
  - [ ] `unknowns` **always** contains the 20-hour rule statement: face-to-face hours are not reportable from CaseWind, so the primary capacity rule could not be applied
  - [ ] `no_capacity` vs `no_eligible_staff` must be distinguished exactly as `approval_rules.md` describes (scheduling gap vs staffing gap)
- [ ] Tests (`engine.test.ts`) — the scenario suite, built from the deliberate difficulties in the data:
  - [ ] **Happy path**: a referral where a qualified, under-cap, county-matching staff member exists → `match` with rationale
  - [ ] **Inactive best match**: the inactive staff member (e.g. S001, bilingual, evenings+weekends) never appears in recommendations or runners-up
  - [ ] **At-cap exclusion**: staff with 12/12 or 13/12 are excluded from recommendation
  - [ ] **No capacity**: a service+county where every eligible person is full → `no_capacity`, and the rationale names who was eligible-but-full
  - [ ] **No eligible staff**: a service+county nobody covers → `no_eligible_staff`, worded as a staffing gap
  - [ ] **Dual-role service**: FCT referral matched by a Family Engagement Specialist 2 *and* by a Clinician II in separate cases
  - [ ] **Soft preference ranking**: bilingual-request referral ranks a Spanish speaker over an otherwise-equal English-only staff member — but does **not** exclude the English-only staff
  - [ ] **Judgment call**: Insurance/Medicaid referral returns `requiresSupervisorJudgment: true` and no auto-recommendation
  - [ ] **Unknowns**: every decision includes the 20-hour-rule unknown
- [ ] Run the engine over all 30 referrals and snapshot the outcome distribution (`scenarios.test.ts`) — this is the regression suite

### Milestone 5 — Pipeline + YORM service
> Commit: `M5: end-to-end pipeline — mailpit to collaborative case docs with SQL projections`

- [ ] `src/server.ts` — Hono app: `createYorm({ runtime: memoryRuntime(), documents/projections: drizzle stores, mappings: [caseMapping] })`, mounted at `/yorm` (REST + Yjs WebSocket).
- [ ] `src/pipeline.ts`: ingest → parse → match → create/update the case Y.Doc (`Case/<message_id>`); YORM projection populates `cases` + `case_decisions`. Dedupe on `message_id` so re-syncing is safe.
- [ ] Hono REST endpoints:
  - [ ] `POST /api/sync` — pull new mail from Mailpit and run the pipeline
  - [ ] `GET /api/queue` — SQL over the `cases` projection (join `case_decisions`, `staff`)
  - [ ] Approve / override / decline are **Yjs transactions on the case doc** (status, assigned staff, reason) — the projection updates the SQL rows; no separate write path
  - [ ] Approving increments the staff row's `current_families_assigned` (transaction) so later decisions see updated capacity
  - [ ] `GET /api/kpi` — declines per week by service line, SQL `GROUP BY` over the `cases` projection (Whitney's KPI, feeds project 10)
- [ ] Integration test (in-memory SQLite): seed → sync → 30 case rows; approve one via a doc transaction → projection row flips to `approved` and that staff member's headroom drops in the next decision; re-sync creates no duplicates.

### Milestone 6 — Supervisor UI (collaborative)
> Commit: `M6: supervisor approval screen — mieweb ui, esheet case sheet, live collab`

All components from `@mieweb/ui`; style only with `--mieweb-*` tokens.

- [ ] **Queue view** (`GET /api/queue`): pending referrals — service, county, received date, outcome badge (match / no capacity / no eligible staff / judgment call), response-deadline countdown from config.
- [ ] **Case detail view** — connects to the case's YORM room over y-websocket:
  - [ ] The **case sheet**: `<EsheetRenderer />` bound to the case doc fields (parsed referral, decision, supervisor notes) + raw email body (trust through transparency)
  - [ ] Recommendation with the rationale list, and runners-up with *why they ranked lower*
  - [ ] The **unknowns box** — always visible, states the 20-hour rule gap plainly
  - [ ] Judgment-call banner for Insurance/Medicaid/group referrals
  - [ ] Actions: **Approve** (recommended or pick a runner-up = override with required reason), **Decline** (reason category required) — all as Yjs transactions on the case doc
  - [ ] **Presence**: awareness shows who else has the case open; edits from a second browser window appear live
- [ ] **KPI panel**: declines per week by service line.
- [ ] Verify the full demo loop: seed → sync → open the same case in two browser windows → note typed in one appears in the other → approve in one, queue updates in both → KPI updates.
- [ ] Dark mode check: no non-`--mieweb-*` CSS vars (`grep -rn 'var(--' src | grep -v mieweb` is empty).

### Milestone 7 — Polish & handoff
> Commit: `M7: readme, demo script, final test pass`

- [ ] `README.md`: prerequisites (including `git submodule update --init` for vendor/yorm), `npm run mailpit` / `db:import` / `seed` / `dev` / `test`, the demo walkthrough (including the two-window collab moment), and a **"What we could not compute and why"** section (the 20-hour rule, the thin real-world email vs this richer synthetic one, the unsettled response deadline, per-role doc redaction out of scope).
- [ ] All tests green; run `npm run build` to confirm production build.
- [ ] Tag the demo scenarios: list 3 referral IDs to show live — one clean match, one no-capacity, one no-eligible-staff.

---

## Guardrails (do not violate)

- The matcher never silently resolves a soft preference — tradeoffs go to the supervisor.
- Never invent service hours. The 12-family cap is the only measurable hard gate.
- Declines are reported, not hidden — they feed the KPI.
- Response deadline is config, not a constant.
- Engine stays pure and fully unit-tested; the model-ish prose extraction is isolated in the parser.
- All persistence goes through Drizzle/YORM stores in `src/db/` — no raw `better-sqlite3` imports elsewhere, so the DB can be swapped later.
- The case Y.Doc is the single write path for case state; SQL rows are forward-only projections — never UPDATE a projection table by hand.
- A case doc contains a child's name — anyone who can sync the room sees the whole doc. One room per case, and the demo README must note that per-role redaction is out of scope.
- UI styling uses `--mieweb-*` tokens only.
