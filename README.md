<div align="center">
  <img src="./public/brands/main_brand.svg" alt="TM Hub" width="260">

  # TM Hub · Painel Executivo

  Plataforma operacional da TM para gestão de pessoas, reposições, contratos,
  estoque, projetos, chamados e rotinas operacionais em tempo real.

  [![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
  [![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
  [![PrimeReact](https://img.shields.io/badge/PrimeReact-10-06B6D4?logo=prime&logoColor=white)](https://primereact.org/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-Tempo%20real-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
  [![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

  [API](https://github.com/foxtec198/api_tmhub) ·
  [Fluxo do time](./FLUXO.md) ·
  [Execução local](#execução-local)
</div>

---

## Visão geral

O TM Hub concentra processos administrativos e operacionais em uma interface
responsiva. O frontend consome a API Flask do ecossistema TM Hub e recebe
eventos Socket.IO para atualizar apenas o módulo afetado, sem recarregar a
aplicação inteira.

## Módulos atuais

| Área | Recursos |
| --- | --- |
| **Reposições** | Requisição pública e autenticada, lançamento rápido, reservas técnicas, indisponibilidade, histórico, timeline e painel ODS/KDS em tempo real. |
| **Faltas** | Controle, tratativa, prazo documental, lançamento manual, dashboard e regras para férias, remanejamento e posto vago. |
| **Glosas** | Cobertura integral ou parcial, valores, evidências, filtros, XLSX, dashboard e métrica específica da Roçada. |
| **Admissões e rescisões** | Vagas de substituição e aditivos, SLA em dias úteis, dashboard e controle de desligamentos. |
| **Estoque e logística** | Produtos, categorias, movimentações, destinatários por colaborador, locais automáticos, códigos de barras e dashboard logístico. |
| **Estrutura** | Filiais, departamentos, contratos, supervisor, locais, subestruturas ilimitadas, ativos e patrimônio. |
| **TM Ops / Scheduler** | Rotinas, vínculos por estrutura, checklists, tarefas recorrentes, workflows, Executor mobile, evidências e geolocalização. |
| **Projetos** | Kanban, cards, datas, membros, comentários, anexos e dashboard de projetos. |
| **Chamados** | Central de chamados com SLA de 24h, conversa em tempo real, responsáveis, motivos e gestão administrativa por filial. |
| **Timo** | Configuração de intenções, consultas analíticas, aprendizado assistido e integração com o Timo Voice Agent. |
| **Dashboards** | Reposições, faltas, admissões, projetos, logística, PCD, glosas, rescisões e colaboradores por departamento. |

## Recursos de plataforma

- Autenticação JWT, requisitos de primeiro acesso e troca de senha segura.
- Permissões por tela e ação: visualizar, criar e alterar.
- Escopo obrigatório de filial; administradores e usuários Matriz podem usar o seletor global de filiais.
- Temas TM Hub, Cyberpunk e Pride com modo claro/escuro persistido.
- Componentes reutilizáveis de cabeçalho, filtros, tabelas, diálogos e indicadores.
- Datas formatadas em `pt-BR`, filtros procedurais e exportações que respeitam o filtro aplicado na tela.
- WebSocket por canal de domínio para atualizações pontuais de dados.
- PWA e layout responsivo para operação em desktop e mobile.

## Arquitetura

```text
Usuário
  │
  ├── React + PrimeReact
  │     ├── Axios ───────────────────► API Flask
  │     └── Socket.IO ◄──────────────► Flask-SocketIO
  │                                      │
  └── Theme, permissões e filial          └── PostgreSQL + SQLAlchemy
```

## Execução local

### Pré-requisitos

- Node.js 20 ou superior.
- npm.
- API TM Hub em execução na porta `8590`.

```powershell
git clone https://github.com/foxtec198/tmhub.git
cd tmhub
npm.cmd install
npm.cmd run dev
```

Em desenvolvimento, o frontend usa `http://localhost:8590`. Para o ambiente
de produção, configure `VITE_SERVER` com a URL pública da API antes do build.

Comandos úteis:

| Comando | Finalidade |
| --- | --- |
| `npm.cmd run dev` | Inicia o Vite em desenvolvimento. |
| `npm.cmd run dev:full` | Inicia frontend e API local quando disponível. |
| `npm.cmd run dev:mobile` | Expõe o Vite para testes na rede local. |
| `npm.cmd run build` | Gera e valida o bundle de produção. |
| `npm.cmd run lint` | Executa o ESLint. |
| `npm.cmd run work:new -- -Type feat -Name "nome"` | Sincroniza `dev` e cria uma branch de trabalho. |
| `npm.cmd run deploy:pr -- -Message "feat: resumo"` | Envia a branch e abre PR para `dev`. |

## Estrutura do frontend

```text
src/
├── components/     componentes compartilhados
├── contexts/       loading, toast e estados globais
├── layouts/        layout autenticado e MenuBar
├── pages/          telas organizadas por domínio
├── theme/          tokens, temas e modos de exibição
├── utils/          API, sessão, Socket.IO, permissões e perfil
└── App.jsx         rotas públicas e protegidas
```

## Segurança e escopo

- O token é enviado em `Access-Token`; nunca grave tokens ou segredos no repositório.
- Ocultar um botão não substitui a validação da API.
- O filtro global de filial é uma regra de negócio e segurança. Novas telas autenticadas devem respeitá-lo.
- Rotas públicas são exceções explícitas e não recebem o contexto autenticado de filial.

## Contribuição

Leia [FLUXO.md](./FLUXO.md) antes de iniciar uma atividade. Colaboradores
trabalham em branches e abrem PR para `dev`; apenas o responsável do projeto
promove `dev` para `main` e produção.

## Projeto relacionado

As regras de negócio, modelos e API estão em
**[api_tmhub](https://github.com/foxtec198/api_tmhub)**.

## Licença e uso

Projeto proprietário de uso interno. Distribuição, cópia ou modificação externa
dependem de autorização.
