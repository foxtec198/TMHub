/**
 * Mantém no PATCH do board apenas os campos que a API persiste.
 *
 * O projeto carregado pela tela também contém fotos em base64, comentários,
 * anexos e objetos de membros. Esses dados são somente de leitura nesse fluxo
 * e faziam uma simples movimentação de card ultrapassar o limite do Nginx.
 */
export function serializeProjectUpdate(project) {
  const cards = Object.fromEntries(
    Object.entries(project.cards || {}).map(([cardId, card]) => [
      cardId,
      {
        id: card.id,
        titulo: card.titulo,
        descricao: card.descricao || '',
        etiqueta: card.etiqueta ?? null,
        data_inicio: card.data_inicio ?? null,
        data_fim: card.data_fim ?? null,
        memberIds: card.memberIds || [],
      },
    ])
  );

  return {
    id: project.id,
    nome: project.nome,
    cor: project.cor,
    memberIds: project.memberIds || [],
    columns: (project.columns || []).map((column) => ({
      id: column.id,
      titulo: column.titulo,
      cardIds: column.cardIds || [],
    })),
    cards,
  };
}
