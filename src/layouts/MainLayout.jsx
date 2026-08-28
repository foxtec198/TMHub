import { AppIcon, appIcon } from "../components/icons/AppIcon";
// Utils
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { storeProfile } from "../utils/profile";
import { can } from "../utils/permissions";
import { useEffect, useState } from "react";
import connect from "../utils/request";
import { useToast } from "../contexts/ToastContext";
import { capitalize, deny_roles } from "../utils/ui";
import { socketio } from "../utils/socketio";
import { clearAccessToken, getAccessToken } from "../utils/authSession";

// Widgets
import { PanelMenu } from "primereact/panelmenu";
import { MultiSelect } from "primereact/multiselect";
import { FloatLabel } from "primereact/floatlabel";
import { ThemeLogo } from "../components/ThemeLogo";
import { UserAvatar } from "../components/UserAvatar";
import { TimoAgentNavigationBridge } from "../components/Timo/TimoAgentNavigationBridge";
import { UsageTelemetryTracker } from "../components/UsageTelemetryTracker";

// Styles
import './main.css'
import { EdinhoCard } from "../components/Edinho";
import { Divider } from "primereact/divider";

const REALTIME_CHANNELS_BY_ROUTE = {
  "/configuracoes": ["configuracoes", "colaboradores"],
  "/controle-faltas": ["controle_faltas"],
  "/avaliacoes-experiencia": ["avaliacoes_experiencia"],
  "/controle-glosas": ["glosas"],
  "/indicadores/pcd": ["pcd", "colaboradores"],
  "/admissao/vagas": ["admissao"],
  "/admissao/aditivos": ["admissao"],
  "/rescisoes": ["rescisoes", "colaboradores"],
  "/reposicoes/requisicoes": ["reposicoes.requisicoes"],
  "/reposicoes/requisicao": ["reposicoes.requisicoes", "reposicoes.reservas"],
  "/reposicoes/reservas": ["reposicoes.reservas"],
  "/reposicoes/historico": ["reposicoes.historico"],
  "/colaboradores": ["colaboradores"],
  "/centros-de-custo": ["centros_custo"],
  "/reports/colaboradores-departamento": ["colaboradores"],
  "/reports/ponto-48-horas": ["ponto48"],
  "/reports/ql": ["ql"],
  "/reports/admissoes": ["admissao"],
  "/reports/faltas": ["controle_faltas"],
  "/reports/logistica": ["estoque.movimentos"],
  "/reports/rocada": ["glosas"],
  "/estoque/produtos": ["estoque.produtos"],
  "/estoque/codigos-de-barras": ["estoque.produtos"],
  "/estoque/movimentacoes": ["estoque.movimentos"],
  "/estrutura": ["estrutura", "estoque.movimentos"],
  "/projetos": ["projetos"],
  "/reports/rescisoes": ["rescisoes", "colaboradores"],
  "/controle-medidas-disciplinares": ["medidas_disciplinares"],
  "/reports/medidas-disciplinares": ["medidas_disciplinares"],
  "/tickets": ["tickets"],
  "/tm-ops/gestao": ["tm_ops"],
  "/tm-ops/checklists": ["tm_ops"],
  "/tm-ops/tarefas": ["tm_ops"],
};

