import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { commit } from "./commit.ts";
import { createIris, type Iris } from "./server.ts";
import { readRoster, replan, sync } from "./pipeline.ts";
import { referrals } from "./testing/fixtures.ts";
import type { EngineConfig } from "./model.ts";

const CONFIG: EngineConfig = { fairness: "balance", fairnessWeight: 1 };

let iris: Iris;

/** Seeds from the JSON fixture rather than Mailpit, so the suite is hermetic. */
const seed = () => sync(iris.pipeline, referrals);

beforeEach(() => {
  iris = createIris({ file: ":memory:", config: CONFIG });
});

const post = (path: string, body: unknown) =>
  iris.app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const matchedCase = async () => {
  const result = await seed();
  const match = result.plan.allocations.find((a) => a.outcome === "match");
  if (!match) throw new Error("expected at least one match in the seeded plan");
  const queue = (await (await iris.app.request("/api/queue")).json()) as {
    messageId: string;
    referralId: string;
  }[];
  const row = queue.find((q) => q.referralId === match.referralId);
  if (!row) throw new Error(`no queue row for ${match.referralId}`);
  return { messageId: row.messageId, staffId: match.assignedStaffId as string };
};

describe("pipeline", () => {
  it("turns 30 emails into 30 planned cases", async () => {
    const result = await seed();

    expect(result.created).toBe(30);
    expect(result.plan.allocations).toHaveLength(30);

    const queue = (await (await iris.app.request("/api/queue")).json()) as unknown[];
    expect(queue).toHaveLength(30);
  });

  it("creates no duplicates when the same mail is synced twice", async () => {
    await seed();
    const again = await seed();

    expect(again.created).toBe(0);
    expect((await (await iris.app.request("/api/queue")).json()).length).toBe(30);
  });

  it("projects the planner's rationale into SQL, not just into the document", async () => {
    await seed();
    const queue = (await (await iris.app.request("/api/queue")).json()) as {
      status: string;
      rationale: string[] | null;
      unknowns: string[] | null;
    }[];
    const proposed = queue.filter((row) => row.status === "proposed");

    expect(proposed.length).toBeGreaterThan(0);
    expect(proposed[0]?.rationale?.length).toBeGreaterThan(0);
    // The 20-hour gap travels all the way to the reporting layer.
    expect(queue.every((row) => (row.unknowns ?? []).some((u) => u.includes("20-hour")))).toBe(true);
  });

  it("answers a what-if without touching stored state", async () => {
    await seed();
    const before = readRoster(iris.database.db);

    const response = await post("/api/plan/scenario", {
      pins: [{ referralId: "R770010", staffId: "S007" }],
    });
    const hypothetical = (await response.json()) as {
      allocations: { referralId: string; assignedStaffId?: string; pinned: boolean }[];
    };

    expect(hypothetical.allocations.find((a) => a.referralId === "R770010")?.assignedStaffId).toBe("S007");
    expect(readRoster(iris.database.db)).toEqual(before);

    const queue = (await (await iris.app.request("/api/queue")).json()) as { status: string }[];
    expect(queue.every((row) => row.status !== "assigned")).toBe(true);
  });
});

