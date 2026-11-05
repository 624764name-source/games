const CACHE_NAME = "gift-coupon-v7";
const APP_FILES = [
  "./",
  "./index.html",
  "./src/main.js",
  "./src/styles.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Сначала сеть (чтобы обновления доходили), без сети — кэш.
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match("./index.html")))
  );
});
