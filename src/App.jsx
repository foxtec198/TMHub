// Utils
import { MainLayout } from "./layouts/MainLayout";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { addLocale } from "primereact/api";
import connect from "./utils/request";

// Providers
import { PrimeReactProvider } from "primereact/api";
import { LoadingProvider } from "./contexts/LoadingContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider } from "./theme/ThemeProvider";
import { PermissionGate } from "./components/PermissionGate";
import { AuthRequirementsGate } from "./components/AuthRequirementsGate";
import { clearAccessToken, getAccessToken } from "./utils/authSession";

// Styles
import "primereact/resources/themes/saga-green/theme.css";
import "primeflex/primeflex.css";
import "./index.css";

// Routes
import { RequestReport } from "./pages/Dashboards/requests";
import { EmployeesPage } from "./pages/Employees";
import { CostCentersPage } from "./pages/CostCenters";
import { Ponto48Dashboard } from "./pages/Dashboards/Ponto48";
import { AdmissionDashboard } from "./pages/Dashboards/Admission.jsx";
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
import { TerminationControl } from "./pages/TerminationControl";
import { VacationControl } from "./pages/VacationControl";
import { Settings } from "./pages/Configuratiom";
import { AbsenceControl } from "./pages/FaltsControl";
import { DisallowanceControl } from "./pages/DissallowancesControls";
import { AbsenceDashboard } from "./pages/Dashboards/Absence";
import { DashboardLogistic } from "./pages/Dashboards/logistic";
import { Pcd } from "./pages/Indicators/pcd";
import { PcdDashboard } from "./pages/Dashboards/Pcd";
import { QLDashboard } from "./pages/Dashboards/QL";
import { ProjectDashboard } from "./pages/Dashboards/Projects";
import { GlosaDashboard } from "./pages/Dashboards/Dissallownces";
import { RocadaDashboard } from "./pages/Dashboards/Rocada";
import { TerminationDashboard } from "./pages/Dashboards/Termination.jsx";
import { Structure } from "./pages/Structure/index";
import { TMOps } from "./pages/TMOps";
import { TMOpsManagement } from "./pages/TMOps/Management";
import { TMOpsTasks } from "./pages/TMOps/Tasks";
import { DisciplinaryMeasures } from "./pages/DisciplinaryMeasures";
import { TicketDetail, TicketsDashboard } from "./pages/Tickets";
import { TicketManagement } from "./pages/Tickets/TicketManagement";
import { DisciplinaryMeasuresDashboard } from "./pages/Dashboards/DisciplinaryMeasures.jsx";
import { ExperienceDashboard } from "./pages/Dashboards/Experience.jsx";
import { ExperienceControl } from "./pages/ExperienceControl";
import { ExperienceSupervisor } from "./pages/ExperienceControl/supervisor";
import { PeriodicExams } from "./pages/PeriodicExams";
import { MarketPlace } from "./pages/Marketplace";
import { TimoAssistant } from "./pages/TimoAssistant";

// Theme tokens and PrimeReact overrides must be the final stylesheet layer.
import "./theme/theme.css";

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

