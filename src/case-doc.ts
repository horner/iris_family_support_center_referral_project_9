/**
 * The canonical case document — one `Y.Doc` per referral, one collaborative
 * room per case.
 *
 * The ownership split is the point (docs/ARCHITECTURE.md, decision 3):
 *
 * - `referral` and `evaluation` are written once by the pipeline.
 * - `proposal`, `notes` and `scenarioPins` are written by **supervisors**,
 *   collaboratively and offline. They consume nothing and merge freely.
 * - `commitment` is written by the **server only**, inside the assignment
 *   transaction. Clients never write it; a CRDT gives convergence, not
 *   invariants, so two offline commits would merge cleanly straight through
 *   the 12-family cap.
 *
 * A case document names a child. One room per case, and sync is scoped to a
 * supervisor's own open queue.
 */
import type { Allocation, AllocationOutcome, Evaluation, Referral } from "./model.ts";

export type CaseStatus = "pending" | "proposed" | "assigned" | "declined" | "needs_re_decision";

/** Supervisor-owned. Reversible, replannable, and free of capacity consequences. */
export interface CaseProposal {
  staffId?: string;
  outcome: AllocationOutcome;
  rationale: string[];
  contendedWith: string[];
  runnersUp: { staffId: string; reason: string }[];
  /** Required when a supervisor overrides the planner's choice. */
  overrideReason?: string;
  proposedBy?: string;
  proposedAt?: string;
}

/** Server-owned. The API is the writer of truth; the document is the broadcast channel. */
export interface CaseCommitment {
  status: "assigned" | "declined";
  staffId?: string;
  declineReason?: string;
  committedBy: string;
  committedAt: string;
  commitKey: string;
}

export interface CaseNote {
  author: string;
  text: string;
  at: string;
}

export interface CaseDoc {
  messageId: string;
  referral: Referral;
  evaluation: Evaluation;
  proposal: CaseProposal;
  notes: CaseNote[];
  commitment: CaseCommitment | null;
  /** Set when a commit was rejected — never resolved silently in either direction. */
  needsReDecision: { reason: string; at: string } | null;
}

export const caseRoom = (messageId: string): string => messageId;

/** Status is derived, never stored twice — the commitment block decides it. */
export function caseStatus(doc: Pick<CaseDoc, "commitment" | "proposal" | "needsReDecision">): CaseStatus {
  if (doc.commitment) return doc.commitment.status;
  if (doc.needsReDecision) return "needs_re_decision";
  return doc.proposal.staffId ? "proposed" : "pending";
}

/** A committed case pins the planner; a proposal never does. */
export const isCommitted = (doc: Pick<CaseDoc, "commitment">): boolean => doc.commitment !== null;

/** Builds the document the pipeline writes for a freshly planned referral. */
export function buildCaseDoc(
  referral: Referral,
  evaluation: Evaluation,
  allocation: Allocation,
  previous?: CaseDoc,
): CaseDoc {
  return {
    messageId: referral.messageId,
    referral,
    evaluation,
    proposal: {
      staffId: allocation.assignedStaffId,
      outcome: allocation.outcome,
      rationale: allocation.rationale,
      contendedWith: allocation.contendedWith,
      runnersUp: allocation.runnersUp,
    },
    notes: previous?.notes ?? [],
    commitment: previous?.commitment ?? null,
    needsReDecision: previous?.needsReDecision ?? null,
  };
}
