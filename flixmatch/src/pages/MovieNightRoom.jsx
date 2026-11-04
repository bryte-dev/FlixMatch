import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { FiCheck, FiHeart, FiLink, FiX } from "react-icons/fi";
import { useToast } from "../toastContext";
import { useSettings } from "../settings";
import { DICT, useT } from "../i18n";
import { track } from "../lib/analytics";
import useNightRoom from "../hooks/useNightRoom";
import { normalizeCode } from "../lib/night";
import Avatar from "../components/Avatar";
import MatchModal from "../components/MatchModal";
import MediaCard from "../components/MediaCard";
import SwipeCard from "../components/SwipeCard";
import { Button, EmptyState, ErrorState, MediaGrid, Spinner } from "../components/ui";
import { errorMessage, posterUrl } from "../utils";

const cardKey = (c) => `${c.mediaType}-${c.tmdbId}`;
const hasText = (key) => Boolean(key && DICT.fr[key]);

function Players({ members, total, showProgress }) {
  return (
    <ul className="flex flex-wrap gap-3" aria-label="Players">
      {members.map((m) => (
        <li key={m.id} className="surface flex min-w-36 items-center gap-2 p-2 pr-3">
          <Avatar avatar={m.avatar} name={m.username} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{m.username || `#${m.id}`}</p>
            {showProgress && total > 0 && (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={m.swiped}>
                <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, (m.swiped / total) * 100)}%` }} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SwipeDeck({ code, state, reload, onMatch }) {
  const t = useT();
  const toast = useToast();
  const cardRef = useRef(null);
  const [local, setLocal] = useState(() => new Set());
  const [pending, setPending] = useState(false);
  const [bump, setBump] = useState(0);
  const queue = state.queue.filter((c) => !local.has(cardKey(c)));
  const top = queue[0];
  const next = queue[1];

  const vote = useCallback(
    async (liked) => {
      if (!top || pending) return;
      setPending(true);
      setLocal((s) => new Set(s).add(cardKey(top)));
      try {
        const { data } = await axios.post(`/night/${code}/swipe`, { tmdbId: top.tmdbId, mediaType: top.mediaType, liked });
        if (data.match) onMatch(data.match);
      } catch (err) {
        setLocal((s) => {
          const copy = new Set(s);
          copy.delete(cardKey(top));
          return copy;
        });
        const reason = err.response?.data?.reason;
        toast(hasText(reason) ? t(reason) : errorMessage(err, t("nightNotActive")), "error");
      } finally {
        await reload();
        setPending(false);
      }
    },
    [top, pending, code, onMatch, reload, toast, t]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") cardRef.current?.trigger("right");
      if (e.key === "ArrowLeft") cardRef.current?.trigger("left");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!top) {
    return state.remaining > 0 ? (
      <div className="flex justify-center py-16 text-brand-400" role="status"><Spinner className="h-8 w-8" /></div>
    ) : (
      <EmptyState icon="⏳" title={t("nightWaitingOthers")} />
    );
  }
  return (
    <div className="mx-auto" style={{ width: "min(100%, 24rem, max(14rem, calc((100dvh - 24rem) * 2 / 3)))" }}>
      <div className="relative mb-4 aspect-[2/3] w-full">
        {next && <img src={posterUrl(next.posterPath, "w342")} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-95 rounded-2xl object-cover opacity-60" />}
        <SwipeCard
          key={`${cardKey(top)}-${bump}`}
          ref={cardRef}
          noUp
          disabled={pending}
          onSwipe={(dir) => (dir === "up" ? setBump((b) => b + 1) : vote(dir === "right"))}
        >
          <article className="surface relative h-full w-full overflow-hidden" aria-label={top.title}>
            <img src={posterUrl(top.posterPath, "w780") || "/default-movie.png"} alt={top.title} draggable={false} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-16 text-white">
              <h2 className="text-xl font-bold leading-tight">{top.title}</h2>
              <p className="mb-1 text-xs text-zinc-300">{[top.year, top.rating ? `★ ${top.rating.toFixed(1)}` : null].filter(Boolean).join(" · ")}</p>
              {top.overview && <p className="line-clamp-3 text-xs text-zinc-200">{top.overview}</p>}
            </div>
          </article>
        </SwipeCard>
      </div>
      <div className="flex items-center justify-center gap-6" role="group">
        <Button onClick={() => cardRef.current?.trigger("left")} disabled={pending} aria-label={t("nightPass")} title={`${t("nightPass")} (←)`} className="!h-14 !w-14 !rounded-full"><FiX size={26} aria-hidden="true" /></Button>
        <Button variant="primary" onClick={() => cardRef.current?.trigger("right")} disabled={pending} aria-label={t("nightLike")} title={`${t("nightLike")} (→)`} className="!h-14 !w-14 !rounded-full"><FiHeart size={26} aria-hidden="true" /></Button>
      </div>
      <p className="mt-3 text-center text-xs text-zinc-400">{state.remaining} {t("nightLeft")}</p>
    </div>
  );
}

export default function MovieNightRoom() {
  const { code: raw } = useParams();
  const code = normalizeCode(raw);
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { metaLang } = useSettings();
  const [celebration, setCelebration] = useState(null);
  const celebrated = useRef(new Set());
  const [busy, setBusy] = useState(false);

  const onMatch = useCallback((card) => {
    const key = cardKey(card);
    if (celebrated.current.has(key)) return;
    celebrated.current.add(key);
    track("movie_night_match", { media_type: card.mediaType, tmdb_id: card.tmdbId });
    setCelebration(card);
  }, []);

  const { state, error, reload } = useNightRoom(code || "INVALID", onMatch);

  // Les matchs déjà présents au chargement ne sont pas re-fêtés
  useEffect(() => {
    state?.matches?.forEach((m) => celebrated.current.add(cardKey(m)));
  }, [state?.member, state?.room?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Une partie terminée est comptée une fois par participant, seulement si on l'a vue se terminer
  const lastStatus = useRef(null);
  const status = state?.room?.status;
  useEffect(() => {
    if (!state?.member) return;
    if (status === "ENDED" && lastStatus.current && lastStatus.current !== "ENDED") {
      track("movie_night_completed", { players: state.members.length, matches: state.matches.length, cards: state.room.total, media_type: state.room.mediaType });
    }
    lastStatus.current = status;
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (path, body, errorKey) => {
    setBusy(true);
    try {
      await axios.post(`/night/${code}/${path}`, body);
      if (path === "start") track("movie_night_started", { players: state.members.length, media_type: state.room.mediaType, is_host: true });
      if (path === "join") track("movie_night_joined", { players_before: state.room.members });
      await reload();
    } catch (err) {
      const reason = err.response?.data?.reason;
      toast(hasText(reason) ? t(reason) : errorMessage(err, t(errorKey)), "error");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/movie-night/${code}`);
      toast(t("nightLinkCopied"), "success");
    } catch {
      toast(`${window.location.origin}/movie-night/${code}`, "info");
    }
  };

  if (!code || error) {
    return <div className="page"><ErrorState message={t(!code ? "nightCodeInvalid" : hasText(error) ? error : "nightNotFound")} /></div>;
  }
  if (!state) return <div className="page flex justify-center py-24 text-brand-400" role="status"><Spinner className="h-8 w-8" /></div>;

  const { room } = state;
  if (!state.member) {
    return (
      <div className="page max-w-md text-center">
        <h1 className="mb-2 text-2xl font-extrabold">🍿 {t("nightTitle")}</h1>
        <p className="mb-1 text-zinc-400">{t("nightHostedBy")} {room.host?.username}</p>
        <p className="mb-6 font-mono text-2xl tracking-widest">{room.code}</p>
        {state.joinable ? (
          <Button variant="primary" pending={busy} onClick={() => act("join", {}, "nightFull")}>{t("nightJoin")}</Button>
        ) : (
          <p className="text-zinc-400">{room.status === "LOBBY" ? t("nightFull") : t("nightStarted")}</p>
        )}
      </div>
    );
  }

  const header = (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold">🍿 {t("nightTitle")}</h1>
        <p className="text-sm text-zinc-400">{t("nightCodeIs")} <span className="font-mono tracking-widest text-zinc-200">{room.code}</span></p>
      </div>
      <Link to="/movie-night" className="btn btn-ghost btn-sm">{t("nightBack")}</Link>
    </div>
  );

  return (
    <div className="page max-w-3xl">
      {header}

      {room.status === "LOBBY" && (
        <div className="grid gap-5">
          <Players members={state.members} />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={copyLink}><FiLink aria-hidden="true" /> {t("nightShareLink")}</Button>
            {state.isHost ? (
              <Button variant="primary" pending={busy} disabled={state.members.length < 2} onClick={() => act("start", { lang: metaLang }, "nightNotActive")}>{t("nightStart")}</Button>
            ) : (
              <p className="text-sm text-zinc-400" role="status">{t("nightWaitHost")}</p>
            )}
          </div>
          {state.isHost && state.members.length < 2 && <p className="text-sm text-zinc-400">{t("nightNeedPlayers")}</p>}
        </div>
      )}

      {room.status === "ACTIVE" && (
        <div className="grid gap-6">
          <Players members={state.members} total={room.total} showProgress />
          <SwipeDeck code={code} state={state} reload={reload} onMatch={onMatch} />
          {state.matches.length > 0 && <p className="text-center text-sm text-brand-300"><FiCheck aria-hidden="true" className="inline" /> {state.matches.length} match</p>}
          {state.isHost && <div className="text-center"><Button size="sm" variant="ghost" pending={busy} onClick={() => act("end", {}, "nightNotActive")}>{t("nightEnd")}</Button></div>}
        </div>
      )}

      {room.status === "ENDED" && (
        <div>
          <h2 className="mb-4 text-xl font-bold">{t("nightEnded")} · {t("nightResultsTitle")}</h2>
          {state.matches.length === 0 ? (
            <EmptyState icon="🤷" title={t("nightNoMatch")} actionTo="/movie-night" actionLabel={t("nightCreate")} />
          ) : (
            <MediaGrid>
              {state.matches.map((m) => (
                <MediaCard key={cardKey(m)} to={`/${m.mediaType}/${m.tmdbId}`} title={m.title} poster={posterUrl(m.posterPath)} subtitle={m.year} />
              ))}
            </MediaGrid>
          )}
          <div className="mt-6"><Button onClick={() => navigate("/movie-night")}>{t("nightBack")}</Button></div>
        </div>
      )}

      <MatchModal key={celebration?.tmdbId} card={celebration} onClose={() => setCelebration(null)} />
    </div>
  );
}
