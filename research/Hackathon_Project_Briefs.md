# Northeast Indiana Nonprofit Hackathon — Project Briefs

> Source: `Hackathon Project Briefs.pdf` (jdobler/2026-Hackathon), converted to Markdown for reference.
> Project 9 — Referral Matching Assistant (Iris Family Support Center) — is the brief this repository implements.

Eleven build options submitted by eight local nonprofits. Pick one, ship something they can use Monday.

## How this works

Each brief below came from a real submission by a Northeast Indiana nonprofit. Two organizations submitted more than one idea, so those are listed as separate projects — you are choosing a specific build, not adopting an organization.

Every brief is scoped for a single day of roughly eight hours. The **Build this** section is the target. The **Out of scope** section is there to protect you: those items were deliberately cut, and you will not lose points for skipping them. Reach for **Stretch goals** only once the core build demos cleanly.

Every project has data waiting for it. A separate data pack contains synthetic datasets, placeholder documents, and a schema README for each project, so no team sits idle waiting on a file. That data is fabricated — realistic in shape, invented in substance. Where a nonprofit sends the real thing before or during the event, an organizer will hand it to you. Point your ingest at the documented schema and keep it in one place, so swapping real data in later is a small change rather than a rewrite.

## Ground rules

- **Questions go through the organizers.** Several nonprofits offered to answer questions. Route requests through us so one staff member does not field ten teams at once.
- **Use only the data you are given.** Everything supplied is de-identified or synthetic. Do not bring in real client, student, or consumer records, and do not upload supplied files to services outside your project.
- **A narrow working thing beats a broad broken thing.** These are real operational problems for small teams with no engineering staff. Something modest that runs is worth more than an ambitious demo that does not.
- **Hand off what you build.** Include a short README covering how to run it, what it costs to operate, and what the next developer would need to do. For most of these organizations that document decides whether your work survives the weekend.

## Difficulty labels

- **Starter** — achievable by one or two people, finishable well before time is up.
- **Core** — a solid full-day build for a small team.
- **Advanced** — expect to deliver a strong prototype plus a clear specification rather than a finished system.

## The options at a glance

| # | Project | Organization | Difficulty | Team | Dependency before you start |
|---|---------|--------------|------------|------|------------------------------|
| 1 | Alt Text Generator | Turnstone Center | Starter | 1–2 people | None — real photos and real alt text both in the pack |
| 2 | Ask The League's Handbook | The League for the Blind & Disabled | Core | 2–3 people | Six real staff questions received; policy docs still pending |
| 3 | For-Hire License Test Prep | Community Transportation Network | Starter to Core | 1–2 people | None — a placeholder bank is in the pack and CTN can vet questions |
| 4 | Medical Ride Analytics | Community Transportation Network | Core | 2–3 people | None — CTN's real destination strings are in the pack |
| 5 | Employee Handbook Chatbot | Community Transportation Network | Core | 2 people | Needs their new employee handbook |
| 6 | Student Event Survey | Grow Allen | Core | 2–3 people | None — all five real forms are in the pack |
| 7 | PharmD Progression Dashboard | Manchester University | Core | 2–3 people | None — their real column names are already in the pack |
| 8 | Tourism Video Generator | Huntington County Visitor Bureau | Core | 2–3 people | Scope confirmed: assemble from photos, for Facebook. Photos pending. |
| 9 | **Referral Matching Assistant** | **Iris Family Support Center** | **Advanced** | **3–4, backend-heavy** | **None — Iris sent the service matrix, capacity rules and systems** |
| 10 | Outcomes and KPI Dashboard | Iris Family Support Center | Core to Advanced | 2–3 people | None — Iris confirmed the KPI list and named all three systems |
| 11 | Volunteer Re-Engagement Finder | Junior Achievement of Northern Indiana | Starter to Core | 1–2 people | None — JA confirmed the workflow and the real column headers |

Not sure where to start? Projects 1 and 11 are the cleanest small wins. Projects 2 and 5 are the same technique applied twice, so those teams should compare notes. Projects 3, 6, and 7 need no model API key at all. Project 9 is the deep end.

---

## Project 9 — Referral Matching Assistant *(this repository)*

**Iris Family Support Center** · Advanced · 3–4, backend-heavy · Before you start: none — Iris sent the service matrix, capacity rules and systems

### The problem

DCS referrals arrive by email through Kidtraks. Iris staff read each one, re-key it into CaseWind, work out who holds the right role, who has room, and route it for supervisor approval. Iris describes this as roughly the work of two full-time staff — hours not spent with families.

### Build this

- Parse a Kidtraks referral email. That is the real intake — there is no API.
- Filter staff by the role and education the service requires, and by county.
- Rank the eligible staff by room under the 12-family DCS cap.
- Produce a recommended match with a plain-language rationale, on a supervisor approve or deny screen.
- On approval, notify the assigned staff member. On no capacity, draft the decline message back to DCS.
- Be explicit that face-to-face hours are unknown. CaseWind cannot report them.

### Out of scope — deliberately cut

- No real CaseWind or Kidtraks connection.
- No authentication or role management.
- Notifications can log to a console or a test inbox.

### Stretch goals, only after the core build works

- Fairness or workload balancing in the tie-break, not just first available.
- Capacity forecasting a week or two out.
- An audit log, which matters for a DCS-contracted agency.
- Batch handling, or reading real availability from an ICS calendar feed.

### Suggested approach

Rules first. Role, county and capacity matching is deterministic and should be readable, testable code. The model's job is parsing the referral email and drafting the rationale and decline message.

### What a successful demo looks like

Five referral emails end to end — a match, a no-capacity decline, and a no-eligible-staff decline read differently. Say out loud what your engine cannot know.

### What the organization is providing

- The real service matrix: 13 services with the education and role each requires.
- The real capacity rules, and 30 referrals shaped as the Kidtraks emails DCS sends.
- Iris is happy to answer more questions — route them through an organizer.

> **Read this before you commit.** Iris gave three capacity rules: about 20 face-to-face hours fills a caseload, DCS cases cap at 12 families, and group or Medicaid referrals are a supervisor's judgment call. Then they added the sentence that defines this project — CaseWind "can only see the number of cases assigned, not necessarily the number of direct service hours." Their main capacity rule is not measurable with the data they have. Do not paper over that. Gate on the 12-family cap, say plainly that hours are unknown, and you will have told Iris something useful about their own systems.

