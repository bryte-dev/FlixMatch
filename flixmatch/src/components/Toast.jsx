import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext } from "../toastContext";

const STYLES = {
  success: "border-emerald-500/40 bg-emerald-950/90 text-emerald-100",
  error: "border-red-500/40 bg-red-950/90 text-red-100",
  info: "border-white/15 bg-ink-700/95 text-zinc-100",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message, type = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), type === "error" ? 6000 : 3500);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${STYLES[t.type] || STYLES.info}`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-mr-1 rounded px-1 text-lg leading-none opacity-70 hover:opacity-100"
              aria-label="Fermer la notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
