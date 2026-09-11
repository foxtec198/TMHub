let tmOpsToken = null;

// O token do executor só existe enquanto esta aba permanece aberta.
// Limpa chaves antigas para que uma atualização não mantenha sessões persistidas.
sessionStorage.removeItem("tm_ops_token");
sessionStorage.removeItem("schedular_token");

export function getTmOpsToken() {
  return tmOpsToken;
}

export function setTmOpsToken(token) {
  tmOpsToken = typeof token === "string" && token ? token : null;
}

export function clearTmOpsToken() {
  tmOpsToken = null;
  sessionStorage.removeItem("tm_ops_token");
  sessionStorage.removeItem("schedular_token");
}
