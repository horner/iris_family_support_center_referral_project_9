/**
 * The one place the database is opened. Everything else takes `db` as a
 * parameter, so the backend stays swappable.
 *
 * `better-sqlite3` is reached through `@yorm/drizzle`'s adapter, which also
 * brings the `yorm_*` system tables; our own tables come from the generated
 * Drizzle migrations, so `schema.ts` stays the single source of truth for them.
 */
import { fileURLToPath } from "node:url";
import { createSqliteAdapter } from "@yorm/drizzle";
import type { SqliteAdapter } from "@yorm/drizzle";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { DATABASE_FILE } from "../paths.ts";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

export interface Database {
  db: BetterSQLite3Database;
  adapter: SqliteAdapter;
  close(): void;
}

/** Pass `":memory:"` for tests — same factory, same migrations. */
export function createDatabase(file: string = DATABASE_FILE): Database {
  const adapter = createSqliteAdapter({ file });
  adapter.migrate();
  migrate(adapter.db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db: adapter.db, adapter, close: () => adapter.close() };
}
