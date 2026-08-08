# Project 9 - who does what, and where the gap is

Two diagrams. The first is how a referral moves today. The second is what this
project inserts into it.

Read `approval_rules.md` first - it has the rules. This file has the shape.
See `deep-research-background-project.md` for the sourcing behind the claims
below.

## What is real here and what is not

- **Real:** the actors, notification by email from Kidtraks, the click-through
  into the vendor portal to review and accept or reject, the manual re-keying
  into CaseWind, the supervisor approval step, and rejected referrals being a
  KPI Iris tracks.
- **Corrected.** MaGIK is not the FCM's case system as distinct from Kidtraks.
  DCS describes MaGIK as the legacy ecosystem that contains **both** Casebook,
  the case-management interface, and Kidtraks, the provider and financial side.
- **Corrected.** "There is no API" is too strong. DCS publishes a provider
  Attachment API for monthly reports and a CSV/XML import for invoices. Both run
  provider to DCS. No public interface for **retrieving referrals** was found.
- **Corrected.** The notification email is thinner than this pack models it. The
  published sample carries the referral number as a link, county, submission
  date, the submitting DCS worker, and a child's name. Enough to trigger work,
  not enough to decide. The full referral sits behind the portal login.
- **Corrected.** Twelve families is **service-specific**, not a blanket DCS cap.
  It is published for Home-Based Casework and Home-Based Therapy. DCS has said
  the maximum depends on the individual service standard.
- **Invented:** every name, case number, and note in `referral_emails.json` -
  including the three-business-day line in the footer. The 2018 Kidtraks guide
  says 48 hours; at least one current service standard says 72. Do not hard-code
  a number.

Build Saturday against `referral_emails.json` as it stands. It gives you more
than a real notification would, which keeps the parsing exercise honest without
blocking the matcher. Just do not tell Iris the email is the whole referral.

## Today

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#253044','primaryTextColor':'#e8ecf3','primaryBorderColor':'#5b6b85','lineColor':'#767f8e','textColor':'#767f8e','actorBkg':'#253044','actorBorder':'#5b6b85','actorTextColor':'#e8ecf3','actorLineColor':'#767f8e','signalColor':'#767f8e','signalTextColor':'#767f8e','labelBoxBkgColor':'#253044','labelBoxBorderColor':'#5b6b85','labelTextColor':'#e8ecf3','loopTextColor':'#767f8e','noteBkgColor':'#414d63','noteTextColor':'#eef2f8','noteBorderColor':'#7c8aa3','activationBkgColor':'#5b6b85','activationBorderColor':'#7c8aa3','sequenceNumberColor':'#111827'}}}%%
sequenceDiagram
    autonumber
    actor Family
    participant FCM as DCS Family Case Manager
    participant CB as Casebook - DCS case system
    participant KT as Kidtraks - DCS provider portal
    participant Inbox as referrals at irisfamily.org
    participant Intake as Iris intake staff
    participant Sup as Iris supervisor
    participant CW as CaseWind - Iris case system
    actor Worker as Iris staff member

    Family->>FCM: Case opened
    FCM->>CB: Records case, history, court dates
    Note over CB,KT: Both sit inside MaGIK.<br/>Casebook for DCS, Kidtraks for providers.
    FCM->>FCM: Decides a purchased service is needed
    FCM->>KT: Creates the referral
    KT->>KT: Approved by a DCS supervisor

    KT->>Inbox: Notification email
    Note over Inbox: Referral number, county, date, DCS worker,<br/>a child's name. A trigger, not the referral.

    Inbox->>Intake: Read by hand
    Intake->>KT: Opens the referral in the vendor portal
    KT-->>Intake: Service, participants, goals, authorized units
    Intake->>CW: Looks up who is qualified and who has room
    Note over Intake,CW: CaseWind reports cases assigned,<br/>not face to face hours
    Intake->>Sup: Proposes an assignment

    alt Accept
        Sup-->>Intake: Approves
        Intake->>CW: Re-keys the referral, assigns worker
        Intake->>KT: Accepts in the portal
        Worker->>Family: Delivers the service
        Intake->>KT: Invoices against the referral
    else Reject
        Sup-->>Intake: No capacity or nobody qualified
        Intake->>KT: Rejects in the portal
        Note over KT: Counts toward rejected referrals<br/>per week by service line
    end
