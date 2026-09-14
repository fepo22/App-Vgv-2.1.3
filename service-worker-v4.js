const CACHE_NAME = "vgv-cache-v1.4";
const APP_ROOT = new URL("./", self.registration.scope).pathname;

const urlsToCache = [
  "",
  "index.html",
  "style.css",
  "script_v2.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
].map(file => `${APP_ROOT}${file}`);

// ============================================================
// INSTALL — Cachea archivos
// ============================================================
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url =>
          cache.add(url).catch(err =>
            console.warn("No se pudo cachear:", url, err)
          )
        )
      );
    })
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — Limpia cachés viejos
// ============================================================
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ============================================================
// FETCH — Cache-first
// ============================================================
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // No interceptar POST
  if (req.method !== "GET") return;

  // No interceptar Apps Script
  if (req.url.includes("script.google.com/macros")) return;

  // Para la app (HTML/CSS/JS), priorizar red para evitar usar versiones obsoletas.
  const isSameOrigin = url.origin === self.location.origin;
  const isAppShellRequest = req.mode === "navigate" || req.destination === "script" || req.destination === "style";

  if (isSameOrigin && isAppShellRequest) {
    event.respondWith(
      fetch(req)
        .then(networkResp => {
          const copy = networkResp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return networkResp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(resp => resp || fetch(req))
  );
});
