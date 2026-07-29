// Utils
import { MainLayout } from "./layouts/MainLayout"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { createRoot } from 'react-dom/client';
import { useEffect } from "react";
import { addLocale } from "primereact/api";
import connect from "./utils/request";

// Providers
import { PrimeReactProvider } from 'primereact/api';
import { LoadingProvider } from './contexts/LoadingContext';
import { ToastProvider } from "./contexts/ToastContext";
import { PermissionGate } from "./components/PermissionGate"
import { AuthRequirementsGate } from "./components/AuthRequirementsGate"

// Styles
import 'primeicons/primeicons.css';
import 'primereact/resources/themes/saga-green/theme.css';
import 'primeflex/primeflex.css';
import "./index.css"

// Routes
import { RequestReport } from "./pages/Dashboards/requests"
import { DepartmentEmployeesDashboard } from "./pages/Dashboards/DepartmentEmployees"
import { Ponto48Dashboard } from "./pages/Dashboards/Ponto48Dashboard"
import { AdmissionDashboard } from "./pages/Dashboards/AdmissionDashboard.jsx"
import { Requests } from "./pages/Requisicoes/requests"
import { Request } from "./pages/Requisicoes/new.jsx"
import { Auth } from "./pages/Auth"
import { Init } from "./pages/Init"
import { RequestsODS } from "./pages/Dashboards/requests_ods";
import { History } from "./pages/Requisicoes/history";
import { Products } from "./pages/Estoque/products";
import { Movements } from "./pages/Estoque/movements";
import { BarcodeGenerator } from "./pages/Estoque/barcode_generator.jsx";
import { Floaters } from "./pages/Requisicoes/floaters";
import ProjetosPage from "./pages/Projetos/ProjetosPage";
import { Vacancies } from "./pages/Admissao/vacancies.jsx";
import { Settings } from "./pages/Configuracoes";
import { AbsenceControl } from "./pages/ControleFaltas";
import { DisallowanceControl } from "./pages/ControleGlosas";
import { AbsenceDashboard } from "./pages/Dashboards/AbsenceDashboard";
import { DashboardLogistic } from "./pages/Dashboards/logistic";
import { Structure } from "./pages/Estrutura/index";
import { Pcd } from "./pages/Indicadores/pcd";

document.documentElement.dataset.theme = localStorage.getItem("theme") === "dark" ? "dark" : "light";

addLocale('pt-BR', {
  firstDayOfWeek: 0,
  dayNames: [
    'domingo', 'segunda', 'terça', 'quarta',
    'quinta', 'sexta', 'sábado'
  ],
  dayNamesShort: [
    'dom', 'seg', 'ter', 'qua',
    'qui', 'sex', 'sáb'
  ],
  dayNamesMin: [
    'D', 'S', 'T', 'Q', 'Q', 'S', 'S'
  ],
  monthNames: [
    'janeiro', 'fevereiro', 'março', 'abril',
    'maio', 'junho', 'julho', 'agosto',
    'setembro', 'outubro', 'novembro', 'dezembro'
  ],
  monthNamesShort: [
    'jan', 'fev', 'mar', 'abr',
    'mai', 'jun', 'jul', 'ago',
    'set', 'out', 'nov', 'dez'
  ],
  today: 'Hoje',
  clear: 'Limpar'
});

export function AppRoutes() {
  const token = function () { return !!sessionStorage.getItem("token") };

  useEffect(() => {
    // HMR and rerenders must never accumulate response interceptors.
    connect.interceptors.response.clear();
    const interceptor = connect.interceptors.response.use(
      (response) => response,
      (error) => {
        const isLoginRequest = String(error.config?.url || "").includes("/login");
        if (error.response?.status === 428 && error.response?.data?.code === "AUTH_REQUIREMENTS_PENDING") {
          const requirements = error.response.data.requirements || {};
          localStorage.setItem("auth_requirements", JSON.stringify(requirements));
          window.dispatchEvent(new CustomEvent("tmhub:auth-requirements", { detail: requirements }));
        }
        if (error.response?.status === 401 && !isLoginRequest) {
          sessionStorage.removeItem("token");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
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

        <Route element={<MainLayout />}>
          {/* Init Page */}
          <Route path="/init" element={<Init />} />
          <Route path="/projetos" element={<PermissionGate screen="projetos"><ProjetosPage /></PermissionGate>} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/controle-faltas" element={<PermissionGate screen="controle_faltas"><AbsenceControl /></PermissionGate>} />
          <Route path="/controle-glosas" element={<PermissionGate screen="controle_glosas"><DisallowanceControl /></PermissionGate>} />

          {/* Indicadores */}
          <Route path="/indicadores/pcd" element={<PermissionGate screen="indicador_pcd"><Pcd /></PermissionGate>} />

          {/* Admissão */}
          <Route path="/admissao/vagas" element={<PermissionGate screen="admissoes"><Vacancies key="substituicao" /></PermissionGate>} />
          <Route path="/admissao/aditivos" element={<PermissionGate screen="admissoes"><Vacancies key="aditivo" vacancyType="aditivo" /></PermissionGate>} />

          {/* Reposicoes */}
          <Route path="/reposicoes/requisicoes" element={<PermissionGate screen="reposicoes"><Requests /></PermissionGate>} />
          <Route path="/reposicoes/reservas" element={<PermissionGate screen="reservas"><Floaters /></PermissionGate>} />
          <Route path="/reposicoes/historico" element={<PermissionGate screen="historico_reposicoes"><History /></PermissionGate>} />

          {/* Estoque */}
          <Route path="/reports/reposicoes" element={<PermissionGate screen="dashboard_reposicoes"><RequestReport /></PermissionGate>} />
          <Route path="/reports/colaboradores-departamento" element={<PermissionGate screen="dashboard_colaboradores"><DepartmentEmployeesDashboard /></PermissionGate>} />
          <Route path="/reports/ponto-48-horas" element={<PermissionGate screen="dashboard_ponto48"><Ponto48Dashboard /></PermissionGate>} />
          <Route path="/reports/admissoes" element={<PermissionGate screen="dashboard_admissoes"><AdmissionDashboard /></PermissionGate>} />
          <Route path="/reports/faltas" element={<PermissionGate screen="dashboard_faltas"><AbsenceDashboard /></PermissionGate>} />
          <Route path="/reports/logistica" element={<PermissionGate screen="dashboard_logistica"><DashboardLogistic /></PermissionGate>} />
          <Route path="/estoque/produtos" element={<PermissionGate screen="estoque_produtos"><Products /></PermissionGate>} />
          <Route path="/estoque/codigos-de-barras" element={<PermissionGate screen="estoque_codigos"><BarcodeGenerator /></PermissionGate>} />
          <Route path="/estoque/movimentacoes" element={<PermissionGate screen="estoque_movimentos"><Movements /></PermissionGate>} />

          {/* Estrutura */}
          <Route path="/estrutura" element={<Structure />} />
        </Route>

        <Route path="*" element={<Navigate to={token() ? "/init" : "/"} />} />
      </Routes>
      <AuthRequirementsGate />
    </>
  )
};

let container = null; // Variavel do container
document.addEventListener('DOMContentLoaded', function () {
  if (!container) {
    container = document.getElementById('root');
    const root = createRoot(container)
    root.render(
      <PrimeReactProvider>
        <LoadingProvider>
          <BrowserRouter>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </BrowserRouter>
        </LoadingProvider>
      </PrimeReactProvider>
    );
  }
});
