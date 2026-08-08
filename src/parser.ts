/**
 * Kidtraks notification email → `Referral`.
 *
 * Two different jobs live here, deliberately in one place so the fuzzy one is
 * easy to find and easy to replace:
 *
 * 1. **Labelled lines** — mechanical, exact, and the reason parsing is cheap.
 * 2. **The `Notes:` prose** — keyword rules that lift soft preferences. This is
 *    the step a language model would own in production; keeping it isolated
 *    means the engine and planner stay plain, deterministic, testable code.
 *
 * The parser is tolerant by contract: unknown lines are ignored and missing
 * fields become `undefined` with an entry in `parseWarnings`. It never throws
 * on a well-formed email, because one malformed referral must not stop the
 * other twenty-nine.
 */
import type { Availability, Referral, ReferralPreferences } from "./model.ts";
import type { RawMessage } from "./ingest.ts";

/** Labelled line → `Referral` field. */
const FIELD_LABELS = {
  "Case Number": "caseNumber",
  "Referral ID": "referralId",
  "Service Requested": "service",
  County: "county",
  Region: "region",
  "Family Case Manager": "fcmName",
  "FCM Phone": "fcmPhone",
  "Requested Start Date": "requestedStartDate",
  "Number of Children in Home": "childrenInHome",
  Notes: "notes",
} as const satisfies Record<string, keyof Referral>;

/** Fields we warn about when absent — everything else is genuinely optional. */
const REQUIRED_FIELDS = ["caseNumber", "referralId", "service", "county"] as const;

function readLabelledLines(body: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of body.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z /]*?):\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, label, value] = match;
    if (label !== undefined && value !== undefined && label in FIELD_LABELS) {
      values.set(label, value.trim());
    }
  }
  return values;
}

/**
 * Soft preferences from prose. These rank candidates; they never block one —
 * resolving a tradeoff silently is exactly what `approval_rules.md` forbids.
 */
export function extractPreferences(notes: string | undefined): ReferralPreferences {
  const preferences: ReferralPreferences = {};
  if (!notes) return preferences;

  if (/\bbilingual\b/i.test(notes) || /\bspanish\b/i.test(notes)) {
    preferences.bilingual = true;
    if (/\bspanish\b/i.test(notes)) preferences.language = "Spanish";
  }

  const availability: Availability[] = [];
  if (/\bevenings?\b/i.test(notes)) availability.push("Evenings");
  if (/\bweekends?\b/i.test(notes)) availability.push("Weekends");
  if (availability.length > 0) preferences.availability = availability;

  if (/\bexpedite\b/i.test(notes) || /\bpermanency hearing\b/i.test(notes)) {
    preferences.expedite = true;
  }
  return preferences;
}

export function parseReferral(message: RawMessage): Referral {
  const labelled = readLabelledLines(message.body);
  const parseWarnings: string[] = [];

  const text = (label: keyof typeof FIELD_LABELS): string | undefined => {
    const value = labelled.get(label);
    return value !== undefined && value.length > 0 ? value : undefined;
  };

  const childrenRaw = text("Number of Children in Home");
  const childrenInHome = childrenRaw === undefined ? undefined : Number(childrenRaw);
  if (childrenRaw !== undefined && !Number.isFinite(childrenInHome)) {
    parseWarnings.push(`Number of Children in Home is not a number: "${childrenRaw}"`);
  }

  const notes = text("Notes");
  const referral: Referral = {
    messageId: message.messageId,
    receivedAt: message.receivedAt,
    subject: message.subject,
    caseNumber: text("Case Number"),
    referralId: text("Referral ID"),
    service: text("Service Requested"),
    county: text("County"),
    region: text("Region"),
    fcmName: text("Family Case Manager"),
    fcmPhone: text("FCM Phone"),
    requestedStartDate: text("Requested Start Date"),
    childrenInHome: Number.isFinite(childrenInHome) ? childrenInHome : undefined,
    notes,
    preferences: extractPreferences(notes),
    rawBody: message.body,
    parseWarnings,
  };

  for (const field of REQUIRED_FIELDS) {
    if (referral[field] === undefined) {
      parseWarnings.push(`missing ${field} — the email did not carry that labelled line`);
    }
  }
  return referral;
}

export function parseReferrals(messages: RawMessage[]): Referral[] {
  return messages.map(parseReferral);
}
