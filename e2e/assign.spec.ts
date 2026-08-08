import { expect, test, type Page } from "@playwright/test";

/**
 * The journey a supervisor actually makes on a phone: sync the inbox, open the
 * most urgent referral, read why the worker was recommended, and assign.
 *
 * The width assertions are not decoration. A 375px screen is the real device;
 * anything that overflows sideways there is broken in the field even if it
 * looks fine on a laptop.
 */

const noHorizontalOverflow = async (page: Page): Promise<boolean> =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

/** `/` is the welcome page; the supervisor's work starts one route in. */
const QUEUE = "/#/queue";

/**
 * The queue is a card list on a phone and a DataVis grid on a laptop, so the
 * journey tests ask for "a referral" rather than for one layout's markup.
 */
const entries = (page: Page) =>
  page.locator(".queue-table").isVisible().then((grid) =>
    grid ? page.locator(".queue-table tbody tr") : page.locator(".queue-card"),
  );

const pinned = ":is(.queue-pinned, .queue-table-pinned)";

const openReferral = async (page: Page, select: "first" | "unpinned" | "matched"): Promise<void> => {
  const rows = await entries(page);
  const unpinned = rows.filter({ hasNot: page.locator(pinned) });
  const target =
    select === "first"
      ? rows.first()
      : select === "unpinned"
        ? unpinned.first()
        : unpinned.filter({ hasText: "Match" }).first();
  await expect(target).toBeVisible();
  await target.click();
};

test("supervisor can sync, open a case and assign", async ({ page }) => {
  await page.goto(QUEUE);

  await expect(page.getByRole("heading", { name: /Iris referral matching/i })).toBeVisible();

  // Pull the referrals in and wait for the queue to report a count.
  await page.getByRole("button", { name: /Sync mail/i }).click();
  const count = page.locator(".queue-count");
  await expect(count).toBeVisible({ timeout: 30_000 });
  await expect(count).not.toHaveText("0 referrals");

  // Take a case the planner could actually staff — the assign path is the one
  // under test, and a staffing gap would never reach it.
  await openReferral(page, "matched");

  // Recommend is the phone default, and the reasoning is on screen with it.
  await expect(page.getByRole("heading", { name: /Recommended worker/i })).toBeVisible();
  await expect(page.locator(".recommend-rationale")).toBeVisible();

  // Honesty about limits is never scrolled away or collapsed.
  await expect(page.getByRole("heading", { name: /What this cannot tell you/i })).toBeVisible();

  // Explore shows everyone, including the people who cannot take the case.
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.locator(".explore-card")).not.toHaveCount(0);
  await expect(page.locator(".explore-card--blocked").first()).toBeVisible();

  // The case sheet renders the referral and keeps the source email reachable.
  await page.getByRole("button", { name: /Case sheet/i }).click();
  await expect(page.getByRole("button", { name: /Show the original email/i })).toBeVisible();

  await page.getByRole("button", { name: "Recommend", exact: true }).click();

  const assign = page.locator(".action-assign");
  await expect(assign).toBeEnabled();
  await assign.click();

  // The commitment lands and the bar says so — no optimistic tick beforehand.
  await expect(page.locator(".action-bar--done")).toBeVisible({ timeout: 20_000 });

  // Back in the queue the case is pinned, because a commitment is not a plan.
  await page.getByRole("button", { name: /Back to the queue/i }).click();
  await expect(page.locator(pinned).first()).toBeVisible();

  expect(await noHorizontalOverflow(page)).toBe(false);
});

test("declining captures a tappable reason", async ({ page }) => {
  await page.goto(QUEUE);
  await page.getByRole("button", { name: /Sync mail/i }).click();
  await expect(page.locator(".queue-count")).toBeVisible({ timeout: 30_000 });

  // Skip anything already committed — those cases have no action bar left.
  await openReferral(page, "unpinned");
  await page.getByRole("button", { name: "Decline", exact: true }).click();

  // A bottom sheet, with reasons as taps rather than a text box to type into.
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".reason-chip").first()).toBeVisible();

  // Confirm stays closed until a reason is chosen.
  const confirm = sheet.getByRole("button", { name: /Confirm decline/i });
  await expect(confirm).toBeDisabled();
  await sheet.locator(".reason-chip").first().click();
  await expect(confirm).toBeEnabled();

  await sheet.getByRole("button", { name: /Cancel/i }).click();
  await expect(sheet).toBeHidden();
});

