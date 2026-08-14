// components/KanbanBoard.jsx
import React, { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import KanbanColumn from '../pages/Projects/KanbanColumn';

export default function KanbanBoard({ projeto, onUpdateProjeto, onOpenCard }) {
  // Estados transitórios de drag-and-drop e criação de coluna.
  const [draggingCardId, setDraggingCardId] = useState(null);
  const [draggingColumnId, setDraggingColumnId] = useState(null);
  const [columnDropTarget, setColumnDropTarget] = useState(null);
  const [novaColunaAberta, setNovaColunaAberta] = useState(false);
  const [novaColunaTitulo, setNovaColunaTitulo] = useState('');

  // Converte IDs persistidos nos objetos usados pelos avatares.
  function membrosPorCard(card) {
    return card.members || [];
  }

  function handleDragStart(e, cardId) {
    setDraggingCardId(cardId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setDraggingCardId(null);
  }

  function handleColumnDragStart(e, columnId) {
    e.stopPropagation();
    setDraggingColumnId(columnId);
    setDraggingCardId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `column:${columnId}`);
  }

  function handleColumnDragOver(e, columnId) {
    if (!draggingColumnId || draggingColumnId === columnId) return;
    e.preventDefault();
    e.stopPropagation();
    const bounds = e.currentTarget.getBoundingClientRect();
    const position = e.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after';
    setColumnDropTarget({ id: columnId, position });
  }

  function handleColumnDrop(e, columnId) {
    if (!draggingColumnId || draggingColumnId === columnId) return;
    e.preventDefault();
    e.stopPropagation();

    const columns = [...projeto.columns];
    const sourceIndex = columns.findIndex((column) => column.id === draggingColumnId);
    if (sourceIndex === -1) return;
    const [movedColumn] = columns.splice(sourceIndex, 1);
    let targetIndex = columns.findIndex((column) => column.id === columnId);
    if (targetIndex === -1) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const position = e.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after';
    if (position === 'after') targetIndex += 1;
    columns.splice(targetIndex, 0, movedColumn);

    setDraggingColumnId(null);
    setColumnDropTarget(null);
    onUpdateProjeto({ ...projeto, columns });
  }

  function handleColumnDragEnd() {
    setDraggingColumnId(null);
    setColumnDropTarget(null);
  }

  // Move o card arrastado para a coluna/posição alvo
  function moverCard(colunaDestinoId, index) {
    if (!draggingCardId) return;

    const columns = projeto.columns.map((col) => ({ ...col, cardIds: [...col.cardIds] }));

    // remove o card de onde estava
    let colunaOrigem = null;
    for (const col of columns) {
      const pos = col.cardIds.indexOf(draggingCardId);
      if (pos !== -1) {
        colunaOrigem = col;
        col.cardIds.splice(pos, 1);
        break;
      }
    }
    if (!colunaOrigem) return;

    const colunaDestino = columns.find((c) => c.id === colunaDestinoId);
    if (!colunaDestino) return;

    const indiceFinal = Math.min(index, colunaDestino.cardIds.length);
    colunaDestino.cardIds.splice(indiceFinal, 0, draggingCardId);

    onUpdateProjeto({ ...projeto, columns });
  }

  function handleDropCard(colunaId, index) {
    moverCard(colunaId, index);
  }

  function handleDropOnColumnEnd(colunaId) {
    const coluna = projeto.columns.find((c) => c.id === colunaId);
    moverCard(colunaId, coluna ? coluna.cardIds.length : 0);
  }

  function renomearColuna(colunaId, novoTitulo) {
    const columns = projeto.columns.map((c) => (c.id === colunaId ? { ...c, titulo: novoTitulo } : c));
    onUpdateProjeto({ ...projeto, columns });
  }

  function excluirColuna(colunaId) {
    const columns = projeto.columns.filter((c) => c.id !== colunaId);
    const cards = { ...projeto.cards };
    onUpdateProjeto({ ...projeto, columns, cards });
  }

  function confirmarNovaColuna() {
    const titulo = novaColunaTitulo.trim();
    if (titulo) {
      const novaId = `c${Date.now()}`;
      onUpdateProjeto({
        ...projeto,
        columns: [...projeto.columns, { id: novaId, titulo, cardIds: [] }],
      });
    }
    setNovaColunaTitulo('');
    setNovaColunaAberta(false);
  }

  return (
    <div className="kanban-board">
      {projeto.columns.map((coluna) => (
        <KanbanColumn
          key={coluna.id}
          coluna={coluna}
          cards={coluna.cardIds.map((id) => projeto.cards[id]).filter(Boolean)}
          membrosPorCard={membrosPorCard}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDropCard={handleDropCard}
          onDropOnColumnEnd={handleDropOnColumnEnd}
          draggingCardId={draggingCardId}
          draggingColumnId={draggingColumnId}
          columnDropTarget={columnDropTarget}
          onColumnDragStart={handleColumnDragStart}
          onColumnDragOver={handleColumnDragOver}
          onColumnDrop={handleColumnDrop}
          onColumnDragEnd={handleColumnDragEnd}
          onCardClick={onOpenCard}
          onRenameColumn={renomearColuna}
          onDeleteColumn={excluirColuna}
        />
      ))}

      <div className="kanban-board__nova-coluna">
        {novaColunaAberta ? (
          <div className="kanban-board__nova-coluna-form">
            <InputText
              autoFocus
              placeholder="Título da coluna..."
              value={novaColunaTitulo}
              onChange={(e) => setNovaColunaTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmarNovaColuna();
                if (e.key === 'Escape') { setNovaColunaAberta(false); setNovaColunaTitulo(''); }
              }}
            />
            <div className="kanban-board__nova-coluna-acoes">
              <Button label="Adicionar" size="small" onClick={confirmarNovaColuna} />
              <Button icon="pi pi-times" text size="small" severity="secondary" onClick={() => setNovaColunaAberta(false)} />
            </div>
          </div>
        ) : (
          <Button
            label="Adicionar coluna"
            icon="pi pi-plus"
            text
            onClick={() => setNovaColunaAberta(true)}
          />
        )}
      </div>
    </div>
  );
}
