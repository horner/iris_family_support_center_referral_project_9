/**
 * Case sheet mode — the referral rendered as a form via eSheet, with the
 * original email kept one tap away behind a disclosure.
 *
 * The raw email matters: parsers get things wrong, and when a supervisor
 * doubts a parsed field the source has to be reachable without leaving the
 * case.
 */
import { useState } from "react";
import { EsheetRenderer } from "@esheet/renderer";

import { CASE_SHEET, caseSheetResponses } from "../../case-sheet.ts";
import type { CaseDoc } from "../../case-doc.ts";
import { useI18n } from "../i18n.ts";
import "./CaseSheet.scss";

export function CaseSheet({ doc }: { doc: CaseDoc }): React.ReactElement {
  const { t } = useI18n();
  const [showRaw, setShowRaw] = useState(false);

  return (
    <section className="case-sheet" aria-labelledby="case-sheet-title">
      <h2 className="case-sheet-title" id="case-sheet-title">
        {t("sheet.title")}
      </h2>

      <div className="case-sheet-form">
        <EsheetRenderer
          formDataInput={CASE_SHEET}
          initialResponses={caseSheetResponses(doc, t(`outcome.${doc.proposal.outcome}`))}
          strict
        />
      </div>

      <button
        aria-controls="case-sheet-raw"
        aria-expanded={showRaw}
        className="case-sheet-disclosure"
        onClick={() => setShowRaw((value) => !value)}
        type="button"
      >
        {showRaw ? t("sheet.hideRaw") : t("sheet.showRaw")}
      </button>

      <pre className="case-sheet-raw" hidden={!showRaw} id="case-sheet-raw">
        {doc.referral.rawBody ?? t("sheet.noRaw")}
      </pre>
    </section>
  );
}
