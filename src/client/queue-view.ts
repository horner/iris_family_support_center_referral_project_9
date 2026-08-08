/**
 * Filtering and sorting for the pending queue, in one place so the phone card
 * list and the desktop data table are two views of the same result rather than
 * two implementations that drift.
 */
import { APP_CONFIG, responseDeadline } from "../config.ts";
import type { QueueRow } from "./api.ts";

export type QueueSortField = "deadline" | "referralId" | "service" | "county" | "outcome";
export type SortDirection = "asc" | "desc";

export interface QueueSort {
  field: QueueSortField;
  direction: SortDirection;
}

export interface QueueFilter {
  search: string;
  service: string;
  outcome: string;
}

export const EMPTY_FILTER: QueueFilter = { search: "", service: "", outcome: "" };

export const deadlineOf = (row: QueueRow): Date =>
  responseDeadline(new Date(row.receivedAt ?? Date.now()), APP_CONFIG.responseDeadline);

const searchable = (row: QueueRow): string =>
  [row.referralId, row.caseNumber, row.service, row.county, row.proposedStaffName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const key = (row: QueueRow, field: QueueSortField): string | number => {
  switch (field) {
    case "deadline":
      return deadlineOf(row).getTime();
    case "referralId":
      return row.referralId ?? "";
    case "service":
      return row.service ?? "";
    case "county":
      return row.county ?? "";
    case "outcome":
      return row.outcome ?? "";
  }
};

export const uniqueValues = (rows: QueueRow[], field: "service" | "outcome"): string[] =>
  [...new Set(rows.map((row) => row[field]).filter((value): value is string => Boolean(value)))].sort();

export function filterAndSort(rows: QueueRow[], filter: QueueFilter, sort: QueueSort): QueueRow[] {
  const needle = filter.search.trim().toLowerCase();

  const kept = rows.filter(
    (row) =>
      (!needle || searchable(row).includes(needle)) &&
      (!filter.service || row.service === filter.service) &&
      (!filter.outcome || row.outcome === filter.outcome),
  );

  const direction = sort.direction === "asc" ? 1 : -1;
  return kept.sort((a, b) => {
    const left = key(a, sort.field);
    const right = key(b, sort.field);
    if (left === right) return deadlineOf(a).getTime() - deadlineOf(b).getTime();
    return (left < right ? -1 : 1) * direction;
  });
}
