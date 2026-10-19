import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listZip } from "../lib/zip";
import { ADAPTERS, adapterById, detectAdapter } from "../lib/import";
import { commitAll, needsReview, resolveAll } from "../lib/import/runner";
import { BottomSheet, Button, PageHeader, Tabs } from "../components/ui";
import { posterUrl } from "../utils";

const PAGE = 100;
const MAX_FILE_BYTES = 200 * 1024 * 1024;

const kindLabel = (k) => (k === "tv" ? "Série" : k === "movie" ? "Film" : "Type inconnu");
const viaLabel = { tmdb: "ID TMDB", imdb: "ID IMDb", tvdb: "ID TVDB", title: "Titre" };
const errorLabel = { tmdb_unavailable: "TMDB indisponible, réessaie plus tard", rate_limited: "TMDB saturé, réessaie plus tard", network: "Erreur réseau" };

async function readFiles(fileList) {
  const decoder = new TextDecoder();
  const files = [];
  for (const file of fileList) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`« ${file.name} » est trop volumineux.`);
    const buffer = await file.arrayBuffer();
    if (/\.zip$/i.test(file.name)) {
      for (const entry of listZip(buffer)) {
        if (/\.(csv|json)$/i.test(entry.name) && !/__MACOSX/.test(entry.name)) files.push({ name: entry.name, text: decoder.decode(await entry.read()) });
      }
    } else if (/\.(csv|json)$/i.test(file.name)) {
      files.push({ name: file.name, text: decoder.decode(buffer) });
    }
  }
  return files;
}

function Progress({ progress, label }) {
  if (!progress) return null;
  return (
    <div>
      <progress className="w-full accent-brand-500" value={progress.done} max={progress.total || 1} aria-label={label} />
      <p className="text-xs text-zinc-400" aria-live="polite">
        {label} : {progress.done} / {progress.total} {progress.current ? `· ${progress.current}` : ""}
      </p>
    </div>
  );
}

