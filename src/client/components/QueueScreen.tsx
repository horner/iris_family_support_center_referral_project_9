/**
 * Plan mode — "how do we staff everything that's pending?"
 *
 * On a phone this is a card list, deadline-sorted, so the most-at-risk referral
 * is the first thing a thumb reaches. At desktop width the same filtered and
 * sorted rows become a DataVis table. It is never a 30-row table squeezed onto
 * a 375px screen.
 */
import { useMemo, useState } from "react";
import { Badge, Button } from "@mieweb/ui";

import type { Plan } from "../../model.ts";
import type { QueueRow } from "../api.ts";
import { formatDate, useI18n, type MessageKey } from "../i18n.ts";
import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import {
  deadlineOf,
  EMPTY_FILTER,
  filterAndSort,
  uniqueValues,
  type QueueFilter,
  type QueueSort,
} from "../queue-view.ts";
import { ContentionBanner } from "./ContentionBanner.tsx";
import { outcomeVariant } from "./outcome.ts";
import { QueueFilters } from "./QueueFilters.tsx";
import { QueueTable } from "./QueueTable.tsx";
import { UnknownsBox } from "./UnknownsBox.tsx";
import "./QueueScreen.scss";

const DAY = 24 * 60 * 60 * 1000;

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
  const [filter, setFilter] = useState<QueueFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<QueueSort>({ field: "deadline", direction: "asc" });

  // Below this the table stops being readable and the cards take over.
  const wide = useMediaQuery("(min-width: 60rem)");

  const visible = useMemo(() => filterAndSort(rows, filter, sort), [rows, filter, sort]);
  const services = useMemo(() => uniqueValues(rows, "service"), [rows]);
  const outcomes = useMemo(() => uniqueValues(rows, "outcome"), [rows]);

  return (
    <div className="queue-screen">
      <header className="queue-header">
        <h1 className="queue-heading">{t("queue.heading")}</h1>
        <p className="queue-count" aria-live="polite">
          {visible.length === rows.length
            ? t("queue.count", { count: rows.length })
            : t("queue.countFiltered", { count: visible.length, total: rows.length })}
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

      {wide ? (
        <QueueTable onOpen={onOpen} rows={rows} />
      ) : (
        <>
          <QueueFilters
            filter={filter}
            onFilterChange={setFilter}
            onSortChange={setSort}
            outcomes={outcomes}
            services={services}
            sort={sort}
          />

          {visible.length === 0 ? (
            <p className="queue-empty">
              {rows.length === 0 ? t("queue.empty") : t("filter.none")}
            </p>
          ) : (
            <ul className="queue-list">
              {visible.map((row) => {
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
                    <Badge className="queue-outcome" variant={outcomeVariant(row.outcome)} size="sm">
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
        </>
      )}

      <UnknownsBox unknowns={plan?.unknowns ?? []} />
    </div>
  );
}