export function MainLayout() {
  const [standardFilterVersion, setStandardFilterVersion] = useState(0);
  const [fls, setFls] = useState([]);
  const [selectedFilialIds, setSelectedFilialIds] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState([]);
  const [canSelectFiliais, setCanSelectFiliais] = useState(false);
  const [displayName, setDisplayName] = useState(() => localStorage.getItem("display_name") || "");
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("profile_photo"));
  const [role, setRole] = useState(() => {
    const storedRole = localStorage.getItem("role");
    return storedRole ? capitalize(storedRole) : "";
  });
  const [isMenuVisible, setIsMenuVisible] = useState(
    () => !window.matchMedia("(max-width: 960px)").matches
  );
  const [profileStatus, setProfileStatus] = useState("loading");

  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const deny = deny_roles.includes(role)

  useEffect(() => {
    const remountCurrentPage = () => setStandardFilterVersion((value) => value + 1);
    window.addEventListener("tmhub:standard-filters-changed", remountCurrentPage);
    return () => window.removeEventListener("tmhub:standard-filters-changed", remountCurrentPage);
  }, []);

  useEffect(() => {
    const clearGlobalScope = () => {
      setSelectedCompanyIds([]);
      setSelectedFilialIds([]);
      localStorage.removeItem("selected_company_ids");
      localStorage.removeItem("selected_filial_ids");
    };
    window.addEventListener("tmhub:global-scope-cleared", clearGlobalScope);
    return () => window.removeEventListener("tmhub:global-scope-cleared", clearGlobalScope);
  }, []);

  const navigateTo = (path) => {
    navigate(path);

    if (window.matchMedia("(max-width: 960px)").matches) {
      setIsMenuVisible(false);
    }
  };

  const logout = () => {
    socketio.disconnect();
    clearAccessToken();
    localStorage.clear();
    navigateTo("/");
  };

  const items = [
    {
      label: 'Dashboards',
      icon: appIcon("chart-line"),
      items: [
        {
          label: "Operacional",
          items: [
            {
              label: "Reposições",
              items: [
                {
                  label: 'Reposições',
                  icon: appIcon("refresh"),
                  visible: can("dashboard_reposicoes"),
                  command: () => { navigateTo("/reports/reposicoes") }
                },
                {
                  label: 'Rep. ODS',
                  icon: appIcon("external-link"),
                  visible: can("dashboard_reposicoes_ods"),
                  command: () => { navigateTo("/reports/reposicoes/ods") }
                }
              ],
            },
            {
              label: 'Logística',
              icon: appIcon("truck"),
              visible: can("dashboard_logistica"),
              command: () => { navigateTo("/reports/logistica") }
            },
          ]
        },
        {
          label: "RH",
          items: [
            {
              label: 'Ponto 48 horas',
              icon: appIcon("clock"),
              visible: can("dashboard_ponto48"),
              command: () => { navigateTo("/reports/ponto-48-horas") }
            },
            {
              label: 'Admissões',
              icon: appIcon("user-plus"),
              visible: can("dashboard_admissoes"),
              command: () => { navigateTo("/reports/admissoes") }
            },
            {
              label: 'Faltas',
              icon: appIcon("chart-bar"),
              visible: can("dashboard_faltas"),
              command: () => { navigateTo("/reports/faltas") }
            },
            {
              label: 'PCD',
              icon: appIcon("heart"),
              visible: can("dashboard_pcd"),
              command: () => { navigateTo("/reports/pcd") }
            },
            {
              label: 'QL',
              icon: appIcon("users"),
              visible: can("dashboard_ql"),
              command: () => { navigateTo("/reports/ql") }
            },
            {
              label: "Rescisões",
              icon: appIcon("user-minus"),
              visible: can("dashboard_rescisoes"),
              command: () => {
                navigateTo("/reports/rescisoes");
              },
            },
            {
              label: "Disciplina",
              icon: appIcon("file-pencil"),
              visible: can("dashboard_medidas_disciplinares"),
              command: () => {
                navigateTo("/reports/medidas-disciplinares");
              },
            },
            {
              label: "Experiências",
              icon: appIcon("id-badge"),
              visible: can("controle_experiencia_rh"),
              command: () => {
                navigateTo("/reports/experiencias");
              },
            },
            {
              label: "Glosas",
              items: [
                {
                  label: 'Gerais',
                  icon: appIcon("cash"),
                  visible: can("dashboard_glosas"),
                  command: () => { navigateTo("/reports/glosas") }
                },
                {
                  label: 'Roçada',
                  icon: appIcon("target"),
                  visible: can("dashboard_glosas"),
                  command: () => { navigateTo("/reports/rocada") }
                },
              ]
            },
          ]
        },
        {
          label: 'Projetos',
          icon: appIcon("chart-line"),
          visible: can("dashboard_projetos"),
          command: () => { navigateTo("/reports/projetos") }
        },
      ]
    },
    {
      label: "RH",
      icon: appIcon("users"),
      items: [
        {
          label: "Admissão",
          icon: appIcon("user-plus"),
          items: [
            {
              label: 'Vagas',
              icon: appIcon("briefcase"),
              visible: can("admissoes"),
              command: () => { navigateTo("/admissao/vagas") }
            },
            {
              label: 'Aditivos',
              icon: appIcon("circle-plus"),
              visible: can("admissoes"),
              command: () => { navigateTo("/admissao/aditivos") }
            },
          ]
        },
        {
          label: "PCD's",
          icon: appIcon("heart"),
          visible: can("indicador_pcd"),
          command: () => { navigateTo("/indicadores/pcd") }
        },
        {
          label: 'Rescisões',
          icon: appIcon("user-minus"),
          visible: can("controle_rescisoes"),
          command: () => { navigateTo("/rescisoes") }
        },
        {
          label: 'Férias',
          icon: appIcon("calendar-plus"),
          visible: can("controle_ferias"),
          command: () => { navigateTo("/ferias") }
        },
        {
          label: 'Faltas',
          icon: appIcon("calendar-x"),
          visible: can("controle_faltas"),
          command: () => { navigateTo("/controle-faltas") }
        },
        {
          label: "Experiências",
          icon: appIcon("clipboard"),
          visible: can("controle_experiencia_rh"),
          command: () => { navigateTo("/avaliacoes-experiencia"); },
        },
        {
          label: "Minhas avaliações",
          icon: appIcon("id-badge"),
          visible: can("avaliacao_experiencia_supervisor"),
          command: () => { navigateTo("/avaliacoes-experiencia/supervisor"); },
        },
        {
          label: 'Glosas',
          icon: appIcon("cash"),
          visible: can("controle_glosas"),
          command: () => { navigateTo("/controle-glosas") }
        },
        {
          label: 'Disciplina',
          icon: appIcon("file-pencil"),
          visible: can("controle_medidas_disciplinares"),
          command: () => { navigateTo("/controle-medidas-disciplinares") }
        },
      ]
    },
    {
      label: "Operacional",
      icon: appIcon("briefcase"),
      items: [
        {
          label: 'Reposições',
          icon: appIcon("refresh"),
          items: [
            {
              label: 'Nova requisição',
              icon: appIcon("circle-plus"),
              visible: can("reposicoes", "create"),
              command: () => { navigateTo("/reposicoes/requisicao") }
            },
            {
              label: 'Requisições',
              icon: appIcon("question"),
              visible: can("reposicoes"),
              command: () => { navigateTo("/reposicoes/requisicoes") }
            },
            {
              label: 'Histórico',
              icon: appIcon("history"),
              display: false,
              visible: can("historico_reposicoes"),
              command: () => { navigateTo("/reposicoes/historico") }
            },
            {
              label: 'Reservas',
              icon: appIcon("users"),
              visible: can("reservas"),
              command: () => { navigateTo("/reposicoes/reservas") },
            },
          ]
        },
        {
          label: "Estoque",
          icon: appIcon("box"),
          items: [
            {
              label: 'Produtos',
              icon: appIcon("box"),
              visible: can("estoque_produtos"),
              command: () => { navigateTo("/estoque/produtos") }
            },
            {
              label: 'Barcode',
              icon: appIcon("barcode"),
              visible: can("estoque_codigos"),
              command: () => { navigateTo("/estoque/codigos-de-barras") }
            },
            {
              label: 'Movimentações',
              icon: appIcon("arrows-exchange"),
              visible: can("estoque_movimentos"),
              command: () => { navigateTo("/estoque/movimentacoes") }
            },
          ]
        },
        {
          label: "SESMT",
          icon: appIcon("shield"),
          visible: can("controle_exames_periodicos"),
          items: [
            {
              label: "Exames periódicos",
              icon: appIcon("heart"),
              visible: can("controle_exames_periodicos"),
              command: () => { navigateTo("/exames-periodicos"); },
            },
          ],
        },
      ]
    },
    {
      label: "RPA Center",
      disabled: true,

      icon: appIcon("verified"),
      className: deny ? "hidden" : null,
      items: [
        {
          label: 'HK Bot',
          icon: appIcon("clock"),
          command: () => { }
        },
      ]
    },
    {
      label: 'TM Ops',
      icon: appIcon("calendar-time"),
      visible: can("tm_ops") && String(role || "").toUpperCase() === "ADMIN",
      items: [
        {
          label: 'Rotinas e locais',
          icon: appIcon("calendar-plus"),
          command: () => { navigateTo("/tm-ops/gestao") },
        },
        {
          label: 'Checklists',
          icon: appIcon("list-check"),
          command: () => { navigateTo("/tm-ops/checklists") },
        },
        {
          label: 'Tarefas',
          icon: appIcon("list"),
          command: () => { navigateTo("/tm-ops/tarefas") },
        },
        {
          label: 'Abrir execução',
          icon: appIcon("external-link"),
          command: () => { window.open("/tm-ops/login", "_blank", "noopener,noreferrer") },
        },
      ],
    },
    {
      label: 'Colaboradores',
      icon: appIcon("users"),
      visible: can("colaboradores") || can("dashboard_colaboradores"),
      command: () => { navigateTo("/colaboradores") }
    },
    
    {
      label: 'Estrutura',
      icon: appIcon("building"),
      visible: can("estrutura"),
      command: () => { navigateTo("/estrutura") }
    },
    {
      label: 'Centros de custo',
      icon: appIcon("map-pin"),
      visible: can("estrutura"),
      command: () => { navigateTo("/centros-de-custo") }
    },
    {
      label: 'Chamados',
      icon: appIcon("headphones"),
      visible: can("tickets"),
      command: () => { navigateTo("/tickets") }
    },
    {
      label: 'Gestão de chamados',
      icon: appIcon("adjustments-horizontal"),
      visible: can("tickets") && String(role || "").toUpperCase() === "ADMIN",
      command: () => { navigateTo("/tickets/gestao") }
    },
    {
      label: 'Meus Projetos',
      icon: appIcon("loader"),
      visible: can("projetos"),
      command: () => { navigateTo("/projetos") }
    },
    {
      label: 'Marketplace',
      icon: appIcon("shopping-cart"),
      visible: String(role || "").toUpperCase() === "ADMIN",
      command: () => { navigateTo("/marketplace") }
    },
    {
      label: 'Configurações',
      icon: appIcon("settings"),
      command: () => { navigateTo("/configuracoes") }
    },
    {
      label: 'Sair',
      icon: appIcon("logout"),
      command: logout
    },
  ];

  useEffect(() => {
    // No reload, o perfil ainda está sendo revalidado. Redirecionar antes
    // desta consulta cria uma falsa impressão de logout apesar do JWT válido.
    if (profileStatus === "ready" && (!displayName || !role)) {
      navigate("/");
    }
  }, [displayName, navigate, profileStatus, role]);

  useEffect(() => {
    let active = true;

    const updateProfile = (profile) => {
      setDisplayName(profile.nome || "");
      setProfilePhoto(profile.foto_perfil || null);
      setRole(profile.role ? capitalize(profile.role) : "");

      const profileRole = String(profile.role || "").toUpperCase();
      const isProfileAdmin = profileRole === "ADMIN";
      const isMatrixUser = Array.isArray(profile.filiais)
        && profile.filiais.some((filial) => Number(filial.id) === 1);

      return isProfileAdmin || isMatrixUser;
    };

    const loadProfileAndBranches = async () => {
      try {
        const { data: profile } = await connect.get("/usuarios/perfil");
        if (!active) return;

        storeProfile(profile);
        const maySelectBranches = updateProfile(profile);
        setProfileStatus("ready");
        setCanSelectFiliais(maySelectBranches);

        if (!maySelectBranches) {
          setFls([]);
          setSelectedFilialIds([]);
          localStorage.removeItem("selected_filial_ids");
          const { data: companyRows } = await connect.get("/centro/empresas");
          const activeCompanies = (Array.isArray(companyRows) ? companyRows : []).filter((company) => company.ativa !== false);
          const ids = activeCompanies.map((company) => Number(company.id));
          setCompanies(activeCompanies);
          setSelectedCompanyIds(ids);
          localStorage.setItem("selected_company_ids", JSON.stringify(ids));
          return;
        }

        const [{ data: branches }, { data: companyRows }] = await Promise.all([
          connect.get("/filiais"),
          connect.get("/centro/empresas"),
        ]);
        if (!active) return;

        const activeBranches = (Array.isArray(branches) ? branches : [])
          .filter((branch) => branch.ativa !== false)
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

        const availableIds = new Set(activeBranches.map((branch) => Number(branch.id)));
        let storedIds = [];

        try {
          const parsed = JSON.parse(localStorage.getItem("selected_filial_ids") || "[]");
          storedIds = Array.isArray(parsed)
            ? parsed.map(Number).filter((id) => availableIds.has(id))
            : [];
        } catch {
          storedIds = [];
        }

        const initialSelection = storedIds.length
          ? storedIds
          : activeBranches.map((branch) => Number(branch.id));

        setFls(activeBranches);
        setSelectedFilialIds(initialSelection);
        localStorage.setItem("selected_filial_ids", JSON.stringify(initialSelection));

        const activeCompanies = (Array.isArray(companyRows) ? companyRows : [])
          .filter((company) => company.ativa !== false)
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
        const availableCompanyIds = new Set(activeCompanies.map((company) => Number(company.id)));
        let storedCompanyIds = [];
        try {
          const parsed = JSON.parse(localStorage.getItem("selected_company_ids") || "[]");
          storedCompanyIds = Array.isArray(parsed) ? parsed.map(Number).filter((id) => availableCompanyIds.has(id)) : [];
        } catch {
          storedCompanyIds = [];
        }
        const initialCompanies = storedCompanyIds.length ? storedCompanyIds : [...availableCompanyIds];
        setCompanies(activeCompanies);
        setSelectedCompanyIds(initialCompanies);
        localStorage.setItem("selected_company_ids", JSON.stringify(initialCompanies));
      } catch {
        if (!active) return;
        setFls([]);
        setSelectedFilialIds([]);
        setCanSelectFiliais(false);
        localStorage.removeItem("selected_filial_ids");
        setCompanies([]);
        setSelectedCompanyIds([]);
        localStorage.removeItem("selected_company_ids");
        // Falha pontual de rede não deve invalidar nem redirecionar a sessão.
        setProfileStatus("ready");
      }
    };

    const listener = (event) => {
      const maySelectBranches = updateProfile(event.detail || {});
      setCanSelectFiliais(maySelectBranches);
    };

    window.addEventListener("tmhub:profile", listener);
    loadProfileAndBranches();

    return () => {
      active = false;
      window.removeEventListener("tmhub:profile", listener);
    };
  }, []);

  const handleFiliaisChange = (event) => {
    const ids = (event.value || []).map(Number);
    setSelectedFilialIds(ids);
    localStorage.setItem("selected_filial_ids", JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent("tmhub:filiais-changed", {
      detail: { filialIds: ids },
    }));
    window.dispatchEvent(new CustomEvent("tmhub:standard-filters-changed", {
      detail: { name: "branches", value: ids },
    }));
  };

  const handleCompaniesChange = (event) => {
    const ids = (event.value || []).map(Number);
    setSelectedCompanyIds(ids);
    localStorage.setItem("selected_company_ids", JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent("tmhub:filiais-changed", {
      detail: { filialIds: selectedFilialIds, companyIds: ids },
    }));
    window.dispatchEvent(new CustomEvent("tmhub:standard-filters-changed", {
      detail: { name: "companies", value: ids },
    }));
  };

  useEffect(() => {
    const token = getAccessToken();
    socketio.auth = { token };
    if (token) {
      socketio.disconnect().connect();
    }
  }, []);

  useEffect(() => {
    let refreshTimer;
    const handleDataChanged = (event = {}) => {
      if (event.source_socket && event.source_socket === socketio.id) return;
      const routeChannels = REALTIME_CHANNELS_BY_ROUTE[location.pathname] || [];
      if (!event.channel || !routeChannels.includes(event.channel)) return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("tmhub:data-changed", { detail: event }));
      }, 350);
    };
    const handleNotification = (notification = {}) => {
      showToast(
        notification.severity || "info",
        notification.summary || "TM Hub",
        notification.detail || "Uma operação foi atualizada."
      );
    };

    socketio.on("data_changed", handleDataChanged);
    socketio.on("system_notification", handleNotification);
    return () => {
      window.clearTimeout(refreshTimer);
      socketio.off("data_changed", handleDataChanged);
      socketio.off("system_notification", handleNotification);
    };
  }, [location.pathname, showToast]);

  return (
    <div className={`app-layout ${isMenuVisible ? "menu-open" : "menu-closed"}`}>
      <UsageTelemetryTracker />
      {/* DOCKER */}
      <header className="layout-header shadow-6 px-3">
        <div className="flex align-items-center gap-2">
          <button
            type="button"
            className="layout-menu-toggle"
            aria-controls="main-sidebar"
            aria-expanded={isMenuVisible}
            aria-label={isMenuVisible ? "Ocultar menu principal" : "Exibir menu principal"}
            title={isMenuVisible ? "Ocultar menu" : "Exibir menu"}
            onClick={() => setIsMenuVisible((visible) => !visible)}
          >
            <AppIcon name={isMenuVisible ? "chevron-left" : "menu"} />
          </button>

          <button
            type="button"
            className="layout-brand fadein animation-duration-2000"
            aria-label="Ir para a tela inicial"
            onClick={() => navigateTo("/init")}
          >
            <ThemeLogo className="layout-brand-logo" />
          </button>
        </div>

        <div className="flex gap-2 align-items-center flipup animation-duration-500">
          <EdinhoCard />

          <Divider layout="vertical" />

          <div className="layout-user-info flex flex-column text-right">
            <span className="font-bold">{displayName}</span>
            <span className="text-700 font-italic">{role}</span>
          </div>
          <UserAvatar
            userId={Number(localStorage.getItem("current_id"))}
            nome={displayName}
            foto_perfil={profilePhoto}
            size="large"
          />
        </div>
      </header>
      <TimoAgentNavigationBridge />

      {/* MAIN CONTENT */}
      <div className="layout-body">
        <button
          type="button"
          className="layout-sidebar-backdrop"
          aria-label="Fechar menu principal"
          onClick={() => setIsMenuVisible(false)}
        />

        {/* MENU BAR */}
        <aside id="main-sidebar" className="layout-sidebar bg-primary shadow-4" aria-hidden={!isMenuVisible}>
          {companies.length > 0 ? (
            <FloatLabel className="flex mx-3 mt-5">
              <MultiSelect inputId="layout-empresas" className="w-full" value={selectedCompanyIds} options={companies} optionLabel="nome" optionValue="id" onChange={handleCompaniesChange} placeholder="Selecione as empresas" display="chip" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} empresas selecionadas" />
              <label htmlFor="layout-empresas">Empresas</label>
            </FloatLabel>
          ) : null}
          {(() => {
            return canSelectFiliais && fls.length > 0 ? (
              <FloatLabel className="flex mx-3 mt-4">
                <MultiSelect
                  inputId="layout-filiais"
                  className="w-full"
                  value={selectedFilialIds}
                  options={fls}
                  optionLabel="nome"
                  optionValue="id"
                  onChange={handleFiliaisChange}
                  placeholder="Selecione as filiais"
                  display="chip"
                  filter
                  showClear
                  maxSelectedLabels={2}
                  selectedItemsLabel="{0} filiais selecionadas"
                  emptyMessage="Nenhuma filial disponível"
                  emptyFilterMessage="Nenhuma filial encontrada"
                />
                <label htmlFor="layout-filiais">Filiais</label>
              </FloatLabel>
            ) : null;
          })()}
          <PanelMenu model={items} className="layout-panel-menu py-2" />
        </aside>

        {/* PANEL FRAME */}
        <main className="layout-outlet">
          <Outlet key={standardFilterVersion} />
        </main>
      </div>
    </div>
  );
}
