# Indiana DCS KidTraks Provider Portal: Integration, Referral Intake, and Compliance

## Bottom line and corrections

The most important finding is that **KidTraks is not an API-free system**.[^1] Indiana DCS currently publishes a provider-facing HTTP API for uploading monthly reports/case documentation, and it separately supports bulk e-invoice imports in CSV and XML. What I could not find is any publicly documented API, web service, SFTP feed, webhook, scheduled export, or bulk download that lets a contracted provider retrieve newly assigned service referrals. The documented integrations are principally provider-to-DCS, not DCS-to-provider.[^2]

That makes your integration problem quite specific: DCS has demonstrated both the technical ability and willingness to support provider integrations, including authenticated API access, but the public integration surface I found does not include referral intake.

### Your starting assumptions, verified or corrected

| Assumption | Finding | Confidence |
|---|---|---|
| KidTraks is DCS's provider-facing child-welfare financial system for contracts, referrals, claims/invoicing, and payments. | Mostly correct. Current DCS materials explicitly describe KidTraks as its "referral and financial system." It also contains contracting/RFP functions, provider information, case-document attachments, invoicing, and payment-status functions. Calling it only a financial system understates it somewhat.[^3] | High |
| KidTraks is distinct from MaGIK, which is the case-management system used by FCMs. | Misleading / partly wrong. DCS materials describe the legacy MaGIK environment as including Casebook and KidTraks. Casebook is the principal case-management interface; KidTraks is the provider/referral/financial side. They are distinguishable applications/interfaces, but KidTraks is part of the broader MaGIK ecosystem rather than an entirely separate statewide system.[^4] | High |
| DCS Service Standards define each purchasable service, practitioner qualifications, and billing rates. | Partly correct. Service Standards define service scope, delivery requirements, credentials/qualifications, documentation, outcomes, and often billing-unit rules. Rates are not necessarily embedded in the individual standard; the procurement separates Service Standards from rate sheets/contract attachments.[^5] | High |
| Referral notification happens by email, not API. | Email notification is verified; "not by API" is only partly supportable. DCS's published referral guide shows KidTraks sending the provider an email after approval. I found no public referral-retrieval API. But KidTraks does have other provider APIs, so "KidTraks has no API" would be wrong.[^6] | High for email; medium for absence of referral API |

**Overall practical conclusion**: I would presently design around the assumption that there is no publicly supported inbound referral API, while treating that as an explicit item to confirm with DCS rather than as a proven architectural limitation. There is enough evidence of supported provider integration elsewhere that asking DCS for a private/referral interface is worthwhile.[^7]

---

## Integration surface

### Referral retrieval and provider APIs

**Answer**: Could not determine that any supported interface exists for electronically retrieving new provider referrals. No such interface was found in public DCS documentation.

The strongest current evidence is DCS's **Provider Monthly Report Attachment API**. The current document describes a ProviderUpload operation on DCS's Attachment API. A provider requests its own security token by emailing the DCS Help Desk, providing its DCS vendor ID and requesting an "Attachment API Token." DCS publishes separate QA and production endpoints and specifies parameters including vendor ID, DCS case ID, Billable Unit ID from the referral, and document type. The document includes sample .NET/C# POST code.[^8]

The production service is documented under the MaGIK web-services environment as an `Attachment.svc/api/v1/attachments` endpoint. Importantly, the API requires the provider already to know the case ID and Billable Unit ID, and DCS validates that the provider delivered services on the case. There is no documented GET/list-referrals method in this material.[^9]

An earlier DCS FAQ, revised September 14, 2021, confirms this is not a newly invented capability: DCS then described an automated case-document mechanism using an Attachment API method named `SendMonthlyReport` and said each provider could obtain a unique token from the DCS MaGIK IT/help desk.[^10]

So there are at least two supported machine-oriented integration surfaces:

| Surface | Direction | Publicly documented? | Referral intake? |
|---|---|---|---|
| Attachment / monthlyreport API | Provider → DCS | Yes | No evidence |
| E-invoice CSV/XML file import | Provider → DCS | Yes | No |
| Manual e-invoicing portal | Provider → DCS | Yes | No |
| Referral notification email | DCS → Provider | Yes | Yes, partial metadata |
| Referral-detail API / webhook | DCS → Provider | Could not determine | No public documentation found |
| Referral SFTP / scheduled export | DCS → Provider | Could not determine | No public documentation found |
| Referral bulk download | DCS → Provider | Could not determine | No public documentation found |

DCS's e-invoicing documentation is unusually integration-friendly. A 2019 DCS Q&A says providers have two e-invoicing mechanisms, manual input and File Import, with file import accepting XML and CSV; DCS also publishes file specifications, example files, an XSD schema, CSV templates, and binary-attachment examples on its current KidTraks tools page.[^11]

That means the answer to "API, web service, SFTP, scheduled export, or bulk download?" is not simply "no":

**Verified fact**: API and bulk file-import mechanisms exist for provider submissions.[^12]

**Verified fact**: I found no published referral-retrieval equivalent. DCS's current public KidTraks tools specifically expose invoicing imports and monthly-report API documentation, not referral API documentation.[^13]

**Reasonable inference**: If DCS maintains an unpublished provider referral API, it is either access-gated/private or not indexed in the public provider documentation. Public evidence alone is insufficient to claim one exists.

**Confidence**: High regarding the documented outbound/provider-submission surfaces; medium regarding the absence of an inbound referral API, because non-public interfaces cannot be ruled out.

### Developer documentation and access gating

**Answer**: Yes, published integration documentation exists, but I found it only for attachments/reporting and invoice import, not for referral retrieval.

There is **developer-style documentation**, although it is narrow in scope. The Attachment API document provides endpoint URLs, authentication-token instructions, fields, validation behavior, and sample program code. Access to the production service is token-gated, with tokens issued by the DCS Help Desk to vendors.[^14]

