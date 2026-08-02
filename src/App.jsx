// Utils
import { MainLayout } from "./layouts/MainLayout";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { addLocale } from "primereact/api";
import connect from "./utils/request";

// Providers
import { PrimeReactProvider } from "primereact/api";
import { LoadingProvider } from "./contexts/LoadingContext";
import { ToastProvider } from "./contexts/ToastContext";
import { PermissionGate } from "./components/PermissionGate";
import { AuthRequirementsGate } from "./components/AuthRequirementsGate";

// Styles
import "primeicons/primeicons.css";
import "primereact/resources/themes/saga-green/theme.css";
import "primeflex/primeflex.css";
import "./index.css";

// Routes
import { RequestReport } from "./pages/Dashboards/requests";
import { DepartmentEmployeesDashboard } from "./pages/Dashboards/DepartmentEmployees";
import { Ponto48Dashboard } from "./pages/Dashboards/Ponto48Dashboard";
import { AdmissionDashboard } from "./pages/Dashboards/AdmissionDashboard.jsx";
import { Requests } from "./pages/Requests/requests";
import { Request } from "./pages/Requests/new.jsx";
import { Auth } from "./pages/Auth";
import { Init } from "./pages/Init";
import { RequestsODS } from "./pages/Dashboards/requests_ods";
import { History } from "./pages/Requests/history";
import { Products } from "./pages/Stock/products";
import { Movements } from "./pages/Stock/movements";
import { BarcodeGenerator } from "./pages/Stock/barcode_generator.jsx";
import { Floaters } from "./pages/Requests/floaters";
import { ProjetosPage } from "./pages/Projects/ProjetosPage";
import { Vacancies } from "./pages/Admission/vacancies.jsx";
import { Settings } from "./pages/Configuratiom";
import { AbsenceControl } from "./pages/FaltsControl";
import { DisallowanceControl } from "./pages/DissallowancesControls";
import { AbsenceDashboard } from "./pages/Dashboards/AbsenceDashboard";
import { DashboardLogistic } from "./pages/Dashboards/logistic";
import { Pcd } from "./pages/Indicators/pcd";
import { PcdDashboard } from "./pages/Dashboards/PcdDashboard";
import { Structure } from "./pages/Structure/index";
import { Schedular } from "./pages/Schedular";
import { SchedularManagement } from "./pages/Schedular/Management";
import { SchedularTasks } from "./pages/Schedular/Tasks";

document.documentElement.dataset.theme =
  localStorage.getItem("theme") === "dark" ? "dark" : "light";

addLocale("pt-BR", {
  firstDayOfWeek: 0,
  dayNames: [
    "domingo",
    "segunda",
    "terça",
    "quarta",
    "quinta",
    "sexta",
    "sábado",
  ],
  dayNamesShort: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
  dayNamesMin: ["D", "S", "T", "Q", "Q", "S", "S"],
  monthNames: [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ],
  monthNamesShort: [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ],
  today: "Hoje",
  clear: "Limpar",
});

