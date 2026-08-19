User: Can you make this into a md file and make sure to preserve the references and urls?

GitHub Copilot: Updated todo list

Created [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/research/Indiana_DCS_KidTraks_Integration.md)

Done! I've converted the PDF into a markdown file with all references and URLs preserved. The file has been saved to:

Indiana_DCS_KidTraks_Integration.md

The markdown file includes:
- All section headings and structure
- Tables formatted in markdown
- All 90 footnotes preserved as markdown references `[^1]`, `[^2]`, etc.
- Complete reference list at the end with all URLs as live links
- Bold formatting for key findings and verified facts
- Proper code blocks for examples
- Clean, professional formatting throughout

Created 4 todos

Made changes.

User: set the remote to [Sign in - Reusser Hackathon: One day. Real non-profits. Working software.](https://hackathon.reusser.io/carapia/IrisDCSReferrals.git)

GitHub Copilot: Updated todo list

Ran terminal command:  git remote set-url origin https://hackathon.reusser.io/carapia/IrisDCSReferrals.git

Ran terminal command:  git remote add origin https://hackathon.reusser.io/carapia/IrisDCSReferrals.git

Ran terminal command:  git remote -v

Done! Git remote origin is now configured to:
```
https://hackathon.reusser.io/carapia/IrisDCSReferrals.git
```

Created 5 todos

User: git push

GitHub Copilot: Updated todo list

Ran terminal command:  git push -u origin main

Ran terminal command:  git branch -a

Ran terminal command:  git status

Ran terminal command:  git add . && git commit -m "Initial commit: Add project files and documentation"

Ran terminal command:  git push -u origin main

Ran terminal command:  git push origin HEAD:refs/for/main/initial-setup

It looks like the remote repository has restricted permissions—it's not allowing direct pushes to `main`. The server requires either:

1. **Pull request workflow** (via AGit), but the repository appears to be empty and needs initialization first
2. **Admin/owner access** to push directly to main

The error indicates you may need to:
- Contact the repository administrator to initialize the remote repository
- Check if you have the correct permissions/credentials set up
- Or, if you have admin access, initialize the remote repository first before pushing

Your local commits are ready:
```
[main (root-commit) c73e961] Initial commit: Add project files and documentation
```

Would you like me to try a different branch name, or do you need to handle the remote repository setup separately?

Created 2 todos

User: try pushing now

GitHub Copilot: Updated todo list

Ran terminal command:  git push -u origin main

Success! Your commits are now pushed to the remote repository. The branch `main` is now tracking `origin/main`.

Created 2 todos

User: Lets develop a plan to complete this project and include the goals.  The plan should include a checklist with milestones I can give to a junor developer.  I want them to check off the todo items as they go, committing on each milestone.  We should just a vite server and mailpit.  We should build the scanerios and test suite.  put the plan in plan.md

GitHub Copilot: Updated todo list

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/flow.md#1-1), lines 1 to 150

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching)

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/README-origianal-request.md)

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/approval_rules.md)

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/staff_roster.csv)

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/service_role_matrix.csv)

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/referral_emails.json#1-1), lines 1 to 60

Created [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)

Created plan.md. Structure:

- **Goals** — email ingestion via Mailpit (no API exists), tolerant parsing, a correct decision engine honoring Iris's real rules (12-family hard cap, unmeasurable 20-hour rule stated honestly, judgment-call services surfaced not automated), supervisor approval screen, and the three honest outcomes.
- **8 milestones (M0–M7)**, each ending in a named commit: scaffolding → Mailpit seeding → ingest/parser → data loaders → decision engine → pipeline/persistence → supervisor UI → polish.
- **Scenario test suite** in M4 built directly from the deliberate traps in the data: the inactive best-match staffer, at/over-cap staff, dual-role services (FCT/Family Preservation), no-capacity vs no-eligible-staff distinction, bilingual/evening soft preferences that rank but never gate.
- **Guardrails** section at the bottom — the rules a junior dev must not violate (configurable deadline, no invented hours, declines feed the KPI).

Want me to commit and push it?

Created 4 todos

Made changes.

User: what would the database be?

GitHub Copilot: Updated todo list

The plan deliberately uses **no real database** — persistence is a flat `data/state.json` file (see plan.md and Milestone 5). For a one-day hackathon that's the right call: zero setup, human-readable, easy to reset for demos, and trivially git-ignorable.

What actually needs to be stored:

