// utils/request.js
import axios from "axios";
import { socketio } from "./socketio";

export const server = import.meta.env.VITE_SERVER

const connect = axios.create({
  baseURL: server,
});

// Injeta o token em toda requisição automaticamente
connect.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers["Access-Token"] = token;
  if (socketio.connected && socketio.id) config.headers["X-TMHub-Socket-Id"] = socketio.id;
  if (!(config.data instanceof FormData)) config.headers["Content-Type"] = 'application/json'
  return config;
});

export default connect;
