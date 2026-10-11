export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

export async function apiFetch(path, options = {}) {
  const requestPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers || {});
  headers.set("X-Requested-With", "WayfinderWeb");

  return fetch(API_BASE_URL ? `${API_BASE_URL}${requestPath}` : requestPath, {
    ...options,
    headers,
    credentials: options.credentials || "include",
  });
}