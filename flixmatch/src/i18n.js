import { useEffect } from "react";
import { getSettings, useSettings } from "./settings";
import { RTL, translate } from "./lib/i18nData";

export { LANGUAGES, RTL, DICT, translate } from "./lib/i18nData";

// Hook : renvoie t(key) et applique lang/dir (RTL pour l'arabe) sur <html>
// Hors composants (utilitaires, erreurs) : lit la langue courante
export const tr = (key, params) => translate(getSettings().uiLang, key, params);

export function useT() {
  const { uiLang } = useSettings();
  useEffect(() => {
    document.documentElement.lang = uiLang;
    document.documentElement.dir = RTL.has(uiLang) ? "rtl" : "ltr";
  }, [uiLang]);
  return (key, params) => translate(uiLang, key, params);
}
