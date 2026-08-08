/**
 * Two kinds of table, and the difference matters.
 *
 * **Reference** (`staff`, `services`) are read-mostly facts imported from CSV,
 * plus the one counter the assignment API owns: `current_families_assigned`.
 *
 * **Projections** (`cases`, `case_decisions`) are derived from case documents
 * by the YORM mapping. They are forward-only and never hand-updated — they
 * exist so the queue and the KPI are a SQL query rather than a document scan.
 */
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const staff = sqliteTable("staff", {
  staffId: text("staff_id").primaryKey(),
  staffName: text("staff_name").notNull(),
  education: text("education").notNull(),
  role: text("role").notNull(),
  countiesServed: text("counties_served", { mode: "json" }).$type<string[]>().notNull(),
  maxFamiliesDcs: integer("max_families_dcs").notNull(),
  currentFamiliesAssigned: integer("current_families_assigned").notNull(),
  languages: text("languages", { mode: "json" }).$type<string[]>().notNull(),
  availability: text("availability", { mode: "json" }).$type<string[]>().notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
});

export const services = sqliteTable("services", {
  service: text("service").primaryKey(),
  minimumEducation: text("minimum_education", { mode: "json" }).$type<string[]>().notNull(),
  eligibleRoles: text("eligible_roles", { mode: "json" }).$type<string[]>().notNull(),
});

export const cases = sqliteTable("cases", {
  messageId: text("message_id").primaryKey(),
  referralId: text("referral_id"),
  caseNumber: text("case_number"),
  service: text("service"),
  county: text("county"),
  region: text("region"),
  fcmName: text("fcm_name"),
  fcmPhone: text("fcm_phone"),
  requestedStartDate: text("requested_start_date"),
  childrenInHome: integer("children_in_home"),
  notes: text("notes"),
  subject: text("subject"),
  receivedAt: text("received_at"),
  preferences: text("preferences", { mode: "json" }).$type<Record<string, unknown>>(),
  parseWarnings: text("parse_warnings", { mode: "json" }).$type<string[]>(),
  /** `pending | proposed | assigned | declined | needs_re_decision` — the propose/commit boundary. */
  status: text("status").notNull(),
  proposedStaffId: text("proposed_staff_id").references(() => staff.staffId),
  committedStaffId: text("committed_staff_id").references(() => staff.staffId),
  committedBy: text("committed_by"),
  committedAt: text("committed_at"),
  declineReason: text("decline_reason"),
  /** Client-generated, so a retry on a flaky phone consumes one slot, not two. */
  commitKey: text("commit_key"),
});

export const caseDecisions = sqliteTable("case_decisions", {
  messageId: text("message_id")
    .primaryKey()
    .references(() => cases.messageId),
  outcome: text("outcome").notNull(),
  proposedStaffId: text("proposed_staff_id"),
  runnersUp: text("runners_up", { mode: "json" }).$type<unknown[]>(),
  rationale: text("rationale", { mode: "json" }).$type<string[]>(),
  contendedWith: text("contended_with", { mode: "json" }).$type<string[]>(),
  unknowns: text("unknowns", { mode: "json" }).$type<string[]>(),
  requiresSupervisorJudgment: integer("requires_supervisor_judgment", {
    mode: "boolean",
  }).notNull(),
});

export type StaffRow = typeof staff.$inferSelect;
export type ServiceRow = typeof services.$inferSelect;
export type CaseRow = typeof cases.$inferSelect;
export type CaseDecisionRow = typeof caseDecisions.$inferSelect;
