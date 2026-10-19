// Analytics produit (PostHog), pensé pour ne jamais gêner l'utilisateur :
// - inactif sans clé (VITE_POSTHOG_KEY ou NEXT_PUBLIC_POSTHOG_KEY) : aucune requête, aucun chargement ;
// - SDK chargé à la demande (import dynamique), après le premier rendu ;
// - toute erreur PostHog est avalée (try/catch partout) ;
// - aucun cookie ni stockage local (persistence "memory"), pas d'enregistrement de session,
//   pas d'autocapture, aucun script externe ; les identifiants envoyés sont des ids internes,
//   jamais l'email ; les URL sont nettoyées (codes d'invitation, paramètres).
// - l'utilisateur peut refuser dans les Paramètres (stocké sur l'appareil).

const env = import.meta.env || {};
const KEY = env.VITE_POSTHOG_KEY || env.NEXT_PUBLIC_POSTHOG_KEY || "";
const HOST = (env.VITE_POSTHOG_HOST || env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/+$/, "");
const OPT_OUT_KEY = "fm-analytics-optout";
const MAX_QUEUE = 100;

let client = null;
let loading = null;
let queue = [];

export const analyticsConfigured = () => Boolean(KEY);

const safe = (fn) => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

export const isOptedOut = () => safe(() => localStorage.getItem(OPT_OUT_KEY) === "1") || false;

// Retire tout ce qui pourrait être personnel d'une URL / d'un chemin
export const cleanPath = (value) =>
  String(value || "")
    .replace(/[?#].*$/, "")
    .replace(/\/join\/[^/]+/, "/join/:code")
    .replace(/\/search\/[^/]+/, "/search/:query");

const cleanUrl = (value) => {
  if (!value) return value;
  return safe(() => {
    const url = new URL(value, window.location.origin);
    return url.origin + cleanPath(url.pathname);
  }) || "";
};

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const TOKEN = /\b(eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{32,})\b/g;
export const scrubText = (value, max = 200) => String(value ?? "").replace(EMAIL, "[email]").replace(TOKEN, "[token]").slice(0, max);

// Propriétés d'événement : valeurs simples uniquement, textes nettoyés et tronqués
export const cleanProps = (props = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || typeof v === "function") continue;
    if (typeof v === "string") out[k] = scrubText(v, 120);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.slice(0, 20).map((x) => (typeof x === "string" ? scrubText(x, 60) : x));
  }
  return out;
};

const beforeSend = (event) => {
  if (!event) return event;
  return safe(() => {
    const p = event.properties || {};
    for (const k of ["$current_url", "$referrer", "$initial_referrer", "$initial_current_url"]) if (p[k]) p[k] = cleanUrl(p[k]);
    if (p.$pathname) p.$pathname = cleanPath(p.$pathname);
    return event;
  }) ?? event;
};

const run = (fn) => {
  if (!KEY || isOptedOut()) return;
  if (client) safe(() => fn(client));
  else if (queue.length < MAX_QUEUE) queue.push(fn);
};

export function initAnalytics() {
  if (!KEY || loading || typeof window === "undefined" || isOptedOut()) return;
  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        persistence: "memory",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        capture_pageleave: false,
        autocapture: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_exceptions: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_web_experiments: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        respect_dnt: true,
        before_send: beforeSend,
      });
      client = posthog;
      const pending = queue;
      queue = [];
      pending.forEach((fn) => safe(() => fn(client)));
    })
    .catch(() => {
      // bloqueur de pub, réseau… : l'application continue sans analytics
      queue = [];
    });
}

export const track = (event, props) => run((ph) => ph.capture(event, cleanProps(props)));

// Identifiant interne uniquement (jamais l'email ni le pseudo)
export const identifyUser = (user) => {
  if (!user?.id) return;
  run((ph) => ph.identify(`user_${user.id}`));
};

export const resetAnalytics = () => run((ph) => ph.reset());

export function setAnalyticsOptOut(optOut) {
  safe(() => (optOut ? localStorage.setItem(OPT_OUT_KEY, "1") : localStorage.removeItem(OPT_OUT_KEY)));
  if (optOut) {
    if (client) safe(() => client.opt_out_capturing());
    queue = [];
  } else {
    if (client) safe(() => client.opt_in_capturing());
    else initAnalytics();
  }
}