The e-invoicing side is even more fully documented, with XML/CSV schemas and specifications.[^11]

**Source date**: Attachment API documentation appears current in 2026; the e-invoice Q&A/specification set dates principally to 2019–2021, although DCS still links the tools from its current 2026 site.

**Outdated flag**: The older invoice technical specifications should be validated against the current DCS Help Desk before implementing them, even though DCS still publishes them.

**Confidence**: High.

### Public evidence of third-party integrations

There is meaningful public evidence that Indiana provider-software vendors integrate with KidTraks, but it supports document/billing submission, not inbound referrals.

CEI's **Case Management Pro** materials for Indiana providers advertise that monthly DCS reports and visitation reports can be uploaded directly into KidTraks and that the product can generate an e-invoice file for upload.[^15]

**Family Case Registry**, a current vendor product aimed at Indiana DCS providers, advertises "KidTraks integration" for document and billing submission, including per-agency API integration for monthly reports and an export matching the DCS billing specification.[^16]

**MedEZ** advertises a DCS billing module that prepares the DCS monthly report and KidTraks upload spreadsheet; notably, its own FAQ describes preparation for KidTraks upload rather than claiming a live inbound KidTraks referral connection.[^17]

These descriptions align closely with DCS's documented Attachment API and e-invoice file-import mechanisms.[^12]

**Could not determine**: I found no provider agency or commercial case-management vendor publicly claiming that new KidTraks referrals automatically flow into its application through an official KidTraks referral API.

**Confidence**: Medium-high. Public marketing cannot prove what private integrations exist, but the convergence on outbound attachments/billing rather than inbound referrals is significant.

### API roadmap or request process

I found no public roadmap item specifically promising a provider referral API.

There is, however, a much broader integration roadmap. Indiana's 2019 CCWIS procurement specified Salesforce as the new child-welfare platform, AWS for storage, and MuleSoft as the single point of bidirectional data exchange. Phase two was explicitly supposed to replace ancillary case-management functions, including **referral management and financial management**, and "all remaining KidTraks functionality."[^18]

That procurement shows that API-driven exchange is part of DCS's intended architecture, but it does **not** establish that contracted providers will receive a referral API, nor that such an interface exists today.[^19]

For an authoritative answer, the best public contact routes I found are:

- **DCS Help Desk**: `DCSHelpDesk@dcs.in.gov`, already the official route for Attachment API tokens and KidTraks technical support.[^20]
- **I-KIDS / CCWIS implementation**: DCS's Child Welfare IT contact guide identifies `DCS.IKIDS@dcs.in.gov` for questions about the I-KIDS CCWIS system and implementation.[^21]
- **Provider/service-contract questions**: `ChildWelfarePlan@dcs.in.gov` is the contract notice address and is also identified in DCS provider materials for Service Standards questions.[^22]

A highly specific question to those offices would be: **"Is there an approved machine-to-machine interface for a contracted vendor to retrieve its assigned Billable Unit/service referrals, including newly created/modified/cancelled referrals, without automating the KidTraks web UI?"**

---

## Referral notification content

### Is the notification a full referral or a thin alert?

**Answer**: It is best characterized as a **partial referral alert**: more than a generic notification, but substantially less than the full referral.

DCS's published KidTraks User Guide for Traditional Service Referrals shows the actual workflow. After the referral receives supervisory approval, KidTraks generates an email to the provider. The provider clicks the referral number in the email and is taken to the vendor portal, where the referral can be reviewed and accepted or rejected.[^23]

The published example notification includes:[^24]

- the provider/agency name;
- the KidTraks referral number as a link;
- county;
- submission date;
- the name of the submitting DCS worker;
- the child/children field, with a child's name visible in the example;
- instructions to accept or reject the referral;
- links/contact information for referral and technical assistance.

It does not show the full referral narrative, family addresses/phones, allegations/history, service goals, maximum authorized units, safety information, detailed participant records, or other material displayed/required in the portal.[^25]

**Verified fact**: The published email therefore contains personally identifying information. At minimum, the DCS sample identifies a child by name and associates that child with a DCS service referral, county and DCS worker.[^24]

**Could not determine**: Whether the current 2026 email template contains exactly the same fields. The publicly available screenshot is from the 2018 user guide.

**Confidence**: High for the historical documented format; medium for the exact current template.

### What is in the full referral?

The portal holds considerably richer information. The referral-guide screenshots show service information such as referral/Billable Unit identifiers, service type, service start/end dates, maximum units, participant data, instructions, and goals.[^26]

Current DCS referral guidance titled **5 Things for EVERY Referral** says a referral should contain accurate participant profiles and contact information, including addresses, email and phone information where applicable; provider/FCM contacts; worker-safety issues such as home conditions, animals, firearms and other hazards; reasons for DCS involvement, including substantiated abuse/neglect information and relevant DCS history; court orders; medical issues and medications; protective orders; other agencies/services involved; and specific service goals.[^27]

That is plainly data of a much higher confidentiality and sensitivity level than the notification email.[^28]

### Implication for email parsing

**Verified fact**: Email parsing can obtain a machine-readable trigger plus some routing metadata, based on the published template.[^24]

**Reasonable inference**: Email parsing alone will not replace manual entry of a complete referral if your case-management system needs the service authorization, participants, family contacts, safety information, narrative/instructions, goals, or other full-referral fields. The DCS sample demonstrably leaves those items behind the portal login.[^25]

That makes email parsing useful as a durable event-ingestion layer only if your operational need is "a referral arrived; create a shell record and route it." It is a stopgap if your goal is "reproduce the full KidTraks referral in our system without staff opening KidTraks."

I would also be cautious about filling that gap with headless-browser/RPA scraping. The KidTraks access agreement says information may only be accessed with DCS authority and prohibits accessing it in a manner inconsistent with DCS's approved method of system entry. That does not expressly prohibit automation, but it makes unapproved browser automation contractually risky.[^29]

