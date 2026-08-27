import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import { useEffect, useState } from "react";
import connect from "../../utils/request";
import "./init.css";
import WeatherWidget from "../../components/WeatherWidget";
import { ThemeLogo } from "../../components/ThemeLogo";
import { UserAvatar } from "../../components/UserAvatar";

const documentation = [
  {
    title: "Documentação do Frontend",
    description: "Interface React, componentes, permissões, temas e fluxo de desenvolvimento.",
    icon: appIcon("desktop"),
    tech: "React + Vite",
    href: "https://github.com/foxtec198/tmhub#readme",
  },
  {
    title: "Documentação da API",
    description: "Rotas, serviços, banco de dados, WebSocket e execução do backend.",
    icon: appIcon("server"),
    tech: "Flask + PostgreSQL",
    href: "https://github.com/foxtec198/api_tmhub#readme",
  },
];

const supportChecklist = [
  "Informe a tela e a ação que estava realizando.",
  "Envie uma captura da mensagem apresentada.",
  "Se possível, inclua matrícula, contrato ou código do registro.",
];

export function Init() {
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    connect.get("/usuarios/suporte")
      .then(({ data }) => setAdmins(Array.isArray(data) ? data : []))
      .catch(() => setAdmins([]));
  }, []);

  return (
    <main className="init-support-page">
      <div className="init-support-top">
        <section className="init-support-hero">
          <div className="init-support-hero-content">
            <span className="init-support-eyebrow">TM HUB · CENTRAL DE AJUDA</span>
            <h1>Suporte e documentação em um só lugar.</h1>
            <p>
              Encontre orientações técnicas, consulte os recursos do sistema e saiba
              quais informações enviar para agilizar seu atendimento.
            </p>
            <div className="init-support-hero-tags">
              <span><AppIcon name="book"  /> Documentação atualizada</span>
              <span><AppIcon name="messages"  /> Suporte interno</span>
              <span><AppIcon name="shield"  /> Acesso controlado</span>
            </div>
          </div>
          <div className="init-support-hero-mark" aria-hidden="true">
            <ThemeLogo variant="inverse" alt="" />
            <span className="init-support-hero-icon">
              <AppIcon name="headphones" size="2rem" />
            </span>
          </div>
        </section>

        <WeatherWidget className="init-weather-widget" />
      </div>

      <section className="init-support-section">
        <header className="init-support-section-header">
          <div>
            <span>Base técnica</span>
            <h2>Documentação do projeto</h2>
            <p>Acesse diretamente o README oficial de cada aplicação no GitHub.</p>
          </div>
          <AppIcon name="brand-github" aria-hidden="true"  />
        </header>

        <div className="init-docs-grid">
          {documentation.map((item) => (
            <article className="init-doc-card" key={item.title}>
              <div className="init-doc-icon">{typeof item.icon === "string" ? <AppIcon icon={item.icon} /> : item.icon}</div>
              <span className="init-doc-tech">{item.tech}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <a href={item.href} target="_blank" rel="noreferrer">
                <AppIcon name="external-link"  />
                Abrir documentação
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="init-support-grid">
        <article className="init-help-card">
          <div className="init-help-card-title">
            <AppIcon name="send"  />
            <div>
              <span>Atendimento eficiente</span>
              <h2>Antes de solicitar suporte</h2>
            </div>
          </div>
          <ol>
            {supportChecklist.map((item, index) => (
              <li key={item}>
                <span>{index + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className="init-team-card">
          <div>
            <span>Equipe responsável</span>
            <h2>Precisa de ajuda?</h2>
            <p>Entre em contato com o suporte interno do TM Hub.</p>
          </div>
          <div className="init-team-list">
            {admins.length ? admins.map((admin) => (
              <div key={admin.id}>
                <UserAvatar user={admin} />
                <div>
                  <strong>{admin.nome}</strong>
                  <small>Administrador · Suporte TM Hub</small>
                </div>
              </div>
            )) : (
              <div className="init-team-empty">
                <span><AppIcon name="users"  /></span>
                <div>
                  <strong>Equipe de administradores</strong>
                  <small>Consulte um administrador interno.</small>
                </div>
              </div>
            )}
          </div>
          <a
            className="init-issue-link"
            href="https://github.com/foxtec198/tmhub/issues/new"
            target="_blank"
            rel="noreferrer"
          >
            <AppIcon name="brand-github"  />
            Registrar problema técnico
          </a>
        </article>
      </section>

      <footer className="init-support-footer">
        <ThemeLogo />
        <span>Feito para conectar gestão, operação e tecnologia.</span>
      </footer>
    </main>
  );
}
