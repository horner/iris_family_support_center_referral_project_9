import { describe, expect, it } from "vitest";

import { MAILPIT_API } from "./config.ts";
import { fetchMessages, loadReferralEmails } from "./ingest.ts";

/** Mailpit runs in Docker; skip rather than fail when it is not up. */
const mailpitUp = await fetch(`${MAILPIT_API}/api/v1/messages?limit=1`)
  .then((response) => response.ok)
  .catch(() => false);

describe.runIf(mailpitUp)("ingest", () => {
  it("dedupes by Message-ID, so re-seeding is safe", async () => {
    const messages = await fetchMessages();
    const ids = messages.map((message) => message.messageId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(loadReferralEmails().map((e) => e.messageId)));
  });
});