export function AppRoutes() {
  const token = function () {
    return !!sessionStorage.getItem("token");
  };

  useEffect(() => {
    // HMR and rerenders must never accumulate response interceptors.
    connect.interceptors.response.clear();
    const interceptor = connect.interceptors.response.use(
      (response) => response,
      (error) => {
        const isLoginRequest = String(error.config?.url || "").includes(
          "/login",
        );
        const requestToken = error.config?.__tmhubAccessToken;
        const currentToken = sessionStorage.getItem("token");
        const isCurrentAuthenticatedRequest = Boolean(
          requestToken && currentToken && requestToken === currentToken,
        );
        if (
          error.response?.status === 428 &&
          error.response?.data?.code === "AUTH_REQUIREMENTS_PENDING"
        ) {
          const requirements = error.response.data.requirements || {};
          localStorage.setItem(
            "auth_requirements",
            JSON.stringify(requirements),
          );
          window.dispatchEvent(
            new CustomEvent("tmhub:auth-requirements", {
              detail: requirements,
            }),
          );
        }
        // Não deslogue a aplicação por qualquer 401: alguns endpoints são
        // públicos, outros podem falhar durante um refresh em segundo plano e
        // uma resposta de uma sessão antiga pode chegar depois de um novo login.
        // Apenas uma chamada feita com o token atual pode encerrar a sessão.
        if (
          error.response?.status === 401
          && !isLoginRequest
          && isCurrentAuthenticatedRequest
          && window.location.pathname !== "/login"
        ) {
          sessionStorage.removeItem("token");
          localStorage.removeItem("auth_requirements");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      },
    );

    return () => connect.interceptors.response.eject(interceptor);
  }, []);

  return (
    <>
      <Routes>
        <Route path="" element={<Auth />} />
        <Route path="/" element={<Auth />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/reposicoes/requisicao" element={<Request />} />
        <Route path="/reports/reposicoes/ods" element={<RequestsODS />} />
        <Route path="/schedular/login" element={<Schedular />} />
        <Route path="/schedular" element={<Schedular />} />
        <Route path="/schedular/tarefa/:taskId" element={<Schedular />} />
        <Route
          path="/schedular/tarefa/:taskId/executar"
          element={<Schedular />}
        />

        <Route element={<MainLayout />}>
          {/* Init Page */}
          <Route path="/init" element={<Init />} />
          <Route
            path="/projetos"
            element={
              <PermissionGate screen="projetos">
                <ProjetosPage />
              </PermissionGate>
            }
          />
          <Route path="/configuracoes" element={<Settings />} />
          <Route
            path="/controle-faltas"
            element={
              <PermissionGate screen="controle_faltas">
                <AbsenceControl />
              </PermissionGate>
            }
          />
          <Route
            path="/controle-glosas"
            element={
              <PermissionGate screen="controle_glosas">
                <DisallowanceControl />
              </PermissionGate>
            }
          />

          {/* Dashboards */}
          <Route
            path="/reports/reposicoes"
            element={
              <PermissionGate screen="dashboard_reposicoes">
                <RequestReport />
              </PermissionGate>
            }
          />
          <Route
            path="/reports/colaboradores-departamento"
            element={
              <PermissionGate screen="dashboard_colaboradores">
                <DepartmentEmployeesDashboard />
              </PermissionGate>
            }
          />
          <Route
            path="/reports/ponto-48-horas"
            element={
              <PermissionGate screen="dashboard_ponto48">
                <Ponto48Dashboard />
              </PermissionGate>
            }
          />
          <Route
            path="/reports/admissoes"
            element={
              <PermissionGate screen="dashboard_admissoes">
                <AdmissionDashboard />
              </PermissionGate>
            }
          />
          <Route
            path="/reports/faltas"
            element={
              <PermissionGate screen="dashboard_faltas">
                <AbsenceDashboard />
              </PermissionGate>
            }
          />
          <Route
            path="/reports/logistica"
            element={
              <PermissionGate screen="dashboard_logistica">
                <DashboardLogistic />
              </PermissionGate>
            }
          />
          <Route
            path="/reports/pcd"
            element={
              <PermissionGate screen="dashboard_pcd">
                <PcdDashboard />
              </PermissionGate>
            }
          />

          {/* Indicadores */}
          <Route
            path="/indicadores/pcd"
            element={
              <PermissionGate screen="indicador_pcd">
                <Pcd />
              </PermissionGate>
            }
          />

          {/* Admissão */}
          <Route
            path="/admissao/vagas"
            element={
              <PermissionGate screen="admissoes">
                <Vacancies key="substituicao" />
              </PermissionGate>
            }
          />
          <Route
            path="/admissao/aditivos"
            element={
              <PermissionGate screen="admissoes">
                <Vacancies key="aditivo" vacancyType="aditivo" />
              </PermissionGate>
            }
          />

          {/* Reposicoes */}
          <Route
            path="/reposicoes/requisicoes"
            element={
              <PermissionGate screen="reposicoes">
                <Requests />
              </PermissionGate>
            }
          />
          <Route
            path="/reposicoes/reservas"
            element={
              <PermissionGate screen="reservas">
                <Floaters />
              </PermissionGate>
            }
          />
          <Route
            path="/reposicoes/historico"
            element={
              <PermissionGate screen="historico_reposicoes">
                <History />
              </PermissionGate>
            }
          />

          {/* Estoque */}
          <Route
            path="/estoque/produtos"
            element={
              <PermissionGate screen="estoque_produtos">
                <Products />
              </PermissionGate>
            }
          />
          <Route
            path="/estoque/codigos-de-barras"
            element={
              <PermissionGate screen="estoque_codigos">
                <BarcodeGenerator />
              </PermissionGate>
            }
          />
          <Route
            path="/estoque/movimentacoes"
            element={
              <PermissionGate screen="estoque_movimentos">
                <Movements />
              </PermissionGate>
            }
          />

          {/* Estrutura */}
          <Route path="/estrutura" element={<Structure />} />
          <Route
            path="/schedular/gestao"
            element={
              <PermissionGate screen="schedular">
                <SchedularManagement mode="routines" />
              </PermissionGate>
            }
          />
          <Route
            path="/schedular/checklists"
            element={
              <PermissionGate screen="schedular">
                <SchedularManagement mode="checklists" />
              </PermissionGate>
            }
          />
          <Route
            path="/schedular/tarefas"
            element={
              <PermissionGate screen="schedular">
                <SchedularTasks />
              </PermissionGate>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to={token() ? "/init" : "/"} />} />
      </Routes>
      <AuthRequirementsGate />
    </>
  );
}

let container = null; // Variavel do container
document.addEventListener("DOMContentLoaded", function () {
  if (!container) {
    container = document.getElementById("root");
    const root = createRoot(container);
    root.render(
      <PrimeReactProvider>
        <LoadingProvider>
          <BrowserRouter>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </BrowserRouter>
        </LoadingProvider>
      </PrimeReactProvider>,
    );
  }
});
