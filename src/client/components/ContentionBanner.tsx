/**
 * Contention — which workers are over-subscribed and by which referrals. This
 * is the thing a supervisor most needs to see before deciding anything, so on
 * a phone it collapses to a tappable count chip rather than disappearing.
 */
import { useId, useState } from "react";
import { Badge } from "@mieweb/ui";

import type { Contention } from "../../model.ts";
import { useI18n } from "../i18n.ts";
import "./ContentionBanner.scss";

export function ContentionBanner({ contention }: { contention: Contention[] }): React.ReactElement | null {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (contention.length === 0) return null;

  return (
    <section className="contention-banner" aria-labelledby={`${panelId}-title`}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="contention-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Badge variant="warning">{contention.length}</Badge>
        <span className="contention-title" id={`${panelId}-title`}>
          {contention.length === 1
            ? t("contention.titleOne")
            : t("contention.title", { count: contention.length })}
        </span>
        <span className="contention-hint">{open ? t("contention.hide") : t("contention.show")}</span>
      </button>

      <ul className="contention-list" hidden={!open} id={panelId}>
        {contention.map((entry) => (
          <li className="contention-item" key={entry.staffId}>
            <span className="contention-staff">{entry.staffId}</span>
            <span className="contention-detail">
              {t("contention.line", {
                staff: entry.staffId,
                slots: entry.slots,
                wanted: entry.wantedBy.length,
              })}
            </span>
            <span className="contention-referrals">{entry.wantedBy.join(", ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
