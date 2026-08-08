/**
 * `plan()` — allocation across the **whole** pending queue.
 *
 * Capacity is shared, so deciding referrals one at a time is wrong: two Whitley
 * FCT referrals cannot both take the one clinician with a single slot left.
 * Deciding in arrival order hands that slot to whoever emailed first and
 * reports a false `no_capacity` for the other. So the planner works on the set,
 * places the scarcest referrals first, and *names* the contention it resolves.
 *
 * Pure: no I/O, no persistence. Same inputs, same plan, every time.
 */
import { evaluate, fairnessRationale, fairnessScore, qualifiedIgnoringCapacity } from "./engine.ts";
import {
  type Allocation,
  type CandidateEvaluation,
  type Contention,
  type EngineConfig,
  type Evaluation,
  type Pin,
  type Plan,
  type Referral,
  type ServiceMatrix,
  type Staff,
} from "./model.ts";

/** Bounded so a run is fast and deterministic; the pass converges well before this. */
const MAX_IMPROVEMENT_PASSES = 8;

/** Referral IDs are the human handle, but the message ID is what is guaranteed unique. */
export const referralKey = (referral: Referral): string => referral.referralId ?? referral.messageId;

interface Placement {
  referral: Referral;
  evaluation: Evaluation;
  eligible: CandidateEvaluation[];
  staffId?: string;
  pinned: boolean;
  declined: boolean;
}

const scoreFor = (placement: Placement, staffId: string): number =>
  placement.eligible.find((c) => c.staffId === staffId)?.score.total ?? Number.NEGATIVE_INFINITY;

/**
 * Scarcity first, never arrival order: a referral with exactly one possible
 * worker must not lose that worker to a referral with ten options. Ties break
 * on requested start date, then referral ID, so runs are reproducible.
 */
function scarcityOrder(a: Placement, b: Placement): number {
  if (a.eligible.length !== b.eligible.length) return a.eligible.length - b.eligible.length;
  const dateA = a.referral.requestedStartDate ?? "9999-99-99";
  const dateB = b.referral.requestedStartDate ?? "9999-99-99";
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  return referralKey(a.referral).localeCompare(referralKey(b.referral));
}

/**
 * Pairwise swaps that raise the combined score without unassigning anyone.
 * A swap is capacity-neutral — each worker keeps the same number of families —
 * so it can only improve the fit, never the count.
 */
function improve(placed: Placement[]): void {
  const movable = placed.filter((p) => !p.pinned && p.staffId !== undefined);
  for (let pass = 0; pass < MAX_IMPROVEMENT_PASSES; pass += 1) {
    let improved = false;
    for (let i = 0; i < movable.length; i += 1) {
      for (let j = i + 1; j < movable.length; j += 1) {
        const left = movable[i];
        const right = movable[j];
        if (!left?.staffId || !right?.staffId) continue;
        const current = scoreFor(left, left.staffId) + scoreFor(right, right.staffId);
        const swapped = scoreFor(left, right.staffId) + scoreFor(right, left.staffId);
        if (swapped > current) {
          [left.staffId, right.staffId] = [right.staffId, left.staffId];
          improved = true;
        }
      }
    }
    if (!improved) return;
  }
}

function matchRationale(
  placement: Placement,
  staffId: string,
  roster: Map<string, Staff>,
): { rationale: string[]; runnersUp: { staffId: string; reason: string }[] } {
  const chosen = placement.eligible.find((c) => c.staffId === staffId);
  const rationale: string[] = [];
  if (chosen) {
    rationale.push(chosen.gates.role.detail, chosen.gates.county.detail, chosen.gates.capacity.detail);
    const nextBest = placement.eligible.find((c) => c.staffId !== staffId);
    const fairness = fairnessRationale(chosen, nextBest, roster);
    if (fairness) rationale.push(fairness);
  }
  const runnersUp = placement.eligible
    .filter((c) => c.staffId !== staffId)
    .slice(0, 3)
    .map((c) => ({
      staffId: c.staffId,
      reason: `Also eligible (score ${c.score.total.toFixed(2)}): ${c.gates.capacity.detail}`,
    }));
  return { rationale, runnersUp };
}

/**
 * Contention is reported, not silently resolved: the loser's rationale names
 * who took the slot. "No capacity" alone would hide a scheduling gap inside
 * what looks like a staffing gap.
 */
