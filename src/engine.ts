/**
 * `evaluate()` — the complete assessment of **every** staff member for one
 * referral. Pure: no I/O, no persistence, no selection.
 *
 * It elects nobody on purpose (docs/ARCHITECTURE.md, decision 2). Choosing is
 * `planner.ts`'s job, because capacity is a budget shared across the whole
 * pending queue. Returning every candidate — blocked ones included, each with
 * the reason — is what lets the UI answer "why not her?" without re-deriving a
 * single gate client-side.
 */
import {
  EDUCATION_LEVELS,
  HOURS_UNKNOWN,
  JUDGMENT_CALL_SERVICES,
  type CandidateEvaluation,
  type CandidateScore,
  type Education,
  type EngineConfig,
  type Evaluation,
  type GateName,
  type GateResult,
  type Referral,
  type ServiceMatrix,
  type ServiceRule,
  type Staff,
} from "./model.ts";

/** A language match is worth more than a single availability match. */
const LANGUAGE_WEIGHT = 2;
const AVAILABILITY_WEIGHT = 1;
/** Under `balance-first`, headroom dominates and preferences only break ties. */
const BALANCE_FIRST_WEIGHT = 100;

const educationRank = (education: Education): number => EDUCATION_LEVELS.indexOf(education);

/** An "or" minimum passes if any listed level is met, i.e. against the lowest of them. */
function meetsEducation(staffEducation: Education, minimum: Education[]): boolean {
  if (minimum.length === 0) return true;
  return minimum.some((level) => educationRank(staffEducation) >= educationRank(level));
}

function activeGate(person: Staff): GateResult {
  return person.active
    ? { pass: true, detail: "Active on the roster" }
    : { pass: false, detail: "Inactive on the roster" };
}

function roleGate(person: Staff, service: string | undefined, rule: ServiceRule | undefined): GateResult {
  if (service === undefined) {
    return { pass: false, detail: "The referral did not name a service" };
  }
  if (!rule) {
    return { pass: false, detail: `"${service}" is not in the service role matrix` };
  }
  if (!rule.eligibleRoles.includes(person.role)) {
    return {
      pass: false,
      detail: `${person.role} is not eligible for ${service} (needs ${rule.eligibleRoles.join(" or ")})`,
    };
  }
  if (!meetsEducation(person.education, rule.minimumEducation)) {
    return {
      pass: false,
      detail: `${person.education} does not meet the minimum education for ${service} (${rule.minimumEducation.join(" or ")})`,
    };
  }
  return {
    pass: true,
    detail: `${person.role} is eligible for ${service}; ${person.education} meets the minimum (${rule.minimumEducation.join(" or ")})`,
  };
}

function countyGate(person: Staff, county: string | undefined): GateResult {
  if (county === undefined) {
    return { pass: false, detail: "The referral did not name a county" };
  }
  return person.countiesServed.includes(county)
    ? { pass: true, detail: `Serves ${county}` }
    : {
        pass: false,
        detail: `Does not serve ${county} (covers ${person.countiesServed.join(", ")})`,
      };
}

/** The 12-family DCS cap — the only capacity rule the data can actually measure. */
function capacityGate(person: Staff): GateResult {
  const headroom = person.maxFamiliesDcs - person.currentFamiliesAssigned;
  return headroom > 0
    ? {
        pass: true,
        detail: `${person.currentFamiliesAssigned} of ${person.maxFamiliesDcs} families — ${headroom} slot${headroom === 1 ? "" : "s"} free`,
      }
    : {
        pass: false,
        detail: `${person.currentFamiliesAssigned} of ${person.maxFamiliesDcs} families — at the DCS cap`,
      };
}

/**
 * The fairness term, as a function of *remaining* headroom. The planner calls
 * it with headroom that shrinks as the run allocates, so "spread the work"
 * actually spreads it instead of piling the whole queue on the emptiest desk.
 */
