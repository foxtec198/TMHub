// Dependências externas
import axios from "axios";
// Sessão e comunicação em tempo real
import { socketio } from "./socketio";
import { getAccessToken } from "./authSession";

export const server = import.meta.env.VITE_SERVER;

const connect = axios.create({ baseURL: server });

connect.interceptors.request.use((config) => {
  const token = config.skipAuth ? null : getAccessToken();

  if (token) {
    config.headers["Access-Token"] = token;
    // A resposta precisa conseguir distinguir uma falha de sessão de um 401
    // devolvido por uma chamada pública ou por uma requisição antiga.
    config.__tmhubAccessToken = token;
  }

  if (socketio.connected && socketio.id) {
    config.headers["X-TMHub-Socket-Id"] = socketio.id;
  }

  // Formulários públicos não devem herdar o contexto de filial autenticado.
  if (token) {
    const selectedFilialIds = localStorage.getItem("selected_filial_ids");
    if (selectedFilialIds !== null) {
      config.headers["X-Filial-Ids"] = selectedFilialIds;
    }
  }

  if (!(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

export default connect;
