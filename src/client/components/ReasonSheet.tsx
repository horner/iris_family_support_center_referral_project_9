/**
 * Reason capture, as a bottom sheet rather than a centre modal — it opens
 * under the thumb, where the button that summoned it was.
 *
 * Reasons are tappable categories first and free text second. Typing a
 * sentence on a phone is what makes people skip the field, and a skipped
 * reason is a decision nobody can audit later.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@mieweb/ui";

import { useI18n, type MessageKey } from "../i18n.ts";
import "./ReasonSheet.scss";

export interface ReasonSheetProps {
  title: string;
  categories: readonly MessageKey[];
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function ReasonSheet({
  title,
  categories,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: ReasonSheetProps): React.ReactElement {
  const { t } = useI18n();
  const [selected, setSelected] = useState<MessageKey | undefined>();
  const [detail, setDetail] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    // Move focus into the sheet, and keep it there: a focus ring stranded
    // behind an overlay is how keyboard users lose their place.
    const first = panel.current?.querySelector<HTMLElement>("button, textarea");
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = [
        ...panel.current.querySelectorAll<HTMLElement>("button, textarea, [href]"),
      ].filter((element) => !element.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const reason = [selected ? t(selected) : "", detail.trim()].filter(Boolean).join(" — ");

  return (
    <div className="reason-backdrop" onClick={onCancel}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="reason-sheet"
        onClick={(event) => event.stopPropagation()}
        ref={panel}
        role="dialog"
      >
        <h2 className="reason-title" id={titleId}>
          {title}
        </h2>

        <ul className="reason-categories">
          {categories.map((category) => (
            <li key={category}>
              <button
                aria-pressed={selected === category}
                className={`reason-chip${selected === category ? " reason-chip--on" : ""}`}
                onClick={() => setSelected(category)}
                type="button"
              >
                {t(category)}
              </button>
            </li>
          ))}
        </ul>

        <label className="reason-detail-label" htmlFor={`${titleId}-detail`}>
          {t("reason.detail")}
        </label>
        <textarea
          className="reason-detail"
          id={`${titleId}-detail`}
          onChange={(event) => setDetail(event.target.value)}
          rows={3}
          value={detail}
        />

        <div className="reason-actions">
          <Button onClick={onCancel} variant="ghost" fullWidth>
            {t("action.cancel")}
          </Button>
          <Button
            disabled={!selected || busy}
            isLoading={busy}
            loadingText={t("action.working")}
            onClick={() => onConfirm(reason)}
            variant="primary"
            fullWidth
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
