/**
 * The regression suite: eligibility across all 30 referrals, snapshotted.
 *
 * Any change to a gate, the roster or the service matrix moves these numbers.
 * The snapshot is not a correctness proof — it is a tripwire that forces a
 * human to look at what changed and say whether it was intended.
 */
import { describe, expect, it } from "vitest";
import { evaluate, qualifiedIgnoringCapacity } from "./engine.ts";
import type { EngineConfig } from "./model.ts";
import { matrix, referrals, roster } from "./testing/fixtures.ts";

const BALANCED: EngineConfig = { fairness: "balance", fairnessWeight: 1 };

describe("eligibility across the whole inbox", () => {
  it("matches the recorded per-referral counts", () => {
    const summary = referrals.map((referral) => {
      const evaluation = evaluate(referral, roster, matrix, BALANCED);
      const qualified = qualifiedIgnoringCapacity(evaluation);
      const eligible = evaluation.candidates.filter((c) => c.eligible);
      return {
        referralId: referral.referralId,
        service: referral.service,
        county: referral.county,
        // Qualified but full = a scheduling gap; qualified 0 = a staffing gap.
        qualified: qualified.length,
        eligible: eligible.length,
        judgment: evaluation.requiresSupervisorJudgment,
      };
    });

    expect(summary).toMatchSnapshot();
  });

  it("never reports more eligible than qualified candidates", () => {
    for (const referral of referrals) {
      const evaluation = evaluate(referral, roster, matrix, BALANCED);
      expect(evaluation.candidates.filter((c) => c.eligible).length).toBeLessThanOrEqual(
        qualifiedIgnoringCapacity(evaluation).length,
      );
    }
  });
});
