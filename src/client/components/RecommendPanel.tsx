/**
 * Recommend mode — the phone default. One recommendation, the reasons behind
 * it, and the runners-up with *why* they ranked lower.
 *
 * Where a candidate lost to contention rather than to fit, the rationale says
 * so by name: "S031 was the better match but is allocated to R770012." That
 * distinction is the difference between a scheduling gap and a staffing gap.
 */
import { Alert, AlertDescription, AlertTitle, Badge } from "@mieweb/ui";

import type { CaseProposal } from "../../case-doc.ts";
import { useI18n, type MessageKey } from "../i18n.ts";
import type { StaffRow } from "../api.ts";
import "./RecommendPanel.scss";

export interface RecommendPanelProps {
  proposal: CaseProposal;
  roster: Map<string, StaffRow>;
  requiresJudgment: boolean;
}

export function RecommendPanel({
  proposal,
  roster,
  requiresJudgment,
}: RecommendPanelProps): React.ReactElement {
  const { t } = useI18n();
  const worker = proposal.staffId ? roster.get(proposal.staffId) : undefined;

  return (
    <section className="recommend-panel" aria-labelledby="recommend-title">
      {requiresJudgment ? (
        <Alert variant="warning" role="note">
          <AlertTitle>{t("outcome.needs_judgment")}</AlertTitle>
          <AlertDescription>{t("recommend.judgment")}</AlertDescription>
        </Alert>
      ) : null}

      <h2 className="recommend-title" id="recommend-title">
        {t("recommend.title")}
      </h2>

      <p className="recommend-worker">
        {worker ? (
          <>
            <span className="recommend-name">{worker.staffName}</span>
            <span className="recommend-meta">
              {worker.staffId} · {worker.role} · {worker.currentFamiliesAssigned}/
              {worker.maxFamiliesDcs}
            </span>
          </>
        ) : (
          <span className="recommend-name recommend-name--none">{t("recommend.none")}</span>
        )}
        <Badge variant={proposal.outcome === "match" ? "success" : "warning"} size="sm">
          {t(`outcome.${proposal.outcome}` as MessageKey)}
        </Badge>
      </p>

      <h3 className="recommend-subtitle">{t("recommend.why")}</h3>
      <ul className="recommend-rationale">
        {proposal.rationale.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {proposal.contendedWith.length > 0 ? (
        <p className="recommend-contention">
          <strong>{t("recommend.contention")}:</strong> {proposal.contendedWith.join(", ")}
        </p>
      ) : null}

      {proposal.runnersUp.length > 0 ? (
        <>
          <h3 className="recommend-subtitle">{t("recommend.runnersUp")}</h3>
          <ul className="recommend-runners">
            {proposal.runnersUp.map((runner) => (
              <li className="recommend-runner" key={runner.staffId}>
                <span className="recommend-runner-name">
                  {roster.get(runner.staffId)?.staffName ?? runner.staffId}
                </span>
                <span className="recommend-runner-reason">{runner.reason}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
