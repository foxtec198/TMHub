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
| **Experiências** | Controle de contratos de experiências, desde a avaliação até o documento. |
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
- API em produção.

```powershell
git clone https://github.com/foxtec198/TMHub.git
cd TMHub
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

## Guia de componentes

Esta seção é a referência de implementação para telas novas. Antes de criar um
componente visual do zero, confira se um dos componentes abaixo já resolve o
caso. Isso mantém cabeçalhos, filtros, tabelas, avatares e temas consistentes
em todo o TM Hub.

### Regras rápidas

- Importe os componentes por seu caminho em `src/components`; não copie sua
  implementação para uma página.
- Use os tokens de tema (`var(--surface-1)`, `var(--text-primary)`,
  `var(--border)`, `var(--primary)`) em CSS novo. Não fixe cores de modo claro
  ou escuro na página.
- Datas exibidas ao usuário devem usar `pt-BR`. Nos componentes PrimeReact com
  data, use `locale="pt-BR"` quando a propriedade estiver disponível.
- Toda rota autenticada deve respeitar a permissão e o escopo global de filial;
  a API continua sendo a autoridade para validar ambos.
- Para atualizações em tempo real, assine somente o canal do domínio da tela.
  Um evento de Reposições não deve recarregar Produtos, por exemplo.

### `PageHeader`

Use em toda página interna para manter a hierarquia `seção → título →
descrição`. As ações ficam no mesmo cabeçalho, normalmente Atualizar, Filtros
e Criar.

```jsx
import { Button } from "primereact/button";
import { PageHeader } from "../../components/PageHeader";

<PageHeader
  section="Estoque"
  title="Produtos"
  description="Gerencie produtos, categorias e níveis mínimos."
  actions={
    <>
      <Button label="Atualizar" icon="pi pi-refresh" outlined onClick={load} />
      <Button label="Novo produto" icon="pi pi-plus" onClick={() => setOpen(true)} />
    </>
  }
/>
```

Propriedades: `section`, `title`, `description`, `actions` e `className`.

### Cards e painéis de dashboard

Use `DashCard` para indicadores numéricos e `DashboardPanel` para agrupar
gráficos, tabelas ou listas. Eles recebem as classes globais do TM Hub e se
adaptam aos temas automaticamente.

```jsx
import { DashCard } from "../../components/DashCard";
import { DashboardPanel } from "../../components/DashboardPanel";

<div className="grid">
  <DashCard
    title="Em atraso"
    value={summary.atrasadas}
    detail="requerem tratativa"
    icon="pi pi-clock"
    tone="danger"
  />
</div>

<DashboardPanel className="my-dashboard-panel">
  <header><h2>Movimentações recentes</h2></header>
  {/* gráfico, lista ou tabela */}
</DashboardPanel>
```

`DashCard` aceita `title`, `value`, `detail`, `icon`, `tone`, `accentColor`,
`cont` (badge complementar), `className` e `style`. Para dashboards, também é
possível importar `DashboardMetricCard`, que é o mesmo card com a classe
`tm-dashboard-card` aplicada.

### `Table`

É a tabela responsiva padrão. Em desktop ela usa DataTable; em mobile cada
célula preserva o rótulo da coluna. Prefira-a às tabelas montadas diretamente
em telas administrativas comuns.

```jsx
import { Table } from "../../components/tables/Table";

const columns = [
  { field: "nome", header: "Produto", sortable: true },
  { field: "quantidade", header: "Estoque", sortable: true },
  {
    header: "Situação",
    mobileHeader: "Situação",
    body: (row) => row.ativo ? "Ativo" : "Inativo",
  },
];

<Table
  data={products}
  columns={columns}
  loading={loading}
  search
  rows={10}
  rowsPerPageOptions={[10, 25, 50]}
/>
```

Cada coluna aceita `field`, `header`, `mobileHeader`, `sortable`, `body`,
`style` e `class`. O `body` recebe a linha e deve retornar o conteúdo React.
Use `mode="scroll"` apenas quando o painel realmente exigir rolagem vertical;
o padrão é paginação.

### `Placeholder`

É o estado visual padrão para carregamento e ausência de dados. Use-o em toda
nova tela para evitar áreas vazias, mensagens soltas ou skeletons recriados.
Ele respeita os tokens do tema ativo e possui as variantes `content`, `chart`,
`table`, `card` e `dashboard`.

```jsx
import { Placeholder } from "../../components/Placeholder";

if (loading && !data) {
  return <Placeholder loading variant="dashboard" />;
}

return metrics.length ? (
  <Chart type="bar" data={chartData} options={chartOptions} />
) : (
  <Placeholder
    variant="chart"
    icon="pi-chart-bar"
    title="Sem movimentações no período"
    description="Altere os filtros ou aguarde novos registros."
  />
);
```

`Table` já usa esse componente por padrão quando não há resultados. Para
personalizar, passe `emptyTitle`, `emptyDescription`, `emptyIcon` e, quando
necessário, `emptyAction`. `DashboardPanel` também aceita `loading`, `empty`,
`placeholderVariant`, `emptyTitle`, `emptyDescription`, `emptyIcon` e
`emptyAction`.

### `CollaboratorDropdown`

É o seletor obrigatório quando a tela precisa buscar colaboradores. Ele faz
busca remota, debounce, virtualização e preserva a opção selecionada mesmo
fora da primeira página de resultados. Não carregue toda a base de
colaboradores em um `Dropdown` local.

```jsx
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";