```

The manual steps are 7 through 14. That is the target.

Step 8 is the one the pack glosses over. The decision cannot be made from the
email alone, because the published notification does not appear to carry the
service type - which is the single most important matching input.

## What this project builds

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#253044','primaryTextColor':'#e8ecf3','primaryBorderColor':'#5b6b85','lineColor':'#767f8e','textColor':'#767f8e','actorBkg':'#253044','actorBorder':'#5b6b85','actorTextColor':'#e8ecf3','actorLineColor':'#767f8e','signalColor':'#767f8e','signalTextColor':'#767f8e','labelBoxBkgColor':'#253044','labelBoxBorderColor':'#5b6b85','labelTextColor':'#e8ecf3','loopTextColor':'#767f8e','noteBkgColor':'#414d63','noteTextColor':'#eef2f8','noteBorderColor':'#7c8aa3','activationBkgColor':'#5b6b85','activationBorderColor':'#7c8aa3','sequenceNumberColor':'#111827'}}}%%
sequenceDiagram
    autonumber
    participant KT as Kidtraks
    participant Inbox as referrals at irisfamily.org
    participant Parse as Parser
    participant Intake as Iris intake staff
    participant Engine as Decision engine
    participant Queue as Approval queue
    participant Sup as Iris supervisor
    participant CW as CaseWind

    KT->>Inbox: Notification email
    Inbox->>Parse: Raw message

    Parse->>Parse: Structured fields from the body
    Parse->>Parse: Preferences from the Notes prose
    Note over Parse: Bilingual need, evenings and weekends.<br/>The only step that needs a model.<br/>Where it runs is a contract question.

    opt Fields the email does not carry
        Intake->>KT: Reads the referral in the portal
        KT-->>Parse: Service type, units, participants
    end

    Parse->>Engine: Referral record
    CW-->>Engine: Roster, roles, education, assigned counts

    Engine->>Engine: Role and education eligibility
    Engine->>Engine: Caseload cap for this service
    Engine->>Engine: Rank remaining on soft preferences
    Note over Engine: Cannot apply the twenty hour rule.<br/>Say so, do not fake it.

    alt Staff available
        Engine->>Queue: Recommend, with rationale and runners up
    else Eligible but all at cap
        Engine->>Queue: No capacity
    else Nobody holds the required role
        Engine->>Queue: No eligible staff - a staffing gap
    end

    Queue->>Sup: Review
    Sup-->>Queue: Approve, override, or decline
    Queue->>CW: Write the assignment
    Queue->>KT: Accept or decline
    Note over Queue: Declines are reported, not hidden.<br/>Feeds project 10.
```

## What crosses each boundary

| Boundary | What moves across it |
|---|---|
| DCS case to referral | The subset of the case DCS decides a provider needs. |
| Kidtraks to inbox | Notification email. A trigger and routing metadata, including at least one child's name. |
| Kidtraks portal to Iris | The full referral - participants, goals, authorized units, safety information. Behind a login. No public read interface found. |
| Iris to Kidtraks | Attachment API for monthly reports, CSV or XML import for invoices. Both documented. Both outbound. |
| CaseWind to matcher | Roles, education, counties, families assigned. Not service hours. |
| Matcher to supervisor | A recommendation, its reasoning, and what it could not determine. |

Note the asymmetry. Iris can automate everything it sends DCS and almost nothing
it receives. That is the actual finding, and it is worth telling Iris plainly.

In this pack, `Number of Children in Home` is the only measure of case size that
arrives, so any workload estimate is built on that alone.

## The judgment calls the diagrams hide

- **County.** Every referral names one and every staff row lists the counties
  they serve, but no rule Whitney gave mentions geography. Gate or preference is
  your call. It drives most of the declines either way.
- **Insurance and Medicaid referrals.** The service matrix gates them to a
  Clinician 1. The rules call them a supervisor's judgment call with no formula.
  Both statements are real. Decide which wins and say why.
- **Soft preferences.** Bilingual and evening availability are preferences, not
  gates. Show the supervisor the tradeoff rather than resolving it silently.
- **The caseload cap is per service.** `staff_roster.csv` carries one
  `max_families_dcs` column set to 12 for everyone. That is a simplification.
  Make the cap a lookup by service now, even if every value is 12 today, so the
  real standards drop in without a rewrite.
- **Where the model runs.** The DCS provider contract and the Kidtraks access
  agreement both bar disclosing DCS information to third parties without prior
  written consent. Sending referral text to a hosted model API is a disclosure.
  Nothing here is real data, so build what you like Saturday - but keep the
  model call behind one interface so a locally hosted model is a config change,
  and say so in the handover.
