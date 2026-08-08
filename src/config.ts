/**
 * Application configuration. Nothing here is a constant by accident — the DCS
 * response window in particular is deliberately unsettled (48h vs 72h vs
 * "3 business days"), so it lives here rather than in the engine.
 *
 * Kept free of Node imports so the client can import it too; file locations
 * live in `paths.ts`.
 */
import type { EngineConfig } from "./model.ts";

export const MAILPIT_API = process.env.MAILPIT_API ?? "http://localhost:8025";
export const MAILPIT_SMTP = {
  host: process.env.MAILPIT_HOST ?? "localhost",
  port: Number(process.env.MAILPIT_PORT ?? 1025),
};

export interface ResponseDeadlineConfig {
  /** How long Iris has to accept or decline after the referral arrives. */
  amount: number;
  unit: "business-days" | "hours";
}

export interface AppConfig {
  responseDeadline: ResponseDeadlineConfig;
  engine: EngineConfig;
}

export const APP_CONFIG: AppConfig = {
  responseDeadline: { amount: 3, unit: "business-days" },
  engine: { fairness: "balance", fairnessWeight: 1 },
};

/** The response deadline for a referral received at `receivedAt`. */
export function responseDeadline(
  receivedAt: Date,
  config: ResponseDeadlineConfig = APP_CONFIG.responseDeadline,
): Date {
  if (config.unit === "hours") {
    return new Date(receivedAt.getTime() + config.amount * 60 * 60 * 1000);
  }
  const deadline = new Date(receivedAt.getTime());
  let remaining = config.amount;
  while (remaining > 0) {
    deadline.setDate(deadline.getDate() + 1);
    const day = deadline.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return deadline;
}