**Reasonable inference**: Obtain explicit DCS authorization before automating login/navigation or screen-scraping the portal.

**Confidence**: High on the email-versus-full-referral distinction; medium-high on the RPA risk interpretation.

**Outdated flag**: The referral-guide sample is 2018 and should not be treated as an immutable email schema. A parser should tolerate template changes and should not rely on unversioned HTML structure.[^30]

One small correction to the supplied context: the publicly published 2018 sample shows a sender formatted as a KidTraks DCS address rather than proving the present `kidtraks.dcs.in.gov` sending domain. Your agency's current received messages are stronger evidence of the 2026 sender domain than the old public guide.

---

## System lineage and modernization

### What KidTraks actually is

Current DCS material calls KidTraks its "**referral and financial system**."[^31]

The historical technical/procurement record gives a more precise architecture. In Indiana's CCWIS procurement materials, DCS described KidTraks as a **State-created .NET solution** covering finance, provider functions and supplemental child-welfare/case-management functions. Other DCS materials distinguish the Casebook interface from KidTraks while placing both in the legacy MaGIK environment.[^32]

**Answer on who built it**: The strongest official evidence says the **State/DCS created KidTraks**, rather than purchasing KidTraks as an off-the-shelf vendor product.[^33]

**Could not determine**: I did not find a reliable public record identifying a single original "KidTraks development contract," original prime contractor, or exact first-production date. It would therefore be speculative to attribute the original application to a commercial vendor.

**Confidence**: High that it is State-created/internally developed .NET; low on original development date and contracting history.

The office most likely to answer the historical provenance question is DCS Child Welfare IT, potentially through the DCS Help Desk or a public-records request seeking original KidTraks development/M&O statements of work.

### Relationship to MaGIK

The proposition that "MaGIK is the case-management system, KidTraks is separate" needs revision.

The current DCS Child Welfare IT contact guide describes support for "**MaGIK (Casebook and KidTraks)**".[^4] The older CCWIS procurement similarly explains that most case-management functionality was in Casebook while some case-management and the ancillary referral/financial functions were in KidTraks.[^4]

A better mental model is:

- **MaGIK** = legacy child-welfare information-system ecosystem.
- **Casebook** = principal FCM/case-management interface.
- **KidTraks** = provider/referral/financial/contracting interface and related back-end functionality.

That description is an interpretation of DCS's architecture documents, rather than a formal DCS product definition.[^34]

### Technology platform

**Verified fact**: KidTraks is described by DCS procurement materials as a **State-created .NET application**.[^33]

**Verified fact**: Its current provider functionality remains **web-based**. DCS's current 2026 materials continue to give providers KidTraks login and e-invoicing instructions.[^35]

The replacement architecture specified in RFP 20-042 was a cloud-based CCWIS built on **Salesforce**, using **AWS** storage and **MuleSoft** as the central bidirectional integration layer.[^36]

### Modernization and current status

The 2019 procurement was explicit that DCS intended to replace MaGIK. Its planned second implementation phase would replace referral management, financial management and all remaining KidTraks functionality. DCS told ACF that KidTraks would serve as a **Transitional CCWIS** pending replacement.[^37]

That planned timeline plainly did not result in KidTraks disappearing on the original schedule. As of 2026, DCS continues to publish a live KidTraks tools page, current KidTraks invoicing guidance, current links to the system, and the Provider Monthly Report Attachment API.[^38]

DCS's Child Welfare IT documentation now identifies the replacement program as **I-KIDS / CCWIS** and provides a dedicated I-KIDS contact route, while describing the organization as moving away from MaGIK.[^21]

**Answer, current operational status**: KidTraks is still operational and provider-facing in 2026.[^39]

**Answer, replacement status**: Modernization/replacement is real and documented, but I could not determine from public sources the definitive current cutover date for KidTraks referral and financial functions.

**Answer, current procurement**: I found the major RFP 20-042 modernization procurement, issued December 2019. I did not find a sufficiently reliable indexed 2026 award/change record that would let me state the current prime integrator, current contractual milestone, or final KidTraks retirement date without guessing.[^19]

**Reasonable inference**: A new integration built directly against an undocumented KidTraks UI has greater lifecycle risk than an integration using a DCS-supported interface because referral/financial functionality is explicitly within the planned replacement scope.[^19]

**Confidence**: High on KidTraks continuing to operate in 2026 and on the planned CCWIS replacement architecture; medium/low on the current migration schedule.

---

## Service standards and matching constraints

### Where the standards live and what they control

DCS maintains its Service Standards under the provider/partner portion of its public website and incorporates the applicable standards into provider contracting/procurement. The Community Based Services procurement describes the standards as governing service eligibility and delivery, staffing qualifications, required documentation, program reporting and evaluation, among other requirements.[^40]

**Verified fact**: They are sufficiently service-specific that an automated referral matcher should not treat "DCS eligibility" as one generic rule. Qualifications, caseload requirements, initiation times and billing conventions differ by service.[^41]

The procurement structure separates Service Standards from the rate sheet/contract rate attachment, so I would model rates as a separately versioned contract attribute rather than assume that the service-standard PDF is the canonical rate source.[^42]

**Confidence**: High.

### Practitioner qualifications

**Answer**: Yes. Individual standards contain minimum staff/practitioner qualification sections, credential requirements and, where appropriate, supervisory requirements. The current Counseling standard, for example, has explicit minimum qualification/billable-credential provisions; Home-Based Therapy similarly contains staff and supervision requirements.[^43]

For software, these should be represented per service/component and by effective date, rather than as a single "qualified for DCS" flag.

**Reasonable inference**: A practical matching engine should distinguish at least the worker's license/credential, education/degree, experience or DCS qualification category where required, supervision status if relevant, service-specific training, and current assigned caseload.

