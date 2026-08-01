// utils/request.js
import axios from "axios";
import { socketio } from "./socketio";

export const server = import.meta.env.VITE_SERVER;

const connect = axios.create({
  baseURL: server,
});

connect.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");

  if (token) {
    config.headers["Access-Token"] = token;
  }

  if (socketio.connected && socketio.id) {
    config.headers["X-TMHub-Socket-Id"] = socketio.id;
  }

  // Public forms must not inherit the authenticated layout's branch context.
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
