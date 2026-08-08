# Iris referral matching - the real rules

Confirmed by Whitney Craig, Aug 6. This replaces the invented rule set that was
here before.

## Credentials are education plus role, not certificates

There is no certificate matrix. Every service requires a **minimum education
level** and a **role tier**:

| Role | Typical education |
|---|---|
| Family Engagement Specialist 1 | HS Diploma/GED or BA |
| Family Engagement Specialist 2 | BA or Master's |
| Clinician 1 | Master's |
| Clinician II | BA or Master's |

`service_role_matrix.csv` has all thirteen services verbatim. Note two of them -
Family Preservation and FCT - accept **either** a Clinician II or a Family
Engagement Specialist 2, so eligibility is a set membership test, not a ladder.

## Capacity is three different rules

Whitney gave three, and which one applies depends on the referral:

1. **Roughly 20 face-to-face hours** makes a caseload full. This is the general rule.
2. **DCS cases cap at 12 families** per provider. Hard number.
3. **Groups, insurance and Medicaid referrals are a supervisor's judgment call.**
   No formula. Surface the decision, do not automate it.

## The constraint that shapes this whole project

> "At this time, we can only see the number of cases assigned, not necessarily
> the number of direct service hours."

Read that twice. Their **primary** capacity rule is 20 face-to-face hours, and
their system **cannot report** face-to-face hours. Only case counts.

So a matcher cannot apply rule 1 with the data that exists. Your options:

- Use the 12-family DCS cap, which is measurable, as the hard gate.
- Treat hours as unknown and say so in the recommendation rather than implying
  a precision you do not have.
- Estimate hours from service type and family count, clearly labelled as an
  estimate, and let a supervisor override.

Naming this gap honestly is worth more than papering over it. It is also a
concrete, cheap thing Iris could fix in CaseWind, and telling them that is a
real deliverable.

## Referrals arrive by email

Not an API. DCS sends them through **Kidtraks** to an Iris inbox, and staff
re-key them into CaseWind by hand. `referral_emails.json` has 30 in that shape.

This changes the front of the pipeline: step one is parsing a semi-structured
email, which is exactly where a model earns its place. The matching itself stays
plain, testable code.

## Outcomes

- **Match** - recommend, with the rationale and the runners-up, for supervisor approval.
- **No capacity** - eligible staff exist but all are at the 12-family cap.
- **No eligible staff** - nobody holds the required role. A staffing gap, not a
  scheduling one, and it should read differently in the decline.

Whitney also tracks **rejected referrals per week by service line** as a KPI, so
declines are not failures to hide - they are a number the agency reports on.
That connects this project directly to project 10.

## Soft preferences

`languages` and `availability` are on the roster because referral emails mention
them in prose - bilingual requests, evenings and weekends. Preferences, not
gates. Make the tradeoff visible to the supervisor rather than resolving it silently.