// ---------- Événements dérivés des appels API (un seul point de branchement) ----------

// Gabarit de route sans données : /watchlist/123/seen → /watchlist/:id/seen
export const routeTemplate = (url) => {
  const path = cleanPath(String(url || "").replace(/^https?:\/\/[^/]+/, ""));
  if (/^\/tmdb\//.test(path)) return path.split("/").slice(0, 3).join("/");
  return path.replace(/\/\d+(?=\/|$)/g, "/:id").replace(/\/invite\/[^/]+/, "/invite/:code");
};

const MUTATION_EVENTS = [
  ["post", /^\/watchlist$/, () => ["watchlist_added"]],
  ["delete", /^\/watchlist\/:id$/, () => ["library_entry_removed"]],
  ["put", /^\/watchlist\/:id\/seen$/, () => ["marked_seen"]],
  ["put", /^\/seen\/:id\/remove$/, () => ["unmarked_seen"]],
  ["put", /^\/watchlist\/:id\/favorite$/, (body) => [body?.isFavorite ? "favorite_added" : "favorite_removed"]],
  ["put", /^\/watchlist\/:id\/junk$/, () => ["moved_to_trash"]],
  ["put", /^\/junk\/:id\/restore$/, () => ["restored_from_trash"]],
  ["put", /^\/seen\/:id\/rating$/, (body) => ["rating_set", { rating: body?.rating }]],
  ["post", /^\/reviews(\/:id)?$/, (body) => ["review_posted", { is_reply: Boolean(body?.parentId), rating: body?.rating }]],
  ["delete", /^\/reviews\/:id$/, () => ["review_deleted"]],
  ["post", /^\/ignored$/, () => ["title_ignored"]],
  ["put", /^\/library\/abandoned$/, (body) => [body?.abandoned ? "series_abandoned" : "series_resumed"]],
  ["put", /^\/episodes\/:id/, (body, path) => ["episode_progress_updated", { scope: /bulk/.test(path) ? "bulk" : /season/.test(path) ? "season" : "episode", watched: body?.watched }]],
  ["post", /^\/users\/:id\/follow$/, () => ["user_followed"]],
  ["delete", /^\/users\/:id\/follow$/, () => ["user_unfollowed"]],
  ["post", /^\/account\/reset-data$/, () => ["account_data_reset"]],
  ["delete", /^\/account$/, () => ["account_deleted"]],
];

const parseBody = (data) => (typeof data === "string" ? safe(() => JSON.parse(data)) : data) || {};

export function eventForRequest(method, url, data) {
  const m = String(method || "get").toLowerCase();
  const path = routeTemplate(url);
  for (const [verb, re, build] of MUTATION_EVENTS) {
    if (verb === m && re.test(path)) {
      const [name, props] = build(parseBody(data), path);
      return { name, props };
    }
  }
  return null;
}

// Intercepteur axios : événements métier sur succès, erreurs techniques non sensibles sur échec
export function installAxiosAnalytics(axiosInstance) {
  if (!KEY) return;
  axiosInstance.interceptors.response.use(
    (response) => {
      safe(() => {
        const ev = eventForRequest(response.config?.method, response.config?.url, response.config?.data);
        if (ev) track(ev.name, ev.props);
      });
      return response;
    },
    (error) => {
      safe(() => {
        const status = error?.response?.status;
        // 4xx = cas attendus (validation, non connecté) ; on ne remonte que le réseau et les 5xx
        if (error?.code === "ERR_CANCELED" || (status && status < 500)) return;
        track("api_error", { route: routeTemplate(error?.config?.url), method: String(error?.config?.method || "").toUpperCase(), status: status || 0, network: !status });
      });
      return Promise.reject(error);
    }
  );
}

export function installErrorTracking() {
  if (!KEY || typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    if (e?.target && e.target !== window) return; // erreurs de chargement de ressources (images…)
    track("client_error", { kind: "error", message: scrubText(e?.message), source: String(e?.filename || "").split("/").pop() });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e?.reason;
    if (reason?.isAxiosError) return; // déjà couvert par api_error
    track("client_error", { kind: "unhandledrejection", message: scrubText(reason?.message || reason) });
  });
}
