/**
 * Connection state is a first-class fact in this UI, not an afterthought:
 * proposals work offline and commitments do not, so the supervisor has to be
 * told which mode they are in *before* they reach the commit button.
 */
import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
