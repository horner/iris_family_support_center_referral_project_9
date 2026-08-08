/**
 * The shell: locale, connection state, and which of the top-level views is on
 * screen.
 *
 * Plan and case are separate screens rather than a master-detail split,
 * because on a 375px phone a split view gives you two unusable halves.
 *
 * Every screen — and every tab within a case — is a hash route, so the phone
 * back button walks back the way a supervisor expects and a case can be sent
 * to a colleague as a link.
 */
import { useMemo, useState, type ReactElement } from "react";

import type { FairnessStrategy } from "../model.ts";
import { CaseScreen } from "./components/CaseScreen.tsx";
import { KpiPanel } from "./components/KpiPanel.tsx";
import { QueueScreen } from "./components/QueueScreen.tsx";
import { WelcomeScreen } from "./components/WelcomeScreen.tsx";
import { I18nContext, LOCALES, translator, type Locale, type MessageKey } from "./i18n.ts";
import { useHashRoute } from "./hooks/useHashRoute.ts";
import { useOnline } from "./hooks/useOnline.ts";
import { useQueue } from "./hooks/useQueue.ts";
import "./App.scss";

type View = "queue" | "kpi";

/** The signed-in supervisor. Presence needs a name; auth is out of scope here. */
const ME = { name: "Supervisor", colour: "#2f6feb" };

export function App(): ReactElement {
  const [locale, setLocale] = useState<Locale>("en");
  const [fairness, setFairness] = useState<FairnessStrategy>("balance");

  const { route, go } = useHashRoute();
  const online = useOnline();
  const queue = useQueue();
  const i18n = useMemo(() => ({ locale, setLocale, t: translator(locale) }), [locale]);
  const { t } = i18n;

  document.documentElement.lang = locale;
  document.documentElement.dir = LOCALES[locale].dir;

  const onCase = route.name === "case";

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-brand">
            <a className="app-brand-link tappable" href="#/">
              {t("app.title")}
            </a>
          </h1>

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

        {route.name === "queue" || route.name === "kpi" ? (
          <nav className="app-tabs" aria-label={t("app.title")}>
            {(["queue", "kpi"] as View[]).map((option) => (
              <button
                aria-current={route.name === option}
                className={`app-tab${route.name === option ? " app-tab--on" : ""}`}
                key={option}
                onClick={() => go({ name: option })}
                type="button"
              >
                {t((option === "queue" ? "mode.plan" : "mode.kpi") as MessageKey)}
              </button>
            ))}
          </nav>
        ) : null}

        <main className="app-main">
          {queue.error && !onCase && route.name !== "welcome" ? (
            <p className="app-error" role="alert">
              {t("app.error", { message: queue.error })}
            </p>
          ) : null}

          {route.name === "welcome" ? <WelcomeScreen /> : null}

          {route.name === "case" ? (
            <CaseScreen
              fairness={fairness}
              me={ME}
              messageId={route.messageId}
              mode={route.mode}
              onBack={() => go({ name: "queue" })}
              onCommitted={() => void queue.refresh()}
              onFairnessChange={setFairness}
              onModeChange={(mode) => go({ name: "case", messageId: route.messageId, mode })}
              online={online}
              roster={queue.roster}
            />
          ) : null}

          {route.name === "queue" ? (
            <QueueScreen
              busy={queue.busy}
              onOpen={(messageId) => go({ name: "case", messageId, mode: "recommend" })}
              onReplan={() => void queue.replanNow()}
              onSync={() => void queue.sync()}
              plan={queue.plan}
              rows={queue.rows}
            />
          ) : null}

          {route.name === "kpi" ? <KpiPanel kpi={queue.kpi} /> : null}
        </main>
      </div>
    </I18nContext.Provider>
  );
}