**Confidence**: High that service-specific qualifications exist; the exact rule set must be extracted from each service standard relevant to your agency.

### The claimed 12-family cap

**Answer**: "DCS staff may have no more than 12 families" is too broad.

The posted Home-Based Therapy standard says the caseload shall be **no more than 12 active families**.[^44]

The posted Home-Based Casework standard likewise sets a maximum of **12 active families at any one time**.[^45]

But DCS's 2025 procurement Q&A says caseload expectations are contained in the **individual service standard**, that DCS does not track a single average caseload, and that the maximum depends upon the relevant service standard.[^46]

Older DCS guidance also expressly rejected treating the 12-family rule as a universal counseling-treatment caseload.[^47]

So:

**Verified fact**: 12 active families is a published limit for at least Home-Based Casework and Home-Based Therapy.[^48]

**Verified fact**: There is no public basis for treating 12 as the universal maximum for every DCS-contracted service or every provider employee.[^46]

**Confidence**: High.

**Source-age flag**: The web-posted Home-Based standards include historical provisions and amendments. Because contracts incorporate current standards, the version in force for your nonprofit's specific 2025–2029 contract should be checked against the attachments incorporated into that executed contract before enforcing a hard software rule.[^49]

### Case counts versus service hours

**Answer**: Both appear in the standards, but for different purposes.

Home-Based Casework and Therapy use an **active-family count** for staff caseload limitations.[^48]

At the same time, service delivery and billing are **time-based**. For example, the Home-Based Therapy standard defines client-specific face-to-face/service time and says DCS-funded services may be billed in 15-minute increments; routine report writing, ordinary scheduling, collateral contacts, non-client travel and no-shows are generally incorporated into the rate rather than separately billable.[^50]

Home-Based Casework similarly defines face-to-face service and bills service time in quarter-hour increments.[^51]

I did not find a general DCS rule equivalent to "every provider worker must deliver X direct hours per week" across all community-based services.

Instead, service intensity is expressed through the referral authorization and the individual service's standards. Home-Based Casework, for example, requires face-to-face service provision within 48 hours of the referral and ongoing 24/7 crisis availability; its outcome measures repeat the expectation that 95% of referred families receive face-to-face contact within 48 hours or that the FCM/probation officer is notified when the client does not respond.[^52]

Home-Based Therapy similarly sets a 48-hour face-to-face fidelity measure and separate crisis-response provisions.[^53]

**Verified fact**: A workload model therefore cannot safely use **only** case count or **only** scheduled hours. Those are distinct constraints.[^54]

**Reasonable inference**: For automated matching, worker capacity should be modeled as something like:

```
service-specific eligibility + active-family cap + currently authorized/direct 
service load + geographic/travel capacity + required initiation window
```

rather than "worker has fewer than 12 DCS cases."

**Confidence**: High.

### Accepting or declining a referral

There is an important source conflict here.

The 2018 KidTraks referral guide says that after notification the provider should accept if it can initiate within the Service Standard timeframe and otherwise reject. The guide says that a referral not accepted or rejected within **48 hours** is automatically cancelled/rejected.[^23]

However, a currently posted service standard for Cross-System Care Coordination expressly specifies acceptance in the KidTraks vendor portal within **72 hours**, plus separate requirements to notify the referral source when capacity is unavailable and to contact/see the family within specified periods.[^55]

Therefore:

**Answer**: I could not verify a single, current, universal KidTraks accept/decline deadline applicable to all 2026 community-based referrals.

**Verified fact**: 48 hours appears in the old general KidTraks guide.[^30]

**Verified fact**: At least one service-specific standard provides a different 72-hour portal-acceptance rule.[^56]

**Reasonable inference**: For production software, the **current service-specific standard and executed contract** should outrank the 2018 generic portal guide. DCS's current procurement materials themselves instruct providers to operate within Service Standard timeframes.[^57]

**Confidence**: High that 48 hours should not be hard-coded as a universal rule; medium on what KidTraks itself currently does automatically after a referral remains untouched, because the only public system-behavior documentation I found is old.

This is a particularly good question for the DCS Help Desk/Child Welfare Plan team before building an SLA timer.

---

## Confidentiality, Part 2, cloud, and AI

### Indiana child-welfare confidentiality

Indiana's statutory baseline is **IC 31-33-18**. The current Indiana Code framework classifies reports made under the child-abuse/neglect article and associated DCS-held information as confidential, subject to specified statutory exceptions and disclosures.[^58]

DCS's confidentiality policy likewise says DCS holds confidential the information, documents and records concerning children and families involved with DCS, and maintains confidentiality for records it receives from other sources according to the laws applicable to those records.[^59]

**CAPTA** provides the federal backdrop: states receiving CAPTA funding must preserve the confidentiality of child-abuse and neglect reports and records subject to authorized disclosure rules.[^60]

One nuance matters here: **IC 31-33-18 principally regulates the confidentiality/disclosure framework around DCS child-protection records; you should not rely on that statute alone to define every downstream obligation of a private contractor.** The provider contract and KidTraks access agreement impose substantially clearer downstream restrictions.[^61]

**Confidence**: High.

### The provider contract is unusually important for your proposed integration

The 2025 sample Community Based Services contract contains a broad **Confidentiality of State Information** obligation. It says data, material and information gathered, based upon or disclosed to the contractor for purposes of the contract may contain protected information and **will not be disclosed to or discussed with third parties without the State's prior written consent**.[^62]

That is broader than HIPAA and broader than 42 CFR Part 2 because it is a contractual restriction on State contract information generally.[^63]

The same contract also requires the contractor to safeguard Health Records/PHI, including administrative, physical and technical safeguards where applicable; immediately report security/privacy breaches directly relating to the contract; mitigate harmful effects; and ensure subcontractors or agents receiving PHI agree to the same restrictions and safeguards.[^64]

