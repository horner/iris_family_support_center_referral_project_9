import { describe, expect, it } from "vitest";

import { loadReferralEmails } from "./ingest.ts";
import { parseReferral, parseReferrals } from "./parser.ts";
import { loadServiceMatrix } from "./reference-data.ts";

const messages = loadReferralEmails();
const referrals = parseReferrals(messages);

describe("parser", () => {
  it("parses all 30 referral emails with zero warnings", () => {
    expect(referrals).toHaveLength(30);
    const warned = referrals.filter((referral) => referral.parseWarnings.length > 0);
    expect(warned).toEqual([]);
  });

  it("only produces services that exist in the service matrix", () => {
    const matrix = loadServiceMatrix();
    for (const referral of referrals) {
      expect(matrix.has(referral.service ?? "")).toBe(true);
    }
  });

  it("lifts evening and weekend availability out of the notes", () => {
    const referral = referrals.find((candidate) =>
      /Evenings and weekends preferred/i.test(candidate.notes ?? ""),
    );
    expect(referral?.preferences.availability).toEqual(["Evenings", "Weekends"]);
  });

  it("lifts a bilingual request out of the notes", () => {
    const referral = referrals.find((candidate) => /bilingual/i.test(candidate.notes ?? ""));
    expect(referral?.preferences.bilingual).toBe(true);
    expect(referral?.preferences.language).toBe("Spanish");
  });

  it("treats a permanency hearing as an expedite signal", () => {
    const referral = referrals.find((candidate) =>
      /permanency hearing/i.test(candidate.notes ?? ""),
    );
    expect(referral?.preferences.expedite).toBe(true);
  });

  it("warns instead of throwing when a labelled line is missing", () => {
    const source = messages[0];
    if (!source) throw new Error("fixture is empty");
    const mangled = {
      ...source,
      body: source.body.replace(/^Service Requested: .*$/m, ""),
    };
    const referral = parseReferral(mangled);
    expect(referral.service).toBeUndefined();
    expect(referral.parseWarnings.join(" ")).toContain("missing service");
    expect(referral.caseNumber).toBeDefined();
  });

  it("ignores lines it does not recognise", () => {
    const source = messages[0];
    if (!source) throw new Error("fixture is empty");
    const referral = parseReferral({
      ...source,
      body: `Unrecognised Label: nonsense\n${source.body}`,
    });
    expect(referral.parseWarnings).toEqual([]);
  });
});
