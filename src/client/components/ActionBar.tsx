/**
 * The commit bar. Sticky at the bottom because that is where a thumb rests,
 * and because the decision must stay reachable without scrolling back.
 *
 * Three deliberate rules:
 * - Assign and Decline are separated, not adjacent — they are not symmetric
 *   choices and a mis-tap is not cheap.
 * - The button shows "Assigning…" while the request is in flight and only
 *   confirms once the server has actually taken the slot. No optimistic tick:
 *   the server can and does refuse.
 * - Offline it is disabled with the reason spelled out, because a commitment
 *   consumes capacity and capacity cannot be reserved from a queued write.
 */
import { Button } from "@mieweb/ui";

import { useI18n } from "../i18n.ts";
import "./ActionBar.scss";

export interface ActionBarProps {
  online: boolean;
  busy: boolean;
  committedStatus: string | undefined;
  canAssign: boolean;
  assignLabel: string;
  onAssign: () => void;
  onDecline: () => void;
}

export function ActionBar({
  online,
  busy,
  committedStatus,
  canAssign,
  assignLabel,
  onAssign,
  onDecline,
}: ActionBarProps): React.ReactElement {
  const { t } = useI18n();

  if (committedStatus) {
    return (
      <div className="action-bar action-bar--done" role="status">
        {t("action.committed", { status: committedStatus })}
      </div>
    );
  }

  return (
    <div className="action-bar">
      {!online ? (
        <p className="action-offline" role="status">
          {t("app.offline")}
        </p>
      ) : null}

      <div className="action-buttons">
        <Button
          className="action-decline"
          disabled={!online || busy}
          onClick={onDecline}
          variant="outline"
        >
          {t("action.decline")}
        </Button>

        <Button
          className="action-assign"
          disabled={!online || busy || !canAssign}
          isLoading={busy}
          loadingText={t("action.assigning")}
          onClick={onAssign}
          variant="primary"
        >
          {assignLabel}
        </Button>
      </div>
    </div>
  );
}
