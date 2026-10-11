import { useCallback, useRef, useState } from "react";

// Suit les actions asynchrones en cours (par clé) et empêche les doubles clics.
export default function useBusy() {
  const [busy, setBusy] = useState({});
  const running = useRef(new Set());

  const isBusy = useCallback((key) => Boolean(busy[key]), [busy]);

  const run = useCallback(async (key, task) => {
    if (running.current.has(key)) return undefined;
    running.current.add(key);
    setBusy((prev) => ({ ...prev, [key]: true }));
    try {
      return await task();
    } finally {
      running.current.delete(key);
      setBusy((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, []);

  return { isBusy, run };
}
