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

// Styles
import './main.css'

const REALTIME_CHANNELS_BY_ROUTE = {
  "/configuracoes": ["configuracoes", "colaboradores"],
  "/controle-faltas": ["controle_faltas"],
  "/controle-glosas": ["glosas"],
  "/indicadores/pcd": ["pcd", "colaboradores"],
  "/admissao/vagas": ["admissao"],
  "/admissao/aditivos": ["admissao"],
  "/rescisoes": ["rescisoes", "colaboradores"],
  "/reposicoes/requisicoes": ["reposicoes.requisicoes"],
  "/reposicoes/reservas": ["reposicoes.reservas"],
  "/reposicoes/historico": ["reposicoes.historico"],
  "/reports/colaboradores-departamento": ["colaboradores"],
  "/reports/ponto-48-horas": ["ponto48"],
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
};

export function MainLayout() {
  const [fls, setFls] = useState([]);
  const [selectedFilialIds, setSelectedFilialIds] = useState([]);
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
  const [dataRevision, setDataRevision] = useState(0);
  const [profileStatus, setProfileStatus] = useState("loading");

  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const deny = deny_roles.includes(role)

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
      icon: 'pi pi-chart-line',
      items: [
        {
          label: "Operacional",
          items: [
            {
              label: "Reposições",
              items: [
                {
                  label: 'Reposições',
                  icon: 'pi pi-sync',
                  visible: can("dashboard_reposicoes"),
                  command: () => { navigateTo("/reports/reposicoes") }
                },
                {
                  label: 'Rep. ODS',
                  icon: 'pi pi-external-link',
                  visible: can("dashboard_reposicoes_ods"),
                  command: () => { navigateTo("/reports/reposicoes/ods") }
                }
              ],
            },
            {
              label: 'Logística',
              icon: 'pi pi-truck',
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
              icon: 'pi pi-clock',
              visible: can("dashboard_ponto48"),
              command: () => { navigateTo("/reports/ponto-48-horas") }
            },
            {
              label: 'Admissões',
              icon: 'pi pi-user-plus',
              visible: can("dashboard_admissoes"),
              command: () => { navigateTo("/reports/admissoes") }
            },
            {
              label: 'Faltas',
              icon: 'pi pi-chart-bar',
              visible: can("dashboard_faltas"),
              command: () => { navigateTo("/reports/faltas") }
            },
            {
              label: 'PCD',
              icon: 'pi pi-heart',
              visible: can("dashboard_pcd"),
              command: () => { navigateTo("/reports/pcd") }
            },
            {
              label: "Rescisões",
              icon: "pi pi-user-minus",
              visible: can("dashboard_rescisoes"),
              command: () => {
                navigateTo("/reports/rescisoes");
              },
            },
            {
              label: "Disciplina",
              icon: "pi pi-file-edit",
              visible: can("dashboard_medidas_disciplinares"),
              command: () => {
                navigateTo("/reports/medidas-disciplinares");
              },
            },
            {
              label: "Glosas",
              items: [
                {
                  label: 'Gerais',
                  icon: 'pi pi-money-bill',
                  visible: can("dashboard_glosas"),
                  command: () => { navigateTo("/reports/glosas") }
                },
                {
                  label: 'Roçada',
                  icon: 'pi pi-bullseye',
                  visible: can("dashboard_glosas"),
                  command: () => { navigateTo("/reports/rocada") }
                },
              ]
            },
          ]
        },
        {
          label: 'Colaboradores',
          icon: 'pi pi-users',
          visible: can("dashboard_colaboradores"),
          command: () => { navigateTo("/reports/colaboradores-departamento") }
        },
        {
          label: 'Projetos',
          icon: 'pi pi-chart-line',
          visible: can("dashboard_projetos"),
          command: () => { navigateTo("/reports/projetos") }
        },
      ]
    },
    {
      label: "RH",
      icon: "pi pi-users",
      items: [
        {
          label: "Admissão",
          icon: 'pi pi-user-plus',
          items: [
            {
              label: 'Vagas',
              icon: 'pi pi-briefcase',
              visible: can("admissoes"),
              command: () => { navigateTo("/admissao/vagas") }
            },
            {
              label: 'Aditivos',
              icon: 'pi pi-plus-circle',
              visible: can("admissoes"),
              command: () => { navigateTo("/admissao/aditivos") }
            },
          ]
        },
        {
          label: "PCD's",
          icon: 'pi pi-heart',
          visible: can("indicador_pcd"),
          command: () => { navigateTo("/indicadores/pcd") }
        },
        {
          label: 'Rescisões',
          icon: 'pi pi-user-minus',
          visible: can("controle_rescisoes"),
          command: () => { navigateTo("/rescisoes") }
        },
        {
          label: 'Faltas',
          icon: 'pi pi-calendar-times',
          visible: can("controle_faltas"),
          command: () => { navigateTo("/controle-faltas") }
        },
        {
          label: 'Glosas',
          icon: 'pi pi-money-bill',
          visible: can("controle_glosas"),
          command: () => { navigateTo("/controle-glosas") }
        },
        {
          label: 'Disciplina',
          icon: 'pi pi-file-edit',
          visible: can("controle_medidas_disciplinares"),
          command: () => { navigateTo("/controle-medidas-disciplinares") }
        },
      ]
    },
    {
      label: "Operacional",
      icon: "pi pi-briefcase",
      items: [
        {
          label: 'Reposições',
          icon: 'pi pi-sync',
          items: [
            {
              label: 'Requisições',
              icon: 'pi pi-question',
              visible: can("reposicoes"),
              command: () => { navigateTo("/reposicoes/requisicoes") }
            },
            {
              label: 'Histórico',
              icon: 'pi pi-history',
              display: false,
              visible: can("historico_reposicoes"),
              command: () => { navigateTo("/reposicoes/historico") }
            },
            {
              label: 'Reservas',
              icon: 'pi pi-users',
              visible: can("reservas"),
              command: () => { navigateTo("/reposicoes/reservas") },
            },
          ]
        },
        {
          label: "Estoque",
          icon: 'pi pi-box',
          items: [
            {
              label: 'Produtos',
              icon: 'pi pi-box',
              visible: can("estoque_produtos"),
              command: () => { navigateTo("/estoque/produtos") }
            },
            {
              label: 'Barcode',
              icon: 'pi pi-barcode',
              visible: can("estoque_codigos"),
              command: () => { navigateTo("/estoque/codigos-de-barras") }
            },
            {
              label: 'Movimentações',
              icon: 'pi pi-arrow-right-arrow-left',
              visible: can("estoque_movimentos"),
              command: () => { navigateTo("/estoque/movimentacoes") }
            },
          ]
        },
      ]
    },
    {
      label: "RPA Center",
      disabled: true,

      icon: 'pi pi-verified',
      className: deny ? "hidden" : null,
      items: [
        {
          label: 'HK Bot',
          icon: 'pi pi-clock',
          command: () => { }
        },
      ]
    },
    {
      label: 'TM Ops',
      icon: 'pi pi-calendar-clock',
      visible: can("tm_ops") && String(role || "").toUpperCase() === "ADMIN",
      items: [
        {
          label: 'Rotinas e locais',
          icon: 'pi pi-calendar-plus',
          command: () => { navigateTo("/tm-ops/gestao") },
        },
        {
          label: 'Checklists',
          icon: 'pi pi-list-check',
          command: () => { navigateTo("/tm-ops/checklists") },
        },
        {
          label: 'Tarefas',
          icon: 'pi pi-list',
          command: () => { navigateTo("/tm-ops/tarefas") },
        },
        {
          label: 'Abrir execução',
          icon: 'pi pi-external-link',
          command: () => { window.open("/tm-ops/login", "_blank", "noopener,noreferrer") },
        },
      ],
    },
    {
      label: 'Estrutura',
      icon: 'pi pi-building',
      visible: can("estrutura"),
      command: () => { navigateTo("/estrutura") }
    },
    {
      label: 'Chamados',
      icon: 'pi pi-headphones',
      visible: can("tickets"),
      command: () => { navigateTo("/tickets") }
    },
    {
      label: 'Gestão de chamados',
      icon: 'pi pi-sliders-h',
      visible: can("tickets") && String(role || "").toUpperCase() === "ADMIN",
      command: () => { navigateTo("/tickets/gestao") }
    },
    {
      label: 'Meus Projetos',
      icon: 'pi pi-spinner-dotted',
      visible: can("projetos"),
      command: () => { navigateTo("/projetos") }
    },
    {
      label: 'Configurações',
      icon: 'pi pi-cog',
      command: () => { navigateTo("/configuracoes") }
    },
    {
      label: 'Sair',
      icon: 'pi pi-sign-out',
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
          return;
        }

        const { data: branches } = await connect.get("/filiais");
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
      } catch {
        if (!active) return;
        setFls([]);
        setSelectedFilialIds([]);
        setCanSelectFiliais(false);
        localStorage.removeItem("selected_filial_ids");
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
    setDataRevision((revision) => revision + 1);
    window.dispatchEvent(new CustomEvent("tmhub:filiais-changed", {
      detail: { filialIds: ids },
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
        setDataRevision((revision) => revision + 1);
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
            <i className={`pi ${isMenuVisible ? "pi-angle-left" : "pi-bars"}`} aria-hidden="true" />
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
          {(() => {
            return canSelectFiliais && fls.length > 0 ? (
              <FloatLabel className="flex mx-3 mt-5">
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
          <PanelMenu model={items} className="layout-panel-menu" />
        </aside>

        {/* PANEL FRAME */}
        <main className="layout-outlet">
          <Outlet key={dataRevision} />
        </main>
      </div>
    </div>
  );
}
