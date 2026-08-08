/**
 * The real hackathon data, loaded once, for tests that must be true of the
 * actual roster and the actual inbox — not of a convenient fake.
 */
import { loadReferralEmails } from "../ingest.ts";
import { parseReferrals } from "../parser.ts";
import { loadServiceMatrix, loadStaffRoster } from "../reference-data.ts";
import type { Referral, ServiceMatrix, Staff } from "../model.ts";

export const roster: Staff[] = loadStaffRoster();
export const matrix: ServiceMatrix = loadServiceMatrix();
export const referrals: Referral[] = parseReferrals(loadReferralEmails());

export function referral(referralId: string): Referral {
  const found = referrals.find((r) => r.referralId === referralId);
  if (!found) throw new Error(`No referral ${referralId} in referral_emails.json`);
  return found;
}

export function person(staffId: string): Staff {
  const found = roster.find((s) => s.staffId === staffId);
  if (!found) throw new Error(`No staff ${staffId} in staff_roster.csv`);
  return found;
}
