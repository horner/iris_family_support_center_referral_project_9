/**
 * One case, three views of the *same* objects — recommend, explore, case
 * sheet. Switching mode never refetches and never loses the selection, because
 * they are three readings of one evaluation, not three screens.
 *
 * Recommend is the phone default: the answer first, the reasoning under it,
 * everything else a tab away.
 */
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@mieweb/ui";

import { caseStatus } from "../../case-doc.ts";
import type { EngineConfig, FairnessStrategy, Pin, Plan } from "../../model.ts";
import { assign, decline, newCommitKey, scenario, type StaffRow } from "../api.ts";
import { useI18n, type MessageKey } from "../i18n.ts";
import { useCaseDoc, type Presence } from "../hooks/useCaseDoc.ts";
import { ActionBar } from "./ActionBar.tsx";
import { CaseSheet } from "./CaseSheet.tsx";
import { ExplorePanel } from "./ExplorePanel.tsx";
import { FairnessSelector } from "./FairnessSelector.tsx";
import { NotesPanel } from "./NotesPanel.tsx";
import { RecommendPanel } from "./RecommendPanel.tsx";
import { ReasonSheet } from "./ReasonSheet.tsx";
import { UnknownsBox } from "./UnknownsBox.tsx";
import "./CaseScreen.scss";

const DECLINE_REASONS: readonly MessageKey[] = [
  "decline.no_capacity",
  "decline.no_qualified",
  "decline.out_of_area",
  "decline.duplicate",
  "decline.family_declined",
  "decline.other",
];

const OVERRIDE_REASONS: readonly MessageKey[] = [
  "override.better_fit",
  "override.continuity",
  "override.language",
  "override.schedule",
  "override.other",
];

type CaseMode = "recommend" | "explore" | "sheet";
type SheetKind = "assign" | "decline";

export interface CaseScreenProps {
  messageId: string;
  me: Presence;
  roster: Map<string, StaffRow>;
  online: boolean;
  fairness: FairnessStrategy;
  onFairnessChange: (value: FairnessStrategy) => void;
  onBack: () => void;
  onCommitted: () => void;
}