function contentionRationale(
  placement: Placement,
  winners: Map<string, string[]>,
  roster: Map<string, Staff>,
): { rationale: string[]; contendedWith: string[] } {
  const rationale: string[] = [];
  const contendedWith: string[] = [];
  for (const candidate of placement.eligible.slice(0, 3)) {
    const takenBy = winners.get(candidate.staffId) ?? [];
    const person = roster.get(candidate.staffId);
    if (takenBy.length > 0) {
      contendedWith.push(...takenBy);
      rationale.push(
        `${candidate.staffId}${person ? ` (${person.staffName})` : ""} was the better match but is allocated to ${takenBy.join(", ")}.`,
      );
    } else {
      rationale.push(`${candidate.staffId} is eligible but has no slot left this run.`);
    }
  }
  return { rationale, contendedWith: [...new Set(contendedWith)] };
}

/** The honest split: qualified-but-full is scheduling, nobody-qualifies is staffing. */
function gapAllocation(placement: Placement, roster: Map<string, Staff>): Allocation {
  const full = qualifiedIgnoringCapacity(placement.evaluation);
  const base = {
    referralId: referralKey(placement.referral),
    pinned: false,
    contendedWith: [],
    runnersUp: [],
    requiresSupervisorJudgment: placement.evaluation.requiresSupervisorJudgment,
  };
  if (full.length === 0) {
    return {
      ...base,
      outcome: "no_eligible_staff",
      rationale: [
        `Staffing gap: nobody on the roster is qualified for ${placement.referral.service ?? "this service"} in ${placement.referral.county ?? "this county"}.`,
      ],
    };
  }
  return {
    ...base,
    outcome: "no_capacity",
    rationale: [
      `Scheduling gap: ${full.length} qualified worker${full.length === 1 ? " is" : "s are"} at the DCS cap.`,
      ...full.slice(0, 3).map((c) => {
        const person = roster.get(c.staffId);
        return `${c.staffId}${person ? ` (${person.staffName})` : ""}: ${c.gates.capacity.detail}`;
      }),
    ],
  };
}

