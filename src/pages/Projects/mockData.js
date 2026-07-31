// mockData.js
// Dados fake só pra fazer a tela funcionar sem back. Depois troca por chamadas de API/contexto de auth real.
// A ideia: todo mundo já existe no sistema (mesma base de usuários), então "adicionar membro"
// é só colocar o id dele no memberIds do projeto — sem convite, sem e-mail, nada.

export const MOCK_USERS = [
  { id: 'u1', nome: 'Guilherme Souza', avatarColor: '#7c5cff', iniciais: 'GS' },
  { id: 'u2', nome: 'Marina Alves',    avatarColor: '#22a3a3', iniciais: 'MA' },
  { id: 'u3', nome: 'Pedro Lima',      avatarColor: '#e0763a', iniciais: 'PL' },
  { id: 'u4', nome: 'Carla Nunes',     avatarColor: '#c14b6b', iniciais: 'CN' },
  { id: 'u5', nome: 'Diego Farias',    avatarColor: '#3d78c9', iniciais: 'DF' },
];

// Troque isso pelo usuário logado de verdade (contexto de auth / token).
export const CURRENT_USER_ID = 'u1';

function col(id, titulo, cardIds) {
  return { id, titulo, cardIds };
}

function card(id, titulo, descricao, memberIds = [], etiqueta = null) {
  return { id, titulo, descricao, memberIds, etiqueta };
}

// Projetos "existentes no banco". Cada um tem dono + membros + colunas + cards.
export const MOCK_PROJECTS = [
  {
    id: 'p1',
    nome: 'Loja Centro — Reforma do Balcão',
    donoId: 'u1',
    memberIds: ['u1', 'u2', 'u3'],
    cor: '#7c5cff',
    columns: [
      col('c1', 'A Fazer', ['t1', 't2']),
      col('c2', 'Em Andamento', ['t3']),
      col('c3', 'Concluído', ['t4']),
    ],
    cards: {
      t1: card('t1', 'Cotar vidro do balcão', 'Pedir 3 orçamentos com fornecedores da região', ['u2'], 'Compras'),
      t2: card('t2', 'Definir novo layout de peças', 'Alinhar com o Pedro o espaço de bancada', ['u1', 'u3'], null),
      t3: card('t3', 'Comprar iluminação de vitrine', '', ['u3'], 'Compras'),
      t4: card('t4', 'Aprovar orçamento do vidro', '', ['u1'], 'Financeiro'),
    },
  },
  {
    id: 'p2',
    nome: 'App Interno — Módulo de Estoque',
    donoId: 'u2',
    memberIds: ['u1', 'u2', 'u4'],
    cor: '#22a3a3',
    columns: [
      col('c1', 'Backlog', ['t5', 't6']),
      col('c2', 'Em Andamento', []),
      col('c3', 'Concluído', ['t7']),
    ],
    cards: {
      t5: card('t5', 'Modelar tabela de peças', '', ['u1'], null),
      t6: card('t6', 'Tela de entrada de nota fiscal', 'Precisa ler XML da NF-e', ['u4'], 'Dev'),
      t7: card('t7', 'Levantar requisitos com o financeiro', '', ['u2'], null),
    },
  },
  {
    id: 'p3',
    nome: 'Treinamento de Equipe — Q3',
    donoId: 'u3',
    memberIds: ['u3', 'u4', 'u5'],
    cor: '#e0763a',
    columns: [
      col('c1', 'A Fazer', ['t8']),
      col('c2', 'Em Andamento', []),
      col('c3', 'Concluído', []),
    ],
    cards: {
      t8: card('t8', 'Montar apostila de atendimento', '', ['u4'], null),
    },
  },
];
