/**
 * Commitment — the only path that consumes capacity.
 *
 * Proposals live in the CRDT because they merge and cost nothing. Commitments
 * cannot: a CRDT guarantees convergence, not invariants, so two supervisors
 * committing the same last slot offline would merge cleanly straight through
 * the 12-family cap. So this runs in **one SQL transaction** that re-checks
 * every gate against current data and increments the counter conditionally.
 *
 * The document is the broadcast channel; this transaction is the writer of
 * truth. Clients never write the commitment block themselves.
 */
import { and, eq, lt, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { evaluate } from "./engine.ts";
import { cases, commitments, staff } from "./db/schema.ts";
import { readMatrix, readRoster } from "./pipeline.ts";
import type { EngineConfig, GateName, Referral } from "./model.ts";

export interface CommitRequest {
  messageId: string;
  /** Client-generated, so a retry on a flaky connection consumes one slot, not two. */
  commitKey: string;
  committedBy: string;
  staffId?: string;
  declineReason?: string;
}

export interface Commitment {
  commitKey: string;
  messageId: string;
  status: "assigned" | "declined";
  staffId?: string;
  declineReason?: string;
  committedBy: string;
  committedAt: string;
}

/** Never a bare 409: every rejection names what to do about it. */
export type CommitRejection =
  | { code: "already_committed"; message: string; heldBy: Commitment }
  | { code: "slot_taken"; message: string; takenBy: string[] }
  | { code: "gate_failed"; message: string; gate: GateName }
  | { code: "unknown_case"; message: string };

export type CommitResult =
  | { ok: true; commitment: Commitment; idempotent: boolean }
  | { ok: false; rejection: CommitRejection };

const toCommitment = (row: typeof commitments.$inferSelect): Commitment => {
  const commitment: Commitment = {
    commitKey: row.commitKey,
    messageId: row.messageId,
    status: row.status as "assigned" | "declined",
    committedBy: row.committedBy,
    committedAt: row.committedAt,
  };
  if (row.staffId) commitment.staffId = row.staffId;
  if (row.declineReason) commitment.declineReason = row.declineReason;
  return commitment;
};

/** The case row carries everything the gates need — no document read required. */
function referralFromRow(row: typeof cases.$inferSelect): Referral {
  return {
    messageId: row.messageId,
    receivedAt: row.receivedAt ?? "",
    subject: row.subject ?? "",
    preferences: (row.preferences ?? {}) as Referral["preferences"],
    rawBody: "",
    parseWarnings: row.parseWarnings ?? [],
    ...(row.referralId ? { referralId: row.referralId } : {}),
    ...(row.caseNumber ? { caseNumber: row.caseNumber } : {}),
    ...(row.service ? { service: row.service } : {}),
    ...(row.county ? { county: row.county } : {}),
  };
}

/**
 * Runs the whole check-and-consume in one transaction. Synchronous on purpose:
 * `better-sqlite3` transactions are, and awaiting inside one would release it.
 */
export function commit(
  db: BetterSQLite3Database,
  request: CommitRequest,
  config: EngineConfig,
  now: () => string = () => new Date().toISOString(),
): CommitResult {
  return db.transaction((tx): CommitResult => {
    const replay = tx.select().from(commitments).where(eq(commitments.commitKey, request.commitKey)).get();
    if (replay) {
      // Same key, same answer, capacity consumed exactly once.
      return { ok: true, commitment: toCommitment(replay), idempotent: true };
    }

    const existing = tx.select().from(commitments).where(eq(commitments.messageId, request.messageId)).get();
    if (existing) {
      const held = toCommitment(existing);
      return {
        ok: false,
        rejection: {
          code: "already_committed",
          message: `This case was already ${held.status}${held.staffId ? ` to ${held.staffId}` : ""} by ${held.committedBy} at ${held.committedAt}.`,
          heldBy: held,
        },
      };
    }

    const caseRow = tx.select().from(cases).where(eq(cases.messageId, request.messageId)).get();
    if (!caseRow) {
      return {
        ok: false,
        rejection: { code: "unknown_case", message: `No case ${request.messageId} has been ingested.` },
      };
    }

    const committedAt = now();

    if (request.staffId === undefined) {
      tx.insert(commitments)
        .values({
          commitKey: request.commitKey,
          messageId: request.messageId,
          status: "declined",
          declineReason: request.declineReason ?? "No reason given",
          committedBy: request.committedBy,
          committedAt,
        })
        .run();
      return {
        ok: true,
        idempotent: false,
        commitment: {
          commitKey: request.commitKey,
          messageId: request.messageId,
          status: "declined",
          declineReason: request.declineReason ?? "No reason given",
          committedBy: request.committedBy,
          committedAt,
        },
      };
    }

    // Re-check every gate against *current* data: a stale client cannot talk
    // the server into an over-cap or ineligible assignment.
    const roster = readRoster(tx as unknown as BetterSQLite3Database);
    const worker = roster.find((p) => p.staffId === request.staffId);
    if (!worker) {
      return {
        ok: false,
        rejection: { code: "gate_failed", message: `${request.staffId} is not on the roster.`, gate: "active" },
      };
    }

    const evaluation = evaluate(
      referralFromRow(caseRow),
      [worker],
      readMatrix(tx as unknown as BetterSQLite3Database),
      config,
    );
    const candidate = evaluation.candidates[0];
    const failed = candidate?.blockedBy.find((gate) => gate !== "capacity");
    if (candidate && failed) {
      return {
        ok: false,
        rejection: {
          code: "gate_failed",
          message: `${worker.staffName} (${worker.staffId}) fails the ${failed} gate: ${candidate.gates[failed].detail}`,
          gate: failed,
        },
      };
    }

    // The cap is enforced by the UPDATE itself, not by a prior SELECT — that
    // is what makes two simultaneous commits safe.
    const consumed = tx
      .update(staff)
      .set({ currentFamiliesAssigned: sql`${staff.currentFamiliesAssigned} + 1` })
      .where(and(eq(staff.staffId, request.staffId), lt(staff.currentFamiliesAssigned, staff.maxFamiliesDcs)))
      .run();

    if (consumed.changes === 0) {
      const takenBy = tx
        .select({ messageId: commitments.messageId })
        .from(commitments)
        .where(eq(commitments.staffId, request.staffId))
        .all()
        .map((row) => row.messageId);
      return {
        ok: false,
        rejection: {
          code: "slot_taken",
          message:
            `${worker.staffName} (${worker.staffId}) is at the ${worker.maxFamiliesDcs}-family cap. ` +
            (takenBy.length > 0
              ? `Committed this session to: ${takenBy.join(", ")}.`
              : "The cap was already reached before this session."),
          takenBy,
        },
      };
    }

    tx.insert(commitments)
      .values({
        commitKey: request.commitKey,
        messageId: request.messageId,
        status: "assigned",
        staffId: request.staffId,
        committedBy: request.committedBy,
        committedAt,
      })
      .run();

    return {
      ok: true,
      idempotent: false,
      commitment: {
        commitKey: request.commitKey,
        messageId: request.messageId,
        status: "assigned",
        staffId: request.staffId,
        committedBy: request.committedBy,
        committedAt,
      },
    };
  });
}
