/**
 * `iris.Case@1` — the forward projection from a case document to the queue
 * tables.
 *
 * Forward-only by design: the document is the system of record and these rows
 * are derived, so nothing outside this file may UPDATE them. Keys are stable
 * on `message_id`, which makes re-projection idempotent.
 */
import { defineMapping, one } from "@yorm/core";
import type { Mapping } from "@yorm/core";

import { caseStatus, type CaseDoc } from "../case-doc.ts";

const commitment = (doc: CaseDoc) => doc.commitment;

export const caseMapping: Mapping<CaseDoc> = defineMapping<CaseDoc>({
  name: "iris.Case",
  version: 1,
  documentType: "Case",
  direction: "forward",
  projections: [
    one("cases", {
      key: ({ object, documentId }) => ({ message_id: object.messageId ?? documentId }),
      values: ({ object }) => {
        const referral = object.referral;
        return {
          referral_id: referral.referralId ?? null,
          case_number: referral.caseNumber ?? null,
          service: referral.service ?? null,
          county: referral.county ?? null,
          region: referral.region ?? null,
          fcm_name: referral.fcmName ?? null,
          fcm_phone: referral.fcmPhone ?? null,
          requested_start_date: referral.requestedStartDate ?? null,
          children_in_home: referral.childrenInHome ?? null,
          notes: referral.notes ?? null,
          subject: referral.subject ?? null,
          received_at: referral.receivedAt ?? null,
          preferences: JSON.stringify(referral.preferences ?? {}),
          parse_warnings: JSON.stringify(referral.parseWarnings ?? []),
          status: caseStatus(object),
          proposed_staff_id: object.proposal.staffId ?? null,
          committed_staff_id: commitment(object)?.staffId ?? null,
          committed_by: commitment(object)?.committedBy ?? null,
          committed_at: commitment(object)?.committedAt ?? null,
          decline_reason: commitment(object)?.declineReason ?? null,
          commit_key: commitment(object)?.commitKey ?? null,
        };
      },
    }),
    one("case_decisions", {
      key: ({ object, documentId }) => ({ message_id: object.messageId ?? documentId }),
      values: ({ object }) => ({
        outcome: object.proposal.outcome,
        proposed_staff_id: object.proposal.staffId ?? null,
        runners_up: JSON.stringify(object.proposal.runnersUp ?? []),
        rationale: JSON.stringify(object.proposal.rationale ?? []),
        contended_with: JSON.stringify(object.proposal.contendedWith ?? []),
        unknowns: JSON.stringify(object.evaluation.unknowns ?? []),
        requires_supervisor_judgment: object.evaluation.requiresSupervisorJudgment ? 1 : 0,
      }),
    }),
  ],
});