export function fairnessScore(remaining: number, max: number, config: EngineConfig): number {
  if (config.fairness === "off" || max <= 0) return 0;
  const ratio = Math.max(0, remaining) / max;
  return config.fairness === "balance-first" ? ratio * BALANCE_FIRST_WEIGHT : ratio * config.fairnessWeight;
}

function scoreCandidate(
  person: Staff,
  referral: Referral,
  config: EngineConfig,
): CandidateScore {
  const wanted = referral.preferences.language ?? (referral.preferences.bilingual ? "Spanish" : undefined);
  const language = wanted !== undefined && person.languages.includes(wanted) ? LANGUAGE_WEIGHT : 0;

  const requested = referral.preferences.availability ?? [];
  const matched = requested.filter((slot) => person.availability.includes(slot)).length;
  const availability = matched * AVAILABILITY_WEIGHT;

  const fairness = fairnessScore(
    person.maxFamiliesDcs - person.currentFamiliesAssigned,
    person.maxFamiliesDcs,
    config,
  );

  return { language, availability, fairness, total: language + availability + fairness };
}

/** Ranked: eligible first by score, blocked after — visible, never hidden. */
function rank(a: CandidateEvaluation, b: CandidateEvaluation): number {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (a.eligible && b.eligible && a.score.total !== b.score.total) {
    return b.score.total - a.score.total;
  }
  return a.staffId.localeCompare(b.staffId);
}

export function evaluate(
  referral: Referral,
  roster: Staff[],
  matrix: ServiceMatrix,
  config: EngineConfig,
): Evaluation {
  const rule = referral.service === undefined ? undefined : matrix.get(referral.service);

  const candidates = roster
    .map((person) => {
      const gates: Record<GateName, GateResult> = {
        active: activeGate(person),
        role: roleGate(person, referral.service, rule),
        county: countyGate(person, referral.county),
        capacity: capacityGate(person),
      };
      const blockedBy = (Object.keys(gates) as GateName[]).filter((gate) => !gates[gate].pass);
      return {
        staffId: person.staffId,
        staffName: person.staffName,
        gates,
        eligible: blockedBy.length === 0,
        blockedBy,
        score: scoreCandidate(person, referral, config),
      };
    })
    .sort(rank);

  const unknowns = [HOURS_UNKNOWN];
  if (referral.service !== undefined && !rule) {
    unknowns.push(`"${referral.service}" is not in the service role matrix, so role eligibility could not be checked.`);
  }

  return {
    referral,
    candidates,
    unknowns,
    requiresSupervisorJudgment:
      referral.service !== undefined && JUDGMENT_CALL_SERVICES.includes(referral.service),
  };
}

/**
 * Names the fairness contribution when it, and not preference-matching,
 * decided the ranking — so a supervisor can see equity beat preference and
 * override it if this family needs the busier worker.
 */
export function fairnessRationale(
  winner: CandidateEvaluation,
  runnerUp: CandidateEvaluation | undefined,
  roster: Map<string, Staff>,
): string | undefined {
  if (!runnerUp) return undefined;
  const preferenceGap =
    winner.score.language + winner.score.availability - (runnerUp.score.language + runnerUp.score.availability);
  if (preferenceGap >= 0) return undefined;
  const win = roster.get(winner.staffId);
  const lose = roster.get(runnerUp.staffId);
  if (!win || !lose) return undefined;
  return (
    `Ranked above ${runnerUp.staffId} on workload: ` +
    `${win.currentFamiliesAssigned} of ${win.maxFamiliesDcs} vs ` +
    `${lose.currentFamiliesAssigned} of ${lose.maxFamiliesDcs} — ` +
    `${runnerUp.staffId} is the better preference match.`
  );
}

/**
 * A referral nobody can take is a **staffing** gap; one where the qualified
 * people are all full is a **scheduling** gap. Whitney reports those
 * differently, so the engine keeps enough information to tell them apart.
 */
export function qualifiedIgnoringCapacity(evaluation: Evaluation): CandidateEvaluation[] {
  return evaluation.candidates.filter(
    (candidate) => candidate.gates.active.pass && candidate.gates.role.pass && candidate.gates.county.pass,
  );
}
