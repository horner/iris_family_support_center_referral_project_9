import { describe, expect, it } from "vitest";
import { plan, recommend, referralKey } from "./planner.ts";
import type { EngineConfig, Referral, ServiceMatrix, Staff } from "./model.ts";
import { matrix, person, referral, referrals, roster } from "./testing/fixtures.ts";

const BALANCED: EngineConfig = { fairness: "balance", fairnessWeight: 1 };
const OFF: EngineConfig = { fairness: "off", fairnessWeight: 0 };
const BALANCE_FIRST: EngineConfig = { fairness: "balance-first", fairnessWeight: 1 };

const allocationFor = (result: ReturnType<typeof plan>, referralId: string) => {
  const found = result.allocations.find((a) => a.referralId === referralId);
  if (!found) throw new Error(`No allocation for ${referralId}`);
  return found;
};

/** A referral cloned onto a new id, so a test can create real contention. */
const clone = (source: Referral, referralId: string, requestedStartDate?: string): Referral => ({
  ...source,
  referralId,
  messageId: `<${referralId}@test>`,
  ...(requestedStartDate === undefined ? {} : { requestedStartDate }),
});

const withSlots = (source: Staff, staffId: string, slots: number): Staff => ({
  ...source,
  staffId,
  staffName: `${staffId} test`,
  maxFamiliesDcs: 12,
  currentFamiliesAssigned: 12 - slots,
});

