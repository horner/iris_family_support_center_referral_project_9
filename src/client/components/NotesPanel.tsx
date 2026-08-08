/**
 * Shared case notes. This is the part of the case that works with no signal:
 * notes are a Yjs array, so two supervisors jotting in a driveway both survive
 * the merge. Nothing here consumes capacity.
 */
import { useState } from "react";
import { Button } from "@mieweb/ui";

import type { CaseNote } from "../../case-doc.ts";
import { formatDate, useI18n } from "../i18n.ts";
import "./NotesPanel.scss";

export interface NotesPanelProps {
  notes: readonly CaseNote[];
  onAdd: (text: string) => void;
}

export function NotesPanel({ notes, onAdd }: NotesPanelProps): React.ReactElement {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState("");

  const submit = (): void => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  };

  return (
    <section className="notes-panel" aria-labelledby="notes-title">
      <h2 className="notes-title" id="notes-title">
        {t("notes.title")}
      </h2>

      {notes.length === 0 ? (
        <p className="notes-empty">{t("notes.empty")}</p>
      ) : (
        <ul className="notes-list" aria-live="polite">
          {notes.map((note, index) => (
            <li className="notes-item" key={`${note.at}-${index}`}>
              <span className="notes-meta">
                {note.author} · {formatDate(locale, note.at)}
              </span>
              <p className="notes-text">{note.text}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="notes-form">
        <label className="visually-hidden" htmlFor="notes-input">
          {t("notes.placeholder")}
        </label>
        <textarea
          className="notes-input"
          id="notes-input"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("notes.placeholder")}
          value={draft}
        />
        <Button disabled={draft.trim().length === 0} onClick={submit} variant="secondary">
          {t("notes.add")}
        </Button>
      </div>
    </section>
  );
}
