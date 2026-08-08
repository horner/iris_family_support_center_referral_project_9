# Project 9 — Iris Referral Matching: Build Plan

## Goals

1. **Ingest referrals from email.** DCS sends Kidtraks notification emails; there is no API. We simulate this locally by delivering `referral_emails.json` into **Mailpit** via SMTP and reading them back over the Mailpit REST API.
2. **Parse semi-structured emails** into referral records — structured fields (case number, referral ID, service, county, start date, children) plus soft preferences from the free-text `Notes` line (bilingual need, evenings/weekends).
3. **Build a correct, testable decision engine** applying Iris's real rules:
   - Role + education eligibility per `service_role_matrix.csv` (set membership — Family Preservation and FCT accept two roles)
   - The 12-family DCS cap as the hard capacity gate
   - The 20-hour rule is **unmeasurable** — the engine must say so, never fake it
   - Insurance/Medicaid/group referrals are a supervisor judgment call — surface, don't automate
   - Fairness/workload balancing is an **explicit, switchable policy**, never a hidden tiebreaker
4. **Plan the whole queue, not one referral at a time.** Staff capacity is a shared budget — two referrals cannot both take the last slot. The planner allocates across the pending set, surfaces contention by name, and respects supervisor decisions as pins.
5. **Mobile-first supervisor screens with three planning modes** — *Plan* (the whole queue and its contention), *Recommend* (accept the computed answer for one case), and *Explore* (see every candidate, every gate, and re-rank under different policies). All read the same objects, so the UI never re-derives engine logic. **Review-and-commit must be completable one-handed on a phone** — supervisors triage between home visits, not at a desk, and the DCS response clock runs while they are in the field.
6. **Collaborative case editing.** Each case is a YORM-backed Yjs document — two supervisors can triage the same referral live with presence, while SQL projections keep the queue and KPIs queryable.
7. **Honest outcomes.** Three distinct results: **Match**, **No capacity** (eligible staff all at cap, or the slot went to a more constrained referral), **No eligible staff** (staffing gap). Declines are a KPI Iris reports — count them per week by service line.
8. **A test suite proving all of it** against known scenarios in the data.

**The win** (from the project pack): a correct decision engine, a supervisor approval screen, and an honest account of what cannot be computed from current data.

## Stack & architecture

The design of record is **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — stack table, system diagram, data model, case lifecycle, commit protocol, security boundaries, and the reasoning behind each. **Read it before starting M0.** When the design changes, update that file rather than restating it here.

Three rules from it that every milestone below depends on:

1. **Plan the set, not the referral.** Capacity is a shared budget across the pending queue.
2. **Evaluate, then allocate.** The engine scores everyone; selection is a separate step; the UI never re-derives a gate.
3. **Propose in the CRDT, commit through the API.** Proposals merge and work offline; assignments are server-authoritative and confirmed in real time.

**Fallback rule (hackathon insurance):** the parser, engine, and planner are pure and framework-free. If YORM integration stalls past midday, fall back to plain Drizzle tables for the case record and keep collab as a stretch goal — nothing in M2–M5 changes.

---

## Milestones & Checklist

Rules for the junior dev:
- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first. This file is *what to build in what order*; that one is *how it fits together and why*.
- Work top to bottom. Check off items as you complete them (`[x]`).
- **Commit at the end of every milestone** with the message given.
- If a rule is ambiguous, read `approval_rules.md` — it wins over both this file and the architecture doc.
- If the design changes as you build, update `docs/ARCHITECTURE.md` in the same commit. Don't let it go stale and don't restate it elsewhere.
- Never hard-code the response deadline (48h vs 72h vs "3 business days" is deliberately unsettled — make it a config value).

### Milestone 0 — Scaffolding
> Commit: `M0: project scaffolding — vite+react, vitest, mieweb ui, yorm vendored, mailpit config`