| Data | Source | Storage |
|---|---|---|
| Staff roster | staff_roster.csv | Read-only CSV, loaded at startup |
| Service/role matrix | service_role_matrix.csv | Read-only CSV, loaded at startup |
| Referral emails | Mailpit (its own embedded store) | Fetched via REST API |
| Approval queue + decisions + capacity deltas | your pipeline | `data/state.json` |

If you'd rather have a real DB, the upgrade path in order of effort:

1. **SQLite via `better-sqlite3`** — single file, synchronous API, no server. Best choice if you want SQL for the KPI query (declines per week by service line is a natural `GROUP BY`).
2. **Postgres in docker-compose** — only worth it if you want to show a production-ish story; overkill for the day.

My recommendation: stick with `state.json` through M5–M6, and only swap in SQLite if the KPI aggregation or concurrent-write handling gets awkward. The layer boundary in the plan (`src/pipeline.ts` owns all state access) means the swap stays cheap. Want me to add a note to the plan making that explicit?

User: I prefer a drizzle api so we can switch out the db decision later without issue.  start with sqllite

GitHub Copilot: Updated todo list

Replacing 37 lines with 50 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```
Updated the plan to use Drizzle ORM over SQLite:

- **Stack**: `drizzle-orm` + `better-sqlite3` + `drizzle-kit`, DB at `data/iris.db`
- **M0**: install Drizzle deps, `drizzle.config.ts`, git-ignore `data/*.db`
- **M3** is now "Database schema + data loaders" — full Drizzle schema (`staff`, `services`, `referrals`, `decisions`, `queue`), a `src/db/index.ts` that is the *only* file touching `better-sqlite3`, CSV import via `npm run db:import`, and tests against in-memory SQLite
- **M5**: pipeline persists via Drizzle with `message_id` unique-constraint dedupe, approvals in a transaction, KPI as a SQL `GROUP BY`
- **Guardrails**: added the swap-ability rule — no raw `better-sqlite3` imports outside `src/db/`

The decision engine stays pure (takes plain objects, no DB), so it's untouched by the persistence choice.

Created 5 todos

Made changes.

User: I want to use https://github.com/mieweb/yorm to allow collab editing and https://github.com/mieweb/ui for the UI and https://github.com/mieweb/esheet for the case

GitHub Copilot: Updated todo list



Fetched 2 resources

Replacing 69 lines with 90 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```


Replacing 4 lines with 5 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```
Plan updated for the mieweb stack. Key changes:

- **Stack**: React (required by `@mieweb/ui`/eSheet), Hono backend (YORM's transport), YORM over Drizzle/SQLite, Mailpit unchanged.
- **YORM is vendored** — it has no npm releases, so M0 adds it as a git submodule at `vendor/yorm` with workspace links, the same pattern YORM's own demo uses for `vendor/ui`.
- **Architecture shift**: each case (referral + decision + supervisor state + notes) is one canonical Yjs document in a YORM room (`Case/<message_id>`). Approve/override/decline are **Yjs transactions** — the only write path. SQL tables (`cases`, `case_decisions`) become forward-only YORM projections, so the queue and the declines-per-week KPI stay plain `GROUP BY` queries. Staff/services stay plain Drizzle reference tables.
- **eSheet** renders the case sheet in the detail view (`<EsheetRenderer />` with a shared form definition in `src/case-sheet.ts`); **M6** adds presence and the two-browser live-edit demo moment.
- **New guardrails**: never hand-UPDATE a projection table; `--mieweb-*` tokens only (with the dark-mode grep check); and a confidentiality note — a case doc carries a child's name and anyone syncing the room sees the whole doc, so per-role redaction is explicitly out of scope.
- **Fallback rule** added: parser and engine stay pure, so if YORM integration stalls midday, the team drops back to plain Drizzle tables without touching M2–M4.

Created 3 todos

Made changes.

User: I worry about the #sym:Decision  being uncoupled from the UI.  I think planning needs to be able to be in two modes?  Like planning a flight.  Are we capturing options with the best route auto-chosen?  Also is fairness or load balancing schedling part of the planning process?

GitHub Copilot: Updated todo list

Good instincts — both worries are real, and they're the same worry.

**The coupling problem.** As written, the engine returns a verdict (`recommended` + `runnersUp`). A supervisor exploring "what if I use the at-cap person anyway?" or "who's excluded and why?" can't do that without the UI re-deriving engine logic client-side. The fix: the engine emits the **full evaluation** — every staff member with per-gate results and score components — and "recommendation" becomes a thin selection over that. One data structure, two views.

**Fairness.** It's currently smuggled in as a tiebreaker ("fewest current families"). That's a policy decision hiding in a sort comparator. It should be a named, configurable strategy, because it genuinely conflicts with preference-matching — and Iris should own that tradeoff, not us.

Let me restructure the plan accordingly. 

Replacing 59 lines with 122 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```
Plan restructured around both concerns.

**Decoupling fix** — the engine now splits into `evaluate()` → `recommend()`. `evaluate()` scores **all 38 staff** and returns per-gate pass/fail with a human-readable `detail` string (that string *is* the rationale the UI renders). `recommend()` is a thin selection over that. Nobody is filtered out server-side, so Explore mode has everything it needs without re-deriving a single gate. There's a test asserting `candidates.length === 38` for every referral to keep it honest.

Nice side effect: `no_capacity` vs `no_eligible_staff` is now *derived* from the gate results rather than tracked separately — if anyone passes role+county but fails capacity it's a scheduling gap, otherwise a staffing gap.

**Two modes** — Recommend (accept the route) and Explore (open the map: all candidates, gate chips, sortable score components, live re-rank). Overriding to a *blocked* candidate is refused with the reason shown — gates stay gates, only ranking is negotiable.

**Fairness** — pulled out of the tiebreaker into `config.fairness`: `off` / `balance` / `balance-first`, with a visible selector in the UI. The rationale must name the fairness contribution when it changed the ranking ("ranked above S016 on workload: 2 of 12 vs 11 of 12"), so a supervisor can see when equity beat the bilingual match and override. There's a test that the same referral produces different winners under different declared policies — which doubles as a strong demo moment.

**Batch planning** — this is the part of your flight analogy the plan was quietly ignoring. Greedy per-referral assignment gives a measurably worse allocation than solving all 30 as a set. I put it in a new Stretch Goals section rather than day-one scope, with an explicit README note so we don't imply the greedy result is optimal.

One open question worth deciding before M4, since it's Iris's policy and not ours: **should `balance` or `off` be the default?** I defaulted to `balance` on the assumption that spreading load is the safer institutional behavior, but if Whitney's actual practice is "best fit for the family, workload is my call," then `off` is the honest default and fairness becomes purely an exploration tool.

Created 3 todos

Made changes.

User: Batch planning should not be a strech goal.  If we have more than one it should be considered.

GitHub Copilot: Updated todo list

Agreed — with 30 pending referrals and staff sitting at 11/12, contention is the normal case, not the exception. Assigning in arrival order is just a bad algorithm. Let me promote it to a first-class milestone. 

Replacing 91 lines with 152 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)

Compacted conversation
```

```


Searched for regex `^### Milestone|^> Commit:|Milestone 5 is|M2–M5` (`**/plan.md`), 19 results

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md#121-121), lines 121 to 175

Replacing 26 lines with 24 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```


Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md#104-104), lines 104 to 120