On subcontracting generally, the sample contract says the contractor may not subcontract the whole or part of the contract without State prior written consent, remains responsible for subcontractor performance, must have written subcontractor agreements, and must supply those agreements to the State on request.[^65]

It also requires cyber-liability insurance under the contract.[^49]

**Answer**: Yes. The DCS provider contract contains data/confidentiality, subcontracting, PHI/security, and breach provisions that are directly relevant to sending referral data to an external API.

**Confidence**: High.

**Source date**: The cited document is the 2025 Community Based Services sample contract associated with the current procurement cycle. An agency's executed contract can contain modifications, so the signed agreement must control over the sample.[^49]

### KidTraks itself imposes a separate restriction

The **KidTraks Information Systems Access and Use Agreement** is even more explicit. It says users must use utmost care protecting DCS "Information" from unauthorized access, misuse or disclosure; unauthorized access/use must be reported; the information may contain protected/confidential data; and the user **will not disclose it to or discuss it with third parties without prior written DCS consent**. It also restricts information to official DCS business and prohibits accessing information through a method inconsistent with DCS's **approved system-entry method**.[^29]

This is directly material to your architecture.

**Verified fact**: An ordinary third-party AI/API provider is a "third party" in the everyday meaning of that contract language. The agreement does not contain a public exception saying that encrypted SaaS processors, zero-retention AI APIs, or HIPAA-compliant cloud services can automatically receive KidTraks information.[^66]

**Reasonable inference, not a legal determination**: Sending raw KidTraks referral content to an external cloud/LLM/API **without written DCS authorization** would be difficult to reconcile with these provisions, even where the vendor promises not to train on the data. The issue is not just model training; **transmission to the third party itself is the contractually relevant disclosure**.[^67]

Likewise, a software company processing contract information for the nonprofit could potentially be considered a subcontractor/agent depending on what function it performs. If so, the subcontracting requirements create an additional approval issue. Whether a particular SaaS processor legally qualifies as a "subcontractor" under your executed agreement is a contract-specific question, not something public sources resolve.[^68]

**Confidence**: High on the underlying contract language; medium-high on the architectural implication.

### Substance-use records and 42 CFR Part 2

The current provider contract explicitly anticipates this situation. Its section on drug and alcohol patient records says the contractor may encounter protected alcohol/SUD patient information, requires the contractor and State to comply with **42 CFR Part 2**, and requires immediate reporting to the State of unauthorized disclosures.[^69]

The federal rule was materially updated in 2024. HHS says the final rule became effective April 16, 2024 and **compliance was required February 16, 2026**, so the updated regime is now the operative one for this project.[^70]

Part 2 does not apply simply because a referral says that someone uses drugs or is being referred for an SUD assessment. The regulation applies to **SUD patient records maintained in connection with a Part 2 program**, and SAMHSA describes covered programs as federally assisted programs providing SUD diagnosis, treatment or referral for treatment.[^71]

The current CFR defines a **patient** in relation to applying for or receiving SUD diagnosis, treatment or referral from a Part 2 program.[^72]

Accordingly:

**Verified fact**: If the referral contains information originating in or constituting a Part 2 program's protected patient record, Part 2 can follow that information according to its disclosure rules.[^73]

**Verified fact**: A provider that itself operates a federally assisted SUD diagnosis/treatment/referral program may generate Part 2 records once the individual becomes a Part 2 patient.[^74]

**Reasonable inference**: A DCS referral that merely states DCS's own concern about suspected substance use is **not automatically transformed into a Part 2 record** solely because of that subject matter. The source and status of the record matter.[^75]

The 2024 rule allows a single patient consent for future treatment/payment/health-care-operations uses and disclosures and, in applicable circumstances, lets HIPAA covered entities and business associates receiving records under that consent redisclose them according to HIPAA.[^76]

But that federal flexibility does **not supersede a stricter DCS contract requirement** to obtain State consent before disclosing DCS contract information to third parties. That latter point is an inference from the independent contractual obligations.[^67]

**Confidence**: High on the Part 2 framework; medium on classification of any particular DCS referral because the provenance of the information must be examined record by record.

### Third-party cloud and AI services

**Answer**: I could not find a DCS publication specifically saying "providers may/may not use generative AI" with referral information.

I also did not find a provider-specific public policy establishing an approved list of cloud platforms or AI vendors for community-based contractors.

Indiana IOT does have statewide cloud/security contracting practices, including cloud security terms and vendor-review processes for State IT contracts, but those materials are directed at State procurement and do not by themselves authorize a DCS community-based provider's use of a cloud processor.[^77]

More importantly, an AI-specific prohibition is not necessary to reach the practical result: the **current DCS sample provider contract and KidTraks access agreement already prohibit disclosure of DCS information to third parties without prior written State/DCS consent**.[^67]

For the system you describe, I would therefore categorize cloud processing as follows:

| Architecture | Public-source assessment |
|---|---|
| Parse KidTraks email entirely inside the provider's controlled environment | Potentially viable, subject to ordinary confidentiality/security requirements. |
| Send referral email/body to a third-party SaaS API | Requires DCS contract review; likely needs prior written consent under the quoted third-party disclosure provision.[^67] |
| Send full portal referral to an external LLM/API | Highest concern, because full referrals may contain abuse history, addresses, medical/SUD information, safety information and other sensitive data.[^78] |
| Use a vendor as a contractor/subprocessor for the DCS workflow | May also trigger subcontractor/agent provisions and PHI flow-down requirements.[^79] |
| Browser/RPA automation against KidTraks | Obtain explicit approval, because the access agreement restricts access to authorized/approved system-entry methods.[^66] |
| DCS-supported Attachment API | Clearly supported, subject to issued token and documented parameters.[^80] |

