/**
 * Plan mode — "how do we staff everything that's pending?"
 *
 * On a phone this is a card list sorted by deadline urgency, so the
 * most-at-risk referral is the first thing a thumb reaches. The same data
 * becomes a table at tablet width and up; it is never a 30-row table squeezed
 * onto a 375px screen.
 */
import { Badge, Button } from "@mieweb/ui";

import { APP_CONFIG, responseDeadline } from "../../config.ts";
import type { Plan } from "../../model.ts";
import type { QueueRow } from "../api.ts";
import { formatDate, useI18n, type MessageKey } from "../i18n.ts";
import { ContentionBanner } from "./ContentionBanner.tsx";
import { UnknownsBox } from "./UnknownsBox.tsx";
import "./QueueScreen.scss";

const DAY = 24 * 60 * 60 * 1000;

const outcomeVariant = (outcome: string | null): "success" | "warning" | "danger" | "secondary" => {
  if (outcome === "match") return "success";
  if (outcome === "no_capacity") return "warning";
  if (outcome === "no_eligible_staff") return "danger";
  return "secondary";
};

const deadlineOf = (row: QueueRow): Date =>
  responseDeadline(new Date(row.receivedAt ?? Date.now()), APP_CONFIG.responseDeadline);

export interface QueueScreenProps {
  rows: QueueRow[];
  plan: Plan | undefined;
  busy: boolean;
  onOpen: (messageId: string) => void;
  onSync: () => void;
  onReplan: () => void;
}

export function QueueScreen({
  rows,
  plan,
  busy,
  onOpen,
  onSync,
  onReplan,
}: QueueScreenProps): React.ReactElement {
  const { t, locale } = useI18n();

  // Most-at-risk first: the deadline drives the order, not the arrival time.
  const sorted = [...rows].sort((a, b) => deadlineOf(a).getTime() - deadlineOf(b).getTime());

  return (
    <div className="queue-screen">
      <header className="queue-header">
        <h1 className="queue-heading">{t("queue.heading")}</h1>
        <p className="queue-count" aria-live="polite">
          {t("queue.count", { count: rows.length })}
        </p>
        <div className="queue-actions">
          <Button onClick={onSync} disabled={busy} variant="secondary" size="sm">
            {t("queue.sync")}
          </Button>
          <Button onClick={onReplan} disabled={busy} variant="primary" size="sm">
            {t("queue.replan")}
          </Button>
        </div>
      </header>

      <ContentionBanner contention={plan?.contention ?? []} />

      {sorted.length === 0 ? (
        <p className="queue-empty">{t("queue.empty")}</p>
      ) : (
        <ul className="queue-list">
          {sorted.map((row) => {
            const deadline = deadlineOf(row);
            const days = Math.ceil((deadline.getTime() - Date.now()) / DAY);
            const urgency = days < 0 ? "overdue" : days === 0 ? "today" : days <= 1 ? "soon" : "ok";
            const pinned = row.status === "assigned" || row.status === "declined";

            return (
              <li className="queue-item" key={row.messageId}>
                <button
                  className={`queue-card queue-card--${urgency}`}
                  onClick={() => onOpen(row.messageId)}
                  type="button"
                  aria-label={t("queue.open", { referral: row.referralId ?? row.messageId })}
                >
                  <span className="queue-card-top">
                    <span className="queue-referral">{row.referralId ?? "—"}</span>
                    <Badge variant={outcomeVariant(row.outcome)} size="sm">
                      {t(`outcome.${row.outcome ?? "no_capacity"}` as MessageKey)}
                    </Badge>
                  </span>

                  <span className="queue-service">{row.service ?? "—"}</span>
                  <span className="queue-county">{row.county ?? "—"}</span>

                  <span className="queue-deadline">
                    {days < 0
                      ? t("queue.overdue", { date: formatDate(locale, deadline.toISOString()) })
                      : days === 0
                        ? t("queue.dueToday")
                        : t("queue.dueIn", { days })}
                  </span>

                  <span className="queue-assignee">
                    {row.proposedStaffName
                      ? t("queue.proposed", { name: row.proposedStaffName })
                      : t("queue.unassigned")}
                  </span>

                  {pinned ? (
                    <span className="queue-pinned">
                      <Badge variant="outline" size="sm">
                        {t(`status.${row.status}` as MessageKey)}
                      </Badge>
                      <span className="queue-pinned-note">{t("queue.pinned")}</span>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <UnknownsBox unknowns={plan?.unknowns ?? []} />
    </div>
  );
}