Replacing 2 lines with 2 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```


Created 6 todos

Done — batch planning is now **Milestone 5**, a core deliverable rather than a stretch goal. Everything downstream renumbered (pipeline → M6, UI → M7, polish → M8).

The reasoning I've written into the plan: capacity is a **shared budget**, so referrals can't be decided independently. Two Whitley-county FCT referrals can't both take the one clinician with a single slot left. Deciding in arrival order gives that slot to whoever emailed first and reports a *false* `no_capacity` for the other — which is worse than useless, because it corrupts the decline KPI by logging a scheduling gap as a staffing gap.

Key changes:

**M4 is now pure scoring.** `evaluate()` returns candidate gates and scores; it picks nobody. All selection lives in M5, so there's one allocation code path — `recommend()` is literally `plan([referral], …)`.

**M5 — the planner:**
- Headroom is decremented across the run, so a worker with 2 slots takes 2 referrals, not 30
- **Scarcity-first ordering** — a referral with one possible worker is placed before a referral with ten. Arrival order is explicitly banned in the guardrails
- **Contention is named, not flattened** — the losing referral's rationale says *who took the slot and why*, so a supervisor can overrule the tradeoff
- **Pinning** — anything a supervisor decided is a fixed constraint; a replan may never move it
- A swap-improvement pass with a fixed iteration cap, so it stays deterministic

**M6/M7** follow through: `GET /api/plan`, `POST /api/replan`, an automatic replan after each decision, and a Plan mode in the UI showing contention ("3 referrals want S031's last slot") plus a knock-on warning before you take a contended worker.

Min-cost max-flow is noted as an upgrade path with the `Plan` shape held constant — so it's a drop-in swap if there's time, and the README stays honest that the heuristic isn't a proven optimum.

Two things worth your call before M4 starts: whether `balance` is the right default fairness policy (versus `off`, if Whitney's real practice is "best fit, workload is my judgment"), and whether I should commit plan.md — it's still uncommitted from earlier.

Made changes.

User: I want to add mobile first design so recommendation review and approval could be accomplished on the phone and on the fly

GitHub Copilot: Updated todo list

Good instinct — this is the actual use case. A supervisor triaging between home visits, in a parking lot, on a phone. Let me weave mobile-first through the plan rather than bolting a "responsive" checkbox onto the end. 

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md#249-249), lines 249 to 300

Replacing 39 lines with 62 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```


