import { describe, expect, it } from "vitest";
import { evaluate, qualifiedIgnoringCapacity } from "./engine.ts";
import { HOURS_UNKNOWN, type EngineConfig, type Referral, type Staff } from "./model.ts";
import { matrix, person, referral, referrals, roster } from "./testing/fixtures.ts";

const BALANCED: EngineConfig = { fairness: "balance", fairnessWeight: 1 };
const OFF: EngineConfig = { fairness: "off", fairnessWeight: 0 };
const BALANCE_FIRST: EngineConfig = { fairness: "balance-first", fairnessWeight: 1 };

const candidate = (staffId: string, evaluation: ReturnType<typeof evaluate>) => {
  const found = evaluation.candidates.find((c) => c.staffId === staffId);
  if (!found) throw new Error(`${staffId} missing from the evaluation`);
  return found;
};

describe("evaluate", () => {
  it("scores every staff member for every referral, blocked ones included", () => {
    for (const item of referrals) {
      const evaluation = evaluate(item, roster, matrix, BALANCED);
      expect(evaluation.candidates).toHaveLength(roster.length);
      expect(roster).toHaveLength(38);
    }
  });

  it("blocks S001 on the active gate alone when every other gate passes", () => {
    // R770014 is Supervised Visitation Paraprofessional in Wabash: S001's role,
    // education and county all clear, so only the inactive flag is left.
    const evaluation = evaluate(referral("R770014"), roster, matrix, BALANCED);
    const casey = candidate("S001", evaluation);

    expect(casey.blockedBy).toEqual(["active"]);
    expect(casey.eligible).toBe(false);
    expect(casey.gates.active.detail).toBe("Inactive on the roster");
  });

  it("blocks a full caseload on capacity and says how full", () => {
    const evaluation = evaluate(referral("R770006"), roster, matrix, BALANCED);
    const priya = candidate("S003", evaluation);

    expect(person("S003").currentFamiliesAssigned).toBe(12);
    expect(priya.blockedBy).toEqual(["capacity"]);
    expect(priya.gates.capacity.detail).toBe("12 of 12 families — at the DCS cap");
  });

  it("blocks S006 on capacity even though the roster says 13 of 12", () => {
    const evaluation = evaluate(referral("R770003"), roster, matrix, BALANCED);
    const ibrahim = candidate("S006", evaluation);

    expect(person("S006").currentFamiliesAssigned).toBe(13);
    expect(ibrahim.blockedBy).toContain("capacity");
    expect(ibrahim.gates.capacity.detail).toBe("13 of 12 families — at the DCS cap");
  });

  it("accepts both roles the matrix allows for FCT", () => {
    const evaluation = evaluate(referral("R770010"), roster, matrix, BALANCED);
    const roles = evaluation.candidates
      .filter((c) => c.gates.role.pass)
      .map((c) => person(c.staffId).role);

    expect(new Set(roles)).toEqual(new Set(["Clinician II", "Family Engagement Specialist 2"]));
  });

  it("explains a role rejection by naming the roles the service does allow", () => {
    const evaluation = evaluate(referral("R770010"), roster, matrix, BALANCED);
    const casey = candidate("S001", evaluation);

    expect(casey.gates.role.pass).toBe(false);
    expect(casey.gates.role.detail).toBe(
      "Family Engagement Specialist 1 is not eligible for FCT (needs Clinician II or Family Engagement Specialist 2)",
    );
  });

  it("names the counties a blocked worker does cover", () => {
    const evaluation = evaluate(referral("R770003"), roster, matrix, BALANCED);
    const renee = candidate("S005", evaluation);

    expect(renee.gates.county.pass).toBe(false);
    expect(renee.gates.county.detail).toBe("Does not serve Adams (covers Kosciusko)");
  });

  it("scores a language preference up without ever blocking on it", () => {
    const spanish: Referral = {
      ...referral("R770014"),
      preferences: { bilingual: true, language: "Spanish" },
    };
    const evaluation = evaluate(spanish, roster, matrix, OFF);
    const bilingual = evaluation.candidates.filter((c) => person(c.staffId).languages.includes("Spanish"));
    const englishOnly = evaluation.candidates.filter((c) => !person(c.staffId).languages.includes("Spanish"));

    expect(bilingual.every((c) => c.score.language > 0)).toBe(true);
    expect(englishOnly.every((c) => c.score.language === 0)).toBe(true);
    // A preference is a preference: nobody is disqualified for missing it.
    expect(englishOnly.some((c) => c.eligible)).toBe(true);
  });

  it("lets the fairness policy, and only the fairness policy, override a preference match", () => {
    const busyBilingual: Staff = {
      ...person("S007"),
      staffId: "S900",
      staffName: "Busy Bilingual",
      languages: ["English", "Spanish"],
      currentFamiliesAssigned: 11,
    };
    const freeEnglish: Staff = {
      ...person("S007"),
      staffId: "S901",
      staffName: "Free English",
      languages: ["English"],
      currentFamiliesAssigned: 0,
    };
    const pair = [busyBilingual, freeEnglish];
    const spanish: Referral = {
      ...referral("R770010"),
      county: "Allen",
      preferences: { bilingual: true, language: "Spanish" },
    };

    const preferenceWins = evaluate(spanish, pair, matrix, OFF).candidates[0];
    const fairnessWins = evaluate(spanish, pair, matrix, BALANCE_FIRST).candidates[0];

    expect(preferenceWins?.staffId).toBe("S900");
    expect(fairnessWins?.staffId).toBe("S901");
  });

  it("flags the judgment-call services for a supervisor and leaves everything else alone", () => {
    expect(evaluate(referral("R770000"), roster, matrix, BALANCED).requiresSupervisorJudgment).toBe(true);
    expect(evaluate(referral("R770015"), roster, matrix, BALANCED).requiresSupervisorJudgment).toBe(true);
    expect(evaluate(referral("R770010"), roster, matrix, BALANCED).requiresSupervisorJudgment).toBe(false);
  });

  it("states the hours gap on every single evaluation", () => {
    for (const item of referrals) {
      expect(evaluate(item, roster, matrix, BALANCED).unknowns).toContain(HOURS_UNKNOWN);
    }
  });

  it("separates a staffing gap from a scheduling gap", () => {
    const evaluation = evaluate(referral("R770006"), roster, matrix, BALANCED);
    const qualified = qualifiedIgnoringCapacity(evaluation);

    // Somebody is qualified for R770006; whether anyone is free is a separate question.
    expect(qualified.length).toBeGreaterThan(0);
    expect(qualified.length).toBeGreaterThanOrEqual(evaluation.candidates.filter((c) => c.eligible).length);
  });

  it("ranks deterministically, breaking ties on staff id", () => {
    const evaluation = evaluate(referral("R770010"), roster, matrix, BALANCED);
    const again = evaluate(referral("R770010"), roster, matrix, BALANCED);

    expect(evaluation.candidates.map((c) => c.staffId)).toEqual(again.candidates.map((c) => c.staffId));

    const eligible = evaluation.candidates.filter((c) => c.eligible);
    const ordered = [...eligible].sort(
      (a, b) => b.score.total - a.score.total || a.staffId.localeCompare(b.staffId),
    );
    expect(eligible.map((c) => c.staffId)).toEqual(ordered.map((c) => c.staffId));
  });
});
