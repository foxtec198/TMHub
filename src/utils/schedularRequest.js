import axios from "axios";

const schedularRequest = axios.create({
    baseURL: import.meta.env.VITE_SERVER,
});

schedularRequest.interceptors.request.use((config) => {
    const token = sessionStorage.getItem("schedular_token");
    if (token) config.headers["Schedular-Token"] = token;
    return config;
});

export default schedularRequest;
