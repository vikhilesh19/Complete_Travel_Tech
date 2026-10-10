import { apiFetch } from "./api.js";

const requests = new Map();

export function translateAlert(text, language) {
  const key = `${language}:${text}`;
  if (requests.has(key)) return requests.get(key);

  const request = apiFetch("/api/translate-alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  }).then(async (response) => {
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Translation unavailable.");
    return result.translatedText;
  });

  requests.set(key, request);
  request.catch(() => requests.delete(key));
  return request;
}
