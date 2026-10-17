import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listZip } from "../lib/zip";
import { ADAPTERS } from "../lib/import";
import { runImport } from "../lib/import/runner";
import { useSettings } from "../settings";
import { Button, PageHeader } from "../components/ui";

export default function Import() {
  const { metaLang } = useSettings();
  const adapter = ADAPTERS[0];
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const abort = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setParsed(null);
    setReport(null);
    try {
      const buffer = await file.arrayBuffer();
      const decoder = new TextDecoder();
      const files = [];
      if (/\.zip$/i.test(file.name)) {
        for (const entry of listZip(buffer)) {
          if (/\.(csv|json)$/i.test(entry.name) && !/__MACOSX/.test(entry.name)) files.push({ name: entry.name, text: decoder.decode(await entry.read()) });
        }
      } else files.push({ name: file.name, text: decoder.decode(buffer) });
      const result = await adapter.parse(files);
      if (result.stats.series + result.stats.movies === 0) setError("Aucune série ni aucun film reconnu dans ce fichier.");
      else setParsed(result);
    } catch (err) {
      setError(err.message || "Fichier illisible");
    }
  };

  const start = async () => {
    abort.current = new AbortController();
    setRunning(true);
    setProgress({ done: 0, total: parsed.series.length + parsed.movies.length });
    try {
      setReport(await runImport(parsed, { lang: metaLang, onProgress: setProgress, signal: abort.current.signal }));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page max-w-2xl">
      <PageHeader title="Importer mes données" subtitle="Depuis l'export RGPD de TV Time (fichier ZIP). L'analyse se fait sur ton appareil." />
      <section className="surface space-y-4 p-5">
        <p className="text-sm text-zinc-300">
          Demande ton export dans TV Time (Paramètres → Confidentialité → Télécharger mes données), puis dépose le ZIP ici. Le format évolue : les fichiers CSV/JSON sont reconnus par leurs colonnes.
        </p>
        <input type="file" accept={adapter.accepts + ",.csv,.json"} onChange={onFile} className="field" aria-label="Fichier d'export" disabled={running} />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {parsed && !report && (
          <div className="space-y-3">
            <p className="font-semibold">
              {parsed.stats.series} séries, {parsed.stats.episodes} épisodes vus, {parsed.stats.movies} films
              {parsed.stats.favorites ? `, ${parsed.stats.favorites} favoris` : ""}
            </p>
            <Button variant="primary" onClick={start} pending={running} pendingLabel="Import en cours…">Lancer l&apos;import</Button>
            {running && <Button variant="ghost" onClick={() => abort.current?.abort()}>Arrêter</Button>}
          </div>
        )}
        {progress && (running || report) && (
          <div>
            <progress className="w-full accent-brand-500" value={progress.done} max={progress.total || 1} aria-label="Progression de l'import" />
            <p className="text-xs text-zinc-400" aria-live="polite">{progress.done} / {progress.total} {progress.current ? `· ${progress.current}` : ""}</p>
          </div>
        )}
        {report && (
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-emerald-400">
              Importé : {report.imported.series} séries ({report.imported.episodes} épisodes), {report.imported.movies} films.
            </p>
            {report.notFound.length > 0 && (
              <details><summary>{report.notFound.length} élément(s) introuvables sur TMDB</summary><ul className="mt-2 list-disc pl-5 text-zinc-400">{report.notFound.map((n) => <li key={n}>{n}</li>)}</ul></details>
            )}
            {report.failed.length > 0 && (
              <details><summary>{report.failed.length} erreur(s)</summary><ul className="mt-2 list-disc pl-5 text-zinc-400">{report.failed.map((n) => <li key={n}>{n}</li>)}</ul></details>
            )}
            <Link to="/seen" className="btn btn-primary">Voir ma bibliothèque</Link>
          </div>
        )}
      </section>
    </div>
  );
}
