import { AppIcon } from "./icons/AppIcon";
// components/NewProjectDialog.jsx
import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { Button } from 'primereact/button';
import ProjectMemberAvatar from './ProjectMemberAvatar';

const CORES = ['#7c5cff', '#22a3a3', '#e0763a', '#c14b6b', '#3d78c9', '#2f9e44'];

export default function NewProjectDialog({ visible, todosUsuarios, currentUserId, onHide, onCreate }) {
  const [nome, setNome] = useState('');
  const [memberIds, setMemberIds] = useState([]);

  function resetar() {
    setNome('');
    setMemberIds([]);
  }

  function criar() {
    if (!nome.trim()) return;
    const cor = CORES[Math.floor(Math.random() * CORES.length)];
    onCreate({
      id: `p${Date.now()}`,
      nome: nome.trim(),
      donoId: currentUserId,
      memberIds: Array.from(new Set([currentUserId, ...memberIds])),
      cor,
      columns: [
        { id: `c${Date.now()}-1`, titulo: 'A Fazer', cardIds: [] },
        { id: `c${Date.now()}-2`, titulo: 'Em Andamento', cardIds: [] },
        { id: `c${Date.now()}-3`, titulo: 'Concluído', cardIds: [] },
      ],
      cards: {},
    });
    resetar();
    onHide();
  }

  return (
    <Dialog
      header="Novo projeto"
      visible={visible}
      style={{ width: '28rem' }}
      onHide={() => { resetar(); onHide(); }}
      footer={
        <div>
          <Button label="Cancelar" text onClick={() => { resetar(); onHide(); }} />
          <Button label="Criar projeto" icon={<AppIcon name="check" />} onClick={criar} disabled={!nome.trim()} />
        </div>
      }
    >
      <div className="flex flex-column gap-3">
        <div>
          <label className="block text-sm text-color-secondary mb-1">Nome do projeto</label>
          <InputText
            className="w-full"
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Reforma Loja Centro"
            onKeyDown={(e) => e.key === 'Enter' && criar()}
          />
        </div>

        <div>
          <label className="block text-sm text-color-secondary mb-1">Membros (opcional)</label>
          <MultiSelect
            className="w-full"
            value={memberIds}
            options={todosUsuarios.filter((u) => u.id !== currentUserId)}
            optionLabel="nome"
            optionValue="id"
            display="chip"
            placeholder="Selecione quem participa"
            itemTemplate={(m) => (
              <div className="flex align-items-center gap-2">
                <ProjectMemberAvatar member={m} size="normal" />
                <span>{m.nome}</span>
              </div>
            )}
            onChange={(e) => setMemberIds(e.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}
