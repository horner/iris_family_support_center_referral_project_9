/**
 * The unknowns box. It is always visible, in every mode and at every width —
 * it is never the thing that gets hidden to save vertical space, because
 * stating what the system cannot compute is the whole trust story.
 */
import { useI18n } from "../i18n.ts";
import "./UnknownsBox.scss";

export function UnknownsBox({ unknowns }: { unknowns: string[] }): React.ReactElement | null {
  const { t } = useI18n();
  if (unknowns.length === 0) return null;

  return (
    <section className="unknowns-box" aria-labelledby="unknowns-title">
      <h2 className="unknowns-title" id="unknowns-title">
        {t("unknowns.title")}
      </h2>
      <ul className="unknowns-list">
        {unknowns.map((unknown) => (
          <li className="unknowns-item" key={unknown}>
            {unknown}
          </li>
        ))}
      </ul>
    </section>
  );
}
