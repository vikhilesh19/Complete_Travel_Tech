export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

export async function apiFetch(path, options = {}) {
  const requestPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers || {});
  headers.set("X-Requested-With", "WayfinderWeb");

  const isCrossDomain = typeof window !== "undefined" && Boolean(
    API_BASE_URL && !API_BASE_URL.startsWith(window.location.origin)
  );

  const fetchOptions = {
    ...options,
    headers,
    credentials: "include",
  };

  const targetUrl = API_BASE_URL ? `${API_BASE_URL}${requestPath}` : requestPath;

  try {
    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    // If the deployed URL returned a non-JSON error (e.g. 404/502 from Vercel before complete deployment),
    // fall back to the running backend server on port 5000 or the local proxy
    if (
      isCrossDomain &&
      (response.status === 404 || response.status === 502 || response.status === 503) &&
      !contentType.includes("application/json")
    ) {
      return await fetch(`http://localhost:5000${requestPath}`, fetchOptions).catch(() =>
        fetch(requestPath, fetchOptions)
      );
    }

    return response;
  } catch (err) {
    if (isCrossDomain) {
      // In dev or local server, fallback to local backend or Vite proxy if network/CORS error occurs
      return await fetch(`http://localhost:5000${requestPath}`, fetchOptions).catch(() =>
        fetch(requestPath, fetchOptions)
      );
    }
    throw err;
  }
}