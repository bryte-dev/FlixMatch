import { Link } from "react-router-dom";

export default function AuthCard({ title, subtitle, footer, children }) {
  return (
    <div className="page flex items-center justify-center">
      <div className="surface w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" aria-label="Accueil FlixMatch">
            <img src="/FlixMatchLogo.png" alt="" className="mb-3 h-14 w-14" />
          </Link>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
        </div>
        {children}
        {footer && <p className="mt-6 text-center text-sm text-zinc-400">{footer}</p>}
      </div>
    </div>
  );
}

export function FormField({ id, label, hint, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-300">{label}</label>
      <input id={id} className="field" {...props} />
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