Replacing 3 lines with 6 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```
Mobile-first is now woven through the plan rather than appended to it.

**The framing I used:** mobile-first as a *build order*, not a media query. Base styles target 375px, every query is `min-width`. That's in the guardrails because the alternative — designing the desktop screen and shrinking it — reliably ends with a 38-row candidate table wedged into a phone.

**The mode table gained phone/desktop columns.** The modes now differ only in presentation density, which falls straight out of the earlier evaluate/recommend split: Explore is stacked candidate *cards* on a phone and a sortable table on desktop, but both render the same `Evaluation`. No second data path, no re-derived gates.

**Journey-specific decisions worth flagging:**
- Actions sit in a sticky bottom bar within thumb reach; override/decline reasons open as bottom sheets, not centre-screen modals
- Decline reason is a **tappable category list**, not free text — typing prose on a phone in a parking lot is exactly how the decline KPI stops getting filled in, and that KPI feeds project 10
- Queue sorts by deadline urgency on a phone, so the most at-risk referral is what the thumb reaches first
- Decline/override need a confirm step — a mis-tap in a moving car shouldn't decline a referral

**Two things I added that you didn't ask for but I think are load-bearing:**

*Connection state must be explicit.* Yjs happily merges notes typed on a flaky connection, which is a real advantage in the field — but an **approval consumes shared capacity**. If a phone renders a green checkmark from local state while offline, two supervisors in bad signal can both approve the last slot. So: approval is confirmed by the server projection, never local state alone. This is the mobile-shaped version of the shared-budget problem from M5.

*Privacy gets sharper on a phone.* A case doc contains a child's name, and a phone screen is often visible in a public place — so no child's name in notifications, list previews, or the tab title.

I also added a Playwright phone-viewport test of the whole approve journey to M0/M7, so a desktop-only change can't silently break the mobile path — and made the M8 demo "approve on the phone, watch the projected desktop queue replan," which is the pitch in one gesture.

Still open from before: default fairness policy (`balance` vs `off`), and whether to commit plan.md.

Created 4 todos

Made changes.

User: did the requirements show how many cases are open at any given time?  Can the entire database fit in the phone in the indexeddb and be synced to the backend?  That way it can run offline?

GitHub Copilot: Updated todo list

Good question — let me check what the requirements actually say about volume rather than guess.  

Ran terminal command:  ls -la *.json *.csv *.md 2>/dev/null | awk '{print $5, $9}'; echo '---'; wc -c referral_emails.json staff_roster.csv service_role_matrix.csv

Searched for regex `per week|per month|per day|volume|caseload|open cases|referrals a|how many|30 referrals|annual`, 30 results

No — the requirements never state an open-case volume. I checked approval_rules.md, flow.md, README-origianal-request.md, and the research doc. The only volume signals are the 30 synthetic referrals and what you can *derive* from the roster.

**The derivable ceiling:** 38 staff × 12 families = **456 active families**, and that's Iris's entire organizational capacity, not a typical load. Current roster occupancy is well under that.

**Size, measured not guessed:**

| Data | Now |
|---|---|
| referral_emails.json (30) | 24.8 KB |
| staff_roster.csv (38) | 4.0 KB |
| service_role_matrix.csv (13) | 0.8 KB |
| **Total** | **~30 KB** |

A case Y.Doc is fatter than its email — parsed referral + the 38-candidate evaluation + notes + CRDT overhead, call it ~10 KB. So even at the theoretical 456-case ceiling you're at **~5 MB**. A full year of throughput retained is tens of MB. Mobile IndexedDB budgets run to hundreds of MB or more.

So yes — it fits, by two or three orders of magnitude. Size is not the constraint. Two other things are.

**1. Offline approval is a correctness problem CRDTs cannot solve.** This is the real finding. Yjs merges *edits* beautifully — two supervisors typing notes offline reconcile perfectly. But approval consumes a **shared scarce slot**, and that's exactly the shared-budget problem from M5. If two supervisors each approve the last Whitley FCT slot while offline, both updates are valid CRDT-wise and merge cleanly — and the 12-family cap is now breached with no conflict to detect. There is no last-writer-wins rule that's *correct* here, because the loser has already told a family they have a worker.

**2. Privacy is the reason to sync less than you can.** Every case doc carries a child's name. Syncing the whole database to every phone means every supervisor's device persistently stores every child in the system. A lost phone becomes a much larger disclosure. That argues for scoping the sync even though the bytes are free.

Let me put this in the plan.  

Replacing 3 lines with 24 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```
Added an **Offline capability** section to M7, plus `y-indexeddb` to the stack and two guardrails.

