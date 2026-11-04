import { useCallback, useMemo, useState } from "react";
import { ProContext } from "../proContext";
import { PRO_FEATURES, intentProps, proFakeDoorEnabled } from "../lib/pro";
import { track } from "../lib/analytics";
import { useT } from "../i18n";
import { BottomSheet, Button } from "./ui";

// Fournit `openPro(feature, { source, onContinue })` : événement d'intention + modale d'information.
export default function ProProvider({ children }) {
  const t = useT();
  const [current, setCurrent] = useState(null);

  const openPro = useCallback((feature, { source = "unknown", onContinue } = {}) => {
    if (!proFakeDoorEnabled() || !PRO_FEATURES[feature]) {
      onContinue?.();
      return;
    }
    track("intent_to_purchase_pro", intentProps(feature, source, "entry"));
    setCurrent({ feature, source, onContinue });
  }, []);

  const close = useCallback(() => {
    setCurrent((c) => {
      if (c) track("pro_modal_dismissed", { feature: c.feature, source: c.source });
      return null;
    });
  }, []);

  const proceed = () => {
    if (!current) return;
    track("intent_to_purchase_pro", intentProps(current.feature, current.source, "continue"));
    const { onContinue } = current;
    setCurrent(null);
    onContinue?.();
  };

  const value = useMemo(() => ({ openPro }), [openPro]);
  return (
    <ProContext.Provider value={value}>
      {children}
      <BottomSheet open={Boolean(current)} onClose={close} title={t("proModalTitle")}>
        {current && (
          <div className="grid gap-4">
            <p className="text-sm text-zinc-300">{t("proModalText")}</p>
            <p className="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-sm font-medium">
              <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-xs font-extrabold text-white">{t("proBadge")}</span>
              {t(PRO_FEATURES[current.feature].labelKey)}
            </p>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={proceed}>{t("proContinue")}</Button>
              <Button onClick={close}>{t("proClose")}</Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </ProContext.Provider>
  );
}
