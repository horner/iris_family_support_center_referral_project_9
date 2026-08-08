/**
 * `staff_roster.csv` and `service_role_matrix.csv` → typed reference data.
 *
 * Separate from `db/import.ts` on purpose: the engine and planner tests need
 * the roster and the matrix, not a database.
 */
import { readFileSync } from "node:fs";

import { EDUCATION_LEVELS, type Availability, type Education } from "./model.ts";
import type { ServiceMatrix, ServiceRule, Staff } from "./model.ts";
import { SERVICE_MATRIX_FILE, STAFF_ROSTER_FILE } from "./paths.ts";

/** Minimal CSV reader — the two reference files are plain, unquoted, comma-separated. */
function readCsv(file: string): Record<string, string>[] {
  const [header, ...lines] = readFileSync(file, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  const columns = (header ?? "").split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""]));
  });
}

const splitList = (value: string): string[] =>
  value
    .split("|")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

/** `Master's or BA` → both levels. Membership, not a threshold. */
function parseEducationSet(value: string): Education[] {
  return value
    .split(/\s+or\s+/i)
    .map((entry) => entry.trim())
    .filter((entry): entry is Education => (EDUCATION_LEVELS as readonly string[]).includes(entry));
}

/** `Clinician II or Family Engagement Specialist 2` → both roles. */
function parseRoleSet(value: string): string[] {
  return value
    .split(/\s+or\s+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function loadStaffRoster(file: string = STAFF_ROSTER_FILE): Staff[] {
  return readCsv(file).map((row) => ({
    staffId: row["staff_id"] ?? "",
    staffName: row["staff_name"] ?? "",
    education: (row["education"] ?? "") as Education,
    role: row["role"] ?? "",
    countiesServed: splitList(row["counties_served"] ?? ""),
    maxFamiliesDcs: Number(row["max_families_dcs"] ?? 0),
    currentFamiliesAssigned: Number(row["current_families_assigned"] ?? 0),
    languages: splitList(row["languages"] ?? ""),
    availability: splitList(row["availability"] ?? "") as Availability[],
    active: (row["active_flag"] ?? "").toUpperCase() === "Y",
  }));
}

export function loadServiceRules(file: string = SERVICE_MATRIX_FILE): ServiceRule[] {
  return readCsv(file).map((row) => ({
    service: row["service"] ?? "",
    minimumEducation: parseEducationSet(row["minimum_education"] ?? ""),
    eligibleRoles: parseRoleSet(row["eligible_roles"] ?? ""),
  }));
}

export function loadServiceMatrix(file: string = SERVICE_MATRIX_FILE): ServiceMatrix {
  return new Map(loadServiceRules(file).map((rule) => [rule.service, rule]));
}
