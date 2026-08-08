/**
 * The shell: locale, connection state, and which of the top-level views is on
 * screen.
 *
 * Plan and case are separate screens rather than a master-detail split,
 * because on a 375px phone a split view gives you two unusable halves.
 */
import { useMemo, useState, type ReactElement } from "react";

import type { FairnessStrategy } from "../model.ts";
import { CaseScreen } from "./components/CaseScreen.tsx";
import { KpiPanel } from "./components/KpiPanel.tsx";
import { QueueScreen } from "./components/QueueScreen.tsx";
import { I18nContext, LOCALES, translator, type Locale, type MessageKey } from "./i18n.ts";
import { useOnline } from "./hooks/useOnline.ts";
import { useQueue } from "./hooks/useQueue.ts";
import "./App.scss";

type View = "queue" | "kpi";

/** The signed-in supervisor. Presence needs a name; auth is out of scope here. */
const ME = { name: "Supervisor", colour: "#2f6feb" };

export function App(): ReactElement {
  const [locale, setLocale] = useState<Locale>("en");
  const [view, setView] = useState<View>("queue");
  const [openCase, setOpenCase] = useState<string>();
  const [fairness, setFairness] = useState<FairnessStrategy>("balance");

  const online = useOnline();
  const queue = useQueue();
  const i18n = useMemo(() => ({ locale, setLocale, t: translator(locale) }), [locale]);
  const { t } = i18n;

  document.documentElement.lang = locale;
  document.documentElement.dir = LOCALES[locale].dir;

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-brand">{t("app.title")}</h1>

          <p className={`app-connection app-connection--${online ? "on" : "off"}`} role="status">
            {online ? t("app.online") : t("app.offline")}
          </p>

          <label className="visually-hidden" htmlFor="locale">
            {t("app.language")}
          </label>
          <select
            className="app-locale"
            id="locale"
            onChange={(event) => setLocale(event.target.value as Locale)}
            value={locale}
          >
            {Object.entries(LOCALES).map(([code, meta]) => (
              <option key={code} value={code}>
                {meta.label}
              </option>
            ))}
          </select>
        </header>

        {!openCase ? (
          <nav className="app-tabs" aria-label={t("app.title")}>
            {(["queue", "kpi"] as View[]).map((option) => (
              <button
                aria-current={view === option}
                className={`app-tab${view === option ? " app-tab--on" : ""}`}
                key={option}
                onClick={() => setView(option)}
                type="button"
              >
                {t((option === "queue" ? "mode.plan" : "mode.kpi") as MessageKey)}
              </button>
            ))}
          </nav>
        ) : null}

        <main className="app-main">
          {queue.error ? (
            <p className="app-error" role="alert">
              {t("app.error", { message: queue.error })}
            </p>
          ) : null}

          {openCase ? (
            <CaseScreen
              fairness={fairness}
              me={ME}
              messageId={openCase}
              onBack={() => setOpenCase(undefined)}
              onCommitted={() => void queue.refresh()}
              onFairnessChange={setFairness}
              online={online}
              roster={queue.roster}
            />
          ) : view === "queue" ? (
            <QueueScreen
              busy={queue.busy}
              onOpen={setOpenCase}
              onReplan={() => void queue.replanNow()}
              onSync={() => void queue.sync()}
              plan={queue.plan}
              rows={queue.rows}
            />
          ) : (
            <KpiPanel kpi={queue.kpi} />
          )}
        </main>
      </div>
    </I18nContext.Provider>
  );
}