describe("commitment", () => {
  it("consumes exactly one slot and pins the case", async () => {
    const { messageId, staffId } = await matchedCase();
    const before = readRoster(iris.database.db).find((p) => p.staffId === staffId);

    const response = await post("/api/assignments", {
      messageId,
      staffId,
      commitKey: "key-1",
      committedBy: "whitney",
    });

    expect(response.status).toBe(200);
    const after = readRoster(iris.database.db).find((p) => p.staffId === staffId);
    expect(after?.currentFamiliesAssigned).toBe((before?.currentFamiliesAssigned ?? 0) + 1);

    const queue = (await (await iris.app.request("/api/queue")).json()) as {
      messageId: string;
      status: string;
      committedStaffId: string | null;
    }[];
    const row = queue.find((q) => q.messageId === messageId);
    expect(row?.status).toBe("assigned");
    expect(row?.committedStaffId).toBe(staffId);
  });

  it("is idempotent: the same key twice consumes one slot", async () => {
    const { messageId, staffId } = await matchedCase();
    const before = readRoster(iris.database.db).find((p) => p.staffId === staffId);
    const body = { messageId, staffId, commitKey: "retry-me", committedBy: "whitney" };

    const first = (await (await post("/api/assignments", body)).json()) as {
      ok: boolean;
      idempotent: boolean;
      commitment: unknown;
    };
    const second = (await (await post("/api/assignments", body)).json()) as typeof first;

    expect(first.ok).toBe(true);
    expect(first.idempotent).toBe(false);
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(second.commitment).toEqual(first.commitment);

    const after = readRoster(iris.database.db).find((p) => p.staffId === staffId);
    expect(after?.currentFamiliesAssigned).toBe((before?.currentFamiliesAssigned ?? 0) + 1);
  });

  it("rejects a second commitment of the same case by name", async () => {
    const { messageId, staffId } = await matchedCase();
    await post("/api/assignments", { messageId, staffId, commitKey: "k1", committedBy: "whitney" });

    const response = await post("/api/assignments", {
      messageId,
      staffId,
      commitKey: "k2",
      committedBy: "dana",
    });
    const body = (await response.json()) as { rejection: { code: string; message: string } };

    expect(response.status).toBe(409);
    expect(body.rejection.code).toBe("already_committed");
    expect(body.rejection.message).toContain("whitney");
  });

  it("lets exactly one of two simultaneous commits take the last slot", async () => {
    await seed();
    const queue = (await (await iris.app.request("/api/queue")).json()) as {
      messageId: string;
      referralId: string;
      county: string;
      service: string;
    }[];

    // R770007 and R770008 are both Home-Based Therapy in Whitley: two real
    // referrals that genuinely compete for the same worker.
    const first = queue.find((row) => row.referralId === "R770007");
    const second = queue.find((row) => row.referralId === "R770008");
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    // Squeeze the roster down to a single free slot. S002 is a Master's-level
    // Clinician 1, so she qualifies for Home-Based Therapy; give her Whitley.
    iris.database.db.run(sql`UPDATE staff SET current_families_assigned = max_families_dcs`);
    iris.database.db.run(
      sql`UPDATE staff
          SET current_families_assigned = max_families_dcs - 1,
              counties_served = '["Whitley"]'
          WHERE staff_id = 'S002'`,
    );

    const requests = [
      { messageId: first!.messageId, staffId: "S002", commitKey: "race-a", committedBy: "whitney" },
      { messageId: second!.messageId, staffId: "S002", commitKey: "race-b", committedBy: "dana" },
    ];
    // Both clients believe the slot is free; the transaction decides.
    const results = requests.map((request) => commit(iris.database.db, request, CONFIG));

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok);
    expect(loser?.ok).toBe(false);
    if (loser && !loser.ok) {
      expect(loser.rejection.code).toBe("slot_taken");
      expect(loser.rejection.message).toContain("S002");
    }

    const worker = readRoster(iris.database.db).find((p) => p.staffId === "S002");
    expect(worker!.currentFamiliesAssigned).toBe(worker!.maxFamiliesDcs);
  });

  it("re-checks the gates and refuses a stale client's ineligible pick", async () => {
    const { messageId } = await matchedCase();

    const result = commit(
      iris.database.db,
      { messageId, staffId: "S001", commitKey: "stale", committedBy: "whitney" },
      CONFIG,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.code).toBe("gate_failed");
      expect(result.rejection.message).toContain("S001");
    }
  });

  it("records a decline without consuming capacity, and reports it in the KPI", async () => {
    const { messageId } = await matchedCase();
    const before = readRoster(iris.database.db);

    const response = await post("/api/declines", {
      messageId,
      commitKey: "decline-1",
      committedBy: "whitney",
      declineReason: "No provider with capacity in county",
    });

    expect(response.status).toBe(200);
    expect(readRoster(iris.database.db)).toEqual(before);

    const kpi = (await (await iris.app.request("/api/kpi")).json()) as {
      declines: { week: string; service: string; declines: number }[];
    };
    expect(kpi.declines).toHaveLength(1);
    expect(kpi.declines[0]?.declines).toBe(1);
  });

  it("replans the rest of the queue around a commitment", async () => {
    const { messageId, staffId } = await matchedCase();

    const response = await post("/api/assignments", {
      messageId,
      staffId,
      commitKey: "pin-me",
      committedBy: "whitney",
    });
    const body = (await response.json()) as {
      plan: { allocations: { referralId: string; pinned: boolean; assignedStaffId?: string }[] };
    };

    const pinned = body.plan.allocations.filter((a) => a.pinned);
    expect(pinned).toHaveLength(1);
    expect(pinned[0]?.assignedStaffId).toBe(staffId);

    // And the pin survives a plain replan.
    const again = await replan(iris.pipeline);
    expect(again.allocations.filter((a) => a.pinned)).toHaveLength(1);
  });
});
