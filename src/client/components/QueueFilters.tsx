/**
 * Filter controls for the pending queue. Present at every width — a supervisor
 * looking for one county's referrals should not have to find a laptop.
 */
import type { ReactElement } from "react";

import { useI18n, type MessageKey } from "../i18n.ts";
import type { QueueFilter, QueueSort, QueueSortField } from "../queue-view.ts";
import "./QueueFilters.scss";

const SORT_FIELDS: readonly QueueSortField[] = [
  "deadline",
  "referralId",
  "service",
  "county",
  "outcome",
];

export interface QueueFiltersProps {
  filter: QueueFilter;
  onFilterChange: (filter: QueueFilter) => void;
  /** Sort is a control on a phone and a header click on desktop — same state either way. */
  sort: QueueSort;
  onSortChange: (sort: QueueSort) => void;
  services: string[];
  outcomes: string[];
}

export function QueueFilters({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  services,
  outcomes,
}: QueueFiltersProps): ReactElement {
  const { t } = useI18n();

  return (
    <div className="queue-filters">
      <div className="queue-filter">
        <label className="queue-filter-label" htmlFor="queue-search">
          {t("filter.search")}
        </label>
        <input
          className="queue-filter-input"
          id="queue-search"
          onChange={(event) => onFilterChange({ ...filter, search: event.target.value })}
          placeholder={t("filter.searchHint")}
          type="search"
          value={filter.search}
        />
      </div>

      <div className="queue-filter">
        <label className="queue-filter-label" htmlFor="queue-service">
          {t("case.service")}
        </label>
        <select
          className="queue-filter-input"
          id="queue-service"
          onChange={(event) => onFilterChange({ ...filter, service: event.target.value })}
          value={filter.service}
        >
          <option value="">{t("filter.all")}</option>
          {services.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>
      </div>

      <div className="queue-filter">
        <label className="queue-filter-label" htmlFor="queue-outcome">
          {t("table.outcome")}
        </label>
        <select
          className="queue-filter-input"
          id="queue-outcome"
          onChange={(event) => onFilterChange({ ...filter, outcome: event.target.value })}
          value={filter.outcome}
        >
          <option value="">{t("filter.all")}</option>
          {outcomes.map((outcome) => (
            <option key={outcome} value={outcome}>
              {t(`outcome.${outcome}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="queue-filter">
        <label className="queue-filter-label" htmlFor="queue-sort">
          {t("filter.sort")}
        </label>
        <select
          className="queue-filter-input"
          id="queue-sort"
          onChange={(event) =>
            onSortChange({ ...sort, field: event.target.value as QueueSortField })
          }
          value={sort.field}
        >
          {SORT_FIELDS.map((field) => (
            <option key={field} value={field}>
              {t(`sort.${field}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
