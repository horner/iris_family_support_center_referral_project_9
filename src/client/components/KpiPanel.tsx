/**
 * The KPI the brief actually asked for: declines per week by service line —
 * the signal that says "we are short of Home-Based Therapy capacity in
 * Whitley", which is a hiring decision, not a scheduling one.
 *
 * Paired with the gap breakdown, because a decline for "nobody qualified" and
 * a decline for "everyone is full" point at different fixes.
 */
import { Badge } from "@mieweb/ui";

import type { Kpi } from "../api.ts";
import { useI18n, type MessageKey } from "../i18n.ts";
import "./KpiPanel.scss";

export function KpiPanel({ kpi }: { kpi: Kpi | undefined }): React.ReactElement {
  const { t } = useI18n();

  if (!kpi || (kpi.declines.length === 0 && kpi.gaps.length === 0)) {
    return <p className="kpi-empty">{t("kpi.none")}</p>;
  }

  return (
    <section className="kpi-panel" aria-labelledby="kpi-title">
      <h2 className="kpi-title" id="kpi-title">
        {t("kpi.title")}
      </h2>

      <h3 className="kpi-subtitle">{t("kpi.declines")}</h3>
      <ul className="kpi-list">
        {kpi.declines.map((row) => (
          <li className="kpi-row" key={`${row.week}:${row.service}`}>
            <span className="kpi-week">{row.week}</span>
            <span className="kpi-service">{row.service}</span>
            <Badge variant="danger" size="sm">
              {row.declines}
            </Badge>
          </li>
        ))}
      </ul>

      <h3 className="kpi-subtitle">{t("kpi.gapTitle")}</h3>
      <ul className="kpi-list">
        {kpi.gaps.map((row) => (
          <li className="kpi-row" key={`${row.outcome}:${row.service}`}>
            <span className="kpi-week">{t(`outcome.${row.outcome}` as MessageKey)}</span>
            <span className="kpi-service">{row.service}</span>
            <Badge variant="secondary" size="sm">
              {row.count}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