Those assessments are **reasonable contract/security inferences, not legal opinions**. The decisive document is your nonprofit's actual executed DCS contract and any incorporated security/addendum language.

---

## Decision implications and unresolved questions

### What appears feasible now

The public evidence supports a **partially integrated architecture today**.

A provider can automate outbound DCS reporting using the Attachment API and can automate or bulk-generate KidTraks billing via the published CSV/XML import formats. Commercial Indiana provider products are already publicly advertising these capabilities.[^81]

For inbound referrals, the documented DCS channel remains an email generated by KidTraks that links into the secure portal. The email contains enough information to create a provisional referral event, but the published template does not contain enough information to reproduce the full referral.[^82]

So a reasonable technical characterization is:

**Supported today:**
```
internal case system → monthly report API → KidTraks
```
and
```
internal billing system → CSV/XML import → KidTraks
```

**Publicly unsupported/unknown today:**
```
KidTraks new referral → official API/webhook → internal case system
```

**Available but incomplete:**
```
KidTraks referral → email → internal parser → provisional case/referral record
```

### The largest blocker may be authorization, not technology

Technically, parsing email and calling a cloud service is straightforward. Contractually, the stronger constraint is that **DCS's current contract and KidTraks user agreement say DCS information is not to be disclosed to third parties without prior written consent**.[^67]

That makes the preferred order of operations quite different from "build a parser and then see if DCS objects":

1. Determine whether DCS has an unpublished referral read API or provider-facing I-KIDS integration path.
2. Obtain written approval for any proposed third-party processor before sending referral text outside the provider's controlled environment.
3. Only then choose between official API integration, local email parsing, or approved UI automation.

That ordering is my **reasonable inference** from the published technical and contractual material.[^83]

### Questions public sources do not resolve

| Question | Result | Who should know | Confidence in "unknown" |
|---|---|---|---|
| Is there a private/authenticated API to list or retrieve provider referrals? | Could not determine. No public documentation found. | DCS Child Welfare IT / KidTraks Help Desk; `DCSHelpDesk@dcs.in.gov`[^80] | Medium-high |
| Is there SFTP, scheduled export, webhook or bulk referral feed? | Could not determine. | DCS Child Welfare IT / I-KIDS integration team | Medium-high |
| Will I-KIDS expose an external-provider referral API, and when? | Could not determine. RFP architecture supports bidirectional APIs generally, but no provider-referral interface commitment was found. | `DCS.IKIDS@dcs.in.gov` / Child Welfare IT[^34] | High that public record is insufficient |
| What is the exact 2026 referral email schema? | Could not determine publicly. Published sample is 2018. | KidTraks Help Desk; alternatively compare a representative set of the provider's actual 2026 notifications | High |
| Does the current system still auto-reject every untouched referral after 48 hours? | Could not determine. 2018 guide says 48h, but a current service standard has a 72h acceptance rule.[^84] | DCS Help Desk / Child Welfare Plan | High |
| Is "12 families" a universal DCS cap? | No. It is service-specific; 12 is verified for Home-Based Casework and Therapy.[^85] | Current Service Standard / contract | High |
| Does DCS permit a named third-party cloud/AI processor to receive referral text? | Could not determine generically. Written consent appears necessary under current contract/ access language. | DCS contract representative / legal & privacy/security review | High |
| Is unapproved RPA/browser automation permitted? | Could not determine; do not assume yes. Access agreement requires authorized, DCS-approved methods of access.[^66] | DCS Child Welfare IT / Help Desk | Medium-high |
| Who originally built KidTraks and under which development contract? | State-created .NET is verified; exact original contract/date could not be determined. | DCS Child Welfare IT or Indiana public-records/procurement office | High on State-created; low on provenance details |
| Exact KidTraks retirement/cutover date | Could not determine. | I-KIDS/CCWIS program office | High |

---

## Source-age and reliability summary

The **strongest current sources** for an implementation decision are DCS's 2026 KidTraks tools/invoicing pages and Attachment API documentation, the current procurement-cycle sample contract, the current Service Standards, and current federal Part 2 material.[^86]

The **2018 Traditional Service Referral guide** is exceptionally useful because it contains the only public notification-email screenshot I found, but it should be treated as historical evidence rather than a guaranteed 2026 interface specification.[^23]

The **2019 CCWIS RFP** remains authoritative regarding DCS's intended replacement architecture and KidTraks's status as a transitional system, but its original implementation schedule is demonstrably outdated because KidTraks remains operational in 2026.[^87]

The **2021 Attachment FAQ and 2019 invoice specifications** remain relevant because DCS continues to link these functions in the present KidTraks documentation, but any production integration should obtain the current specification/token instructions from DCS before coding against them.[^88]

### Overall assessment

**Native full-referral integration**: Could not determine; no public supported interface found. **Confidence**: medium-high.

**Email-trigger automation**: Technically feasible and supported by the documented workflow, but the notification carries only partial referral content. **Confidence**: high.[^82]

**Outbound KidTraks integration**: Definitely feasible through supported mechanisms: Attachment API and XML/CSV e-invoice imports. **Confidence**: high.[^89]

**12-family rule**: Real for specific home-based services, not a universal DCS provider caseload rule. **Confidence**: high.[^85]

**Cloud/AI processing without DCS approval**: Not something I would treat as contractually permitted. The public contract and access agreement require prior State/DCS written consent before DCS information is disclosed to third parties. **Confidence**: high on the underlying restriction; medium-high on how it applies to a particular SaaS architecture.[^67]

**Strategic conclusion**: The strongest path is not to regard email scraping as the final integration design. DCS already runs authenticated provider APIs and bulk-import mechanisms, and its CCWIS architecture is explicitly API-oriented. The critical unresolved question is whether DCS will authorize or expose a provider-side referral read interface. Until DCS answers that, an internally hosted email parser can eliminate some manual triage, but public documentation does not support assuming it can replace the portal as the authoritative source of the complete referral.[^90]

