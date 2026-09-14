const TOKEN_KEY = "token";
let accessToken = null;

// O token vive apenas na memória da aba. Nunca é gravado em localStorage ou
// sessionStorage, para não ficar disponível a scripts injetados após recarga.
function clearLegacyStoredTokens() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

clearLegacyStoredTokens();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = typeof token === "string" && token ? token : null;
}

export function clearAccessToken() {
  accessToken = null;
  clearLegacyStoredTokens();
}

export function logoutAccessSession() {
  clearAccessToken();
  const server = import.meta.env.VITE_SERVER || window.location.origin;
  return fetch(`${server}/login/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
}
