import axios from "axios";

const tmOpsRequest = axios.create({baseURL: import.meta.env.VITE_SERVER});

tmOpsRequest.interceptors.request.use((config) => {
    const legacyToken = sessionStorage.getItem("schedular_token");
    if (legacyToken && !sessionStorage.getItem("tm_ops_token")) {
        sessionStorage.setItem("tm_ops_token", legacyToken);
        sessionStorage.removeItem("schedular_token");
    }
    const token = sessionStorage.getItem("tm_ops_token");
    if (token) config.headers["TM-Ops-Token"] = token;
    return config;
});

export default tmOpsRequest;
