import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../api";
import { useT } from "../i18n";
import { useSettings } from "../settings";
import { daysUntil } from "../lib/episodes";
import { posterUrl } from "../utils";
import { EmptyState, ErrorState, GridSkeleton, PageHeader } from "../components/ui";

const epLabel = (ep) => `S${ep.season_number}·E${ep.episode_number}`;

// « demain », « dans 3 jours »… dans la langue de l'interface
function countdown(airDate, lang) {
  const days = daysUntil(airDate);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  return rtf.format(days, "day");
}

function Poster({ item }) {
  return (
    <img
      src={posterUrl(item.poster_path, "w185") || "/default-movie.png"}
      alt=""
      loading="lazy"
      className="h-24 w-16 shrink-0 rounded-lg bg-ink-700 object-cover"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/default-movie.png";
      }}
    />
  );
}

function InProgressCard({ item, t }) {
  const pct = item.total > 0 ? Math.min(100, Math.round((item.watched / item.total) * 100)) : 0;
  return (
    <li className="surface flex gap-3 p-3">
      <Link to={`/tv/${item.tmdbId}`} aria-label={item.title}><Poster item={item} /></Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold" title={item.title}>{item.title}</h3>
          <p className="text-xs text-zinc-400">{item.watched} / {item.total}</p>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={item.total}
          aria-valuenow={Math.min(item.watched, item.total)}
          aria-label={item.title}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${pct}%` }} />
        </div>
        <Link to={`/tv/${item.tmdbId}`} className="btn btn-primary btn-sm self-start">{t("resume")}</Link>
      </div>
    </li>
  );
}

function UpcomingCard({ item, lang }) {
  const { episode } = item;
  return (
    <li className="surface flex gap-3 p-3">
      <Link to={`/tv/${item.tmdbId}`} aria-label={item.title}><Poster item={item} /></Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
        <div className="min-w-0">
          <h3 className="truncate font-semibold" title={item.title}>{item.title}</h3>
          <p className="truncate text-xs text-zinc-400">
            {epLabel(episode)}{episode.name ? ` · ${episode.name}` : ""}
          </p>
        </div>
        <p className="text-sm">
          <span className="chip !border-brand-400/40 !text-brand-300 capitalize">{countdown(episode.air_date, lang)}</span>
          <time dateTime={episode.air_date} className="ml-2 text-xs text-zinc-400">
            {new Date(`${episode.air_date}T00:00:00`).toLocaleDateString(lang, { day: "numeric", month: "short" })}
          </time>
        </p>
      </div>
    </li>
  );
}

export default function Tracking() {
  const t = useT();
  const { uiLang, metaLang } = useSettings();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setData(null);
    axios
      .get(`${API_URL}/tracking`, { params: { lang: metaLang } })
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error("Erreur chargement suivi :", err);
        setError(true);
      });
  }, [metaLang]);

  useEffect(load, [load]);

  return (
    <div className="page">
      <PageHeader title={t("tracking")} />
      {error ? (
        <ErrorState onRetry={load} />
      ) : !data ? (
        <GridSkeleton count={4} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-2">
          <section aria-labelledby="in-progress-title">
            <h2 id="in-progress-title" className="mb-4 text-xl font-bold">{t("tracking")}</h2>
            {data.inProgress.length === 0 ? (
              <EmptyState icon="📺" title={t("trackingEmptyTitle")} text={t("trackingEmptyText")} />
            ) : (
              <ul className="grid gap-3">{data.inProgress.map((item) => <InProgressCard key={item.tmdbId} item={item} t={t} />)}</ul>
            )}
          </section>
          <section aria-labelledby="upcoming-title">
            <h2 id="upcoming-title" className="mb-4 text-xl font-bold">{t("upcoming")}</h2>
            {data.upcoming.length === 0 ? (
              <EmptyState icon="⏳" title={t("upcomingEmptyTitle")} text={t("upcomingEmptyText")} />
            ) : (
              <ul className="grid gap-3">{data.upcoming.map((item) => <UpcomingCard key={item.tmdbId} item={item} lang={uiLang} />)}</ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