The design it lands on:

- **Read and draft offline, confirm approvals online.** The queue, recommendation, rationale, and full 38-candidate evaluation are all readable with no signal — the engine output is already computed server-side and carried in the case doc, so the phone never needs to re-evaluate anything.
- **Offline approvals queue as `pending submission`**, visibly not final, and confirm only when the projection acknowledges and the capacity decrement succeeds.
- **Lost races surface as "needs re-decision"** with the reason, never resolved silently in either direction.
- There's a test for the nasty case: two offline clients approve the same last slot, exactly one confirms, and `current_families_assigned` never exceeds `max_families_dcs`.

I noted the **slot-hold pattern** as the principled upgrade — the server reserves the slots a supervisor's pending cases would consume when they open their queue online, so an offline approval spends capacity already reserved to them, and holds expire back to the pool. It's the airline seat-hold, which fits the flight-planning metaphor the plan already runs on. But it's only worth building after the simpler pending-submission flow works.

One thing worth naming explicitly: your instinct that "the whole DB fits, so sync it all" is correct on the engineering and wrong on the risk. The bytes genuinely are free here — but the reason to sync only the supervisor's own open queue is that each case doc carries a child's name, and a lost phone shouldn't be a whole-agency disclosure. That's now a guardrail rather than something a junior dev has to intuit.

Still open: default fairness policy, and whether to commit plan.md — it's accumulated four substantial revisions now and is still uncommitted.

Created 5 todos

Made changes.

User: I am thinking that decision of actual assignment would need to go to the api and be confirmed in realtime, but scanerios could be played out for a case in a proposed status.

GitHub Copilot: Updated todo list

That's the right call, and it fixes something I got wrong earlier. Let me re-read the affected sections.  

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md#36-36), lines 36 to 60

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md#236-236), lines 236 to 256

Exactly right — and it corrects a mistake I made in M6, where I'd written approvals as Yjs transactions. That works for notes; it cannot work for capacity. A CRDT guarantees *convergence*, not *invariants* — there's no way to enforce "current < max" in a doc that merges. The commit has to be serialized by an authority.

Let me restructure around that split. 

Replacing 33 lines with 60 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```


Replacing 35 lines with 42 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```


Searched for regex `approv|pending submission|unpinned|decided case` (`**/plan.md`), 17 results

Multi-Replace String in Files

Made changes.

User: Let's make a architecture.MD file.

GitHub Copilot: Updated todo list

Repo convention (from copilot-instructions.md) is `docs/ARCHITECTURE.md` as the single source of truth for stack and design, with Mermaid rather than ASCII. Let me create it there and then trim plan.md down to milestones so the two don't duplicate. 

Created [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/docs/ARCHITECTURE.md)

Now trim plan.md so it doesn't duplicate the architecture doc. 

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md#1-1), lines 1 to 40

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md#40-40), lines 40 to 78

Replacing 69 lines with 25 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```


Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md#17-17), lines 17 to 50

Replacing 6 lines with 9 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```


Created 3 todos

Created ARCHITECTURE.md as the design of record, and trimmed plan.md back to being purely *what to build in what order* — the two no longer duplicate each other.

I put it at ARCHITECTURE.md because that's the path your copilot-instructions.md names as the single source of truth for stack and layout, and I converted the ASCII pipeline diagram to Mermaid per the same instructions.

**What's in it:**

