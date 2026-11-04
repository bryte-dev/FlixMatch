import { useEffect, useState } from "react";
import axios from "axios";
import { validateUsername } from "../lib/username";
import { useT } from "../i18n";
import { FormField } from "./AuthCard";

// Champ « nom d'utilisateur » : validation locale + disponibilité vérifiée côté serveur (anti-rebond).
// `onValidity(true|false)` indique si le nom peut être envoyé.
export default function UsernameField({ id = "username", value, onChange, onValidity, autoFocus = false }) {
  const t = useT();
  const [state, setState] = useState({ status: "idle", reason: null });

  useEffect(() => {
    const local = validateUsername(value);
    if (!value) {
      setState({ status: "idle", reason: null });
      onValidity?.(false);
      return undefined;
    }
    if (!local.ok) {
      setState({ status: "invalid", reason: local.reason });
      onValidity?.(false);
      return undefined;
    }
    setState({ status: "checking", reason: null });
    onValidity?.(false);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      axios
        .get("/users/username-available", { params: { u: local.username }, signal: controller.signal })
        .then((res) => {
          setState(res.data.available ? { status: "ok", reason: null } : { status: "invalid", reason: res.data.reason || "usernameTaken" });
          onValidity?.(Boolean(res.data.available));
        })
        .catch((err) => {
          if (axios.isCancel(err)) return;
          // Vérification indisponible : le serveur tranchera à l'envoi
          setState({ status: "idle", reason: null });
          onValidity?.(true);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // onValidity est volontairement exclu : seul le texte saisi déclenche la vérification
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const message =
    state.status === "checking" ? t("usernameChecking") : state.status === "ok" ? t("usernameAvailable") : state.reason ? t(state.reason) : t("usernameHint");
  const tone = state.status === "ok" ? "text-emerald-400" : state.status === "invalid" ? "text-red-300" : "text-zinc-500";

  return (
    <div>
      <FormField
        id={id}
        label={t("usernameLabel")}
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={30}
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={state.status === "invalid"}
        aria-describedby={`${id}-status`}
      />
      <p id={`${id}-status`} role="status" className={`-mt-0.5 text-xs ${tone}`}>{message}</p>
    </div>
  );
}
