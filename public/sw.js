const CACHE_NAME = "wayfinder-shell-v1";
const SHELL_FILES = ["/", "/manifest.webmanifest", "/wayfinder-mark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  )
    return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (
          response.ok &&
          (request.mode === "navigate" ||
            ["script", "style", "image", "font"].includes(request.destination))
        ) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (
          (await cache.match(request)) ||
          (request.mode === "navigate" ? cache.match("/") : undefined) ||
          Response.error()
        );
      }
    })(),
  );
});
