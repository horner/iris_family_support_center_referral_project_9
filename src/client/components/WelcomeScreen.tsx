/**
 * Landing page. A hackathon demo gets opened by people who have never seen it,
 * so the first screen says what this is and hands over the two other things a
 * reviewer needs: the source, and an inbox they can post a referral into.
 */
import type { ReactElement } from "react";

import { useI18n } from "../i18n.ts";
import "./WelcomeScreen.scss";

const REPO_URL = "https://hackathon.reusser.io/carapia/IrisDCSReferrals";

/** Same host, Mailpit's port — so the link still works from a phone on the LAN. */
const mailpitUrl = (): string => `http://${location.hostname}:8025`;

export function WelcomeScreen(): ReactElement {
  const { t } = useI18n();

  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <h2 id="welcome-title">{t("welcome.title")}</h2>
      <p className="welcome-lede">{t("welcome.lede")}</p>

      <a className="welcome-cta" href="#/queue">
        {t("welcome.enter")}
      </a>

      <h3>{t("welcome.tryTitle")}</h3>
      <ol className="welcome-steps">
        <li>{t("welcome.step1")}</li>
        <li>{t("welcome.step2")}</li>
        <li>{t("welcome.step3")}</li>
      </ol>

      <h3>{t("welcome.linksTitle")}</h3>
      <ul className="welcome-links">
        <li>
          <a className="welcome-link" href={mailpitUrl()} rel="noreferrer" target="_blank">
            <span className="welcome-link-title">{t("welcome.mailpit")}</span>
            <span className="welcome-link-detail">{t("welcome.mailpitDetail")}</span>
          </a>
        </li>
        <li>
          <a className="welcome-link" href={REPO_URL} rel="noreferrer" target="_blank">
            <span className="welcome-link-title">{t("welcome.repo")}</span>
            <span className="welcome-link-detail">{t("welcome.repoDetail")}</span>
          </a>
        </li>
      </ul>

      <p className="welcome-note">{t("welcome.boundary")}</p>
    </section>
  );
}
