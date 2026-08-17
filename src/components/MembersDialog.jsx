//React
import React from 'react';
//PrimeReact
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
//Componentes
import ProjectMemberAvatar from './ProjectMemberAvatar';

// Como todo mundo já é do mesmo sistema, "adicionar membro" é só marcar o checkbox:
// o projeto passa a aparecer automaticamente na timeline de projetos daquela pessoa.
// Sem convite, sem e-mail, sem token — é só vínculo direto por ID de usuário.
export default function MembersDialog({ visible, projeto, todosUsuarios, onHide, onToggleMember }) {
  if (!projeto) return null;

  return (
    <Dialog header={`Membros — ${projeto.nome}`} visible={visible} style={{ width: '28rem' }} onHide={onHide}>
      <p className="text-sm text-color-secondary mt-0 mb-3">
        Marque quem deve ter acesso a este projeto. Assim que marcado, o projeto aparece
        na timeline de projetos da pessoa — não precisa convite.
      </p>

      <div className="flex flex-column gap-2">
        {todosUsuarios.map((usuario) => {
          const isDono = usuario.id === projeto.donoId;
          const isMembro = projeto.memberIds.includes(usuario.id);
          return (
            <div key={usuario.id} className="flex align-items-center justify-content-between p-2 border-round surface-100">
              <div className="flex align-items-center gap-2">
                <ProjectMemberAvatar member={usuario} />
                <div>
                  <div className="font-medium">{usuario.nome}</div>
                  {isDono && <div className="text-xs text-color-secondary">Dono do projeto</div>}
                </div>
              </div>
              <Checkbox
                checked={isMembro}
                disabled={isDono}
                onChange={() => onToggleMember(projeto.id, usuario.id)}
              />
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
