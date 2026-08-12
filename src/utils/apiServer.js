const LOCAL_API_SERVER = "http://localhost:8590";

// Vite carrega variáveis de ambiente apenas quando o processo inicia. Forçar
// localhost em desenvolvimento evita que um servidor dev antigo mantenha a
// URL de produção em memória durante testes locais.
export const apiServer = import.meta.env.DEV
  ? LOCAL_API_SERVER
  : import.meta.env.VITE_SERVER;
