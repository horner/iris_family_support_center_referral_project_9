/**
 * Explore mode — every staff member, with the four gates shown as chips and
 * the score broken out.
 *
 * Blocked candidates are greyed, never hidden. A supervisor who cannot see the
 * person they expected to see assumes the tool is broken; showing them with
 * "Does not serve Whitley" against their name answers the question instead of
 * raising it.
 *
 * Fairness re-ranks here live. It only ever reorders — it can never make an
 * ineligible worker eligible, because the gates are computed before it.
 */
import { Badge } from "@mieweb/ui";

import { fairnessScore } from "../../engine.ts";
import type { CandidateEvaluation, EngineConfig, GateName } from "../../model.ts";
import type { StaffRow } from "../api.ts";
import { useI18n, type MessageKey } from "../i18n.ts";
import "./ExplorePanel.scss";

const GATES: GateName[] = ["active", "role", "county", "capacity"];

export interface ExplorePanelProps {
  candidates: CandidateEvaluation[];
  roster: Map<string, StaffRow>;
  config: EngineConfig;
  selectedStaffId: string | undefined;
  onSelect: (staffId: string) => void;
}

export function ExplorePanel({
  candidates,
  roster,
  config,
  selectedStaffId,
  onSelect,
}: ExplorePanelProps): React.ReactElement {
  const { t } = useI18n();

  // Re-score on the current fairness policy so the ordering the supervisor
  // sees matches the policy they just chose.
  const ranked = candidates
    .map((candidate) => {
      const worker = roster.get(candidate.staffId);
      const max = worker?.maxFamiliesDcs ?? 0;
      const remaining = Math.max(0, max - (worker?.currentFamiliesAssigned ?? 0));
      const fairness = fairnessScore(remaining, max, config);
      return {
        candidate,
        worker,
        fairness,
        total: candidate.score.language + candidate.score.availability + fairness,
      };
    })
    .sort((a, b) => {
      if (a.candidate.eligible !== b.candidate.eligible) return a.candidate.eligible ? -1 : 1;
      if (a.total !== b.total) return b.total - a.total;
      return a.candidate.staffId.localeCompare(b.candidate.staffId);
    });

  return (
    <section className="explore-panel" aria-labelledby="explore-title">
      <h2 className="explore-title" id="explore-title">
        {t("explore.title")}
      </h2>
      <p className="explore-summary" aria-live="polite">
        {t("explore.summary", {
          eligible: candidates.filter((candidate) => candidate.eligible).length,
          total: candidates.length,
        })}
      </p>

      <ul className="explore-list">
        {ranked.map(({ candidate, worker, fairness, total }) => (
          <li className="explore-item" key={candidate.staffId}>
            <button
              aria-disabled={!candidate.eligible}
              aria-pressed={candidate.staffId === selectedStaffId}
              className={[
                "explore-card",
                candidate.eligible ? "" : "explore-card--blocked",
                candidate.staffId === selectedStaffId ? "explore-card--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(candidate.staffId)}
              type="button"
            >
              <span className="explore-identity">
                <span className="explore-name">{candidate.staffName}</span>
                <span className="explore-meta">
                  {candidate.staffId}
                  {worker ? ` · ${worker.role}` : ""}
                </span>
              </span>

              <span className="explore-gates">
                {GATES.map((gate) => {
                  const result = candidate.gates[gate];
                  return (
                    <Badge
                      key={gate}
                      size="sm"
                      variant={result.pass ? "success" : "danger"}
                      title={result.detail}
                    >
                      {t(`gate.${gate}` as MessageKey)}
                    </Badge>
                  );
                })}
              </span>

              {candidate.blockedBy.length > 0 ? (
                <span className="explore-blocked">
                  {candidate.blockedBy
                    .map((gate) => candidate.gates[gate as GateName]?.detail)
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}

              <span className="explore-score">
                <span>{t("explore.language", { value: candidate.score.language })}</span>
                <span>{t("explore.availability", { value: candidate.score.availability })}</span>
                <span>{t("explore.fairness", { value: round(fairness) })}</span>
                <strong>{t("explore.total", { value: round(total) })}</strong>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const round = (value: number): number => Math.round(value * 100) / 100;
