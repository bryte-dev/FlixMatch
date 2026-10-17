import { useEffect } from "react";
import { useSettings } from "./settings";
import { RTL, translate } from "./lib/i18nData";

export { LANGUAGES, RTL, DICT, translate } from "./lib/i18nData";

// Hook : renvoie t(key) et applique lang/dir (RTL pour l'arabe) sur <html>
export function useT() {
  const { uiLang } = useSettings();
  useEffect(() => {
    document.documentElement.lang = uiLang;
    document.documentElement.dir = RTL.has(uiLang) ? "rtl" : "ltr";
  }, [uiLang]);
  return (key) => translate(uiLang, key);
}