export function plan(
  referrals: Referral[],
  roster: Staff[],
  matrix: ServiceMatrix,
  config: EngineConfig,
  pins: Pin[] = [],
): Plan {
  const byId = new Map(roster.map((person) => [person.staffId, person]));
  const pinByReferral = new Map(pins.map((pin) => [pin.referralId, pin]));

  // Capacity is a shared budget, decremented as the run allocates.
  const headroom = new Map(
    roster.map((person) => [person.staffId, Math.max(0, person.maxFamiliesDcs - person.currentFamiliesAssigned)]),
  );

  const placements: Placement[] = referrals.map((referral) => {
    const evaluation = evaluate(referral, roster, matrix, config);
    const pin = pinByReferral.get(referralKey(referral));
    const placement: Placement = {
      referral,
      evaluation,
      eligible: evaluation.candidates.filter((c) => c.eligible),
      pinned: pin !== undefined,
      declined: pin !== undefined && pin.staffId === undefined,
    };
    if (pin?.staffId !== undefined) placement.staffId = pin.staffId;
    return placement;
  });

  // Demand per worker, before anything is spent — this is what contention measures.
  const wantedBy = new Map<string, string[]>();
  for (const placement of placements) {
    for (const candidate of placement.eligible) {
      const list = wantedBy.get(candidate.staffId) ?? [];
      list.push(referralKey(placement.referral));
      wantedBy.set(candidate.staffId, list);
    }
  }

  // Committed capacity is real capacity: spend the pins before planning the rest.
  for (const placement of placements) {
    if (placement.pinned && placement.staffId) {
      headroom.set(placement.staffId, (headroom.get(placement.staffId) ?? 0) - 1);
    }
  }

  const open = placements
    .filter((p) => !p.pinned && !p.evaluation.requiresSupervisorJudgment)
    .sort(scarcityOrder);

  for (const placement of open) {
    // Re-rank on *live* headroom: the fairness policy has to see the slots this
    // run has already spent, or "spread the work" piles the queue on one desk.
    let best: CandidateEvaluation | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of placement.eligible) {
      const remaining = headroom.get(candidate.staffId) ?? 0;
      if (remaining <= 0) continue;
      const worker = byId.get(candidate.staffId);
      const live =
        candidate.score.language +
        candidate.score.availability +
        fairnessScore(remaining, worker?.maxFamiliesDcs ?? 0, config);
      if (live > bestScore) {
        best = candidate;
        bestScore = live;
      }
    }
    if (!best) continue;
    placement.staffId = best.staffId;
    headroom.set(best.staffId, (headroom.get(best.staffId) ?? 0) - 1);
  }

  improve(placements);

  // Who ended up with whom — the answer the losers' rationale needs.
  const winners = new Map<string, string[]>();
  for (const placement of placements) {
    if (!placement.staffId) continue;
    const list = winners.get(placement.staffId) ?? [];
    list.push(referralKey(placement.referral));
    winners.set(placement.staffId, list);
  }

  const allocations: Allocation[] = placements.map((placement) => {
    const id = referralKey(placement.referral);
    const judgment = placement.evaluation.requiresSupervisorJudgment;

    if (placement.declined) {
      return {
        referralId: id,
        outcome: "declined",
        pinned: true,
        contendedWith: [],
        rationale: ["Declined by a supervisor; the planner leaves it alone."],
        runnersUp: [],
        requiresSupervisorJudgment: judgment,
      };
    }

    if (placement.staffId) {
      const { rationale, runnersUp } = matchRationale(placement, placement.staffId, byId);
      return {
        referralId: id,
        assignedStaffId: placement.staffId,
        outcome: "match",
        pinned: placement.pinned,
        contendedWith: (winners.get(placement.staffId) ?? []).filter((other) => other !== id),
        rationale: placement.pinned ? ["Committed by a supervisor; pinned.", ...rationale] : rationale,
        runnersUp,
        requiresSupervisorJudgment: judgment,
      };
    }

    if (judgment) {
      return {
        referralId: id,
        outcome: "needs_judgment",
        pinned: false,
        contendedWith: [],
        rationale: [
          `${placement.referral.service} is a supervisor judgment call: candidates are shown, none is elected.`,
          ...(placement.eligible.length === 0 ? gapAllocation(placement, byId).rationale : []),
        ],
        runnersUp: placement.eligible.slice(0, 3).map((c) => ({
          staffId: c.staffId,
          reason: `Eligible (score ${c.score.total.toFixed(2)}): ${c.gates.capacity.detail}`,
        })),
        requiresSupervisorJudgment: true,
      };
    }

    // Eligible people exist, but this run spent their slots on scarcer referrals.
    if (placement.eligible.length > 0) {
      const { rationale, contendedWith } = contentionRationale(placement, winners, byId);
      return {
        referralId: id,
        outcome: "no_capacity",
        pinned: false,
        contendedWith,
        rationale,
        runnersUp: placement.eligible.slice(0, 3).map((c) => ({
          staffId: c.staffId,
          reason: c.gates.capacity.detail,
        })),
        requiresSupervisorJudgment: judgment,
      };
    }

    return gapAllocation(placement, byId);
  });

  const contention: Contention[] = [...wantedBy.entries()]
    .map(([staffId, referralIds]) => {
      const person = byId.get(staffId);
      const slots = person ? Math.max(0, person.maxFamiliesDcs - person.currentFamiliesAssigned) : 0;
      return { staffId, slots, wantedBy: referralIds };
    })
    .filter((entry) => entry.wantedBy.length > entry.slots)
    .sort((a, b) => b.wantedBy.length - a.wantedBy.length || a.staffId.localeCompare(b.staffId));

  const unknowns = [...new Set(placements.flatMap((p) => p.evaluation.unknowns))];

  return {
    allocations,
    contention,
    unassigned: allocations.filter((a) => a.assignedStaffId === undefined && a.outcome !== "declined"),
    unknowns,
  };
}

/**
 * The single-case UI runs the same allocator on a queue of one, so there is
 * exactly one selection code path and no duplicated ranking logic.
 */
export function recommend(
  referral: Referral,
  roster: Staff[],
  matrix: ServiceMatrix,
  config: EngineConfig,
  pins: Pin[] = [],
): Allocation {
  const result = plan([referral], roster, matrix, config, pins);
  const allocation = result.allocations[0];
  if (!allocation) throw new Error(`plan() returned no allocation for ${referralKey(referral)}`);
  return allocation;
}
