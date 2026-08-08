/**
 * The eSheet form definition for the case sheet.
 *
 * Field ids are the `Referral` field names on purpose: the renderer and the
 * case document share one vocabulary, so nothing has to translate between a
 * form response and the doc.
 */
import type { FormDefinition } from "@esheet/core";

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

/** Case document → eSheet responses. Same names both sides, so this stays a projection. */
export function caseSheetResponses(doc: CaseDoc): Record<string, unknown> {
  const { referral } = doc;
  return {
    caseNumber: referral.caseNumber ?? "",
    referralId: referral.referralId ?? "",
    service: referral.service ?? "",
    county: referral.county ?? "",
    region: referral.region ?? "",
    requestedStartDate: referral.requestedStartDate ?? "",
    childrenInHome: referral.childrenInHome ?? "",
    fcmName: referral.fcmName ?? "",
    fcmPhone: referral.fcmPhone ?? "",
    proposedStaffId: doc.commitment?.staffId ?? doc.proposal.staffId ?? "",
    outcome: doc.proposal.outcome,
    notes: referral.notes ?? "",
    supervisorNotes: doc.notes.map((note) => `${note.author}: ${note.text}`).join("\n"),
  };
}
