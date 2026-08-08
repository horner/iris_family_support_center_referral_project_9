/**
 * Mailpit REST → raw referral messages. This is the whole inbound integration:
 * DCS has no referral API (see research/), so an inbox is the interface.
 */
import { readFileSync } from "node:fs";

import { MAILPIT_API } from "./config.ts";
import { REFERRAL_EMAILS_FILE } from "./paths.ts";

export interface RawMessage {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  body: string;
}

interface MailpitSummary {
  ID: string;
  MessageID: string;
  Subject: string;
  Created: string;
  From: { Address: string } | null;
  To: { Address: string }[] | null;
}

interface MailpitMessage {
  Text: string;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT_API}${path}`);
  if (!response.ok) throw new Error(`Mailpit ${path} failed: ${response.status}`);
  return (await response.json()) as T;
}

/** Mailpit reports Message-IDs without angle brackets; the JSON fixture has them. */
const normalizeMessageId = (value: string): string => value.replace(/^<|>$/g, "");

/**
 * Fetches every message, newest first, deduped by Message-ID — re-seeding the
 * mailbox must never produce two referrals for the same DCS notification.
 */
export async function fetchMessages(limit = 500): Promise<RawMessage[]> {
  const page = await getJson<{ messages: MailpitSummary[] }>(`/api/v1/messages?limit=${limit}`);
  const seen = new Set<string>();
  const messages: RawMessage[] = [];
  for (const summary of page.messages) {
    if (seen.has(normalizeMessageId(summary.MessageID))) continue;
    seen.add(normalizeMessageId(summary.MessageID));
    const detail = await getJson<MailpitMessage>(`/api/v1/message/${summary.ID}`);
    messages.push({
      messageId: normalizeMessageId(summary.MessageID),
      from: summary.From?.Address ?? "",
      to: summary.To?.[0]?.Address ?? "",
      subject: summary.Subject,
      receivedAt: summary.Created,
      body: detail.Text,
    });
  }
  return messages;
}

/**
 * The same referrals straight from `referral_emails.json`. Used by the seed
 * script and by tests, so the pure core can be exercised without Docker.
 */
export function loadReferralEmails(file: string = REFERRAL_EMAILS_FILE): RawMessage[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as {
    message_id: string;
    from: string;
    to: string;
    received_at: string;
    subject: string;
    body: string;
  }[];
  return raw.map((email) => ({
    messageId: normalizeMessageId(email.message_id),
    from: email.from,
    to: email.to,
    subject: email.subject,
    receivedAt: email.received_at,
    body: email.body,
  }));
}
