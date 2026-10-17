// Service worker FlixMatch : cache du shell + des images, offline basique. Jamais de cache pour l'API.
const VERSION = "v1";
const SHELL_CACHE = `flixmatch-shell-${VERSION}`;
const IMAGE_CACHE = `flixmatch-img-${VERSION}`;
const MAX_IMAGES = 200;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/FlixMatchLogo.png", "/default-movie.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL_CACHE, IMAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const trimCache = async (name, max) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Images TMDB : cache d'abord
  if (url.hostname === "image.tmdb.org") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok || res.type === "opaque") {
            cache.put(request, res.clone());
            trimCache(IMAGE_CACHE, MAX_IMAGES);
          }
          return res;
        } catch {
          return caches.match("/default-movie.png");
        }
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigation : réseau d'abord, puis le shell en cache (offline)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Assets statiques versionnés / icônes : stale-while-revalidate (les appels API ne sont pas concernés)
  const isStatic = url.pathname.startsWith("/assets/") || /\.(png|svg|jpg|webp|woff2|webmanifest)$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
  }
});