describe("plan", () => {
  it("spends a shared capacity budget: two slots take two referrals, not five", () => {
    const source = referral("R770010"); // FCT in Kosciusko
    const only = [withSlots(person("S007"), "S900", 2)];
    const queue = [0, 1, 2, 3, 4].map((n) => clone(source, `R90000${n}`));

    const result = plan(queue, only, matrix, BALANCED);
    const assigned = result.allocations.filter((a) => a.assignedStaffId === "S900");

    expect(assigned).toHaveLength(2);
    expect(result.unassigned).toHaveLength(3);
  });

  it("surfaces contention by name instead of reporting a bare 'no capacity'", () => {
    const source = referral("R770010");
    const only = [withSlots(person("S007"), "S900", 1)];
    const queue = [clone(source, "R900010"), clone(source, "R900011")];

    const result = plan(queue, only, matrix, BALANCED);
    const outcomes = result.allocations.map((a) => a.outcome).sort();

    expect(outcomes).toEqual(["match", "no_capacity"]);

    const loser = result.allocations.find((a) => a.outcome === "no_capacity");
    const winner = result.allocations.find((a) => a.outcome === "match");
    expect(loser?.rationale.join(" ")).toContain("S900");
    expect(loser?.rationale.join(" ")).toContain(winner?.referralId ?? "");
    expect(loser?.contendedWith).toEqual([winner?.referralId]);

    expect(result.contention).toEqual([{ staffId: "S900", slots: 1, wantedBy: ["R900010", "R900011"] }]);
  });

  it("places the scarce referral first even when it arrives second", () => {
    // Both referrals can use S900; only the second can *also* use nobody else.
    const fct = referral("R770010"); // Kosciusko
    const generalist = withSlots(person("S007"), "S900", 1); // Allen|Kosciusko
    const specialist = withSlots(person("S007"), "S901", 1); // same counties
    const roomy = clone(fct, "R900020", "2026-01-01");
    const scarce: Referral = { ...clone(fct, "R900021", "2026-06-01"), county: "Allen" };

    const restricted: Staff[] = [
      { ...generalist, countiesServed: ["Kosciusko", "Allen"] },
      { ...specialist, countiesServed: ["Kosciusko"] },
    ];

    const result = plan([roomy, scarce], restricted, matrix, BALANCED);

    // The Allen referral has exactly one option, so it must get S900.
    expect(allocationFor(result, "R900021").assignedStaffId).toBe("S900");
    expect(allocationFor(result, "R900020").assignedStaffId).toBe("S901");
  });

  it("places at least as many referrals as arrival-order greedy on the real 30", () => {
    const scarcityFirst = plan(referrals, roster, matrix, BALANCED);
    const matched = scarcityFirst.allocations.filter((a) => a.outcome === "match").length;

    // Arrival order, one referral at a time, capacity spent as it goes.
    const budget = new Map(roster.map((p) => [p.staffId, Math.max(0, p.maxFamiliesDcs - p.currentFamiliesAssigned)]));
    let greedy = 0;
    for (const item of referrals) {
      const one = plan(
        [item],
        roster.map((p) => ({ ...p, currentFamiliesAssigned: p.maxFamiliesDcs - (budget.get(p.staffId) ?? 0) })),
        matrix,
        BALANCED,
      );
      const chosen = one.allocations[0]?.assignedStaffId;
      if (chosen) {
        greedy += 1;
        budget.set(chosen, (budget.get(chosen) ?? 0) - 1);
      }
    }

    expect(matched).toBeGreaterThanOrEqual(greedy);
  });

  it("honours a pin to a non-optimal worker and plans the rest around it", () => {
    const source = referral("R770010");
    const best = withSlots(person("S007"), "S900", 1);
    const worse = { ...withSlots(person("S007"), "S901", 1), languages: ["English"] };
    const queue = [
      { ...clone(source, "R900030"), preferences: { bilingual: true, language: "Spanish" } },
      clone(source, "R900031"),
    ];
    const pair: Staff[] = [{ ...best, languages: ["English", "Spanish"] }, worse];

    const free = plan(queue, pair, matrix, OFF);
    expect(allocationFor(free, "R900030").assignedStaffId).toBe("S900");

    const pinned = plan(queue, pair, matrix, OFF, [{ referralId: "R900030", staffId: "S901" }]);
    const pinnedAllocation = allocationFor(pinned, "R900030");

    expect(pinnedAllocation.assignedStaffId).toBe("S901");
    expect(pinnedAllocation.pinned).toBe(true);
    // The rest replans around the pin rather than fighting it.
    expect(allocationFor(pinned, "R900031").assignedStaffId).toBe("S900");
  });

  it("treats a declined pin as settled and consuming nothing", () => {
    const source = referral("R770010");
    const only = [withSlots(person("S007"), "S900", 1)];
    const queue = [clone(source, "R900040"), clone(source, "R900041")];

    const result = plan(queue, only, matrix, BALANCED, [{ referralId: "R900040" }]);

    expect(allocationFor(result, "R900040").outcome).toBe("declined");
    expect(allocationFor(result, "R900040").pinned).toBe(true);
    // The declined case freed nothing and consumed nothing: the slot is still there.
    expect(allocationFor(result, "R900041").assignedStaffId).toBe("S900");
  });

  it("runs scenarios without mutating the roster or the referrals", () => {
    const before = JSON.stringify({ roster, referrals });
    const baseline = plan(referrals, roster, matrix, BALANCED);
    const scenario = plan(referrals, roster, matrix, BALANCED, [{ referralId: "R770010", staffId: "S007" }]);

    expect(JSON.stringify({ roster, referrals })).toBe(before);
    expect(allocationFor(scenario, "R770010").assignedStaffId).toBe("S007");
    // And the baseline is untouched by having asked the question.
    expect(plan(referrals, roster, matrix, BALANCED)).toEqual(baseline);
  });

  it("is deterministic", () => {
    expect(plan(referrals, roster, matrix, BALANCED)).toEqual(plan(referrals, roster, matrix, BALANCED));
  });

  it("levels the peak caseload when fairness is on, and admits it is a tradeoff", () => {
    // "Distinct workers" is the wrong yardstick — a policy can spread across
    // many people and still push one of them to the cap. What fairness buys is
    // a lower *peak* utilisation, which is what burns a worker out.
    const peakUtilisation = (config: EngineConfig): number => {
      const result = plan(referrals, roster, matrix, config);
      const extra = new Map<string, number>();
      for (const allocation of result.allocations) {
        if (!allocation.assignedStaffId) continue;
        extra.set(allocation.assignedStaffId, (extra.get(allocation.assignedStaffId) ?? 0) + 1);
      }
      return Math.max(
        // Only workers this plan touched: S006 is already 13/12 in the source
        // data and no policy can fix that by handing her nothing.
        ...roster
          .filter((p) => extra.has(p.staffId))
          .map((p) => (p.currentFamiliesAssigned + (extra.get(p.staffId) ?? 0)) / p.maxFamiliesDcs),
      );
    };

    const off = peakUtilisation(OFF);
    expect(peakUtilisation(BALANCE_FIRST)).toBeLessThan(off);
    expect(peakUtilisation(BALANCED)).toBeLessThanOrEqual(off);
  });

  it("places the same number of referrals whichever fairness policy is chosen", () => {
    // Fairness changes *who*, not *how many* — the hard gates do the excluding.
    const matched = (config: EngineConfig): number =>
      plan(referrals, roster, matrix, config).allocations.filter((a) => a.outcome === "match").length;

    expect(matched(BALANCE_FIRST)).toBe(matched(OFF));
    expect(matched(BALANCED)).toBe(matched(OFF));
  });

  it("calls a full-but-qualified roster a scheduling gap and names who was full", () => {
    const full = [{ ...person("S007"), staffId: "S900", currentFamiliesAssigned: 12 }];
    const result = plan([referral("R770010")], full, matrix, BALANCED);
    const allocation = allocationFor(result, "R770010");

    expect(allocation.outcome).toBe("no_capacity");
    expect(allocation.rationale[0]).toContain("Scheduling gap");
    expect(allocation.rationale.join(" ")).toContain("S900");
  });

  it("calls an uncovered service+county a staffing gap", () => {
    const result = plan(
      [{ ...referral("R770010"), county: "Nowhere" }],
      roster,
      matrix,
      BALANCED,
    );
    const allocation = result.allocations[0];

    expect(allocation?.outcome).toBe("no_eligible_staff");
    expect(allocation?.rationale[0]).toContain("Staffing gap");
  });

  it("elects nobody for a judgment-call service but still shows the candidates", () => {
    const insurance = referral("R770000");
    const anyone: Staff[] = [
      { ...person("S007"), staffId: "S900", countiesServed: ["Whitley"], currentFamiliesAssigned: 0 },
    ];
    const workable: ServiceMatrix = new Map(matrix);
    workable.set("Insurance/Medicaid Referrals", {
      service: "Insurance/Medicaid Referrals",
      minimumEducation: ["HS Diploma/GED"],
      eligibleRoles: [person("S007").role],
    });

    const allocation = recommend(insurance, anyone, workable, BALANCED);

    expect(allocation.outcome).toBe("needs_judgment");
    expect(allocation.assignedStaffId).toBeUndefined();
    expect(allocation.requiresSupervisorJudgment).toBe(true);
    expect(allocation.runnersUp.map((r) => r.staffId)).toContain("S900");
  });

  it("gives recommend() and plan() the same answer for a single case", () => {
    const one = referral("R770005");
    expect(recommend(one, roster, matrix, BALANCED)).toEqual(
      plan([one], roster, matrix, BALANCED).allocations[0],
    );
    expect(referralKey(one)).toBe("R770005");
  });

  it("matches the recorded outcome distribution across all 30 referrals", () => {
    const result = plan(referrals, roster, matrix, BALANCED);
    const distribution: Record<string, number> = {};
    for (const allocation of result.allocations) {
      distribution[allocation.outcome] = (distribution[allocation.outcome] ?? 0) + 1;
    }

    expect({
      distribution,
      contendedStaff: result.contention.map((c) => `${c.staffId} ${c.slots} slot(s), wanted by ${c.wantedBy.length}`),
      assignments: result.allocations
        .filter((a) => a.assignedStaffId)
        .map((a) => `${a.referralId} -> ${a.assignedStaffId}`),
    }).toMatchSnapshot();
  });
});
