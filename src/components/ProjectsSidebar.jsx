// components/ProjectsSidebar.jsx
import { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { AvatarGroup } from 'primereact/avatargroup';
import ProjectMemberAvatar from './ProjectMemberAvatar';

function ProjectRow({ projeto, ativo, currentUserId, onSelect, onRename, onOpenMembers }) {
  const [editando, setEditando] = useState(false);
  const [nomeTemp, setNomeTemp] = useState(projeto.nome);

  function confirmar() {
    const valor = nomeTemp.trim();
    if (valor) onRename(projeto.id, valor);
    else setNomeTemp(projeto.nome);
    setEditando(false);
  }

  const membros = projeto.members || [];
  const canManage = projeto.donoId === currentUserId;

  return (
    <div
      className={`projeto-item ${ativo ? 'projeto-item--ativo' : ''}`}
      style={{ '--projeto-cor': projeto.cor }}
    >
      <div className="projeto-item__linha" onClick={() => !editando && onSelect(projeto.id)}>
        <span className="projeto-item__marcador" />
        {editando ? (
          <InputText
            autoFocus
            value={nomeTemp}
            onChange={(e) => setNomeTemp(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmar();
              if (e.key === 'Escape') { setNomeTemp(projeto.nome); setEditando(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="projeto-item__input"
          />
        ) : (
          <span className="projeto-item__nome">{projeto.nome}</span>
        )}
        {canManage && (
          <Button
            icon="pi pi-pencil"
            text
            rounded
            size="small"
            className="projeto-item__editar"
            onClick={(e) => { e.stopPropagation(); setEditando(true); }}
          />
        )}
      </div>

      <div className="projeto-item__rodape" onClick={() => onSelect(projeto.id)}>
        <AvatarGroup>
          {membros.slice(0, 4).map((m) => (
            <ProjectMemberAvatar
              key={m.id}
              member={m}
              size="normal"
              style={{ fontSize: '0.7rem' }}
            />
          ))}
        </AvatarGroup>
        {canManage && (
          <Button
            icon="pi pi-users"
            text
            rounded
            size="small"
            title="Gerenciar membros"
            onClick={(e) => { e.stopPropagation(); onOpenMembers(projeto.id); }}
          />
        )}
      </div>
    </div>
  );
}

export default function ProjectsSidebar({
  projetos,
  title = 'Meus projetos',
  projetoAtivoId,
  currentUserId,
  onSelect,
  onRename,
  onOpenMembers,
  onNovoProjeto,
  onClose,
}) {
  return (
    <div className="projetos-sidebar">
      <div className="projetos-sidebar__header">
        <span>{title}</span>
        <div className="flex align-items-center gap-1">
          <Button icon="pi pi-plus" rounded text size="small" onClick={onNovoProjeto} title="Novo projeto" />
          <Button
            icon="pi pi-times"
            rounded
            text
            size="small"
            className="projetos-sidebar__fechar"
            onClick={onClose}
            title="Recolher projetos"
          />
        </div>
      </div>

      <div className="projetos-sidebar__lista">
        {projetos.length === 0 && (
          <p className="text-sm text-color-secondary p-2">
            Você ainda não faz parte de nenhum projeto.
          </p>
        )}
        {projetos.map((projeto) => (
          <ProjectRow
            key={projeto.id}
            projeto={projeto}
            ativo={projeto.id === projetoAtivoId}
            currentUserId={currentUserId}
            onSelect={onSelect}
            onRename={onRename}
            onOpenMembers={onOpenMembers}
          />
        ))}
      </div>
    </div>
  );
}
