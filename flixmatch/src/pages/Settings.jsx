import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../api";
import { AuthContext } from "../AuthContext";
import { useToast } from "../toastContext";
import { SWIPE_ACTIONS, saveSettings, useSettings } from "../settings";
import { THEMES, isUnlocked } from "../theme";
import { Button, PageHeader } from "../components/ui";
import { posterUrl } from "../utils";

const REGIONS = {
  FR: "France", BE: "Belgique", CH: "Suisse", CA: "Canada", US: "États-Unis", GB: "Royaume-Uni", DE: "Allemagne",
  ES: "Espagne", IT: "Italie", PT: "Portugal", NL: "Pays-Bas", PL: "Pologne", TR: "Turquie", JP: "Japon",
  KR: "Corée du Sud", BR: "Brésil", MX: "Mexique", AU: "Australie",
};

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
  const [providers, setProviders] = useState([]);
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [exporting, setExporting] = useState(false);

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

  const exportData = async () => {
    setExporting(true);
    try {
      const [watchlist, episodes] = await Promise.all([axios.get(`${API_URL}/watchlist`), axios.get(`${API_URL}/episodes`)]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), watchlist: watchlist.data, episodes: episodes.data, settings }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flixmatch-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("L'export a échoué.", "error");
    } finally {
      setExporting(false);
    }
  };

  const visibleThemes = THEMES.filter((t) => !t.secret || unlocked || settings.theme === t.id);

  return (
    <div className="page max-w-2xl">
      <PageHeader title="Paramètres" subtitle="Réglages enregistrés sur cet appareil." />

      <Section title="Thème">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Thème">
          {visibleThemes.map((t) => (
            <Button key={t.id} variant={settings.theme === t.id ? "primary" : "secondary"} role="radio" aria-checked={settings.theme === t.id} onClick={() => saveSettings({ theme: t.id })}>
              {t.label}
            </Button>
          ))}
        </div>
        {!unlocked && <p className="text-xs text-zinc-500">Des thèmes secrets se cachent quelque part… (indice : un code célèbre des années 80, ou le logo)</p>}
      </Section>

      <Section title="Découverte (swipe)">
        <label className="block text-sm font-medium">
          <span className="mb-1 block">Glisser à droite</span>
          <select className="field" value={settings.swipeAction} onChange={(e) => saveSettings({ swipeAction: e.target.value })}>
            {Object.entries(SWIPE_ACTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={settings.adult} onChange={(e) => saveSettings({ adult: e.target.checked })} />
          Afficher le contenu pour adultes
        </label>
      </Section>

      <Section title="Langue et région">
        <label className="block text-sm font-medium">
          <span className="mb-1 block">Langue des métadonnées TMDB (titres, résumés, recherche)</span>
          <select className="field" value={settings.metaLang} onChange={(e) => saveSettings({ metaLang: e.target.value })}>
            {Object.entries(META_LANGS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          <span className="mb-1 block">Pays / région (disponibilité en streaming)</span>
          <select className="field" value={settings.region} onChange={(e) => saveSettings({ region: e.target.value, providers: [] })}>
            {Object.entries(REGIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </Section>

      <Section title="Mes plateformes de streaming">
        {providers.length === 0 ? (
          <p className="text-sm text-zinc-400">Aucune plateforme disponible pour cette région.</p>
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
        <p className="text-xs text-zinc-500">Données « Où regarder » fournies par JustWatch via TMDB.</p>
      </Section>

      {user && (
        <Section title="Mes données">
          <Button onClick={exportData} pending={exporting} pendingLabel="Export…">Exporter mes données (JSON)</Button>
        </Section>
      )}
    </div>
  );
}