test("a note typed on one device appears on the other", async ({ page, context }) => {
  await page.goto(QUEUE);
  await page.getByRole("button", { name: /Sync mail/i }).click();
  await expect(page.locator(".queue-count")).toBeVisible({ timeout: 30_000 });

  const first = (await entries(page)).first();
  const caseId = ((await first.innerText()).match(/R\d+/) ?? [""])[0];
  await first.click();
  await expect(page.getByRole("heading", { name: /Shared notes/i })).toBeVisible();

  // The same case, open on a second device — the supervisor's laptop while the
  // phone is in a car park.
  const other = await context.newPage();
  await other.goto(QUEUE);
  await (await entries(other)).filter({ hasText: caseId }).first().click();
  await expect(other.getByRole("heading", { name: /Shared notes/i })).toBeVisible();

  const note = `Called the FCM at ${Date.now()}`;
  await page.locator(".notes-input").fill(note);
  await page.getByRole("button", { name: /Add note/i }).click();

  // No refresh, no polling — the Yjs room broadcasts it.
  await expect(other.locator(".notes-text", { hasText: note })).toBeVisible({ timeout: 20_000 });
  await other.close();
});

test("the welcome page points at the app, the inbox and the source", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Referral triage for Indiana DCS/i })).toBeVisible();

  // Mailpit is how a reviewer creates a referral, so it is a first-class link.
  await expect(page.getByRole("link", { name: /Demo inbox/i })).toHaveAttribute(
    "href",
    /:8025$/,
  );
  await expect(page.getByRole("link", { name: /Source code/i })).toHaveAttribute(
    "href",
    /IrisDCSReferrals/,
  );

  await page.getByRole("link", { name: /Open the supervisor queue/i }).click();
  await expect(page.getByRole("button", { name: /Sync mail/i })).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(false);
});

test("back walks out of a case tab by tab", async ({ page }) => {
  await page.goto(QUEUE);
  await page.getByRole("button", { name: /Sync mail/i }).click();
  await expect(page.locator(".queue-count")).toBeVisible({ timeout: 30_000 });

  await openReferral(page, "first");
  await expect(page).toHaveURL(/#\/case\/.+\/recommend$/);

  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page).toHaveURL(/#\/case\/.+\/explore$/);

  // A tab is a history entry, so back is undo rather than "leave the case".
  await page.goBack();
  await expect(page).toHaveURL(/#\/case\/.+\/recommend$/);
  await expect(page.getByRole("heading", { name: /Recommended worker/i })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#\/queue$/);
  await expect(page.getByRole("button", { name: /Sync mail/i })).toBeVisible();
});

for (const width of [375, 768, 1280]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(QUEUE);
    await page.getByRole("button", { name: /Sync mail/i }).click();
    await expect(page.locator(".queue-count")).toBeVisible({ timeout: 30_000 });

    expect(await noHorizontalOverflow(page)).toBe(false);

    await openReferral(page, "first");
    await expect(page.getByRole("heading", { name: /Recommended worker/i })).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(false);
  });
}

test("every tappable target clears 44px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(QUEUE);
  await page.getByRole("button", { name: /Sync mail/i }).click();
  await expect(page.locator(".queue-count")).toBeVisible({ timeout: 30_000 });
  await openReferral(page, "first");
  await expect(page.getByRole("heading", { name: /Recommended worker/i })).toBeVisible();

  // WCAG 2.5.5. A 32px button is a mis-tap waiting to happen in a car park
  // between home visits, which is where this app is actually used.
  const short = await page.evaluate(() =>
    [...document.querySelectorAll(".app-shell button")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.height < 44;
      })
      .map((element) => `${element.className}:${(element.textContent ?? "").slice(0, 20)}`),
  );
  expect(short).toEqual([]);
});
