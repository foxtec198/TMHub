const TOKEN_KEY = "token";

/**
 * Mantém a sessão disponível após atualizar a página ou reabrir o navegador.
 * A validade continua sendo decidida pela API a partir do JWT.
 */
export function getAccessToken() {
  const temporaryToken = sessionStorage.getItem(TOKEN_KEY);
  const storedToken = localStorage.getItem(TOKEN_KEY);
  const token = temporaryToken || storedToken;

  if (token && !temporaryToken) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  return token;
}

export function setAccessToken(token) {
  if (!token) {
    clearAccessToken();
    return;
  }

  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}
