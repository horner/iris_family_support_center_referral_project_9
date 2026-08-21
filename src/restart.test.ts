/**
 * Restart durability — the one thing `":memory:"` can never catch.
 *
 * Every other DB test in this suite opens `":memory:"`, so the upsert in
 * `importReferenceData()` only ever runs its *insert* half. The default
 * database is a file (`src/paths.ts`), and `createIris()` re-imports the
 * reference data on every start, so in real use that upsert runs its *update*
 * half against a roster whose capacity counter has been moved by commitments.
 *
 * These tests open a real file, restart the server on it, and assert that a
 * consumed slot stays consumed.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { commit } from "./commit.ts";
import { createIris, type Iris } from "./server.ts";
import { readRoster, sync } from "./pipeline.ts";
import { referrals } from "./testing/fixtures.ts";
import type { EngineConfig } from "./model.ts";

const CONFIG: EngineConfig = { fairness: "balance", fairnessWeight: 1 };

let directory: string;
let file: string;
let iris: Iris;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "iris-restart-"));
  file = join(directory, "iris.db");
  iris = createIris({ file, config: CONFIG });
});

afterEach(() => {
  iris.close();
  rmSync(directory, { recursive: true, force: true });
});

/** Closes the server and opens a new one on the same file: a plain restart. */
const restart = () => {
  iris.close();
  iris = createIris({ file, config: CONFIG });
};

const seed = () => sync(iris.pipeline, referrals);

const queueRows = async () =>
  (await (await iris.app.request("/api/queue")).json()) as { messageId: string; referralId: string }[];

const worker = (staffId: string) => {
  const row = readRoster(iris.database.db).find((p) => p.staffId === staffId);
  if (!row) throw new Error(`${staffId} is not on the roster`);
  return row;
};

/** Commits every case the worker is eligible for, and reports what happened. */
const fill = (staffId: string, queue: { messageId: string }[], keyPrefix: string) => {
  let committed = 0;
  let blocked: string | undefined;
  for (const row of queue) {
    const result = commit(
      iris.database.db,
      { messageId: row.messageId, staffId, commitKey: `${keyPrefix}-${row.messageId}`, committedBy: "whitney" },
      CONFIG,
    );
    if (result.ok) committed += 1;
    else if (result.rejection.code === "slot_taken" && !blocked) blocked = row.messageId;
  }
  return { committed, blocked };
};

describe("restart durability", () => {
  it("keeps capacity consumed by commitments across a restart", async () => {
    await seed();
    const queue = await queueRows();

    // S028 Miles Hollis starts at 5/12 and is eligible for several fixture
    // cases, so the system's own assignments move him well inside the cap.
    const baseline = worker("S028").currentFamiliesAssigned;
    const { committed } = fill("S028", queue, "pre");

    expect(committed).toBeGreaterThan(0);
    expect(worker("S028").currentFamiliesAssigned).toBe(baseline + committed);

    restart();

    // The commitments ledger survived the restart, so the counter must too.
    expect(worker("S028").currentFamiliesAssigned).toBe(baseline + committed);
  });

  it("still refuses an over-cap assignment after a restart", async () => {
    await seed();
    const queue = await queueRows();

    // S020 Naomi Alvarez starts at 11/12: one real assignment puts her exactly
    // at the cap, and the next eligible case is rejected for want of a slot.
    const { blocked } = fill("S020", queue, "pre");
    expect(blocked).toBeDefined();
    expect(worker("S020").currentFamiliesAssigned).toBe(worker("S020").maxFamiliesDcs);

    restart();

    expect(worker("S020").currentFamiliesAssigned).toBe(worker("S020").maxFamiliesDcs);

    // The same case the server refused a moment ago must still be refused.
    const retry = commit(
      iris.database.db,
      { messageId: blocked as string, staffId: "S020", commitKey: "after-restart", committedBy: "dana" },
      CONFIG,
    );

    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.rejection.code).toBe("slot_taken");
  });
});