---

## References

[^1]: https://www.in.gov/dcs/files/Provider-Monthly-Report-Attachment-API.pdf?utm_source=chatgpt.com
[^2]: https://www.in.gov/dcs/files/Provider-Monthly-Report-Attachment-API.pdf?utm_source=chatgpt.com
[^3]: https://www.in.gov/dcs/files/Provider-Monthly-Report-Attachment-API.pdf?utm_source=chatgpt.com
[^4]: https://www.in.gov/dcs/files/DCS_Contact_Guide.pdf
[^5]: https://www.in.gov/dcs/files/current-requests-for-proposals/2024-CB-Boilerplate-A1.pdf?utm_source=chatgpt.com
[^6]: https://www.in.gov/dcs/files/Kidtraks-guide-Referral-2018-FOR-WEBSITE.pdf
[^7]: https://www.in.gov/dcs/files/Provider-Monthly-Report-Attachment-API.pdf
[^8]: https://www.in.gov/dcs/files/Provider-Monthly-Report-Attachment-API.pdf
[^9]: https://www.in.gov/dcs/files/Provider-Monthly-Report-Attachment-API.pdf
[^10]: https://www.in.gov/dcs/files/FAQ-Attaching-Kidtraks-Case-Documentation-9-14-21.pdf?utm_source=chatgpt.com
[^11]: https://www.in.gov/dcs/files/KidTraks-e-Invoicing-Questions-Answers-8-30-2019.pdf?utm_source=chatgpt.com
[^12]: https://www.in.gov/dcs/providers-and-partners/kidtraks-invoicing-documents-and-tools/?utm_source=chatgpt.com
[^13]: https://www.in.gov/dcs/providers-and-partners/kidtraks-invoicing-documents-and-tools/?utm_source=chatgpt.com
[^14]: https://www.in.gov/dcs/files/Provider-Monthly-Report-Attachment-API.pdf
[^15]: https://www.cei-edu.com/wp-content/uploads/2020/09/CMP-Networking-brouchure.pdf?utm_source=chatgpt.com
[^16]: https://myfcr.org/?utm_source=chatgpt.com
[^17]: https://medez.com/dcs-billing-software/?utm_source=chatgpt.com
[^18]: https://www.in.gov/idoa/proc/bids/RFP-20-042/RFP%2020-042%20Pre%20Proposal%20Conference%20Deck.pdf?utm_source=chatgpt.com
[^19]: https://www.in.gov/idoa/proc/bids/RFP-20-042/Responses%20to%20Questions%20DDI%20RFP%2020-042.xlsx?utm_source=chatgpt.com
[^20]: https://www.in.gov/dcs/files/DCS_Contact_Guide.pdf
[^21]: https://www.in.gov/dcs/files/DCS_Contact_Guide.pdf
[^22]: https://www.in.gov/dcs/files/DCS_Contact_Guide.pdf
[^23]: https://www.in.gov/dcs/files/Kidtraks-guide-Referral-2018-FOR-WEBSITE.pdf
[^24]: https://www.in.gov/dcs/files/Kidtraks-guide-Referral-2018-FOR-WEBSITE.pdf
[^25]: https://www.in.gov/dcs/files/Referral-five-things.pdf
[^26]: https://www.in.gov/dcs/files/Referral-five-things.pdf
[^27]: https://www.in.gov/dcs/files/Referral-five-things.pdf
[^28]: https://www.in.gov/dcs/files/Referral-five-things.pdf
[^29]: https://in.gov/dcs/files/SF56856-DCS-FFH-Foster-Care-Portal-and-KidTraks-User-Agreement.pdf?utm_source=chatgpt.com
[^30]: https://www.in.gov/dcs/files/Kidtraks-guide-Referral-2018-FOR-WEBSITE.pdf
[^31]: https://www.in.gov/dcs/providers-and-partners/kidtraks-invoicing-documents-and-tools/?utm_source=chatgpt.com
[^32]: https://www.in.gov/idoa/proc/bids/RFP-20-042/RFP%2020-042%20Pre%20Proposal%20Conference%20Deck.pdf?utm_source=chatgpt.com
[^33]: https://www.in.gov/idoa/proc/bids/RFP-20-042/Responses%20to%20Questions%20DDI%20RFP%2020-042.xlsx?utm_source=chatgpt.com
[^34]: https://www.in.gov/dcs/files/DCS_Contact_Guide.pdf
[^35]: https://www.in.gov/dcs/files/KidTraks-e-Invoicing-Guide-for-Day-Care-Reimbursement-for-Resource-Parents.pdf?utm_source=chatgpt.com
[^36]: https://www.in.gov/idoa/proc/bids/RFP-20-042/RFP%2020-042%20Pre%20Proposal%20Conference%20Deck.pdf?utm_source=chatgpt.com
[^37]: https://www.in.gov/idoa/proc/bids/RFP-20-042/RFP%2020-042%20Pre%20Proposal%20Conference%20Deck.pdf?utm_source=chatgpt.com
[^38]: https://www.in.gov/dcs/providers-and-partners/kidtraks-invoicing-documents-and-tools/?utm_source=chatgpt.com
[^39]: https://www.in.gov/dcs/providers-and-partners/kidtraks-invoicing-documents-and-tools/?utm_source=chatgpt.com
[^40]: https://www.in.gov/dcs/providers-and-partners/service-standards/
[^41]: https://www.in.gov/dcs/files/current-requests-for-proposals/Q-and-A-Response.pdf?utm_source=chatgpt.com
[^42]: https://www.in.gov/dcs/files/current-requests-for-proposals/2024-CB-Boilerplate-A1.pdf?utm_source=chatgpt.com
[^43]: https://www.in.gov/dcs/files/Counseling.pdf
[^44]: https://www.in.gov/dcs/files/Home-Based-Therapy.pdf
[^45]: https://www.in.gov/dcs/files/3-Home-Based-Casework-002.pdf
[^46]: https://www.in.gov/dcs/files/current-requests-for-proposals/Q-and-A-Response.pdf?utm_source=chatgpt.com
[^47]: https://www.in.gov/dcs/files/coronavirus_faq_community_based_services_archive_10-13-20.pdf?utm_source=chatgpt.com
[^48]: https://www.in.gov/dcs/files/Home-Based-Therapy.pdf
[^49]: https://www.in.gov/dcs/files/current-requests-for-proposals/Supp-Attachment-C-Sample-Contract.pdf
[^50]: https://www.in.gov/dcs/files/Home-Based-Therapy.pdf
[^51]: https://www.in.gov/dcs/files/3-Home-Based-Casework-002.pdf
[^52]: https://www.in.gov/dcs/files/3-Home-Based-Casework-002.pdf
[^53]: https://www.in.gov/dcs/files/Home-Based-Therapy.pdf
[^54]: https://www.in.gov/dcs/files/Home-Based-Therapy.pdf
[^55]: https://www.in.gov/dcs/files/Cross-System-Care-Coordinaton.pdf
[^56]: https://www.in.gov/dcs/files/Cross-System-Care-Coordinaton.pdf
[^57]: https://www.in.gov/dcs/files/current-requests-for-proposals/RFP-Boilerplate-Final.pdf?utm_source=chatgpt.com
[^58]: https://law.justia.com/codes/indiana/title-31/article-33/chapter-18/section-31-33-18-1/?utm_source=chatgpt.com
[^59]: https://www.in.gov/dcs/files/2.06-Sharing-Confidential-Information-v13-Effective-7.1.24-4.30.25.pdf?utm_source=chatgpt.com
[^60]: https://www.acf.hhs.gov/sites/default/files/documents/cb/data_sharing_toolkit.pdf?utm_source=chatgpt.com
[^61]: https://www.in.gov/dcs/files/Kidtraks-User-Agreement-56798-fill-in.pdf?utm_source=chatgpt.com
[^62]: https://www.in.gov/dcs/files/current-requests-for-proposals/Supp-Attachment-C-Sample-Contract.pdf
[^63]: https://www.in.gov/dcs/files/current-requests-for-proposals/Supp-Attachment-C-Sample-Contract.pdf
[^64]: https://www.in.gov/dcs/files/current-requests-for-proposals/Supp-Attachment-C-Sample-Contract.pdf
[^65]: https://www.in.gov/dcs/files/current-requests-for-proposals/Supp-Attachment-C-Sample-Contract.pdf
[^66]: https://in.gov/dcs/files/SF56856-DCS-FFH-Foster-Care-Portal-and-KidTraks-User-Agreement.pdf?utm_source=chatgpt.com
[^67]: https://in.gov/dcs/files/SF56856-DCS-FFH-Foster-Care-Portal-and-KidTraks-User-Agreement.pdf?utm_source=chatgpt.com
[^68]: https://www.in.gov/dcs/files/current-requests-for-proposals/Supp-Attachment-C-Sample-Contract.pdf
[^69]: https://www.in.gov/dcs/files/current-requests-for-proposals/Supp-Attachment-C-Sample-Contract.pdf
[^70]: https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/index.html?utm_source=chatgpt.com
[^71]: https://www.samhsa.gov/substance-use/treatment/statutes-regulations-guidelines?utm_source=chatgpt.com
[^72]: https://www.govinfo.gov/link/cfr/42/2?link-type=pdf&year=mostrecent&utm_source=chatgpt.com
[^73]: https://www.hhs.gov/hipaa/part-2/index.html?utm_source=chatgpt.com
[^74]: https://www.samhsa.gov/substance-use/treatment/statutes-regulations-guidelines?utm_source=chatgpt.com
[^75]: https://www.hhs.gov/hipaa/part-2/index.html?utm_source=chatgpt.com
[^76]: https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/index.html?utm_source=chatgpt.com
[^77]: https://www.in.gov/idoa/files/2023_state_contracts_seminar.pdf?utm_source=chatgpt.com
[^78]: https://www.in.gov/dcs/files/Referral-five-things.pdf
[^79]: https://www.in.gov/dcs/files/current-requests-for-proposals/Supp-Attachment-C-Sample-Contract.pdf
[^80]: https://www.in.gov/dcs/files/DCS_Contact_Guide.pdf
[^81]: https://www.in.gov/dcs/providers-and-partners/kidtraks-invoicing-documents-and-tools/?utm_source=chatgpt.com
[^82]: https://www.in.gov/dcs/files/Kidtraks-guide-Referral-2018-FOR-WEBSITE.pdf
[^83]: https://www.in.gov/dcs/files/Kidtraks-guide-Referral-2018-FOR-WEBSITE.pdf
[^84]: https://www.in.gov/dcs/files/Cross-System-Care-Coordinaton.pdf
[^85]: https://www.in.gov/dcs/files/Home-Based-Therapy.pdf
[^86]: https://www.in.gov/dcs/providers-and-partners/kidtraks-invoicing-documents-and-tools/?utm_source=chatgpt.com
[^87]: https://www.in.gov/idoa/proc/bids/RFP-20-042/RFP%2020-042%20Pre%20Proposal%20Conference%20Deck.pdf?utm_source=chatgpt.com
[^88]: https://www.in.gov/dcs/files/FAQ-Attaching-Kidtraks-Case-Documentation-9-14-21.pdf?utm_source=chatgpt.com
[^89]: https://www.in.gov/dcs/providers-and-partners/kidtraks-invoicing-documents-and-tools/?utm_source=chatgpt.com
[^90]: https://www.in.gov/dcs/providers-and-partners/kidtraks-invoicing-documents-and-tools/?utm_source=chatgpt.com
