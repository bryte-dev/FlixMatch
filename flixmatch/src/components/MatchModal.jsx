import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useT } from "../i18n";
import { Button } from "./ui";
import { posterUrl } from "../utils";

const CONFETTI = ["🎉", "🍿", "🎬", "✨", "🎊"];

// Célébration « It's a Match! » : confettis CSS (désactivés par prefers-reduced-motion) + affiche
export default function MatchModal({ card, onClose }) {
  const t = useT();
  const pieces = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ id: i, emoji: CONFETTI[i % CONFETTI.length], left: Math.random() * 100, delay: Math.random() * 0.8, duration: 2.2 + Math.random() * 1.8, drift: Math.round(Math.random() * 120 - 60) })),
    []
  );
  useEffect(() => {
    if (!card) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [card, onClose]);
  if (!card) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={t("nightMatchTitle")} onClick={onClose}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {pieces.map((p) => (
          <span key={p.id} className="confetti text-2xl" style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, "--drift": `${p.drift}px` }}>{p.emoji}</span>
        ))}
      </div>
      <div className="match-pop surface relative w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-3xl font-extrabold text-brand-400">{t("nightMatchTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-300">{t("nightMatchText")}</p>
        <Link to={`/${card.mediaType}/${card.tmdbId}`} onClick={onClose} className="block">
          <img src={posterUrl(card.posterPath, "w342") || "/default-movie.png"} alt="" className="mx-auto my-4 h-64 rounded-xl object-cover shadow-xl" />
          <p className="mb-4 text-lg font-bold underline-offset-4 hover:underline">{card.title}</p>
        </Link>
        <Button variant="primary" onClick={onClose} className="w-full">{t("nightKeepSwiping")}</Button>
      </div>
    </div>
  );
}