<CollaboratorDropdown
  value={form.colaborador_id}
  selectedOption={selectedCollaborator}
  queryParams={{ ativos: true }}
  onChange={(id, collaborator) => {
    setForm((current) => ({ ...current, colaborador_id: id }));
    setSelectedCollaborator(collaborator);
  }}
  placeholder="Busque por nome ou matrícula"
/>
```

Principais propriedades: `value`, `onChange(id, option)`, `selectedOption`,
`queryParams`, `limit`, `debounce`, `minSearch`, `placeholder`, `disabled`,
`showClear` e `onError`. O retorno completo no segundo argumento permite
preencher cargo, matrícula, contrato e local sem nova consulta.

### `DropdownWS`

Use para seletores remotos genéricos — contratos, motivos, categorias e demais
listas menores — quando não houver um componente específico para o domínio.

```jsx
import { DropdownWS } from "../../components/DropdownWithSearch";

<DropdownWS
  uri="/estoque/categorias"
  value={form.categoria_id}
  onChange={(categoria_id) => setForm((current) => ({ ...current, categoria_id }))}
  placeholder="Selecione a categoria"
  minSearch={0}
/>
```

Ele aceita `uri`, `uriParams`, `value`, `onChange`, `optionLabel`,
`optionValue`, `optionsValuesForDict`, `staticOptions`, `limit`, `fetchAll`,
`minSearch` e `debounce`.

### `UserAvatar` e `ProjectMemberAvatar`

Use `UserAvatar` sempre que um usuário do sistema aparecer: histórico,
comentário, responsável, cabeçalho ou atendimento. O componente prioriza a
foto recebida no payload e, quando necessário, resolve a foto pelo `userId`.
Sem foto, usa iniciais como fallback. A imagem é renderizada com `cover`.

```jsx
import { UserAvatar } from "../../components/UserAvatar";

<UserAvatar
  userId={entry.alterado_por_usuario_id}
  nome={entry.alterado_por}
  foto_perfil={entry.alterado_por_foto}
  style={{ width: "2rem", height: "2rem" }}
/>
```

Para membros de Projeto/Kanban, use o adaptador `ProjectMemberAvatar`:

```jsx
import ProjectMemberAvatar from "../../components/ProjectMemberAvatar";

<ProjectMemberAvatar member={member} style={{ width: "2rem", height: "2rem" }} />
```

Quando criar ou alterar um endpoint que devolve usuários, inclua `id`, `nome`
e `foto_perfil` no payload sempre que a tela precisar mostrar o avatar. Nunca
use o ID de supervisor como se fosse ID de usuário: são entidades distintas.

### `ThemeLogo`

Use a marca por este componente em vez de inserir SVG/PNG manualmente. A marca
segue o tema ativo e preserva acessibilidade.

```jsx
import { ThemeLogo } from "../../components/ThemeLogo";

<ThemeLogo variant="inverse" className="my-page-logo" />
```

Use `variant="inverse"` somente em superfícies escuras; o padrão é
`variant="default"`.

### `PermissionGate`

Protege uma rota ou bloco de interface por tela e ação. É uma camada de UX;
a mesma autorização precisa continuar validada no backend.

```jsx
import { PermissionGate } from "../../components/PermissionGate";

<PermissionGate screen="produtos" action="create">
  <NewProductButton />
</PermissionGate>

<PermissionGate screen="tm_ops" adminOnly>
  <SchedulerManagement />
</PermissionGate>
```

Propriedades: `screen`, `action` (`view`, `create` ou `update`), `adminOnly`
e `children`. Se não houver acesso, o componente redireciona para `/init`.

### Diálogos, projetos e TM Ops

Os diálogos de domínio já existentes devem ser reutilizados em vez de
duplicados: `CardDetailDialog`, `NewProjectDialog`, `MembersDialog`,
`RoutineDialog` e `RoutineLinksDialog`. Eles concentram as regras específicas
de cards, membros, rotinas e vínculos.

No Scheduler, `TaskExecutionMetrics` recebe `task` e `now` para exibir duração,
pausas e distância. `TaskGeolocationMap` recebe `geolocations` e desenha o
percurso. Ambos devem ser usados somente na visualização da tarefa, pois
dependem dos dados reais já registrados pela execução.

### Checklist de uma nova tela

1. Crie a rota atrás de `PermissionGate` e valide a mesma permissão na API.
2. Comece com `PageHeader` e coloque Atualizar/Filtros/Criar em `actions`.
3. Reutilize `DashCard`, `DashboardPanel` e `Table` conforme a necessidade.
4. Use selects remotos (`CollaboratorDropdown` ou `DropdownWS`) em vez de
   carregar listas completas.
5. Exiba pessoas com `UserAvatar` e envie `foto_perfil` do backend.
6. Use tokens do tema e valide claro, escuro, Cyberpunk e Pride.
7. Adicione o listener WebSocket apenas para o domínio da nova tela e limpe-o
   no `useEffect`.

> Esta documentação descreve o contrato atual dos componentes. Quando uma
> prop compartilhada for adicionada ou alterada, atualize esta seção no mesmo
> PR para que ela continue sendo a fonte de consulta do time.

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
