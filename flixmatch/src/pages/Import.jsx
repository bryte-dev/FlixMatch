import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listZip } from "../lib/zip";
import { ADAPTERS, adapterById, detectAdapter } from "../lib/import";
import { commitAll, needsReview, resolveAll } from "../lib/import/runner";
import { BottomSheet, Button, PageHeader, Tabs } from "../components/ui";
import { posterUrl } from "../utils";
import { track } from "../lib/analytics";
import { useT, tr } from "../i18n";

const PAGE = 100;
const MAX_FILE_BYTES = 200 * 1024 * 1024;

const kindKey = (k) => (k === "tv" ? "mdTv" : k === "movie" ? "mdMovie" : "imKindUnknown");
const viaLabel = { tmdb: "ID TMDB", imdb: "ID IMDb", tvdb: "ID TVDB" };
const errorKey = { tmdb_unavailable: "imErrTmdb", rate_limited: "imErrRate", network: "imErrNet" };

async function readFiles(fileList) {
  const decoder = new TextDecoder();
  const files = [];
  for (const file of fileList) {
    if (file.size > MAX_FILE_BYTES) throw new Error(tr("imTooBig", { name: file.name }));
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
  const t = useT();
  const m = item.match;
  const poster = posterUrl(m?.poster, "w92");
  return (
    <li className="flex items-center gap-3 py-2">
      {m && (
        <input type="checkbox" className="h-5 w-5 shrink-0" checked={checked} onChange={onToggle} aria-label={t("imAria", { title: m.title })} />
      )}
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-white/5">
        {poster ? <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-semibold" title={m?.title || item.title}>
          {m ? m.title : item.title || t("imUntitled")} {m?.year ? <span className="font-normal text-zinc-400">({m.year})</span> : null}
        </p>
        <p className="truncate text-xs text-zinc-400">
          {t(kindKey(m?.mediaType || item.kind))}
          {m && item.title && item.title !== m.title ? ` · ${t("imAsTitle", { title: `${item.title}${item.year ? ` (${item.year})` : ""}` })}` : ""}
          {!m && item.year ? ` · ${item.year}` : ""}
          {item.episodes?.length ? ` · ${t("imEps", { n: item.episodes.length })}` : ""}
          {item.rating ? ` · ${item.rating}★` : ""}
          {item.favorite ? ` · ${t("mdFavorite").toLowerCase()}` : ""}
          {item.status === "WATCHLIST" && item.kind !== "tv" ? ` · ${t("imToWatch")}` : ""}
        </p>
        {m && (
          <p className="text-xs text-zinc-500">
            {t("imFoundVia", { via: viaLabel[m.via] || (m.via === "title" ? t("imViaTitle") : m.via) })}
            {needsReview(item) ? <span className="ml-1 text-amber-400">· {t("imToCheck")}</span> : null}
          </p>
        )}
        {!m && item.error && <p className="text-xs text-red-400">{t(errorKey[item.error] || "imErr")}</p>}
      </div>
    </li>
  );
}

export default function Import() {
  const t = useT();
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
      if (files.length === 0) throw new Error(t("imNoFile"));
      const chosen = source === "auto" ? detectAdapter(files) : adapterById(source);
      if (!chosen) throw new Error(t("imBadFormat"));
      const result = await chosen.parse(files);
      if (result.items.length === 0) throw new Error(t("imNoneRecognized", { label: chosen.label }));
      setAdapter(chosen);
      setParsed(result);
      track("import_file_parsed", { source: chosen.id, auto_detected: source === "auto", movies: result.stats.movies, series: result.stats.series, episodes: result.stats.episodes });
    } catch (err) {
      setError(err.message || t("imUnreadable"));
      track("import_parse_failed", { source });
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
      track("import_matched", { source: adapter?.id, total: out.length, matched: out.filter((it) => it.match).length, to_review: out.filter(needsReview).length, tmdb_errors: out.filter((it) => it.error).length });
      setTab("matched");
      setShown(PAGE);
      setPhase("preview");
    } catch (err) {
      setError(err.message || t("imAnalyseFail"));
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
      const result = await commitAll(chosen, { onProgress: setProgress, signal: abort.current.signal });
      setReport(result);
      setPhase("done");
      track("import_completed", { source: adapter?.id, selected: chosen.length, created: result.created, updated: result.updated, episodes_added: result.episodesAdded, episodes_skipped: result.episodesSkipped, reviews: result.reviews, failed: result.failed.length, aborted: result.aborted });
    } catch (err) {
      setError(err.message || t("imInterrupted"));
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
      <PageHeader title={t("imTitle")} subtitle={t("imSubtitle")} />
      <section className="surface space-y-4 p-5">
        <label className="block text-sm font-semibold" htmlFor="import-source">{t("imSource")}</label>
        <select id="import-source" className="field" value={source} onChange={(e) => { setSource(e.target.value); setAdapter(null); reset(); }} disabled={busy}>
          <option value="auto">{t("imAuto")}</option>
          {ADAPTERS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <p className="text-sm text-zinc-400">
          {current ? current.hint : t("imDefaultHint")}
        </p>
        <input type="file" multiple accept=".zip,.csv,.json,application/zip,text/csv,application/json" onChange={onFiles} className="field" aria-label={t("imFilesAria")} disabled={busy} />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        {parsed && phase === "idle" && (
          <div className="space-y-3">
            <p className="font-semibold">
              {t("imSummary", { label: adapter?.label, series: s.series, episodes: s.episodes, movies: s.movies })}
              {s.unknown ? ` · ${t("imUnknownTitles", { n: s.unknown })}` : ""}
            </p>
            <p className="text-sm text-zinc-400">
              {t("imSummary2", { watchlist: s.watchlist, favorites: s.favorites, ratings: s.ratings, reviews: s.reviews })}
            </p>
            <Button variant="primary" className="w-full sm:w-auto" onClick={analyse}>{t("imSearchMatches")}</Button>
            <p className="text-xs text-zinc-500">{t("imNothingSaved")}</p>
          </div>
        )}

        {phase === "resolving" && (
          <div className="space-y-2">
            <Progress progress={progress} label={t("imTmdbProgress")} />
            <Button variant="ghost" onClick={() => abort.current?.abort()}>{t("imStop")}</Button>
          </div>
        )}
      </section>

      {resolved && (phase === "preview" || phase === "committing") && (
        <section className="surface mt-5 space-y-3 p-5">
          <h2 className="text-lg font-bold">{t("imPreview")}</h2>
          <p className="text-sm text-zinc-300">
            {t("imFoundCounts", { matched: matched.length, unmatched: unmatched.length })}
          </p>
          <Tabs
            label={t("imPreviewLabel")}
            value={tab}
            onChange={(id) => { setTab(id); setShown(PAGE); }}
            tabs={[["matched", t("imTabMatched", { n: matched.length })], ["review", t("imTabReview", { n: toReview.length })], ["unmatched", t("imTabUnmatched", { n: unmatched.length })]]}
          />
          {tab !== "unmatched" && matched.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setAll(true)} disabled={busy}>{t("imCheckAll")}</Button>
              <Button size="sm" variant="secondary" onClick={() => setAll(false)} disabled={busy}>{t("imUncheckAll")}</Button>
            </div>
          )}
          {list.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("imNothingHere")}</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {list.slice(0, shown).map((it) => (
                <PreviewRow key={it.key} item={it} checked={selected.has(it.key)} onToggle={() => toggle(it.key)} />
              ))}
            </ul>
          )}
          {list.length > shown && (
            <Button variant="ghost" onClick={() => setShown((n) => n + PAGE)}>{t("imShowMore", { n: list.length - shown })}</Button>
          )}
          {phase === "committing" ? (
            <div className="space-y-2">
              <Progress progress={progress} label={t("imProgressImport")} />
              <Button variant="ghost" onClick={() => abort.current?.abort()}>{t("imStop")}</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={selectedCount === 0}>
                {t("imImportN", { n: selectedCount })}
              </Button>
              <Button variant="ghost" onClick={reset}>{t("cancel")}</Button>
            </div>
          )}
        </section>
      )}

      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t("imConfirmTitle")}>
        <div className="space-y-3 text-sm">
          <p>
            {t("imConfirmText", { n: selectedCount })}
            {unmatched.length ? ` ${t("imConfirmIgnored", { n: unmatched.length })}` : ""}
          </p>
          <p className="text-zinc-400">
            {t("imNeverDowngrade")}
          </p>
          <Button variant="primary" className="w-full" onClick={confirmImport}>{t("imConfirmBtn")}</Button>
          <Button variant="ghost" className="w-full" onClick={() => setConfirmOpen(false)}>{t("imBackPreview")}</Button>
        </div>
      </BottomSheet>

      {report && phase === "done" && (
        <section className="surface mt-5 space-y-2 p-5 text-sm" aria-live="polite">
          <p className="font-semibold text-emerald-400">
            {report.aborted ? t("imAborted") : t("imDone")}{" "}
            {t("imReportCounts", { created: report.created, updated: report.updated, unchanged: report.unchanged })}
          </p>
          <p>
            {t("imReportEps", { n: report.episodesAdded })}{report.reviews ? `, ${t("imReportReviews", { n: report.reviews })}` : ""}.
          </p>
          {report.episodesSkipped > 0 && (
            <p className="text-zinc-400">
              {t("imSkipped", { n: report.episodesSkipped })}
            </p>
          )}
          {report.failed.length > 0 && (
            <details>
              <summary>{t("imFailedSummary", { n: report.failed.length })}</summary>
              <ul className="mt-2 list-disc pl-5 text-zinc-400">{report.failed.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}</ul>
            </details>
          )}
          {unmatched.length > 0 && (
            <details>
              <summary>{t("imUnmatchedSummary", { n: unmatched.length })}</summary>
              <ul className="mt-2 list-disc pl-5 text-zinc-400">{unmatched.map((it) => <li key={it.key}>{it.title || t("imUntitled")}{it.year ? ` (${it.year})` : ""}</li>)}</ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Link to="/watchlist" className="btn btn-primary">{t("imViewLibrary")}</Link>
            <Button variant="ghost" onClick={reset}>{t("imNew")}</Button>
          </div>
        </section>
      )}
    </div>
  );
}
