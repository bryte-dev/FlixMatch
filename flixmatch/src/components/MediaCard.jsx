import { Link } from "react-router-dom";

// Carte affiche : ratio 2/3, titre tronqué, overlay dégradé, lift au survol. `children` = zone d'actions.
export default function MediaCard({ to, title, poster, subtitle, badge, children }) {
  return (
    <article className="group surface flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-brand-400/40 hover:shadow-brand-600/20 focus-within:-translate-y-1">
      <Link to={to} className="relative block aspect-[2/3] overflow-hidden bg-ink-700" aria-label={title}>
        <img
          src={poster || "/default-movie.png"}
          alt={`Affiche de ${title}`}
          loading="lazy"
          className={`h-full w-full transition duration-500 group-hover:scale-105 ${poster ? "object-cover" : "object-contain p-10 opacity-60"}`}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/default-movie.png";
            e.currentTarget.className = "h-full w-full object-contain p-10 opacity-60";
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            {badge}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold sm:text-base" title={title}>
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-zinc-400">{subtitle}</p>}
        </div>
        {children && <div className="mt-auto flex flex-wrap gap-2">{children}</div>}
      </div>
    </article>
  );
}
