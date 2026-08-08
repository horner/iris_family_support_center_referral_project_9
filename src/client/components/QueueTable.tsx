/**
 * The pending queue as a real DataVis grid: the DataVis toolbar brings its own
 * filter bar, multi-column sort, grouping and column configuration, so this
 * file only supplies rows, column types and cell rendering.
 *
 * Only rendered at desktop width — a 30-row grid on a 375px screen is the thing
 * this app exists to avoid.
 */
import { useMemo } from "react";
import { Badge } from "@mieweb/ui";
import {
  buildLocalSourceTypeInfo,
  DataGrid,
  TableRenderer,
  type TableColumn,
} from "@mieweb/datavis";
import { ComputedView, Source } from "datavis-ace";

import type { QueueRow } from "../api.ts";
import { formatDate, useI18n, type MessageKey } from "../i18n.ts";
import { deadlineOf } from "../queue-view.ts";
import { outcomeVariant } from "./outcome.ts";
import "./QueueTable.scss";

const DAY = 24 * 60 * 60 * 1000;

/** LocalSource reads its rows from a global, so the grid needs a name to read from. */
const VAR_NAME = "__irisQueueRows";

export interface QueueTableProps {
  rows: QueueRow[];
  onOpen: (messageId: string) => void;
}

type GridRow = Record<string, unknown>;

const toGridRows = (rows: QueueRow[], unassigned: string): GridRow[] =>
  rows.map((row) => ({
    messageId: row.messageId,
    referralId: row.referralId ?? "—",
    caseNumber: row.caseNumber ?? "—",
    service: row.service ?? "—",
    county: row.county ?? "—",
    outcome: row.outcome ?? "",
    proposedStaffName: row.proposedStaffName ?? unassigned,
    status: row.status,
    deadline: deadlineOf(row).toISOString().slice(0, 10),
  }));

const publish = (gridRows: GridRow[], columns: TableColumn[]): void => {
  (window as unknown as Record<string, unknown>)[VAR_NAME] = {
    data: gridRows,
    typeInfo: buildLocalSourceTypeInfo(gridRows, columns),
  };
};

export function QueueTable({ rows, onOpen }: QueueTableProps): React.ReactElement {
  const { t, locale } = useI18n();

  const columns = useMemo<TableColumn[]>(
    () => [
      { field: "referralId", header: t("table.referral"), width: 120, typeInfo: { type: "string" } },
      { field: "service", header: t("case.service"), width: 240, typeInfo: { type: "string" } },
      { field: "county", header: t("case.county"), width: 120, typeInfo: { type: "string" } },
      { field: "outcome", header: t("table.outcome"), width: 160, typeInfo: { type: "string" } },
      {
        field: "proposedStaffName",
        header: t("table.proposed"),
        width: 200,
        typeInfo: { type: "string" },
      },
      { field: "deadline", header: t("table.deadline"), width: 150, typeInfo: { type: "date" } },
    ],
    [t],
  );

  const gridRows = useMemo(() => toGridRows(rows, t("queue.unassigned")), [rows, t]);

  // LocalSource copies the global as it is constructed, so publish first and
  // rebuild the pipeline whenever the rows change.
  const pipeline = useMemo(() => {
    publish(gridRows, columns);
    const source = new Source({ type: "local", varName: VAR_NAME }, undefined, undefined, {
      name: "iris-queue",
    });
    return { source, view: new ComputedView(source, { name: "iris-queue-view" }) };
  }, [gridRows, columns]);

  const controlFields = useMemo(
    () => columns.map((column) => ({ field: column.field, displayName: String(column.header) })),
    [columns],
  );

  return (
    <div className="queue-table">
      <DataGrid
        allColumns={columns}
        controlFields={controlFields}
        locale={locale}
        mode="full"
        showToolbar
        title={t("queue.heading")}
        view={pipeline.view}
      >
        <TableRenderer
          columns={columns}
          features={{ stickyHeaders: true, zebraStripe: true, columnResize: true }}          formatCell={(value, row, column) => {
            if (column.field === "outcome") {
              const outcome = String(value || "no_capacity");
              return (
                <Badge variant={outcomeVariant(outcome)} size="sm">
                  {t(`outcome.${outcome}` as MessageKey)}
                </Badge>
              );
            }
            if (column.field === "deadline") {
              const days = Math.ceil((new Date(String(value)).getTime() - Date.now()) / DAY);
              const urgency = days < 0 ? "overdue" : days <= 1 ? "soon" : "ok";
              return (
                <span className={`queue-table-deadline queue-table-deadline--${urgency}`}>
                  {formatDate(locale, String(value))}
                </span>
              );
            }
            if (
              column.field === "referralId" &&
              (row.status === "assigned" || row.status === "declined")
            ) {
              return (
                <span className="queue-table-pinned">
                  {String(value)}{" "}
                  <Badge variant="outline" size="sm">
                    {t(`status.${row.status}` as MessageKey)}
                  </Badge>
                </span>
              );
            }
            return String(value ?? "");
          }}
          onRowClick={(row) => onOpen(String(row.data.messageId))}
          /* DataGrid clones this child and supplies the computed view data. */
          viewData={null}
        />
      </DataGrid>
    </div>
  );
}
