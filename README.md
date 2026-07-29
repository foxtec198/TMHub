<div align="center">
  <img src="./public/brands/main_brand.svg" alt="TM Hub" width="260">

  <h1>TM Hub — Painel Executivo</h1>

  <p>
    Plataforma operacional para centralizar reposições, admissões, faltas,
    glosas, estoque, indicadores e estrutura de contratos.
  </p>

  [![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
  [![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
  [![PrimeReact](https://img.shields.io/badge/PrimeReact-10-06B6D4?logo=prime&logoColor=white)](https://primereact.org/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
  [![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
  [![License](https://img.shields.io/badge/uso-interno-155C27)](#licença-e-uso)

  [API](https://github.com/foxtec198/api_tmhub) ·
  [Configuração](#executando-localmente) ·
  [Módulos](#módulos)
</div>

---

## Sobre o projeto

O **TM Hub** é a interface web do ecossistema operacional da TM. Ele combina
fluxos administrativos, painéis executivos e operações em tempo real em uma
experiência responsiva, com suporte a tema claro/escuro e controle granular de
acesso.

A aplicação consome a [API TM Hub](https://github.com/foxtec198/api_tmhub) e
recebe eventos via Socket.IO para manter telas críticas sincronizadas sem
atualizações manuais.

## Módulos

| Área | Recursos |
| --- | --- |
| **Reposições** | Requisições públicas e autenticadas, lançamento rápido, reservas técnicas, histórico, timeline e KDS em tempo real |
| **Admissões** | Vagas de substituição e aditivos, acompanhamento de SLA em dias úteis e dashboard |
| **Faltas** | Tratativa, prazos documentais, lançamentos manuais e indicadores |
| **Glosas** | Cobertura integral/parcial, valores, evidências, filtros e exportação XLSX |
| **Ponto 48h** | Importação e análise de apontamentos operacionais |
| **Estoque** | Produtos, movimentações, códigos de barras e leitura por câmera |
| **Estrutura** | Departamentos, contratos, supervisores, locais, ativos e patrimônio |
| **Projetos** | Cards, responsáveis, etapas e acompanhamento visual |
| **Configurações** | Usuários, permissões, filiais, contratos, departamentos e tema persistente |

## Principais recursos

- Autenticação por JWT e rotas protegidas.
- Permissões por tela: visualizar, criar e alterar.
- Escopo obrigatório por filial para usuários comuns.
- Visão unificada das filiais vinculadas ao usuário.
- Tema claro e escuro persistido.
- Atualizações em tempo real com Socket.IO.
- Dashboards com Chart.js.
- Exportações em XLSX e PDF.
- Upload, arrastar e colar evidências.
- Geração e leitura de códigos de barras.
- Interface responsiva e instalável como PWA.

> [!IMPORTANT]
> O filtro de filial é uma regra de segurança e de negócio. Usuários comuns
> recebem somente dados das filiais às quais estão vinculados. As rotas públicas
> são as únicas exceções previstas.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | React 19, PrimeReact, PrimeFlex e PrimeIcons |
| Build | Vite 8 |
| Navegação | React Router |
| Comunicação | Axios e Socket.IO Client |
| Indicadores | Chart.js e chartjs-plugin-datalabels |
| Documentos | jsPDF, OpenPyXL no backend e exportações XLSX |
| Códigos | bwip-js e Quagga2 |
| PWA | Web App Manifest e ícones multiplataforma |

## Arquitetura

```text
Usuário
  │
  ▼
React + PrimeReact
  ├── HTTP / Axios ───────────────► Flask REST API
  └── Socket.IO Client ◄──────────► Flask-SocketIO
                                        │
                                        ▼
                              PostgreSQL + SQLAlchemy
```

## Executando localmente

### Pré-requisitos

- Node.js 20 ou superior.
- npm.
- API TM Hub configurada e em execução.

### Instalação

```bash
git clone https://github.com/foxtec198/tmhub.git
cd tmhub
npm install
```

Crie um arquivo `.env` na raiz:

```env
VITE_SERVER=http://localhost:8590
```

Inicie o ambiente:

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:5173`.

Para testar em outros dispositivos da rede local no Windows:

```powershell
npm run dev:mobile
```

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o Vite em modo de desenvolvimento |
| `npm run dev:mobile` | Prepara o acesso pela rede local |
| `npm run build` | Gera o bundle de produção |
| `npm run preview` | Visualiza localmente o bundle gerado |
| `npm run lint` | Executa as verificações do ESLint |

## Estrutura principal

```text
src/
├── components/       # Componentes reutilizáveis
├── contexts/         # Loading, toast e estados globais
├── layouts/          # Estrutura autenticada da aplicação
├── pages/            # Telas organizadas por domínio
├── utils/            # API, Socket.IO e permissões
└── App.jsx            # Rotas públicas e protegidas
```

## Segurança

- O token é enviado no cabeçalho `Access-Token`.
- A interface oculta ações sem permissão, mas a decisão final sempre ocorre na API.
- O backend restringe consultas e mutações pelo escopo de filial.
- Credenciais e segredos nunca devem ser adicionados ao repositório.

## Projeto relacionado

O backend, os modelos de dados e as regras de negócio estão no repositório
**[api_tmhub](https://github.com/foxtec198/api_tmhub)**.

## Licença e uso

Projeto proprietário destinado ao uso interno. Distribuição, cópia ou
modificação externa dependem de autorização.
