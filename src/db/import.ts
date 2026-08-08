/**
 * CSV → reference tables. Idempotent: re-running upserts on the primary key,
 * so `npm run db:import` is safe to repeat.
 */
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { loadServiceRules, loadStaffRoster } from "../reference-data.ts";
import { createDatabase } from "./index.ts";
import { services, staff } from "./schema.ts";

export function importReferenceData(db: BetterSQLite3Database): {
  staff: number;
  services: number;
} {
  const roster = loadStaffRoster();
  for (const person of roster) {
    const row = {
      staffId: person.staffId,
      staffName: person.staffName,
      education: person.education,
      role: person.role,
      countiesServed: person.countiesServed,
      maxFamiliesDcs: person.maxFamiliesDcs,
      currentFamiliesAssigned: person.currentFamiliesAssigned,
      languages: person.languages,
      availability: person.availability,
      active: person.active,
    };
    db.insert(staff).values(row).onConflictDoUpdate({ target: staff.staffId, set: row }).run();
  }

  const rules = loadServiceRules();
  for (const rule of rules) {
    const row = {
      service: rule.service,
      minimumEducation: rule.minimumEducation,
      eligibleRoles: rule.eligibleRoles,
    };
    db.insert(services)
      .values(row)
      .onConflictDoUpdate({ target: services.service, set: row })
      .run();
  }

  return { staff: roster.length, services: rules.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const database = createDatabase();
  const counts = importReferenceData(database.db);
  database.close();
  console.log(`imported ${counts.staff} staff and ${counts.services} services`);
}
