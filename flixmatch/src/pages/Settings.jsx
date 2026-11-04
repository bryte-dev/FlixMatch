import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../api";
import { Link } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import { useToast } from "../toastContext";
import { SWIPE_ACTIONS, saveSettings, useSettings } from "../settings";
import { LANGUAGES, useT } from "../i18n";
import { THEMES, isUnlocked } from "../theme";
import { Button, PageHeader } from "../components/ui";
import ProBadge from "../components/ProBadge";
import { PRO_FEATURES } from "../lib/pro";
import PrivacyDangerZone from "../components/PrivacyDangerZone";
import { posterUrl } from "../utils";
import { buildFlixMatchExport, buildLetterboxdCsv, buildTraktCsv } from "../lib/export";
import { analyticsConfigured, isOptedOut, setAnalyticsOptOut, track } from "../lib/analytics";

const EXPORTS = {
  flixmatch: { labelKey: "exportFlixmatch", file: "flixmatch-export.json", type: "application/json", build: (data, settings) => JSON.stringify(buildFlixMatchExport(data, settings), null, 2) },
  letterboxd: { labelKey: "exportLetterboxd", file: "flixmatch-letterboxd-watched.csv", type: "text/csv", build: (data) => buildLetterboxdCsv(data, "watched") },
  letterboxdWatchlist: { labelKey: "exportLetterboxdWatchlist", file: "flixmatch-letterboxd-watchlist.csv", type: "text/csv", build: (data) => buildLetterboxdCsv(data, "watchlist") },
  trakt: { labelKey: "exportTrakt", file: "flixmatch-trakt.csv", type: "text/csv", build: (data) => buildTraktCsv(data) },
};