- [x] `npm create vite@latest app` (React + TypeScript). Keep data files at repo root. *(Built at the repo root instead of an `app/` subfolder, matching the layout in `docs/ARCHITECTURE.md`; pnpm workspace, because YORM's packages use `workspace:*`.)*
- [x] Add `vitest` and a passing smoke test (`expect(true).toBe(true)`).
- [x] Add `@playwright/test` with an `iPhone 13` device project — one placeholder test now, the real assign journey in M7.
- [x] Add `@mieweb/ui` and import `@mieweb/ui/styles.css` in `main.tsx`. Render one `@mieweb/ui` component to prove the tokens load.
- [x] Confirm `index.html` has `<meta name="viewport" content="width=device-width, initial-scale=1">`, and set the app's base stylesheet up mobile-first (phone styles at the top level, `min-width` queries below).
- [x] Add `vite-plugin-pwa` with asset precaching and a web app manifest. Verify once now: build, load, kill the server, reload — the app must still boot. Retest at the end of M7.
- [x] Add `@esheet/renderer` + `@esheet/core`.
- [x] Vendor YORM: `git submodule add https://github.com/mieweb/yorm vendor/yorm`, build it, and link `@yorm/*` via workspace/file deps (mirror YORM's own `examples/patient-collab-demo` setup).
- [x] Add `hono`, `drizzle-orm`, `better-sqlite3`, `drizzle-kit` (dev). Create `drizzle.config.ts` pointing at `src/db/schema.ts` and `data/iris.db`.
- [x] Add `.gitignore` (node_modules, dist, data/*.db).
- [x] Add `npm run mailpit` script (or a `docker-compose.yml`) that starts Mailpit with SMTP on `:1025` and UI/API on `:8025`.
- [x] Verify: `npm run dev`, `npm test`, and Mailpit UI at http://localhost:8025 all work.

### Milestone 1 — Email seeding into Mailpit
> Commit: `M1: seed script delivers referral emails into mailpit`

- [x] Write `scripts/seed-mailpit.ts`: read `referral_emails.json`, send each as a real email over SMTP to `localhost:1025` (use `nodemailer`). Preserve `from`, `to`, `subject`, `body`, `message_id`, and set the `Date` header from `received_at`.
- [x] `npm run seed` script.
- [x] Verify: all 30 messages visible in the Mailpit UI.
- [x] Test: seed script is idempotent-friendly (document that re-seeding duplicates; add `npm run seed:fresh` that calls Mailpit's delete-all API first). *(Covered by the M2 ingest dedupe test.)*

### Milestone 2 — Ingest + parser
> Commit: `M2: mailpit ingest and referral parser with tests`

- [x] `src/ingest.ts`: fetch messages from Mailpit REST API (`GET /api/v1/messages`, then message detail). Dedupe by `Message-ID`.
- [x] `src/parser.ts`: parse the body into a typed `Referral`:
  - `caseNumber`, `referralId`, `service`, `county`, `region`, `fcmName`, `fcmPhone`, `requestedStartDate`, `childrenInHome` — from labelled lines
  - `notes` — raw prose
  - `preferences` — extracted from notes: `{ bilingual?: boolean, language?: string, availability?: ('Evenings'|'Weekends')[], expedite?: boolean }`. Keyword rules are fine (e.g. /bilingual|spanish/i, /evenings?/i, /weekends?/i, /expedite|permanency hearing/i). Note in a comment this is the step a model would own in production.
- [x] Parser must be tolerant: unknown lines ignored, missing fields become `undefined` and flagged in `parseWarnings[]` — never throw on a well-formed email.
- [x] Tests (`parser.test.ts`):
  - [x] All 30 emails parse with zero warnings
  - [x] Every parsed `service` exists in `service_role_matrix.csv`
  - [x] A referral mentioning "Evenings and weekends preferred" yields those preferences
  - [x] A mangled body (missing Service line) produces a warning, not a crash

### Milestone 3 — Database schema, YORM mapping + data loaders
> Commit: `M3: drizzle schema, yorm case mapping, roster and service matrix loaders with tests`

- [ ] `src/db/schema.ts` — Drizzle tables:
  - **Reference (plain Drizzle, no CRDT):** `staff` (mirrors `staff_roster.csv`; `counties_served`, `languages`, `availability` as JSON columns; `active` as boolean) and `services` (service, minimum education set, eligible role set — JSON columns)
  - **YORM projections (owned by the case mapping):** `cases` (message_id unique, parsed fields, status `pending|proposed|assigned|declined|needs_re_decision`, proposed staff FK, **committed** staff FK, committedBy/committedAt, decline reason, `commit_key` for idempotent retries), `case_decisions` (outcome, proposed staff FK, runners-up JSON, rationale JSON, `contended_with` JSON, unknowns JSON, `requiresSupervisorJudgment`)
  - **Status is the propose/commit boundary.** `pending` and `proposed` consume nothing and may be replanned at will; `assigned` and `declined` are server-confirmed, pin the case, and are the only states that count in the KPI.
- [ ] `src/case-doc.ts` — the canonical **case document** shape (one Y.Doc per referral): parsed referral + proposal + scenarios + supervisor notes (all CRDT-owned), plus a **server-owned commitment block** the client never writes directly. Define the eSheet form definition for it in `src/case-sheet.ts` so the renderer and the doc share field names.
- [ ] `src/db/mapping.ts` — YORM `defineMapping('iris.Case', v1)`: project the case doc into `cases` + `case_decisions` (forward-only; `one(...)` + `many(...)`, stable keys from `message_id`).
- [ ] `src/db/index.ts` — the only file that touches `better-sqlite3`; exports the Drizzle `db`. Use `drizzle-kit push` for schema sync.
- [ ] `src/db/import.ts`: import `staff_roster.csv` and `service_role_matrix.csv` (split `|` lists; parse `eligible_roles` on " or " into a role **set**; same for education). `npm run db:import`.
- [ ] Tests (in-memory SQLite — pass `:memory:` to the same factory):
  - [ ] 38 staff load; S001 is inactive; S006 has 13 of 12 families (over cap — real data, keep it)
  - [ ] Family Preservation and FCT each yield **two** eligible roles
  - [ ] Education parsing handles `HS Diploma/GED or BA` and `Master's or BA`
  - [ ] Re-running the import is idempotent (upsert on staff_id / service name)
  - [ ] Mapping golden test: a sample case doc → expected `cases` + `case_decisions` rows; second projection is idempotent

### Milestone 4 — Candidate evaluation
> Commit: `M4: candidate evaluation — gates, scoring, fairness policy, honest gaps`

This milestone is pure scoring. Pure functions, no I/O, no selection.

**Design rule — evaluate, then allocate.** The engine does *not* return a winner. It returns the **complete evaluation of every staff member** for one referral, and *choosing* is Milestone 5's job. This is what keeps the UI from re-deriving engine logic client-side: every mode reads the same object.

- [ ] `src/engine.ts` — `evaluate(referral, staff[], matrix, config) => Evaluation`, scoring **everyone**
- [ ] `Evaluation` shape — one `CandidateEvaluation` per staff member, nobody dropped:
  ```ts
  type CandidateEvaluation = {
    staffId: string
    gates: {
      active:     { pass: boolean; detail: string }
      role:       { pass: boolean; detail: string }  // role ∈ eligible set && education ≥ minimum
      county:     { pass: boolean; detail: string }
      capacity:   { pass: boolean; detail: string }  // current < max (the 12-family cap)
    }
    eligible: boolean          // all gates pass
    blockedBy: GateName[]      // why not, for the UI
    score: {                   // only meaningful when eligible
      language: number; availability: number; fairness: number; total: number
    }
  }
  type Evaluation = {
    referral: Referral
    candidates: CandidateEvaluation[]   // ALL staff, ranked
    unknowns: string[]                  // always includes the 20-hour rule
    requiresSupervisorJudgment: boolean
  }
  ```
- [ ] Gates (each records a human-readable `detail` string — that string *is* the rationale the UI shows):
  - [ ] **Gate 1 — active**: `active_flag === true`
  - [ ] **Gate 2 — role eligibility**: staff role ∈ service's eligible role set AND education meets the service minimum (education ladder: HS Diploma/GED < BA < Master's; an "or" minimum passes if any listed level is met)
  - [ ] **Gate 3 — county**: staff serves the referral county
  - [ ] **Gate 4 — capacity**: `current_families_assigned < max_families_dcs` (the 12-family cap)
- [ ] **Judgment-call services** (Insurance/Medicaid Referrals, Substance Abuse Group): evaluate normally but set `requiresSupervisorJudgment: true` so the planner surfaces candidates without electing one
- [ ] **Scoring** (see the fairness section below): language match, availability match, fairness. Ties broken deterministically (staff_id) so tests and demos are stable
- [ ] `unknowns` **always** contains the 20-hour rule statement: face-to-face hours are not reportable from CaseWind, so the primary capacity rule could not be applied
- [ ] The gates carry enough information for M5 to derive the outcome: passing role+county but failing capacity is a **scheduling** gap; failing role+county is a **staffing** gap. Distinguish them exactly as `approval_rules.md` describes.

#### Fairness / load balancing — make it a named policy, not a tiebreaker

Spreading work evenly is a **policy choice that conflicts with preference-matching** (the best Spanish speaker for this family may be the busiest person on the team). Burying it in a sort comparator hides that tradeoff from the supervisor. So:

- [ ] `config.fairness` is an explicit strategy, default `'balance'`:
  - `'off'` — rank purely on preference match; ignore workload beyond the hard 12-family gate
  - `'balance'` — headroom (`max - current`) contributes to the score, so work spreads across the team
  - `'balance-first'` — headroom dominates; preferences only break ties
- [ ] `config.fairnessWeight` tunes how much `'balance'` counts against a language/availability match.
- [ ] The rationale must **name** the fairness contribution when it changed the ranking (e.g. "ranked above S016 on workload: 2 of 12 vs 11 of 12"), so a supervisor can see when equity beat preference and override it.
- [ ] Test: with `fairness: 'off'` the bilingual match wins; with `'balance-first'` the emptier caseload wins — same referral, same roster, different declared policy.

> **Scope note — one referral is the special case, not the rule.** `evaluate()` scores candidates for a *single* referral. It does **not** decide anything on its own, because the pending queue is a **set** and staff capacity is shared. Allocation across the set is Milestone 5.

- [ ] Tests (`engine.test.ts`) — the scenario suite, built from the deliberate difficulties in the data:
  - [ ] **Everyone is evaluated**: `candidates.length === 38` for every referral — nobody is silently dropped
  - [ ] **Inactive best match**: the inactive staff member (e.g. S001, bilingual, evenings+weekends) is present in `candidates` with `blockedBy: ['active']` and `eligible: false`
  - [ ] **At-cap exclusion**: staff with 12/12 or 13/12 appear with `blockedBy: ['capacity']` and `eligible: false`
  - [ ] **Dual-role service**: an FCT referral marks both a Family Engagement Specialist 2 and a Clinician II eligible
  - [ ] **Soft preference ranking**: a bilingual-request referral scores a Spanish speaker above an otherwise-equal English-only staff member — but does **not** block the English-only staff
  - [ ] **Judgment call**: an Insurance/Medicaid referral sets `requiresSupervisorJudgment: true`
  - [ ] **Unknowns**: every evaluation includes the 20-hour-rule unknown
- [ ] Snapshot the eligibility counts across all 30 referrals (`scenarios.test.ts`) — the regression suite

### Milestone 5 — Set planning (allocation across the whole queue)
> Commit: `M5: set planner — contention detection, scarcity-first allocation, pinning and replan`

Still pure functions, no I/O.

**Why this is core, not a stretch.** Staff capacity is **shared across referrals**. Two Whitley-county FCT referrals cannot both go to the one clinician with a single slot left. Deciding each referral in isolation — or in arrival order — hands the slot to whoever happened to email first and reports a false `no_capacity` for the other. With 30 pending referrals and multiple staff at 11/12, this is the normal case.

- [ ] `src/planner.ts` — `plan(referrals[], staff[], matrix, config) => Plan`:
  ```ts
  type Allocation = {
    referralId: string
    assignedStaffId?: string
    outcome: 'match' | 'no_capacity' | 'no_eligible_staff'
    pinned: boolean            // supervisor-decided; the planner must not move it
    contendedWith: string[]    // other referrals that wanted the same person
    rationale: string[]
  }
  type Plan = {
    allocations: Allocation[]
    contention: {              // demand > supply, surfaced not hidden
      staffId: string; slots: number; wantedBy: string[]
    }[]
    unassigned: Allocation[]   // with the honest reason
    unknowns: string[]
  }
  ```
- [ ] **Capacity is a shared budget.** Track remaining headroom per staff member across the whole run — `max_families_dcs - current_families_assigned`, decremented as the planner allocates. A staff member with 2 slots can take 2 referrals, not 30.
- [ ] **Allocation order is scarcity-first, never arrival order.** Referrals with the fewest eligible candidates are placed first; a referral with exactly one possible worker must not lose that worker to a referral with ten options. Break ties on requested start date, then referral ID (deterministic).
- [ ] **Improvement pass.** After the first allocation, attempt pairwise swaps that raise total score without unassigning anyone. Stop at a fixed iteration cap so runs stay deterministic and fast.
- [ ] **Pinning.** A **committed** case (`assigned` or `declined`) is `pinned` — the planner treats it as a fixed constraint and plans the remainder around it. Committed capacity is real capacity. Proposals are never pinned and are always free to move.
- [ ] **Scenarios.** `plan()` takes an optional set of *hypothetical* commitments so the UI can ask "if I assign S031 here, what happens to everything else?" without touching real capacity. A scenario is just a plan run with extra pins — no separate code path, and nothing is written until the supervisor commits.
- [ ] **Contention is reported, not silently resolved.** When two referrals want the same last slot, the loser's rationale must say *who took it and why* — not merely "no capacity". That distinction is the difference between a scheduling gap and a staffing gap in the KPI.
- [ ] `recommend(evaluation, config) => Allocation` is exported for the single-case UI, implemented as `plan([referral], …)`. One selection code path, no duplicated ranking logic.
- [ ] Tests (`planner.test.ts`):
  - [ ] **Shared budget**: a staff member with 2 slots is assigned at most 2 referrals across the set
  - [ ] **Contention surfaced**: two referrals, one eligible worker with one slot → one `match`, one `no_capacity`, and `contention` names the staff member and both referrals
  - [ ] **Scarcity beats arrival order**: a referral with one eligible worker, arriving second, still gets that worker over a referral with many options
  - [ ] **Scarcity beats greedy on totals**: scarcity-first assigns at least as many referrals as arrival-order greedy on the full 30-referral set
  - [ ] **Pinning respected**: pin a committed assignment to a non-optimal worker, replan, and confirm the pin survives and the rest re-plans around it
  - [ ] **Scenarios are free**: running a plan with hypothetical pins changes no stored state and no staff capacity
  - [ ] **Determinism**: same inputs → identical plan, twice
  - [ ] **Fairness interacts correctly**: under `balance-first` the set spreads across more distinct workers than under `off`
  - [ ] **No capacity**: a service+county where every eligible person is full → `no_capacity`, and the rationale names who was eligible-but-full
  - [ ] **No eligible staff**: a service+county nobody covers → `no_eligible_staff`, worded as a staffing gap
  - [ ] **Judgment call**: an Insurance/Medicaid referral is allocated no worker automatically
  - [ ] Snapshot the outcome distribution across all 30 referrals — the end-to-end regression check

> **Upgrade path (not required Saturday).** Scarcity-first + swap improvement is a good heuristic, not a proven optimum. If time allows, replace the allocator with min-cost max-flow over the (referral → staff, capacity = headroom) bipartite graph for a true optimum. Keep the `Plan` shape identical so nothing above it changes.

### Milestone 6 — Pipeline + YORM service
> Commit: `M6: end-to-end pipeline — mailpit to collaborative case docs with SQL projections`

- [ ] `src/server.ts` — Hono app: `createYorm({ runtime: memoryRuntime(), documents/projections: drizzle stores, mappings: [caseMapping] })`, mounted at `/yorm` (REST + Yjs WebSocket).
- [ ] `src/pipeline.ts`: ingest → parse → evaluate → **plan the whole pending set** → create/update each case Y.Doc (`Case/<message_id>`); YORM projection populates `cases` + `case_decisions`. Dedupe on `message_id` so re-syncing is safe.
- [ ] Hono REST endpoints:
  - [ ] `POST /api/sync` — pull new mail from Mailpit and run the pipeline
  - [ ] `GET /api/queue` — SQL over the `cases` projection (join `case_decisions`, `staff`)
  - [ ] `GET /api/plan` — the current whole-queue `Plan`, including contention
  - [ ] `POST /api/replan` — recompute the plan for all uncommitted cases
  - [ ] `POST /api/plan/scenario` — replan with hypothetical pins and return the result **without persisting anything**; this is what powers "what if" in the UI
  - [ ] `GET /api/kpi` — declines per week by service line, SQL `GROUP BY` over the `cases` projection (Whitney's KPI, feeds project 10)
- [ ] **Proposals are Yjs transactions** on the case doc: the planner's suggestion, supervisor overrides of it, scenario notes, and free-text notes. They merge, work offline, and consume nothing.
- [ ] **Commitment is the API, and only the API** — `POST /api/assignments` and `POST /api/declines`:
  - [ ] The server, inside **one SQL transaction**, re-checks every gate against *current* data and increments `current_families_assigned` only if `current_families_assigned < max_families_dcs`. A stale client cannot talk it into an over-cap assignment
  - [ ] Rejects with a specific, actionable reason — `slot_taken` (naming who took it), `gate_failed` (naming the gate), `already_committed` — never a bare 409
  - [ ] Takes a client-generated **idempotency key**, so a retry on a flaky phone connection cannot double-commit. Same key, same result, capacity consumed once
  - [ ] On success the server writes the commitment back into the case Y.Doc, so every connected supervisor sees it land live — the API is the writer of truth, the doc is the broadcast channel
  - [ ] Committing triggers a replan of the remaining uncommitted queue so freed or consumed slots are reallocated immediately
  - [ ] Clients never write the commitment block themselves; the projection is derived from the server-written fields
- [ ] Integration test (in-memory SQLite): seed → sync → 30 case rows with a coherent plan; commit a contended case → the losing referral replans onto its next-best worker (or reports the honest gap); re-sync creates no duplicates.
- [ ] Concurrency test: two clients commit the same last slot simultaneously → exactly one succeeds, the other gets `slot_taken` naming the winner, and `current_families_assigned` never exceeds `max_families_dcs`.
- [ ] Idempotency test: the same commit key sent twice consumes one slot and returns the same result both times.

### Milestone 7 — Supervisor UI (mobile-first, collaborative, three planning modes)
> Commit: `M7: mobile-first supervisor screens — plan, recommend and explore modes, esheet case sheet, live collab`

All components from `@mieweb/ui`; style only with `--mieweb-*` tokens.

**Mobile first, literally.** Build and style the 375px phone layout **first**, then add desktop affordances with `min-width` media queries. Not "make the desktop screen shrink" — that always ends with a 38-row table wedged into a phone. A supervisor gets a referral alert between home visits and needs to review the recommendation and commit it from a parking lot before the DCS clock runs out. If that journey needs two hands or a zoom gesture, it failed.

**Three modes over one plan.** Like flight planning: the whole day's schedule, one flight's route, or the map. All three read the same `Plan`/`Evaluation` objects — the UI never re-implements a gate. The modes differ only in *presentation density*, so each has a phone form and a desktop form of the same data.

| Mode | Question it answers | Phone | Desktop |
|---|---|---|---|
| **Plan** (queue level) | "How do we staff everything that's pending?" | Scrollable card list, deadline-sorted, with a contention count chip at the top | Full table plus the contention panel |
| **Recommend** (case level) | "Who should take this one?" | The primary phone screen: recommendation, rationale, unknowns, and a thumb-reachable assign/decline bar | Same, side by side with the case sheet |
| **Explore** (case level) | "Why not her? What if I relax this?" | Stacked candidate **cards** with gate chips — never a horizontally-scrolling table | The full 38-row sortable table |

#### Core journey (must work one-handed on a phone)

- [ ] **Queue view** (`GET /api/queue`, `GET /api/plan`): pending referrals — service, county, received date, outcome badge (match / no capacity / no eligible staff / judgment call), proposed assignee, response-deadline countdown from config.
  - [ ] On a phone this is a card list sorted by deadline urgency — the most-at-risk referral is the first thing a thumb reaches
  - [ ] **Contention banner**: which staff are over-subscribed and by which referrals — the thing a supervisor most needs to see before deciding anything. Collapses to a tappable count chip on a phone
  - [ ] **Replan** button, and an automatic replan after each decision
  - [ ] Committed cases render as **pinned** so it is obvious what the planner may no longer move
- [ ] **Case detail view** — connects to the case's YORM room over y-websocket:
  - [ ] The **case sheet**: `<EsheetRenderer />` bound to the case doc fields (parsed referral, decision, supervisor notes) + raw email body (trust through transparency). On a phone the raw email is collapsed behind a disclosure — available, not in the way
  - [ ] **Recommend mode** (the phone default): recommendation with the rationale list, and runners-up with *why they ranked lower*
  - [ ] Where a candidate lost to **contention**, say so by name: "S031 was the better match but is allocated to R770012"
  - [ ] **Explore mode**: every staff member with gate chips (`active` / `role` / `county` / `capacity`) and score breakdown (language, availability, fairness). Blocked candidates stay visible and greyed, never hidden. Cards on a phone, sortable table on desktop — same data, same source object
  - [ ] **Fairness control**: a visible selector for `off` / `balance` / `balance-first` that re-ranks live and shows how the recommendation changes — the workload-vs-preference tradeoff made explicit, not silent
  - [ ] The **unknowns box** — always visible in every mode and at every width, states the 20-hour rule gap plainly. It is never the thing that gets hidden to save vertical space
  - [ ] Judgment-call banner for Insurance/Medicaid/group referrals
  - [ ] **Propose** freely: change the proposed worker from Explore, run scenarios, take notes — all collaborative, all reversible, all offline-capable, none of it consuming capacity. The case sits in `proposed` and the UI says so plainly
  - [ ] **Commit** deliberately: **Assign** (proposed worker, or an override with a required reason) and **Decline** (reason category required) call the API and wait for real-time confirmation. Show an in-flight state, then the confirmed result — never an optimistic checkmark
  - [ ] A rejected commit surfaces the server's reason in place — "S031 was assigned to R770012 a moment ago" — and drops the case back to `proposed` with a fresh recommendation, so the supervisor decides again with current facts
  - [ ] Overriding to a *blocked* candidate is refused client-side **and** re-checked server-side — gates are gates, and the client is never the enforcer
  - [ ] Taking a contended worker shows the knock-on effect before committing: "this will unassign R770012"
  - [ ] **Presence**: awareness shows who else has the case open; edits from a second browser window appear live, and a commit made anywhere appears everywhere
  - [ ] On a phone, actions live in a **sticky bottom bar** within thumb reach; the override/decline reason opens as a bottom sheet, not a centre-screen modal
  - [ ] Decline reason is a **tappable category list**, not a free-text box — typing prose on a phone is how KPIs stop getting filled in
- [ ] **KPI panel**: declines per week by service line. Chart on desktop, summary figures on a phone.

#### Mobile-first checklist

- [ ] Base stylesheet is the phone layout; every media query is `min-width`. No `max-width` overrides patching a desktop design back down.
- [ ] **No horizontal scrolling and no zoom needed at 375px** on any screen. Verify the queue, case detail, and Explore mode.
- [ ] Touch targets are at least 44×44px with visible spacing (WCAG 2.5.5); assign and decline are far enough apart that a thumb cannot confuse them.
- [ ] Destructive/irreversible actions (decline, override) need a confirm step — a mis-tap in a moving-car moment must not decline a referral.
- [ ] Viewport meta is set, and text inputs use a font size that does not trigger iOS auto-zoom.
- [ ] **Connection state is explicit.** Proposals and notes keep working offline; Assign and Decline do not, and the UI says which mode it is in rather than letting a supervisor discover it at the moment of commit.
- [ ] Keyboard and screen-reader parity: the sticky action bar and bottom sheets are reachable in tab order, have ARIA roles/labels, and trap focus correctly while open. Live queue updates announce via `aria-live`.
- [ ] Test at 375px (phone), 768px (tablet), and 1280px (desktop). Add a Playwright check at the phone viewport covering the whole assign journey; keep it in the suite so a desktop-only change cannot silently break it.
- [ ] Dark mode check at phone width: no non-`--mieweb-*` CSS vars (`grep -rn 'var(--' src | grep -v mieweb` is empty).
- [ ] Verify the full demo loop **on a phone viewport**: seed → sync → Plan mode shows contention → open the same case on a phone and a desktop → a note typed on one appears on the other → flip fairness mode and watch the recommendation move → commit a contended case from the phone → the queue replans on both → KPI updates.

#### Offline capability

The whole working set fits on the phone easily — roster (38 staff, 4 KB), service matrix (13 rows, <1 KB), and the open queue at roughly 10 KB per case doc. Even Iris's theoretical ceiling of 456 active families (38 staff × the 12-family cap) is about 5 MB, against an IndexedDB budget in the hundreds of MB. **Capacity is not the constraint.** These two things are:

- **Proposals merge; commitments cannot.** A CRDT gives convergence, not invariants. Two supervisors proposing S031 offline is fine — the planner reconciles it. Two supervisors *committing* S031 offline would merge just as cleanly and silently breach the 12-family cap, because neither write is individually invalid. So the propose/commit split from the architecture section **is** the offline story: everything except the commit works without a signal.
- **Every case doc names a child.** Bytes are free; blast radius is not. A lost phone holding the whole database is a far larger disclosure than one holding a supervisor's own open queue.

So:

- [ ] Persist synced docs with `y-indexeddb` so the queue, the recommendation, the rationale, and the full candidate evaluation are all **readable offline**. The engine output is already computed server-side and carried in the doc — no re-evaluation is needed on the device.
- [ ] Wait for `IndexeddbPersistence.whenSynced` before rendering, or the UI flashes an empty queue and a supervisor concludes their work was lost.
- [ ] Call `navigator.storage.persist()` so IndexedDB is not evicted under storage pressure, and handle private-browsing failure by saying so plainly rather than silently dropping proposals.
- [ ] **The service worker is load-bearing, not polish.** iOS Safari evicts background tabs, so a supervisor switching to Maps and back has effectively reloaded the page. Verify: build, go fully offline, reload — the app boots, the queue is there, proposals made offline are intact, commit controls are disabled with a reason.
- [ ] **Scope the sync deliberately**: reference data (roster, service matrix) plus the supervisor's own open queue. Not the whole case history, and not other supervisors' queues — for privacy, not for space.
- [ ] Proposals, scenarios and notes are fully editable offline and merge on reconnect — this is what CRDTs are genuinely good at, and it covers the common field case: reading a referral in a driveway, deciding who *should* take it, jotting why.
- [ ] **Commit requires connectivity.** Disable Assign and Decline when offline with a plain explanation — "you can decide who should take this; assigning needs a connection" — rather than queueing an approval that might not survive. Nothing the supervisor typed is lost; only the irreversible step waits.
- [ ] Connection state is always visible, and a proposal is never styled to look like a confirmed assignment.
- [ ] On reconnect, if a proposal's worker was taken meanwhile, mark the case `needs_re_decision` with the reason and a fresh recommendation — never resolve it silently in either direction.
- [ ] Test: two clients propose the same worker offline → both proposals survive the merge, neither consumes capacity, and the first to commit on reconnect wins with the other told exactly why.
- [ ] README states the offline boundary in one sentence: **plan anywhere, commit connected.**

> **Upgrade path — slot holds.** If genuinely offline assignment is ever needed, the principled fix is the airline seat-hold pattern: while online, the server issues short-lived holds on the slots a supervisor's proposed cases would consume, so a later offline commit spends capacity already reserved to them. Holds expire back to the pool. Worth building only once the connected commit flow is solid.

### Milestone 8 — Polish & handoff
> Commit: `M8: readme, demo script, final test pass`

- [ ] `README.md`: what the project is, prerequisites (including `git submodule update --init` for vendor/yorm), the npm scripts, and the demo walkthrough (the contention moment, the two-window collab moment, the phone commit). Link to [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and to its **"What we cannot compute"** table rather than restating either.
- [ ] Confirm `docs/ARCHITECTURE.md` still matches what was actually built — correct any drift now, while it is fresh.
- [ ] All tests green, including the phone-viewport journey test; run `npm run build` to confirm production build.
- [ ] Tag the demo scenarios: list 4 referral IDs to show live — one clean match, one contended pair, one no-capacity, one no-eligible-staff.
- [ ] **Demo the commit on an actual phone** (or a phone-sized window) with the desktop queue projected beside it — assign on the phone, watch the desktop replan. That is the whole pitch in one gesture.

---

## Guardrails (do not violate)

- The matcher never silently resolves a soft preference — tradeoffs go to the supervisor.
- **Capacity is a shared budget across the pending set.** Never decide referrals independently and never allocate in arrival order — that hands scarce workers to whoever emailed first.
- Contention is named, not flattened into "no capacity". Say who took the slot and why.
- **Propose in the doc, commit through the API.** Proposals, scenarios and notes are Yjs transactions — collaborative, offline, reversible, free. Assigning and declining go to `POST /api/assignments` / `POST /api/declines` and are confirmed in real time. A CRDT gives convergence, not invariants; it cannot stop two people spending the same slot.
- The server re-checks every gate against current data inside the commit transaction. The client is never the enforcer, only the explainer.
- A rejected commit always names the reason and the winner. Never a bare conflict error, and never a silent overwrite.
- Commits are idempotent by client key — a retry on a flaky phone must not consume two slots.
- A committed case pins the planner; a proposal never does.
- The engine evaluates **every** staff member and the UI renders that evaluation. Never filter candidates out server-side to "tidy" the response, and never re-implement a gate in the UI.
- Fairness is a declared policy with a visible control, not a hidden sort order. When it changes the ranking, the rationale says so.
- Never invent service hours. The 12-family cap is the only measurable hard gate.
- Declines are reported, not hidden — they feed the KPI.
- Response deadline is config, not a constant.
- Planner and engine stay pure, deterministic, and fully unit-tested; the model-ish prose extraction is isolated in the parser.
- All persistence goes through Drizzle/YORM stores in `src/db/` — no raw `better-sqlite3` imports elsewhere, so the DB can be swapped later.
- The case Y.Doc is the single write path for **proposal** state; the API is the single write path for **commitment** state. SQL rows are forward-only projections — never UPDATE a projection table by hand.
- A case doc contains a child's name — anyone who can sync the room sees the whole doc. One room per case, and the demo README must note that per-role redaction is out of scope. This matters more on a phone: assume the screen is visible in a public place, so no child's name in a notification, list preview, or browser tab title.
- UI styling uses `--mieweb-*` tokens only.
- **Mobile first is a build order, not a media query.** Style the 375px layout first and enhance upward. Never ship a screen that needs horizontal scrolling or pinch-zoom to commit a referral.
- The unknowns box and the block reasons are never what gets truncated to fit a small screen — honesty is not a desktop-only feature.
- Plan anywhere, commit connected. A proposal is never styled to look like a confirmed assignment.
- Sync the supervisor's own open queue, not the whole database. The dataset would fit on the phone many times over; the reason to send less is that every case doc names a child.

## Stretch goals (only after M8 is green)

- **Optimal allocation.** Swap the scarcity-first heuristic for min-cost max-flow and show the two plans side by side.
- **Rebalance preview.** "If you commit this, here is the team's load before and after."
- **Capacity forecast.** Given the pending queue, which service lines will hit the staffing gap first — the recruiting signal Iris actually needs.
