import { io } from "socket.io-client"
import { getAccessToken } from "./authSession";

export const socketio = io(import.meta.env.VITE_SERVER, {
  auth: (callback) => callback({ token: getAccessToken() }),
  reconnection: true,          // tenta reconectar automaticamente
  reconnectionAttempts: 10,    // número de tentativas
  reconnectionDelay: 2000,     // espera 2s entre tentativas
  reconnectionDelayMax: 5000,  // máximo de 5s entre tentativas
});
