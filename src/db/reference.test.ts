import { describe, expect, it } from "vitest";

import { loadServiceMatrix, loadStaffRoster } from "../reference-data.ts";
import { createDatabase } from "./index.ts";
import { importReferenceData } from "./import.ts";
import { services, staff } from "./schema.ts";

describe("reference data", () => {
  const roster = loadStaffRoster();
  const matrix = loadServiceMatrix();

  it("loads the full roster", () => {
    expect(roster).toHaveLength(38);
  });

  it("keeps S001 inactive", () => {
    expect(roster.find((person) => person.staffId === "S001")?.active).toBe(false);
  });

  it("keeps S006 over the cap — real data, not a bug to clean up", () => {
    const s006 = roster.find((person) => person.staffId === "S006");
    expect(s006?.currentFamiliesAssigned).toBe(13);
    expect(s006?.maxFamiliesDcs).toBe(12);
  });

  it("reads Family Preservation and FCT as two eligible roles each", () => {
    expect(matrix.get("Family Preservation")?.eligibleRoles).toEqual([
      "Clinician II",
      "Family Engagement Specialist 2",
    ]);
    expect(matrix.get("FCT")?.eligibleRoles).toEqual([
      "Clinician II",
      "Family Engagement Specialist 2",
    ]);
  });

  it("reads an 'or' minimum education as a set of acceptable levels", () => {
    expect(matrix.get("Supervised Visitation Paraprofessional")?.minimumEducation).toEqual([
      "HS Diploma/GED",
      "BA",
    ]);
    expect(matrix.get("Family Preservation")?.minimumEducation).toEqual(["Master's", "BA"]);
    expect(matrix.get("Counseling")?.minimumEducation).toEqual(["Master's"]);
  });

  it("imports idempotently", () => {
    const database = createDatabase(":memory:");
    importReferenceData(database.db);
    importReferenceData(database.db);
    expect(database.db.select().from(staff).all()).toHaveLength(38);
    expect(database.db.select().from(services).all()).toHaveLength(13);
    database.close();
  });
});
