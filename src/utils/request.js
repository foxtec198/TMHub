// utils/request.js
import axios from "axios";
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

  // Public forms must not inherit the authenticated layout's branch context.
  if (token && !config.skipStandardFilters) {
    const selectedFilialIds = localStorage.getItem("selected_filial_ids");
    if (selectedFilialIds !== null) {
      config.headers["X-Filial-Ids"] = selectedFilialIds;
    }
    const selectedCompanyIds = localStorage.getItem("selected_company_ids");
    if (selectedCompanyIds !== null) {
      config.headers["X-Empresa-Ids"] = selectedCompanyIds;
    }
    const selectedDepartmentIds = localStorage.getItem("selected_department_ids");
    if (selectedDepartmentIds !== null) {
      config.headers["X-Departamento-Ids"] = selectedDepartmentIds;
    }
    const selectedCostCenterIds = localStorage.getItem("selected_cost_center_ids");
    if (selectedCostCenterIds !== null) {
      config.headers["X-Centro-Custo-Ids"] = selectedCostCenterIds;
    }
    const selectedDate = localStorage.getItem("standard_filter_date");
    if (selectedDate !== null) {
      config.headers["X-Data-Range"] = selectedDate;
      if (String(config.method || "get").toLowerCase() === "get") {
        try {
          const range = JSON.parse(selectedDate);
          const dates = Array.isArray(range) ? range : [range];
          const start = dates[0] ? String(dates[0]).slice(0, 10) : undefined;
          const end = dates[1] ? String(dates[1]).slice(0, 10) : start;
          config.params = { ...(config.params || {}) };
          if (start) {
            config.params.data_inicio ??= start;
            config.params.inicio ??= start;
            config.params.data_de ??= start;
          }
          if (end) {
            config.params.data_fim ??= end;
            config.params.fim ??= end;
            config.params.data_ate ??= end;
          }
        } catch {
          // Um valor antigo inválido não pode impedir a requisição da tela.
        }
      }
    }
  }

  if (!(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

export default connect;