function LegacyTMOpsRedirect() {
  const location = useLocation();
  const target = location.pathname.replace(/^\/schedular(?=\/|$)/, "/tm-ops");
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

// function MaintenanceGate() {
//   const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
//   return isAdmin ? <Outlet /> : <Navigate to="/manutencao" replace />;
// }

export function AppRoutes() {
  const token = function () {
    return !!getAccessToken();
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
        const currentToken = getAccessToken();
        const isCurrentAuthenticatedRequest = Boolean(
          requestToken && currentToken && requestToken === currentToken,
        );
        const authError = String(error.response?.data || "").toLocaleLowerCase("pt-BR");
        const isInvalidSession = /token.+(expirado|inv[aá]lido)|sess[aã]o.+(invalidada|n[aã]o encontrado)/i.test(authError);
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
        if (
          error.response?.status === 503
          && error.response?.data?.code === "SYSTEM_MAINTENANCE"
          && window.location.pathname !== "/manutencao"
        ) {
          clearAccessToken();
          localStorage.removeItem("auth_requirements");
          window.location.href = "/manutencao";
        }
        if (
          error.response?.status === 401
          && !isLoginRequest
          && isCurrentAuthenticatedRequest
          && isInvalidSession
          && window.location.pathname !== "/login"
        ) {
          clearAccessToken();
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
        <Route path="/tm-ops/login" element={<TMOps />} />
        <Route path="/tm-ops" element={<TMOps />} />
        <Route path="/tm-ops/tarefa/:taskId" element={<TMOps />} />
        <Route
          path="/tm-ops/tarefa/:taskId/executar"
          element={<TMOps />}
        />
        <Route path="/schedular/*" element={<LegacyTMOpsRedirect />} />
        <Route path="/schedular" element={<LegacyTMOpsRedirect />} />

        {/* KDS/ODS executa em tela cheia, sem o MenuBar e o Outlet do TMHub. */}
        <Route
          path="/reports/reposicoes/ods"
          element={
            <PermissionGate screen="dashboard_reposicoes_ods">
              <RequestsODS />
            </PermissionGate>
          }
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
          <Route path="/timo" element={<TimoAssistant />} />
          <Route
            path="/tickets"
            element={<PermissionGate screen="tickets"><TicketsDashboard /></PermissionGate>}
          />
          <Route
            path="/tickets/:ticketId"
            element={<PermissionGate screen="tickets"><TicketDetail /></PermissionGate>}
          />
          <Route
            path="/tickets/gestao"
            element={<PermissionGate screen="tickets" adminOnly><TicketManagement /></PermissionGate>}
          />
          <Route
            path="/controle-faltas"
            element={
              <PermissionGate screen="controle_faltas">
                <AbsenceControl />
              </PermissionGate>
            }
          />
          <Route
            path="/avaliacoes-experiencia"
            element={
              <PermissionGate screen="controle_experiencia_rh">
                <ExperienceControl />
              </PermissionGate>
            }
          />
          <Route
            path="/exames-periodicos"
            element={
              <PermissionGate screen="controle_exames_periodicos">
                <PeriodicExams />
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
          <Route path="/colaboradores" element={<PermissionGate screen="colaboradores"><EmployeesPage /></PermissionGate>} />
          <Route path="/centros-de-custo" element={<PermissionGate screen="estrutura"><CostCentersPage /></PermissionGate>} />
          <Route path="/reports/colaboradores-departamento" element={<Navigate to="/colaboradores" replace />} />
          <Route
            path="/reports/ponto-48-horas"
            element={
              <PermissionGate screen="dashboard_ponto48">
                <Ponto48Dashboard />
              </PermissionGate>
            }
          />
          <Route 
            path="/marketplace"
            element={<PermissionGate screen="marketplace" adminOnly><MarketPlace /></PermissionGate>}
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
            path="/reports/rescisoes"
            element={
              <PermissionGate screen="dashboard_rescisoes">
                <TerminationDashboard />
              </PermissionGate>
            }
          />
          <Route path="/reports/projetos" element={<PermissionGate screen="dashboard_projetos"><ProjectDashboard /></PermissionGate>} />
          <Route path="/reports/glosas" element={<PermissionGate screen="dashboard_glosas"><GlosaDashboard /></PermissionGate>} />
          <Route path="/reports/rocada" element={<PermissionGate screen="dashboard_glosas"><RocadaDashboard /></PermissionGate>} />
          <Route
            path="/reports/pcd"
            element={
              <PermissionGate screen="dashboard_pcd">
                <PcdDashboard />
              </PermissionGate>
            }
          />
          <Route
            path="/reports/ql"
            element={
              <PermissionGate screen="dashboard_ql">
                <QLDashboard />
              </PermissionGate>
            }
          />
          <Route
            path="/reports/medidas-disciplinares"
            element={
              <PermissionGate screen="dashboard_medidas_disciplinares">
                <DisciplinaryMeasuresDashboard />
              </PermissionGate>
            }
          />
          <Route
            path="/reports/experiencias"
            element={
              <PermissionGate screen="controle_experiencia_rh">
                <ExperienceDashboard />
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
            path="/reposicoes/requisicao"
            element={
              <PermissionGate screen="reposicoes" action="create">
                <Request />
              </PermissionGate>
            }
          />
          <Route
            path="/avaliacoes-experiencia/supervisor"
            element={
              <PermissionGate screen="avaliacao_experiencia_supervisor">
                <ExperienceSupervisor />
              </PermissionGate>
            }
          />
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

          {/* Medidas Disciplinares */}

          <Route
            path="/controle-medidas-disciplinares"
            element={
              <PermissionGate screen="controle_medidas_disciplinares">
                <DisciplinaryMeasures />
              </PermissionGate>
            }
          />

          {/* Rescisões */}
          <Route
            path="/rescisoes"
            element={
              <PermissionGate screen="controle_rescisoes">
                <TerminationControl />
              </PermissionGate>
            }
          />

          {/* Férias */}
          <Route
            path="/ferias"
            element={
              <PermissionGate screen="controle_ferias">
                <VacationControl />
              </PermissionGate>
            }
          />

          {/* Estrutura */}
          <Route path="/estrutura" element={<Structure />} />
          <Route
            path="/tm-ops/gestao"
            element={
              <PermissionGate screen="tm_ops" adminOnly>
                <TMOpsManagement mode="routines" />
              </PermissionGate>
            }
          />
          <Route
            path="/tm-ops/checklists"
            element={
              <PermissionGate screen="tm_ops" adminOnly>
                <TMOpsManagement mode="checklists" />
              </PermissionGate>
            }
          />
          <Route
            path="/tm-ops/tarefas"
            element={
              <PermissionGate screen="tm_ops" adminOnly>
                <TMOpsTasks />
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
      <PrimeReactProvider value={{ locale: "pt-BR" }}>
        <ThemeProvider>
          <LoadingProvider>
            <BrowserRouter>
              <ToastProvider>
                <AppRoutes />
              </ToastProvider>
            </BrowserRouter>
          </LoadingProvider>
        </ThemeProvider>
      </PrimeReactProvider>,
    );
  }
});
