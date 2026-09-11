import axios from "axios";
import { getAccessToken } from "./authSession";
import { getTmOpsToken } from "./tmOpsSession";

const tmOpsRequest = axios.create({baseURL: import.meta.env.VITE_SERVER});

tmOpsRequest.interceptors.request.use((config) => {
    const token = getTmOpsToken();
    if (token) config.headers["TM-Ops-Token"] = token;
    const adminToken = getAccessToken();
    if (adminToken) config.headers["Access-Token"] = adminToken;
    return config;
});

export default tmOpsRequest;
