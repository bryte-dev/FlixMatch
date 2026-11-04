import { Component } from "react";
import { track, scrubText } from "../lib/analytics";
import { useT } from "../i18n";

function Fallback() {
  const t = useT();
  return (
    <div className="page flex flex-col items-center justify-center gap-4 text-center" role="alert">
      <p className="text-4xl" aria-hidden="true">🎞️</p>
      <h1 className="text-xl font-bold">{t("errorBoundaryTitle")}</h1>
      <p className="max-w-md text-sm text-zinc-400">{t("errorBoundaryText")}</p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        {t("reload")}
      </button>
    </div>
  );
}

// Évite l'écran blanc si une page plante : message + rechargement, erreur remontée (non sensible)
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    try {
      track("client_error", { kind: "render", message: scrubText(error?.message) });
    } catch {
      /* analytics facultatifs */
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <Fallback />;
  }
}
