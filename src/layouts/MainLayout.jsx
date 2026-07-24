import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { PanelMenu } from "primereact/panelmenu";
import { Avatar } from "primereact/avatar";
import { capitalize, deny_roles } from "../utils/ui";
import connect from "../utils/request";
import { getInitials, storeProfile } from "../utils/profile";
import { can } from "../utils/permissions";
import './main.css'

export function MainLayout() {
  const [displayName, setDisplayName] = useState(() => localStorage.getItem("display_name") || "");
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("profile_photo"));
  const [role] = useState(() => {
    const storedRole = localStorage.getItem("role");
    return storedRole ? capitalize(storedRole) : "";
  });
  const [isMenuVisible, setIsMenuVisible] = useState(
    () => !window.matchMedia("(max-width: 960px)").matches
  );
  const navigate = useNavigate();
  const deny = deny_roles.includes(role)
  const canManageAbsences = can("controle_faltas");

  const navigateTo = (path) => {
    navigate(path);

    if (window.matchMedia("(max-width: 960px)").matches) {
      setIsMenuVisible(false);
    }
  };

  const items = [
    {
      label: 'Dashboards',
      icon: 'pi pi-file',
      items: [
        {
          label: 'Reposições',
          icon: 'pi pi-sync',
          visible: can("dashboard_reposicoes"),
          command: () => { navigateTo("/reports/reposicoes") }
        },
        {
          label: 'Reposições - ODS',
          icon: 'pi pi-external-link',
          visible: can("dashboard_reposicoes_ods"),
          command: () => { navigateTo("/reports/reposicoes/ods") }
        },
        {
          label: 'Colab. por DPTO',
          icon: 'pi pi-users',
          visible: can("dashboard_colaboradores"),
          command: () => { navigateTo("/reports/colaboradores-departamento") }
        },
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
          label: 'Logística',
          disabled: true,
          icon: 'pi pi-truck',
          // command: () => { navigateTo("/reports/logistica") }
        },
      ]
    },
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
      label: "Reposições",
      icon: 'pi pi-sync',
      items: [
        ...(canManageAbsences ? [{
          label: 'Controle de Faltas',
          icon: 'pi pi-calendar-times',
          command: () => { navigateTo("/controle-faltas") }
        }] : []),
        ...(can("controle_glosas") ? [{
          label: 'Controle de Glosas',
          icon: 'pi pi-money-bill',
          command: () => { navigateTo("/controle-glosas") }
        }] : []),
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
          label: 'Reservas Tecnicas',
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
          icon: 'pi pi-barcode',
          visible: can("estoque_produtos"),
          command: () => { navigateTo("/estoque/produtos") }
        },
        {
          label: 'Gerar Códigos',
          icon: 'pi pi-qrcode',
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
    {
      label: 'Meus Projetos',
      icon: 'pi pi-spinner-dotted',
      visible: can("projetos"),
      command: () => { navigateTo("/projetos") }
    },
    {
      label: 'Frotas',
      disabled: "True",
      icon: 'pi pi-car',
      command: () => { navigateTo("/frotas") }
    },
    {
      label: 'Configurações',
      icon: 'pi pi-cog',
      command: () => { navigateTo("/configuracoes") }
    },
    {
      label: 'Importar Planilha',
      icon: 'pi pi-upload',
      command: () => { navigateTo("/importacao") }
    },
    {
      label: 'Sair',
      icon: 'pi pi-sign-out',
      command: () => { localStorage.clear(); navigateTo("/") }
    },
  ];

  useEffect(() => {
    if (!displayName || !role) {
      navigate("/");
    }
  }, [displayName, navigate, role]);

  useEffect(() => {
    const updateProfile = (profile) => {
      setDisplayName(profile.nome || "");
      setProfilePhoto(profile.foto_perfil || null);
    };
    const listener = (event) => updateProfile(event.detail);
    window.addEventListener("tmhub:profile", listener);
    connect.get("/usuarios/perfil").then(({ data }) => { storeProfile(data); updateProfile(data); }).catch(() => { });
    return () => window.removeEventListener("tmhub:profile", listener);
  }, []);

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
            <img className="layout-brand-logo" src="/brands/main_brand.svg" alt="TM Hub — Painel Executivo" />
          </button>
        </div>

        <div className="flex gap-2 align-items-center flipup animation-duration-500">
          <div className="layout-user-info flex flex-column text-right">
            <span className="font-bold">{displayName}</span>
            <span className="text-700 font-italic">{role}</span>
          </div>
          <Avatar
            image={profilePhoto || undefined}
            label={!profilePhoto ? getInitials(displayName) : undefined}
            shape="circle"
            size="large"
          />
        </div>
      </header>

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
          <PanelMenu model={items} className="layout-panel-menu" />
        </aside>

        {/* PANEL FRAME */}
        <main className="layout-outlet">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
