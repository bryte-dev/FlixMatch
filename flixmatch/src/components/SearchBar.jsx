import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../api";
import { FiSearch } from "react-icons/fi";
import { Spinner } from "./ui";
import { getSettings } from "../settings";
import { mediaTitle, posterUrl } from "../utils";

function SearchBar({ onNavigate, className = "" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const inputId = useId();

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setResults([]);
      setOpen(false);
      setFailed(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await axios.get(`${API_URL}/tmdb/search/${encodeURIComponent(term)}`, {
          signal: controller.signal,
          params: { lang: getSettings().metaLang },
        });
        setResults(res.data.slice(0, 6));
        setOpen(true);
      } catch (error) {
        if (!axios.isCancel(error)) {
          setFailed(true);
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery("");
    onNavigate?.();
  };

  const submit = (e) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    navigate(`/search/${encodeURIComponent(term)}`);
    close();
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <form onSubmit={submit} role="search">
        <label htmlFor={inputId} className="sr-only">
          Rechercher un film ou une série
        </label>
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Rechercher un film, une série…"
            autoComplete="off"
            className="field !rounded-full !bg-white/5 !py-2 pl-9 pr-9"
          />
          {loading && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />}
        </div>
      </form>

      {open && (
        <div className="surface absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-auto p-1 sm:min-w-80">
          {failed ? (
            <p className="px-3 py-4 text-sm text-zinc-400">La recherche est indisponible pour le moment.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-400">Aucun résultat.</p>
          ) : (
            <ul>
              {results.map((item) => {
                const isPerson = item.media_type === "person";
                const img = posterUrl(item.poster_path || item.profile_path, "w92");
                const content = (
                  <>
                    <img
                      src={img || (isPerson ? "/default-actor.png" : "/default-movie.png")}
                      data-fallback={isPerson ? "/default-actor.png" : undefined}
                      alt=""
                      className={`h-12 w-8 shrink-0 bg-ink-700 object-cover ${isPerson ? "rounded-full" : "rounded"}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{mediaTitle(item)}</span>
                      <span className="block text-xs text-zinc-400">
                        {isPerson ? "Personne · Rechercher sur Google" : item.media_type === "movie" ? "Film" : "Série TV"}
                      </span>
                    </span>
                  </>
                );
                const cls = "flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/10";
                return (
                  <li key={`${item.media_type}-${item.id}`}>
                    {isPerson ? (
                      <a
                        className={cls}
                        href={`https://www.google.com/search?q=${encodeURIComponent(item.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {content}
                      </a>
                    ) : (
                      <Link className={cls} to={`/${item.media_type}/${item.id}`} onClick={close}>
                        {content}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
