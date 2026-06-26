// ============================================================
// MOONJAR — Service Worker
// Strategi: cache-first untuk app shell (HTML/CSS/JS/icon),
// network-first untuk data (Supabase tidak di-cache di sini —
// data realtime harus selalu fresh dari server).
// ============================================================

const CACHE_NAME = "moonjar-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/variables.css",
  "./css/auth.css",
  "./css/app.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/charts.js",
  "./js/helpers.js",
  "./js/icons.js",
  "./js/state.js",
  "./js/ai-tip-local.js",
  "./js/supabase-client.js",
  "./js/ui-app.js",
  "./js/ui-auth.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch((err) => {
      console.warn("Gagal cache sebagian shell:", err);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jangan campur tangan request ke Supabase / API eksternal — selalu network
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Simpan copy ke cache untuk request app-shell berikutnya
          if (response.ok && event.request.method === "GET") {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