export function CaseScreen({
  messageId,
  me,
  roster,
  online,
  fairness,
  onFairnessChange,
  onBack,
  onCommitted,
}: CaseScreenProps): React.ReactElement {
  const { t } = useI18n();
  const live = useCaseDoc(messageId, me);
  const [mode, setMode] = useState<CaseMode>("recommend");
  const [selected, setSelected] = useState<string>();
  const [sheet, setSheet] = useState<SheetKind>();
  const [busy, setBusy] = useState(false);
  const [rejection, setRejection] = useState<string>();
  const [blocked, setBlocked] = useState<string>();
  const [knockOn, setKnockOn] = useState<string[]>([]);

  const doc = live.doc;
  const config = useMemo<EngineConfig>(() => ({ fairness, fairnessWeight: 1 }), [fairness]);
  const chosen = selected ?? doc?.proposal.staffId;

  // The planner's own recommendation is the starting selection; an override is
  // an explicit act, never a side effect of the doc updating underneath.
  useEffect(() => setSelected(undefined), [messageId]);

  if (!live.ready || !doc) {
    return (
      <div className="case-loading">
        <button className="case-back" onClick={onBack} type="button">
          {t("app.back")}
        </button>
        {/* Offline with nothing cached is a real state, not a spinner. */}
        <p>{online ? t("app.loading") : t("app.offline")}</p>
      </div>
    );
  }

  const status = caseStatus(doc);
  const candidate = doc.evaluation.candidates.find((entry) => entry.staffId === chosen);
  const isOverride = Boolean(selected) && selected !== doc.proposal.staffId;

  const select = (staffId: string): void => {
    const entry = doc.evaluation.candidates.find((item) => item.staffId === staffId);
    if (!entry?.eligible) {
      // Refused here *and* re-checked on the server. The client stops a
      // pointless round trip; the server is what actually enforces the gate.
      setBlocked(
        entry?.blockedBy
          .map((gate) => entry.gates[gate as keyof typeof entry.gates]?.detail)
          .filter(Boolean)
          .join(" · ") ?? t("explore.proposeBlocked"),
      );
      return;
    }
    setBlocked(undefined);
    setSelected(staffId);
  };

  const openAssign = async (): Promise<void> => {
    setRejection(undefined);
    if (!chosen) return;

    // Show the knock-on before the commit, not after: taking a contended
    // worker moves somebody else's referral, and that is the supervisor's
    // call to make knowingly.
    const pins: Pin[] = [{ referralId: doc.referral.referralId ?? messageId, staffId: chosen }];
    try {
      const hypothetical: Plan = await scenario(pins);
      const displaced = hypothetical.allocations
        .filter(
          (allocation) =>
            allocation.referralId !== (doc.referral.referralId ?? messageId) &&
            allocation.outcome !== "match",
        )
        .map((allocation) => allocation.referralId);
      setKnockOn(displaced);
    } catch {
      setKnockOn([]);
    }

    if (isOverride) {
      setSheet("assign");
      return;
    }
    await commitAssign("");
  };

  const commitAssign = async (reason: string): Promise<void> => {
    if (!chosen) return;
    setBusy(true);
    setSheet(undefined);
    try {
      const result = await assign({
        messageId,
        staffId: chosen,
        commitKey: newCommitKey(),
        committedBy: me.name,
      });
      if (!result.ok) {
        // Say exactly what the server said, in place. The case drops back to a
        // fresh recommendation rather than pretending the assignment stuck.
        setRejection(result.rejection.message);
        setSelected(undefined);
      } else if (reason) {
        live.addNote({ author: me.name, text: reason, at: new Date().toISOString() });
      }
      onCommitted();
    } finally {
      setBusy(false);
    }
  };

  const commitDecline = async (reason: string): Promise<void> => {
    setBusy(true);
    setSheet(undefined);
    try {
      const result = await decline({
        messageId,
        commitKey: newCommitKey(),
        committedBy: me.name,
        declineReason: reason,
      });
      if (!result.ok) setRejection(result.rejection.message);
      onCommitted();
    } finally {
      setBusy(false);
    }
  };

  const assignLabel = candidate
    ? t("action.assign", { name: candidate.staffName })
    : t("action.assignNobody");

  return (
    <div className="case-screen">
      <button className="case-back" onClick={onBack} type="button">
        {t("app.back")}
      </button>

      <header className="case-header">
        <h1 className="case-heading">{doc.referral.referralId ?? messageId}</h1>
        <p className="case-subheading">
          {doc.referral.service} · {doc.referral.county} · {t(`status.${status}` as MessageKey)}
        </p>
        {live.others.length > 0 ? (
          <p className="case-presence" aria-live="polite">
            {live.others.length === 1
              ? t("case.presenceOne")
              : t("case.presence", { count: live.others.length })}
          </p>
        ) : null}
        {live.storageDenied ? (
          <p className="case-storage">{t("app.offline")}</p>
        ) : null}
      </header>

      <nav className="case-modes" aria-label={t("app.title")}>
        {(["recommend", "explore", "sheet"] as CaseMode[]).map((option) => (
          <button
            aria-current={mode === option}
            className={`case-mode${mode === option ? " case-mode--on" : ""}`}
            key={option}
            onClick={() => setMode(option)}
            type="button"
          >
            {t(`mode.${option}` as MessageKey)}
          </button>
        ))}
      </nav>

      {rejection ? (
        <Alert variant="danger" role="alert">
          <AlertTitle>{t("action.rejected", { message: "" })}</AlertTitle>
          <AlertDescription>{rejection}</AlertDescription>
        </Alert>
      ) : null}

      {blocked ? (
        <Alert variant="warning" role="alert">
          <AlertTitle>{t("explore.proposeBlocked")}</AlertTitle>
          <AlertDescription>{blocked}</AlertDescription>
        </Alert>
      ) : null}

      {knockOn.length > 0 && !doc.commitment ? (
        <Alert variant="warning" role="status">
          <AlertDescription>
            {t("action.knockOn", { referrals: knockOn.join(", ") })}
          </AlertDescription>
        </Alert>
      ) : null}

      {mode === "recommend" ? (
        <RecommendPanel
          proposal={doc.proposal}
          roster={roster}
          requiresJudgment={doc.evaluation.requiresSupervisorJudgment}
        />
      ) : null}

      {mode === "explore" ? (
        <>
          <FairnessSelector value={fairness} onChange={onFairnessChange} />
          <ExplorePanel
            candidates={doc.evaluation.candidates}
            config={config}
            onSelect={select}
            roster={roster}
            selectedStaffId={chosen}
          />
        </>
      ) : null}

      {mode === "sheet" ? <CaseSheet doc={doc} /> : null}

      {/* Works with no signal; merges on reconnect. */}
      <NotesPanel
        notes={doc.notes}
        onAdd={(text) => live.addNote({ author: me.name, text, at: new Date().toISOString() })}
      />

      {/* Never hidden, in any mode, at any width. */}
      <UnknownsBox unknowns={doc.evaluation.unknowns} />

      <ActionBar
        assignLabel={assignLabel}
        busy={busy}
        canAssign={Boolean(candidate?.eligible)}
        committedStatus={doc.commitment ? t(`status.${doc.commitment.status}` as MessageKey) : undefined}
        onAssign={() => void openAssign()}
        onDecline={() => setSheet("decline")}
        online={online}
      />

      {sheet ? (
        <ReasonSheet
          busy={busy}
          categories={sheet === "assign" ? OVERRIDE_REASONS : DECLINE_REASONS}
          confirmLabel={sheet === "assign" ? t("action.confirmAssign") : t("action.confirmDecline")}
          onCancel={() => setSheet(undefined)}
          onConfirm={(reason) =>
            void (sheet === "assign" ? commitAssign(reason) : commitDecline(reason))
          }
          title={sheet === "assign" ? t("action.overrideReason") : t("action.declineReason")}
        />
      ) : null}
    </div>
  );
}
