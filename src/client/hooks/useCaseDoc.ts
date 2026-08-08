/**
 * Live case document: one Yjs room per case, persisted to IndexedDB so the
 * queue, the recommendation and the full candidate evaluation stay readable
 * without a signal.
 *
 * Two deliberate choices:
 * - Rendering waits for `whenSynced`, otherwise the UI flashes an empty case
 *   and a supervisor concludes their work was lost.
 * - Only `proposal`, `notes` and `scenarioPins` are written from here. The
 *   `commitment` block is server-owned; a CRDT converges but does not enforce,
 *   so two offline commits would merge straight through the 12-family cap.
 */
import { useEffect, useMemo, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import type { CaseDoc, CaseNote, CaseProposal } from "../../case-doc.ts";

const ROOT_KEY = "resource";
const AWARENESS_FIELD = "iris:user";

export interface Presence {
  name: string;
  colour: string;
}

export interface LiveCase {
  doc: CaseDoc | undefined;
  ready: boolean;
  connected: boolean;
  /** Everyone else with this case open — a second pair of eyes, made visible. */
  others: Presence[];
  propose: (change: Partial<CaseProposal>) => void;
  addNote: (note: CaseNote) => void;
  storageDenied: boolean;
}

const websocketUrl = (): string => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/yorm/ws/Case`;
};

export function useCaseDoc(messageId: string | undefined, me: Presence): LiveCase {
  const doc = useMemo(() => new Y.Doc(), [messageId]);
  const [value, setValue] = useState<CaseDoc | undefined>();
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [others, setOthers] = useState<Presence[]>([]);
  const [storageDenied, setStorageDenied] = useState(false);

  useEffect(() => {
    if (!messageId) return;

    const root = doc.getMap<unknown>(ROOT_KEY);

    // An empty room is not a case. IndexedDB resolves immediately with nothing
    // on a first visit, and rendering that shape would hand every component an
    // undefined `proposal`.
    const publish = () => {
      const value = root.toJSON() as CaseDoc;
      setValue(value.referral ? value : undefined);
    };

    // Offline-first: IndexedDB answers before the socket does.
    const local = new IndexeddbPersistence(`iris:Case:${messageId}`, doc);
    local.whenSynced
      .then(() => {
        publish();
        setReady(true);
      })
      .catch(() => {
        // Private browsing refuses IndexedDB. Say so; do not silently drop work.
        setStorageDenied(true);
        setReady(true);
      });
    void navigator.storage?.persist?.().catch(() => setStorageDenied(true));

    const provider = new WebsocketProvider(websocketUrl(), messageId, doc);
    provider.on("status", (event: { status: string }) => setConnected(event.status === "connected"));
    provider.awareness.setLocalStateField(AWARENESS_FIELD, me);

    const onAwareness = () => {
      const states = [...provider.awareness.getStates().entries()]
        .filter(([clientId]) => clientId !== provider.awareness.clientID)
        .map(([, state]) => (state as Record<string, Presence>)[AWARENESS_FIELD])
        .filter((presence): presence is Presence => Boolean(presence));
      setOthers(states);
    };
    provider.awareness.on("change", onAwareness);

    root.observeDeep(publish);
    publish();

    return () => {
      root.unobserveDeep(publish);
      provider.awareness.off("change", onAwareness);
      provider.destroy();
      void local.destroy();
    };
  }, [messageId, doc]);

  const propose = (change: Partial<CaseProposal>): void => {
    const root = doc.getMap<unknown>(ROOT_KEY);
    const proposal = root.get("proposal");
    if (!(proposal instanceof Y.Map)) return;
    // Proposals merge and consume nothing — safe to write offline.
    // Arrays become Y.Array so two supervisors editing the same case converge
    // instead of clobbering each other's list wholesale.
    doc.transact(() => {
      for (const [key, item] of Object.entries(change)) {
        const value = item as string | Record<string, unknown> | (string | Record<string, unknown>)[];
        proposal.set(key, Array.isArray(value) ? Y.Array.from(value) : value);
      }
    });
  };

  const addNote = (note: CaseNote): void => {
    const root = doc.getMap<unknown>(ROOT_KEY);
    const notes = root.get("notes");
    if (!(notes instanceof Y.Array)) return;
    const entry = new Y.Map<unknown>();
    doc.transact(() => {
      entry.set("author", note.author);
      entry.set("text", note.text);
      entry.set("at", note.at);
      notes.push([entry]);
    });
  };

  return { doc: value, ready, connected, others, propose, addNote, storageDenied };
}
