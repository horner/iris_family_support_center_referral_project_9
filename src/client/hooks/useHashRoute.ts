/**
 * Hash routing, hand-rolled because the whole route table is five lines and a
 * router would be a larger dependency than the thing it routes.
 *
 * Hash rather than history: the app is a PWA served from a static bundle, so
 * `#/case/x` needs no server rewrite rule and survives an offline reload.
 *
 * Every screen and every case tab has a URL, which is what makes the phone
 * back button behave the way a supervisor already expects it to.
 */
import { useEffect, useState } from "react";

export const CASE_MODES = ["recommend", "explore", "sheet"] as const;
export type CaseMode = (typeof CASE_MODES)[number];

export type Route =
  | { name: "welcome" }
  | { name: "queue" }
  | { name: "kpi" }
  | { name: "case"; messageId: string; mode: CaseMode };

export const routePath = (route: Route): string => {
  switch (route.name) {
    case "welcome":
      return "#/";
    case "queue":
      return "#/queue";
    case "kpi":
      return "#/kpi";
    case "case":
      return `#/case/${encodeURIComponent(route.messageId)}/${route.mode}`;
  }
};

const parse = (hash: string): Route => {
  const [first, second, third] = hash.replace(/^#\/?/, "").split("/").filter(Boolean);

  if (first === "queue") return { name: "queue" };
  if (first === "kpi") return { name: "kpi" };
  if (first === "case" && second) {
    const mode = (CASE_MODES as readonly string[]).includes(third ?? "")
      ? (third as CaseMode)
      : "recommend";
    return { name: "case", messageId: decodeURIComponent(second), mode };
  }
  return { name: "welcome" };
};

export interface Router {
  route: Route;
  /** Pushes a history entry — the back button undoes it. */
  go: (route: Route) => void;
  /** Swaps the current entry, for a redirect the user should not have to walk back through. */
  replace: (route: Route) => void;
}

export function useHashRoute(): Router {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));

  useEffect(() => {
    const onChange = (): void => setRoute(parse(location.hash));
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);

  const go = (next: Route): void => {
    location.hash = routePath(next);
  };

  const replace = (next: Route): void => {
    history.replaceState(null, "", routePath(next));
    setRoute(next);
  };

  return { route, go, replace };
}
