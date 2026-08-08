import { createYorm, memoryRuntime } from "@yorm/yjs";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { CaseDoc } from "../case-doc.ts";
import type { Referral } from "../model.ts";
import { createDatabase } from "./index.ts";
import { importReferenceData } from "./import.ts";
import { caseMapping } from "./mapping.ts";

const referral: Referral = {
  messageId: "kidtraks-880000@dcs.in.gov",
  receivedAt: "2026-07-31T12:55",
  subject: "New Service Referral - FCT - Case DCS-2026-4100",
  caseNumber: "DCS-2026-4100",
  referralId: "R770000",
  service: "FCT",
  county: "Whitley",
  region: "Region 4",
  fcmName: "Ellsworth",
  fcmPhone: "260-555-1933",
  requestedStartDate: "2026-08-07",
  childrenInHome: 4,
  notes: "Permanency hearing scheduled in 12 days, expedite if possible.",
  preferences: { expedite: true },
  rawBody: "…",
  parseWarnings: [],
};

const doc: CaseDoc = {
  messageId: referral.messageId,
  referral,
  evaluation: {
    referral,
    candidates: [],
    unknowns: ["hours are not reportable"],
    requiresSupervisorJudgment: false,
  },
  proposal: {
    staffId: "S031",
    outcome: "match",
    rationale: ["eligible and has headroom"],
    contendedWith: ["R770012"],
    runnersUp: [{ staffId: "S037", reason: "less headroom" }],
  },
  notes: [],
  commitment: null,
  needsReDecision: null,
};

async function project(caseDoc: CaseDoc) {
  const database = createDatabase(":memory:");
  // The projection carries foreign keys into `staff`, so the roster has to exist.
  importReferenceData(database.db);
  const yorm = createYorm({
    runtime: memoryRuntime(),
    documents: database.adapter.documents,
    projections: database.adapter.projections,
    mappings: [caseMapping],
  });
  const session = await yorm.open("Case", caseDoc.messageId);
  await session.write(caseDoc);
  await session.write(caseDoc);
  session.close();
  const rows = {
    cases: database.db.all<Record<string, unknown>>(sql`SELECT * FROM cases`),
    decisions: database.db.all<Record<string, unknown>>(sql`SELECT * FROM case_decisions`),
  };
  database.close();
  return rows;
}

describe("iris.Case mapping", () => {
  it("projects a case document into cases + case_decisions", async () => {
    const rows = await project(doc);
    expect(rows.cases).toHaveLength(1);
    expect(rows.cases[0]).toMatchObject({
      message_id: "kidtraks-880000@dcs.in.gov",
      referral_id: "R770000",
      service: "FCT",
      county: "Whitley",
      status: "proposed",
      proposed_staff_id: "S031",
      committed_staff_id: null,
    });
    expect(rows.decisions[0]).toMatchObject({
      message_id: "kidtraks-880000@dcs.in.gov",
      outcome: "match",
      requires_supervisor_judgment: 0,
    });
    expect(JSON.parse(String(rows.decisions[0]?.["contended_with"]))).toEqual(["R770012"]);
  });

  it("is idempotent — projecting twice leaves one row", async () => {
    const rows = await project(doc);
    expect(rows.cases).toHaveLength(1);
    expect(rows.decisions).toHaveLength(1);
  });

  it("reports a committed case as assigned, with the server-owned block", async () => {
    const rows = await project({
      ...doc,
      commitment: {
        status: "assigned",
        staffId: "S031",
        committedBy: "whitney",
        committedAt: "2026-08-01T09:00:00.000Z",
        commitKey: "key-1",
      },
    });
    expect(rows.cases[0]).toMatchObject({
      status: "assigned",
      committed_staff_id: "S031",
      committed_by: "whitney",
      commit_key: "key-1",
    });
  });
});
