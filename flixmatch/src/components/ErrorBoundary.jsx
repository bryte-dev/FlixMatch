import { Component } from "react";
import { track, scrubText } from "../lib/analytics";

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
    return (
      <div className="page flex flex-col items-center justify-center gap-4 text-center" role="alert">
        <p className="text-4xl" aria-hidden="true">🎞️</p>
        <h1 className="text-xl font-bold">Oups, cette page a planté.</h1>
        <p className="max-w-md text-sm text-zinc-400">Recharge la page pour réessayer. Tes données ne sont pas touchées.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </div>
    );
  }
}
