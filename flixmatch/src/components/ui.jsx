import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export function Spinner({ className = "h-4 w-4" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

// Bouton avec état « pending » : désactivé + spinner + libellé temporaire
export function Button({
  variant = "secondary",
  size,
  pending = false,
  pendingLabel,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`btn ${VARIANTS[variant]} ${size === "sm" ? "btn-sm" : ""} ${className}`}
      {...props}
    >
      {pending && <Spinner className="h-3.5 w-3.5" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ icon = "🎬", title, text, actionTo, actionLabel }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 text-5xl" aria-hidden="true">{icon}</div>
      <h2 className="text-xl font-bold">{title}</h2>
      {text && <p className="mt-2 max-w-md text-zinc-400">{text}</p>}
      {actionTo && (
        <Link to={actionTo} className="btn btn-primary mt-6">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ message = "Impossible de charger les données.", onRetry }) {
  return (
    <div role="alert" className="surface flex flex-col items-center border-red-500/20 px-6 py-12 text-center">
      <div className="mb-3 text-4xl" aria-hidden="true">⚠️</div>
      <p className="text-zinc-300">{message}</p>
      {onRetry && (
        <Button className="mt-5" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="surface overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[2/3] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/3" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 10 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" role="status" aria-label="Chargement">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MediaGrid({ children }) {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{children}</div>;
}

export function StarRating({ value = 0, onChange, pending = false, label = "Note" }) {
  return (
    <div className="inline-flex items-center gap-0.5" role={onChange ? "radiogroup" : "img"} aria-label={`${label} : ${value || 0} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        const glyph = (
          <span className={`text-xl leading-none ${active ? "text-amber-400" : "text-zinc-600"}`} aria-hidden="true">
            ★
          </span>
        );
        return onChange ? (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
            disabled={pending}
            onClick={() => onChange(star)}
            className="rounded p-0.5 transition hover:scale-110 disabled:opacity-60"
          >
            {glyph}
          </button>
        ) : (
          <span key={star}>{glyph}</span>
        );
      })}
    </div>
  );
}

// Bottom sheet sur mobile, modale centrée sur desktop. Fermeture : Échap, clic sur le fond, bouton.
export function BottomSheet({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="sheet surface safe-bottom max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-b-none p-5 outline-none sm:rounded-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
