import { FiStar } from "react-icons/fi";

const compact = (n) => {
  if (!n) return null;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
};

const SOURCES = {
  imdb: { label: "IMDb", cls: "bg-[#f5c518] text-black", title: "Note IMDb (via OMDb)" },
  tmdb: { label: "TMDB", cls: "bg-[#01b4e4] text-black", title: "Note TMDB" },
  flixmatch: { label: "FM", cls: "bg-brand-500 text-white", title: "Note FlixMatch (moyenne des utilisateurs)" },
};

function Badge({ source, score, votes, size }) {
  const { label, cls, title } = SOURCES[source];
  const big = size === "lg";
  return (
    <span
      title={`${title} : ${score.toFixed(1)}/10${votes ? ` (${votes} votes)` : ""}`}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-black/70 text-white backdrop-blur ${big ? "px-2.5 py-1.5 text-sm" : "px-1.5 py-0.5 text-[11px]"}`}
    >
      <span className={`rounded px-1 font-extrabold leading-tight ${cls}`}>{label}</span>
      <span className="inline-flex items-center gap-0.5 font-semibold">
        <FiStar aria-hidden="true" className="text-amber-300" size={big ? 14 : 11} />
        {score.toFixed(1)}
      </span>
      {votes ? <span className="text-zinc-300">{compact(votes)}</span> : null}
    </span>
  );
}

// Composant unique des notes : IMDb / TMDB / FlixMatch (toutes sur 10). Les sources absentes sont masquées.
export default function RatingBadges({ imdb, imdbVotes, tmdb, tmdbVotes, flixmatch, flixmatchVotes, size = "sm", className = "" }) {
  const entries = [
    ["imdb", Number(imdb), imdbVotes],
    ["tmdb", Number(tmdb), tmdbVotes],
    ["flixmatch", Number(flixmatch), flixmatchVotes],
  ].filter(([, score]) => Number.isFinite(score) && score > 0);
  if (entries.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`} role="group" aria-label="Notes">
      {entries.map(([source, score, votes]) => (
        <Badge key={source} source={source} score={score} votes={votes} size={size} />
      ))}
    </div>
  );
}
