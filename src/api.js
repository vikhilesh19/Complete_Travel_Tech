const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

export function apiFetch(path, options = {}) {
  const requestPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers || {});
  headers.set("X-Requested-With", "WayfinderWeb");

  return fetch(`${apiBaseUrl}${requestPath}`, {
    ...options,
    headers,
    credentials: "include",
  });
}