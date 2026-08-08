/**
 * Delivers `referral_emails.json` into Mailpit over real SMTP, so the rest of
 * the pipeline reads referrals the way Iris does: out of an inbox.
 *
 * `--fresh` clears the mailbox first. Re-seeding without it duplicates every
 * message in Mailpit; the ingest layer dedupes on Message-ID, so a duplicate
 * delivery is harmless downstream but makes the Mailpit UI confusing.
 */
import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";

import { MAILPIT_API, MAILPIT_SMTP } from "../src/config.ts";
import { REFERRAL_EMAILS_FILE } from "../src/paths.ts";

interface ReferralEmail {
  message_id: string;
  from: string;
  to: string;
  received_at: string;
  subject: string;
  body: string;
}

export function loadReferralEmails(file: string = REFERRAL_EMAILS_FILE): ReferralEmail[] {
  return JSON.parse(readFileSync(file, "utf8")) as ReferralEmail[];
}

async function deleteAll(): Promise<void> {
  const response = await fetch(`${MAILPIT_API}/api/v1/messages`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Mailpit delete-all failed: ${response.status}`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--fresh")) {
    await deleteAll();
    console.log("cleared the Mailpit mailbox");
  }

  const transport = nodemailer.createTransport({
    host: MAILPIT_SMTP.host,
    port: MAILPIT_SMTP.port,
    secure: false,
    tls: { rejectUnauthorized: false },
  });

  const emails = loadReferralEmails();
  for (const email of emails) {
    await transport.sendMail({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.body,
      messageId: email.message_id,
      date: new Date(email.received_at),
    });
  }
  transport.close();
  console.log(`delivered ${emails.length} referral emails to ${MAILPIT_SMTP.host}:${MAILPIT_SMTP.port}`);
}

await main();
