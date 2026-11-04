import { usePro } from "../proContext";
import { useT } from "../i18n";
import { PRO_FEATURES, proFakeDoorEnabled } from "../lib/pro";

// Pastille « PRO » cliquable : ouvre la modale et enregistre l'intention d'achat.
export default function ProBadge({ feature, source, className = "" }) {
  const { openPro } = usePro();
  const t = useT();
  if (!proFakeDoorEnabled()) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openPro(feature, { source });
      }}
      title={t(PRO_FEATURES[feature].labelKey)}
      aria-label={`${t("proBadge")}: ${t(PRO_FEATURES[feature].labelKey)}`}
      className={`inline-flex items-center rounded-md bg-gradient-to-r from-amber-400 to-brand-500 px-1.5 py-0.5 text-[10px] font-extrabold leading-none tracking-wider text-black transition hover:brightness-110 ${className}`}
    >
      {t("proBadge")}
    </button>
  );
}
