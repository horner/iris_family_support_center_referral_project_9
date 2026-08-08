# Project 9 - Iris Referral Matching

## Read approval_rules.md first

Whitney Craig answered our questions on Aug 6 and the answers changed this
project. An earlier version of this pack invented a certificate matrix and a
single capacity number. Both were wrong.

## Files

| File | What it is |
|---|---|
| `service_role_matrix.csv` | **Real.** 13 services with the education and role each requires |
| `approval_rules.md` | **Real.** Capacity rules, and the constraint that breaks rule one |
| `staff_roster.csv` | Synthetic staff, real column model |
| `referral_emails.json` | 30 referrals shaped as the Kidtraks emails DCS actually sends |

Staff names and referral contents are invented. **The service list, the role
tiers and the capacity rules are Iris's own.**

## Three things that will catch you out

1. **Referrals are emails.** Parsing a semi-structured DCS notification is step
   one. There is no endpoint to call.
2. **You cannot measure their main capacity rule.** CaseWind reports cases
   assigned, not service hours. The 20-hour rule is unmeasurable today.
3. **Some services accept either of two roles.** Family Preservation and FCT
   take a Clinician II *or* a Family Engagement Specialist 2.

## Deliberate difficulties in the data

- Staff at or over the 12-family DCS cap
- At least two services where every eligible person is full
- One inactive staff member who would otherwise be the best match
- Referral emails mentioning bilingual need or evening availability in prose only

## Scope

Nobody expects a working CaseWind integration in a day. A correct decision
engine, a supervisor approval screen, and an honest account of what cannot be
computed from current data is the win.
