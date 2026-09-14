const SAFE_PROTOCOLS = new Set(["http:", "https:", "blob:"]);

function browserOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

export function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), browserOrigin());
    if (url.protocol === "blob:") return url.href;
    const base = import.meta.env.VITE_SERVER || browserOrigin();
    const apiOrigin = new URL(base, browserOrigin()).origin;
    return SAFE_PROTOCOLS.has(url.protocol) && url.origin === apiOrigin ? url.href : null;
  } catch {
    return null;
  }
}

export function safeApiResourceUrl(path) {
  if (typeof path !== "string") return null;
  const normalizedPath = path.trim();
  if (!normalizedPath.startsWith("/") || normalizedPath.startsWith("//") || normalizedPath.includes("\\")) {
    return null;
  }
  try {
    const base = import.meta.env.VITE_SERVER || browserOrigin();
    const apiOrigin = new URL(base, browserOrigin());
    const url = new URL(normalizedPath, apiOrigin);
    return SAFE_PROTOCOLS.has(url.protocol) && url.origin === apiOrigin.origin ? url.href : null;
  } catch {
    return null;
  }
}