- **System overview** — Mermaid graph with the pure core, proposal layer, and commitment layer visually separated (green/blue/red), so the trust boundary is the first thing you see
- **Three load-bearing decisions** — plan the set; evaluate then allocate; propose in the CRDT, commit through the API. Each with the reasoning, so a future reader can tell which constraints are real and which are taste
- **Case lifecycle** as a state diagram, and the **commit protocol** as a sequence diagram showing two supervisors racing for the last slot — that one is the concurrency-critical path and deserved its own picture
- **Data model with an ownership table** — who may write what. Clients never write the commitment block; capacity counters are server-only
- **Security boundaries** — including the KidTraks contractual limit from the research doc, which is the thing most likely to be forgotten and most expensive to get wrong
- **"What we cannot compute"** as a table — the 20-hour rule, the deadline conflict, cap universality, email thinness, allocation optimality

Two supporting changes: the junior-dev rules now establish precedence (approval_rules.md > architecture > plan) and require updating the architecture doc in the same commit as any design change; and M8's README task links to the architecture doc rather than restating the gaps.

I also finished aligning terminology on **propose/commit** — the leftover "approve" wording from before your correction was still scattered through M7.

Four files are now uncommitted (plan.md and the new ARCHITECTURE.md). Want me to commit them? And the fairness default (`balance` vs `off`) is still open.

Made changes.

User: Is there a clean layer on the browser API to manipulate cases offline?  Like changes go to a local document and get synced with yjs (so if yjs is unreachable it will to it later when it is)?

GitHub Copilot: Updated todo list

Let me check the current state of the file first, since you've edited it. 

Searched for regex `^## |^### ` (`**/docs/ARCHITECTURE.md`), 24 results

Read [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/docs/ARCHITECTURE.md#330-330), lines 330 to 356

Yes — and the good news is you mostly don't build it. Yjs *is* that layer; what's missing is a thin domain facade over it. Let me document the shape. 

Replacing 3 lines with 94 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/docs/ARCHITECTURE.md)


```

```


Multi-Replace String in Files

Created 5 todos

Made changes.

User: but it wont survice a page reload if the server is unreachable, right?

GitHub Copilot: Updated todo list

Correct, and it's the sharpest question yet — because two different things are at stake and only one of them is solved.

**Your data survives.** `y-indexeddb` writes every update locally as it happens, and on load `IndexeddbPersistence` rehydrates the `Y.Doc` from IndexedDB with no server involved. Proposals and notes made in a parking lot are still there after a reload.

**Your app doesn't boot.** With the server unreachable and no service worker, the reload can't fetch `index.html` or the JS bundle. You get the browser's offline error page. The data is intact and completely unreachable, because nothing ever runs to read it.

So I under-called this as a footnote. On mobile it isn't an edge case — iOS Safari aggressively evicts background tabs, so a supervisor who switches to Maps and comes back **is** doing a reload. Let me fix the doc and promote it into scope.  

Replacing 14 lines with 43 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/docs/ARCHITECTURE.md)


```

```


Replacing 3 lines with 8 lines in [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/docs/ARCHITECTURE.md), [](file:///Volumes/Case/prj/hackathon/2026-Hackathon/project-09-iris-referral-matching/plan.md)


```

```

```

```
Right — and it was worth pushing on, because I'd filed it as a footnote when it's actually load-bearing for the mobile goal.

The doc now separates the two concerns explicitly:

| | Mechanism | Offline reload |
|---|---|---|
| **Data durability** | `y-indexeddb` | ✅ Survives — doc rehydrates with no server |
| **App availability** | service worker | ❌ Without one, nothing boots to read it |

**Service worker moved into scope** (`vite-plugin-pwa`, M0) rather than being a stretch. It's a few lines of config, and without it the mobile-first goal is fiction — "works in a parking lot" fails the first time the OS reclaims the tab.

Three follow-on details I added because they're cheap to write down and expensive to discover:

- **`navigator.storage.persist()`** — otherwise IndexedDB is evictable under pressure, and Safari's ITP clears script-writable storage after roughly a week of disuse. Installed home-screen PWAs get treated better, which is a second reason to ship the manifest.
- **Await `IndexeddbPersistence.whenSynced` before rendering** — otherwise the UI flashes an empty queue on cold start and a supervisor quite reasonably concludes their proposals are gone. That's a trust failure, not a cosmetic one.
- **Private browsing** gives ephemeral or absent IndexedDB — detect and say so rather than silently dropping work.

The M7 verification is now concrete: build, go fully offline, reload, and confirm the app boots, the queue renders, offline proposals are intact, and commit controls are disabled with a stated reason.

Worth noting the pleasing consequence: because commits were already server-authoritative, none of this offline durability can produce a wrong assignment. The worst offline outcome is a stale proposal, which the planner corrects on reconnect.

Created 6 todos

Made changes.