function PreviewRow({ item, checked, onToggle }) {
  const m = item.match;
  const poster = posterUrl(m?.poster, "w92");
  return (
    <li className="flex items-center gap-3 py-2">
      {m && (
        <input type="checkbox" className="h-5 w-5 shrink-0" checked={checked} onChange={onToggle} aria-label={`Importer ${m.title}`} />
      )}
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-white/5">
        {poster ? <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-semibold" title={m?.title || item.title}>
          {m ? m.title : item.title || "Sans titre"} {m?.year ? <span className="font-normal text-zinc-400">({m.year})</span> : null}
        </p>
        <p className="truncate text-xs text-zinc-400">
          {kindLabel(m?.mediaType || item.kind)}
          {m && item.title && item.title !== m.title ? ` · importé comme « ${item.title}${item.year ? ` (${item.year})` : ""} »` : ""}
          {!m && item.year ? ` · ${item.year}` : ""}
          {item.episodes?.length ? ` · ${item.episodes.length} épisode(s)` : ""}
          {item.rating ? ` · ${item.rating}★` : ""}
          {item.favorite ? " · favori" : ""}
          {item.status === "WATCHLIST" && item.kind !== "tv" ? " · à voir" : ""}
        </p>
        {m && (
          <p className="text-xs text-zinc-500">
            Trouvé via {viaLabel[m.via] || m.via}
            {needsReview(item) ? <span className="ml-1 text-amber-400">· à vérifier</span> : null}
          </p>
        )}
        {!m && item.error && <p className="text-xs text-red-400">{errorLabel[item.error] || "Erreur"}</p>}
      </div>
    </li>
  );
}

export default function Import() {
  const [source, setSource] = useState("auto");
  const [adapter, setAdapter] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [resolved, setResolved] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [tab, setTab] = useState("matched");
  const [shown, setShown] = useState(PAGE);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | resolving | preview | committing | done
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [report, setReport] = useState(null);
  const abort = useRef(null);
  const busy = phase === "resolving" || phase === "committing";

  const reset = () => {
    setParsed(null);
    setResolved(null);
    setReport(null);
    setProgress(null);
    setSelected(new Set());
    setPhase("idle");
    setError("");
  };

  const onFiles = async (e) => {
    const list = [...(e.target.files || [])];
    if (list.length === 0) return;
    reset();
    try {
      const files = await readFiles(list);
      if (files.length === 0) throw new Error("Aucun fichier CSV ou JSON trouvé.");
      const chosen = source === "auto" ? detectAdapter(files) : adapterById(source);
      if (!chosen) throw new Error("Format non reconnu : choisis la source dans la liste.");
      const result = await chosen.parse(files);
      if (result.items.length === 0) throw new Error(`Aucun film ni aucune série reconnus pour ${chosen.label}.`);
      setAdapter(chosen);
      setParsed(result);
    } catch (err) {
      setError(err.message || "Fichier illisible");
    } finally {
      e.target.value = "";
    }
  };

  const analyse = async () => {
    abort.current = new AbortController();
    setPhase("resolving");
    setProgress({ done: 0, total: parsed.items.length });
    try {
      const out = await resolveAll(parsed.items, { onProgress: setProgress, signal: abort.current.signal });
      setResolved(out);
      setSelected(new Set(out.filter((it) => it.match).map((it) => it.key)));
      setTab("matched");
      setShown(PAGE);
      setPhase("preview");
    } catch (err) {
      setError(err.message || "Analyse impossible");
      setPhase("idle");
    } finally {
      setProgress(null);
    }
  };

  const confirmImport = async () => {
    setConfirmOpen(false);
    abort.current = new AbortController();
    setPhase("committing");
    const chosen = resolved.filter((it) => it.match && selected.has(it.key));
    setProgress({ done: 0, total: chosen.length });
    try {
      setReport(await commitAll(chosen, { onProgress: setProgress, signal: abort.current.signal }));
      setPhase("done");
    } catch (err) {
      setError(err.message || "Import interrompu");
      setPhase("preview");
    } finally {
      setProgress(null);
    }
  };

  const matched = useMemo(() => (resolved || []).filter((it) => it.match), [resolved]);
  const unmatched = useMemo(() => (resolved || []).filter((it) => !it.match), [resolved]);
  const toReview = useMemo(() => matched.filter(needsReview), [matched]);
  const list = tab === "matched" ? matched : tab === "review" ? toReview : unmatched;
  const selectedCount = matched.filter((it) => selected.has(it.key)).length;

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const setAll = (on) => setSelected(on ? new Set(matched.map((it) => it.key)) : new Set());

  const current = adapter || adapterById(source);
  const s = parsed?.stats;

  return (
    <div className="page max-w-2xl">
      <PageHeader title="Importer mes données" subtitle="TV Time, Letterboxd, Trakt ou une sauvegarde FlixMatch. Les fichiers sont lus sur ton appareil." />
      <section className="surface space-y-4 p-5">
        <label className="block text-sm font-semibold" htmlFor="import-source">Source</label>
        <select id="import-source" className="field" value={source} onChange={(e) => { setSource(e.target.value); setAdapter(null); reset(); }} disabled={busy}>
          <option value="auto">Détection automatique</option>
          {ADAPTERS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <p className="text-sm text-zinc-400">
          {current ? current.hint : "Dépose le ZIP ou les fichiers CSV/JSON exportés depuis ton ancien service : le format est reconnu automatiquement."}
        </p>
        <input type="file" multiple accept=".zip,.csv,.json,application/zip,text/csv,application/json" onChange={onFiles} className="field" aria-label="Fichiers d'export" disabled={busy} />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        {parsed && phase === "idle" && (
          <div className="space-y-3">
            <p className="font-semibold">
              {adapter?.label} : {s.series} série(s), {s.episodes} épisode(s) vu(s), {s.movies} film(s)
              {s.unknown ? `, ${s.unknown} titre(s) de type inconnu` : ""}
            </p>
            <p className="text-sm text-zinc-400">
              {s.watchlist} à voir · {s.favorites} favori(s) · {s.ratings} note(s) · {s.reviews} avis
            </p>
            <Button variant="primary" className="w-full sm:w-auto" onClick={analyse}>Rechercher les correspondances</Button>
            <p className="text-xs text-zinc-500">Rien n&apos;est enregistré avant ta confirmation.</p>
          </div>
        )}

        {phase === "resolving" && (
          <div className="space-y-2">
            <Progress progress={progress} label="Correspondances TMDB" />
            <Button variant="ghost" onClick={() => abort.current?.abort()}>Arrêter</Button>
          </div>
        )}
      </section>

      {resolved && (phase === "preview" || phase === "committing") && (
        <section className="surface mt-5 space-y-3 p-5">
          <h2 className="text-lg font-bold">Aperçu avant import</h2>
          <p className="text-sm text-zinc-300">
            {matched.length} trouvé(s), {unmatched.length} introuvable(s). Décoche ce qui ne correspond pas.
          </p>
          <Tabs
            label="Aperçu de l'import"
            value={tab}
            onChange={(id) => { setTab(id); setShown(PAGE); }}
            tabs={[["matched", `Trouvés (${matched.length})`], ["review", `À vérifier (${toReview.length})`], ["unmatched", `Introuvables (${unmatched.length})`]]}
          />
          {tab !== "unmatched" && matched.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setAll(true)} disabled={busy}>Tout cocher</Button>
              <Button size="sm" variant="secondary" onClick={() => setAll(false)} disabled={busy}>Tout décocher</Button>
            </div>
          )}
          {list.length === 0 ? (
            <p className="text-sm text-zinc-400">Rien ici.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {list.slice(0, shown).map((it) => (
                <PreviewRow key={it.key} item={it} checked={selected.has(it.key)} onToggle={() => toggle(it.key)} />
              ))}
            </ul>
          )}
          {list.length > shown && (
            <Button variant="ghost" onClick={() => setShown((n) => n + PAGE)}>Afficher plus ({list.length - shown} restants)</Button>
          )}
          {phase === "committing" ? (
            <div className="space-y-2">
              <Progress progress={progress} label="Import" />
              <Button variant="ghost" onClick={() => abort.current?.abort()}>Arrêter</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={selectedCount === 0}>
                Importer {selectedCount} élément(s)
              </Button>
              <Button variant="ghost" onClick={reset}>Annuler</Button>
            </div>
          )}
        </section>
      )}

      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmer l'import">
        <div className="space-y-3 text-sm">
          <p>
            {selectedCount} élément(s) vont être ajoutés ou complétés dans ta bibliothèque
            {unmatched.length ? ` (${unmatched.length} introuvable(s) ignoré(s))` : ""}.
          </p>
          <p className="text-zinc-400">
            Ce qui existe déjà n&apos;est jamais dégradé : un titre vu reste vu, tes notes et avis actuels sont conservés. Tu peux relancer l&apos;import sans créer de doublons.
          </p>
          <Button variant="primary" className="w-full" onClick={confirmImport}>Confirmer l&apos;import</Button>
          <Button variant="ghost" className="w-full" onClick={() => setConfirmOpen(false)}>Retour à l&apos;aperçu</Button>
        </div>
      </BottomSheet>

      {report && phase === "done" && (
        <section className="surface mt-5 space-y-2 p-5 text-sm" aria-live="polite">
          <p className="font-semibold text-emerald-400">
            {report.aborted ? "Import arrêté. " : "Import terminé. "}
            {report.created} ajout(s), {report.updated} mise(s) à jour, {report.unchanged} déjà à jour.
          </p>
          <p>
            {report.episodesAdded} épisode(s) ajouté(s){report.reviews ? `, ${report.reviews} avis importé(s)` : ""}.
          </p>
          {report.episodesSkipped > 0 && (
            <p className="text-zinc-400">
              {report.episodesSkipped} épisode(s) ignoré(s) : numérotation absente chez TMDB ou épisode non diffusé.
            </p>
          )}
          {report.failed.length > 0 && (
            <details>
              <summary>{report.failed.length} erreur(s) : relance l&apos;import pour réessayer</summary>
              <ul className="mt-2 list-disc pl-5 text-zinc-400">{report.failed.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}</ul>
            </details>
          )}
          {unmatched.length > 0 && (
            <details>
              <summary>{unmatched.length} titre(s) introuvable(s) sur TMDB</summary>
              <ul className="mt-2 list-disc pl-5 text-zinc-400">{unmatched.map((it) => <li key={it.key}>{it.title || "Sans titre"}{it.year ? ` (${it.year})` : ""}</li>)}</ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Link to="/watchlist" className="btn btn-primary">Voir ma bibliothèque</Link>
            <Button variant="ghost" onClick={reset}>Nouvel import</Button>
          </div>
        </section>
      )}
    </div>
  );
}
