// Same-origin par défaut ; VITE_API_URL permet un front séparé en développement.
export const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
