/** Repo-root data files and the SQLite location. Node-only. */
import { fileURLToPath } from "node:url";

const repoRoot = (file: string): string => fileURLToPath(new URL(`../${file}`, import.meta.url));

export const REFERRAL_EMAILS_FILE = repoRoot("referral_emails.json");
export const STAFF_ROSTER_FILE = repoRoot("staff_roster.csv");
export const SERVICE_MATRIX_FILE = repoRoot("service_role_matrix.csv");
export const DATABASE_FILE = process.env.IRIS_DB ?? repoRoot("data/iris.db");
