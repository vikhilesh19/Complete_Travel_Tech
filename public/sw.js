const CACHE_NAME = "wayfinder-shell-v3";
const SHELL_FILES = ["/", "/manifest.webmanifest", "/wayfinder-mark.svg"];
const PUBLIC_GET_ENDPOINTS = new Set(["/api/hazards", "/api/public-config"]);

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

self.addEventListener("message", (event) => {
  if (event.data?.type === "WAYFINDER_HAZARD_DELETED") {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.delete("/api/hazards")),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  )
    return;

  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.startsWith("/api/officer/")) return;
  if (PUBLIC_GET_ENDPOINTS.has(requestUrl.pathname)) {
    const forceRefresh = request.headers.get("X-Wayfinder-Refresh") === "1";
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          if (!response.ok) {
            if (forceRefresh) return response;
            const saved = await cache.match(request);
            if (saved) {
              const headers = new Headers(saved.headers);
              headers.set("X-Wayfinder-Offline", "1");
              return new Response(saved.body, {
                status: saved.status,
                statusText: saved.statusText,
                headers,
              });
            }
            return response;
          }

          const headers = new Headers(response.headers);
          headers.set("X-Wayfinder-Cached-At", new Date().toISOString());
          const savedResponse = new Response(response.clone().body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
          await cache.put(
            `${requestUrl.origin}${requestUrl.pathname}${requestUrl.search}`,
            savedResponse.clone(),
          );
          return savedResponse;
        } catch {
          if (forceRefresh) return Response.error();
          const saved = await cache.match(request);
          if (!saved) return Response.error();
          const headers = new Headers(saved.headers);
          headers.set("X-Wayfinder-Offline", "1");
          return new Response(saved.body, {
            status: saved.status,
            statusText: saved.statusText,
            headers,
          });
        }
      })(),
    );
    return;
  }

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
