/**
 * Domain types shared by the pure decision core (parser → engine → planner).
 * No I/O, no framework, no persistence concerns — everything here is data.
 */

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export type Availability = "Weekdays" | "Evenings" | "Weekends";

/** Soft signals lifted out of the free-text `Notes:` line. Never gates. */
export interface ReferralPreferences {
  bilingual?: boolean;
  language?: string;
  availability?: Availability[];
  expedite?: boolean;
}

export interface Referral {
  messageId: string;
  receivedAt: string;
  subject: string;
  caseNumber?: string;
  referralId?: string;
  service?: string;
  county?: string;
  region?: string;
  fcmName?: string;
  fcmPhone?: string;
  requestedStartDate?: string;
  childrenInHome?: number;
  notes?: string;
  preferences: ReferralPreferences;
  /** Raw email body, kept so the UI can show the source (trust through transparency). */
  rawBody: string;
  parseWarnings: string[];
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

/** The education ladder, low to high. An "or" minimum passes if any level is met. */
export const EDUCATION_LEVELS = ["HS Diploma/GED", "BA", "Master's"] as const;
export type Education = (typeof EDUCATION_LEVELS)[number];

export interface Staff {
  staffId: string;
  staffName: string;
  education: Education;
  role: string;
  countiesServed: string[];
  maxFamiliesDcs: number;
  currentFamiliesAssigned: number;
  languages: string[];
  availability: Availability[];
  active: boolean;
}

export interface ServiceRule {
  service: string;
  /** Any one of these education levels satisfies the minimum. */
  minimumEducation: Education[];
  /** Set membership, not a ladder — Family Preservation and FCT accept two roles. */
  eligibleRoles: string[];
}

export type ServiceMatrix = Map<string, ServiceRule>;

// ---------------------------------------------------------------------------
// Engine configuration
// ---------------------------------------------------------------------------

/**
 * Spreading work evenly conflicts with preference-matching, so it is a named
 * policy with a visible control rather than a hidden sort order.
 */
export type FairnessStrategy = "off" | "balance" | "balance-first";

export interface EngineConfig {
  fairness: FairnessStrategy;
  /** How much headroom counts against a language/availability match under `balance`. */
  fairnessWeight: number;
}

/** Services Whitney says are a supervisor's judgment call — surface, never automate. */
export const JUDGMENT_CALL_SERVICES: readonly string[] = [
  "Insurance/Medicaid Referrals",
  "Substance Abuse Group",
];

/**
 * The capacity rule Iris actually uses is ~20 face-to-face hours, and CaseWind
 * cannot report hours. Stating that beats implying a precision we do not have.
 */
export const HOURS_UNKNOWN =
  "The 20-hour face-to-face capacity rule could not be applied: CaseWind reports " +
  "case counts, not direct service hours. The 12-family DCS cap is the only measurable gate.";

// ---------------------------------------------------------------------------
// Engine output — evaluation of every staff member for one referral
// ---------------------------------------------------------------------------

export type GateName = "active" | "role" | "county" | "capacity";

/** `detail` is the rationale the UI shows — one string serves decision and explanation. */
export interface GateResult {
  pass: boolean;
  detail: string;
}

export interface CandidateScore {
  language: number;
  availability: number;
  fairness: number;
  total: number;
}

export interface CandidateEvaluation {
  staffId: string;
  staffName: string;
  gates: Record<GateName, GateResult>;
  eligible: boolean;
  blockedBy: GateName[];
  /** Only meaningful when `eligible`. */
  score: CandidateScore;
}

export interface Evaluation {
  referral: Referral;
  /** Every staff member, ranked. Nobody is dropped — "why not her?" must have an answer. */
  candidates: CandidateEvaluation[];
  unknowns: string[];
  requiresSupervisorJudgment: boolean;
}

// ---------------------------------------------------------------------------
// Planner output — allocation across the whole pending queue
// ---------------------------------------------------------------------------

export type AllocationOutcome = "match" | "no_capacity" | "no_eligible_staff";

export interface Allocation {
  referralId: string;
  assignedStaffId?: string;
  outcome: AllocationOutcome;
  /** Supervisor-decided (committed): the planner must not move it. */
  pinned: boolean;
  /** Other referrals that wanted the same person. */
  contendedWith: string[];
  rationale: string[];
  runnersUp: { staffId: string; reason: string }[];
  requiresSupervisorJudgment: boolean;
}

export interface Contention {
  staffId: string;
  slots: number;
  wantedBy: string[];
}

export interface Plan {
  allocations: Allocation[];
  contention: Contention[];
  unassigned: Allocation[];
  unknowns: string[];
}
