// React
import React from 'react';
// PrimeReact
import { AvatarGroup } from 'primereact/avatargroup';
import { Tag } from 'primereact/tag';
// Componentes
import ProjectMemberAvatar from '../../components/ProjectMemberAvatar';

// Exibe o conteúdo e os membros vinculados a um card do quadro.
export default function KanbanCard({ card, membros, onDragStart, onDragEnd, onClick, isDragging }) {
  return (
    <div
      className={`kanban-card ${isDragging ? 'kanban-card--dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, card.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(card)}
    >
      {card.etiqueta && (
        <Tag value={card.etiqueta} className="kanban-card__tag" />
      )}

      <p className="kanban-card__titulo">{card.titulo}</p>

      {card.descricao && (
        <p className="kanban-card__descricao">{card.descricao}</p>
      )}

      {membros.length > 0 && (
        <div className="kanban-card__rodape">
          <AvatarGroup>
            {membros.map((m) => (
              <ProjectMemberAvatar
                key={m.id}
                member={m}
                size="normal"
                style={{ fontSize: '0.75rem' }}
              />
            ))}
          </AvatarGroup>
        </div>
      )}
    </div>
  );
}
