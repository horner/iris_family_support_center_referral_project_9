/**
 * The eSheet form definition for the case sheet.
 *
 * Field ids are the `Referral` field names on purpose: the renderer and the
 * case document share one vocabulary, so nothing has to translate between a
 * form response and the doc.
 */
import type { FormDefinition, FormResponse } from "@esheet/core";

import type { CaseDoc } from "./case-doc.ts";

export const CASE_SHEET: FormDefinition = {
  id: "iris.case-sheet",
  title: "Referral",
  fields: [
    { id: "referralSection", fieldType: "section", question: "Referral" },
    { id: "caseNumber", fieldType: "text", question: "Case number" },
    { id: "referralId", fieldType: "text", question: "Referral ID" },
    { id: "service", fieldType: "text", question: "Service requested" },
    { id: "county", fieldType: "text", question: "County" },
    { id: "region", fieldType: "text", question: "Region" },
    { id: "requestedStartDate", fieldType: "text", inputType: "date", question: "Requested start" },
    {
      id: "childrenInHome",
      fieldType: "text",
      inputType: "number",
      question: "Children in home",
    },
    { id: "contactSection", fieldType: "section", question: "DCS contact" },
    { id: "fcmName", fieldType: "text", question: "Family case manager" },
    { id: "fcmPhone", fieldType: "text", inputType: "tel", question: "FCM phone" },
    { id: "decisionSection", fieldType: "section", question: "Decision" },
    { id: "proposedStaffId", fieldType: "text", question: "Proposed worker" },
    { id: "outcome", fieldType: "text", question: "Outcome" },
    { id: "notes", fieldType: "longtext", question: "Referral notes (from DCS)" },
    {
      id: "supervisorNotes",
      fieldType: "longtext",
      question: "Supervisor notes",
    },
  ],
};

/**
 * Case document → eSheet responses. Same field names both sides, so this stays
 * a projection rather than a translation layer.
 *
 * `outcomeLabel` lets the client hand in the translated wording; without it the
 * raw enum would leak onto a supervisor's screen.
 */
export function caseSheetResponses(doc: CaseDoc, outcomeLabel?: string): FormResponse {
  const { referral } = doc;
  const answers: Record<string, string> = {
    caseNumber: referral.caseNumber ?? "",
    referralId: referral.referralId ?? "",
    service: referral.service ?? "",
    county: referral.county ?? "",
    region: referral.region ?? "",
    requestedStartDate: referral.requestedStartDate ?? "",
    childrenInHome: referral.childrenInHome === undefined ? "" : String(referral.childrenInHome),
    fcmName: referral.fcmName ?? "",
    fcmPhone: referral.fcmPhone ?? "",
    proposedStaffId: doc.commitment?.staffId ?? doc.proposal.staffId ?? "",
    outcome: outcomeLabel ?? doc.proposal.outcome,
    notes: referral.notes ?? "",
    supervisorNotes: doc.notes.map((note) => `${note.author}: ${note.text}`).join("\n"),
  };

  return Object.fromEntries(
    Object.entries(answers).map(([field, answer]) => [field, { answer }]),
  );
}
