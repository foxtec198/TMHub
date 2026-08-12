import { io } from "socket.io-client"
import { getAccessToken } from "./authSession";
import { apiServer } from "./apiServer";

export const socketio = io(apiServer, {
  auth: (callback) => callback({ token: getAccessToken() }),
  reconnection: true,          // tenta reconectar automaticamente
  reconnectionAttempts: 10,    // número de tentativas
  reconnectionDelay: 2000,     // espera 2s entre tentativas
  reconnectionDelayMax: 5000,  // máximo de 5s entre tentativas
});
