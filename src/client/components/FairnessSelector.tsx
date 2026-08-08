/**
 * The fairness control, made visible on purpose.
 *
 * Spreading work evenly conflicts with matching a family's stated preference —
 * the best Spanish speaker for this family may be the busiest person on the
 * team. Burying that in a sort comparator hides the tradeoff from the person
 * accountable for it, so it is a labelled selector that re-ranks live.
 */
import type { FairnessStrategy } from "../../model.ts";
import { useI18n, type MessageKey } from "../i18n.ts";
import "./FairnessSelector.scss";

const STRATEGIES: FairnessStrategy[] = ["off", "balance", "balance-first"];

export interface FairnessSelectorProps {
  value: FairnessStrategy;
  onChange: (value: FairnessStrategy) => void;
}

export function FairnessSelector({ value, onChange }: FairnessSelectorProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="fairness-selector">
      <label className="fairness-label" htmlFor="fairness">
        {t("fairness.label")}
      </label>
      <select
        className="fairness-select"
        id="fairness"
        aria-describedby="fairness-help"
        onChange={(event) => onChange(event.target.value as FairnessStrategy)}
        value={value}
      >
        {STRATEGIES.map((strategy) => (
          <option key={strategy} value={strategy}>
            {t(`fairness.${strategy}` as MessageKey)}
          </option>
        ))}
      </select>
      <p className="fairness-help" id="fairness-help">
        {t("fairness.help")}
      </p>
    </div>
  );
}