const download = (name, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const REGIONS = ["FR", "BE", "CH", "CA", "US", "GB", "DE", "ES", "IT", "PT", "NL", "PL", "TR", "JP", "KR", "BR", "MX", "AU"];

const regionName = (lang, code) => {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
};

const THEME_KEYS = { dark: "themeDark", light: "themeLight", auto: "themeAuto", hacker: "themeHacker", neon: "themeNeon", retro: "themeRetro" };

const META_LANGS = {
  "fr-FR": "Français", "en-US": "English", "es-ES": "Español", "de-DE": "Deutsch", "it-IT": "Italiano",
  "pt-PT": "Português", "nl-NL": "Nederlands", "pl-PL": "Polski", "tr-TR": "Türkçe", "ru-RU": "Русский",
  "ja-JP": "日本語", "ko-KR": "한국어", "zh-CN": "中文", "ar-SA": "العربية",
};

const Section = ({ title, children }) => (
  <section className="surface mb-5 p-5">
    <h2 className="mb-4 text-lg font-bold">{title}</h2>
    <div className="space-y-4">{children}</div>
  </section>
);

export default function Settings() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const settings = useSettings();
  const t = useT();
  const [providers, setProviders] = useState([]);
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [exporting, setExporting] = useState(null);
  const [analyticsOff, setAnalyticsOff] = useState(isOptedOut);

  useEffect(() => {
    const onUnlock = () => setUnlocked(true);
    window.addEventListener("fm-unlocked", onUnlock);
    return () => window.removeEventListener("fm-unlocked", onUnlock);
  }, []);

  useEffect(() => {
    let active = true;
    axios
      .get(`${API_URL}/tmdb/providers/movie`, { params: { region: settings.region } })
      .then((res) => active && setProviders(res.data.slice(0, 40)))
      .catch(() => active && setProviders([]));
    return () => {
      active = false;
    };
  }, [settings.region]);

  const toggleProvider = (id) =>
    saveSettings({
      providers: settings.providers.includes(id) ? settings.providers.filter((p) => p !== id) : [...settings.providers, id],
    });

  const exportData = async (format) => {
    if (exporting) return;
    const spec = EXPORTS[format];
    setExporting(format);
    try {
      const { data } = await axios.get(`${API_URL}/account/export`);
      download(spec.file, spec.build(data, settings), spec.type);
      track("data_exported", { format });
    } catch {
      toast(t("exportFail"), "error");
    } finally {
      setExporting(null);
    }
  };

  const visibleThemes = THEMES.filter((th) => !th.secret || unlocked || settings.theme === th.id);

  return (
    <div className="page max-w-2xl">
      <PageHeader title={t("settings")} subtitle={t("settingsSubtitle")} />

      <Section title={t("themeTitle")}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("themeTitle")}>
          {visibleThemes.map((th) => (
            <Button key={th.id} variant={settings.theme === th.id ? "primary" : "secondary"} role="radio" aria-checked={settings.theme === th.id} onClick={() => saveSettings({ theme: th.id })}>
              {t(THEME_KEYS[th.id])}
            </Button>
          ))}
        </div>
        {!unlocked && <p className="text-xs text-zinc-500">{t("themeHint")}</p>}
      </Section>

      <Section title={t("uiLanguage")}>
        <select className="field" aria-label={t("uiLanguage")} value={settings.uiLang} onChange={(e) => saveSettings({ uiLang: e.target.value })}>
          {Object.entries(LANGUAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Section>

      <Section title={t("swipeSettingsTitle")}>
        <label className="block text-sm font-medium">
          <span className="mb-1 block">{t("swipeRightLabel")}</span>
          <select className="field" value={settings.swipeAction} onChange={(e) => saveSettings({ swipeAction: e.target.value })}>
            {Object.keys(SWIPE_ACTIONS).map((value) => <option key={value} value={value}>{t(value === "favorites" ? "swipeActionFavorites" : "swipeActionWatchlist")}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={settings.adult} onChange={(e) => saveSettings({ adult: e.target.checked })} />
          {t("showAdult")}
        </label>
      </Section>

      <Section title={t("langRegionTitle")}>
        <label className="block text-sm font-medium">
          <span className="mb-1 block">{t("metaLangLabel")}</span>
          <select className="field" value={settings.metaLang} onChange={(e) => saveSettings({ metaLang: e.target.value })}>
            {Object.entries(META_LANGS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          <span className="mb-1 block">{t("regionLabel")}</span>
          <select className="field" value={settings.region} onChange={(e) => saveSettings({ region: e.target.value, providers: [] })}>
            {REGIONS.map((value) => <option key={value} value={value}>{regionName(settings.uiLang, value)}</option>)}
          </select>
        </label>
      </Section>

      <Section title={t("proSettingsTitle")}>
        <p className="text-sm text-zinc-400">{t("proSettingsIntro")}</p>
        <ul className="space-y-2">
          {Object.entries(PRO_FEATURES).map(([feature, { labelKey }]) => (
            <li key={feature} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-sm">
              <span className="flex items-center gap-2"><ProBadge feature={feature} source="settings_pro" /> {t(labelKey)}</span>
              <span className="text-xs text-emerald-300">{t("proFreeInBeta")}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("myProviders")}>
        <p className="flex items-center gap-2 text-xs text-zinc-400"><ProBadge feature="provider_filters" source="settings_providers" /> {t("proFeatureProviders")}</p>
        {providers.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("noProviders")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {providers.map((p) => {
              const on = settings.providers.includes(p.id);
              return (
                <li key={p.id}>
                  <button type="button" aria-pressed={on} onClick={() => toggleProvider(p.id)} title={p.name} className={`rounded-xl p-0.5 ${on ? "ring-2 ring-brand-400" : "opacity-60"}`}>
                    <img src={posterUrl(p.logo_path, "w92")} alt={p.name} loading="lazy" className="h-11 w-11 rounded-lg" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-zinc-500">{t("justwatchCredit")}</p>
      </Section>

      {analyticsConfigured() && (
        <Section title={t("usageStatsTitle")}>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand-500"
              checked={!analyticsOff}
              onChange={(e) => {
                setAnalyticsOptOut(!e.target.checked);
                setAnalyticsOff(!e.target.checked);
              }}
            />
            <span>
              {t("usageStatsText")}
            </span>
          </label>
        </Section>
      )}

      {user && (
        <>
          <Section title={t("myDataTitle")}>
            <p className="text-sm text-zinc-400">{t("exportIntro")}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {Object.entries(EXPORTS).map(([id, spec]) => (
                <Button key={id} onClick={() => exportData(id)} pending={exporting === id} pendingLabel={t("exporting")} disabled={Boolean(exporting)}>
                  {t(spec.labelKey)}
                </Button>
              ))}
            </div>
            <Link to="/import" className="btn btn-secondary">{t("importLink")}</Link>
            <Link to="/account" className="btn btn-secondary">{t("accountLink")}</Link>
          </Section>
          <Section title={t("resetOrDeleteTitle")}>
            <PrivacyDangerZone />
          </Section>
        </>
      )}
    </div>
  );
}
