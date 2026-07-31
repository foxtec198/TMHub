import { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { AvatarGroup } from 'primereact/avatargroup';
import { createProject, deleteProject, getProjects, getUsers, renameProject, updateProject } from './services/project';
import { deleteCard, updateCard } from './services/card';
import ProjectsSidebar from '../../components/ProjectsSidebar';
import KanbanBoard from '../../components/KanbanBoard';
import CardDetailDialog from '../../components/CardDetailDialog';
import MembersDialog from '../../components/MembersDialog';
import NewProjectDialog from '../../components/NewProjectDialog';
import ProjectMemberAvatar from '../../components/ProjectMemberAvatar';
import { useToast } from '../../contexts/ToastContext';
import './ProjetosPage.css';

export function ProjetosPage() {
  // Estado normalizado da tela: projetos carregados, seleção e diálogos abertos.
  const [projetos, setProjetos] = useState([]);
  const [currentUserId] = useState(() => {
    const storedId = Number(localStorage.getItem('current_id'));
    return Number.isInteger(storedId) && storedId > 0 ? storedId : null;
  });
  const [usuarios, setUsuarios] = useState([]);
  const [projetoAtivoId, setProjetoAtivoId] = useState(null);
  const [cardSelecionado, setCardSelecionado] = useState(null);
  const [projetoParaMembrosId, setProjetoParaMembrosId] = useState(null);
  const [novoProjetoAberto, setNovoProjetoAberto] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deletingProject, setDeletingProject] = useState(false);
  const { showToast } = useToast();

  const projetoParaMembros = projetoParaMembrosId
    ? projetos.find((p) => p.id === projetoParaMembrosId) || null
    : null;

  // O usuário enxerga somente projetos dos quais participa.
  const meusProjetos = useMemo(
    () => projetos.filter((p) => (p.memberIds || []).includes(currentUserId)),
    [projetos, currentUserId]
  );

  const projetoAtivo = useMemo(() => {
    if (projetoAtivoId) return meusProjetos.find((p) => p.id === projetoAtivoId) || null;
    return meusProjetos[0] || null;
  }, [meusProjetos, projetoAtivoId]);

  // Atualizações otimistas mantêm o board responsivo enquanto a API persiste.
  async function atualizarProjeto(projetoAtualizado) {
    setProjetos((prev) => prev.map((p) => (p.id === projetoAtualizado.id ? projetoAtualizado : p)));
    const data = await updateProject(projetoAtualizado.id, projetoAtualizado);
    setProjetos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
  }

  async function renomearProjeto(id, novoNome) {
    setProjetos((prev) => prev.map((p) => (p.id === id ? { ...p, nome: novoNome } : p)));
    const data = await renameProject(id, novoNome);
    setProjetos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
  }

  // Inclui ou remove um usuário sem duplicar IDs no vínculo do projeto.
  async function alternarMembro(projetoId, usuarioId) {
    const projeto = projetos.find((p) => p.id === projetoId);
    if (!projeto) return;

    const jaEhMembro = projeto.memberIds.includes(usuarioId);
    const projetoAtualizado = {
      ...projeto,
      memberIds: jaEhMembro
        ? projeto.memberIds.filter((id) => id !== usuarioId)
        : [...projeto.memberIds, usuarioId],
    };

    setProjetos((prev) => prev.map((p) => (p.id === projetoId ? projetoAtualizado : p)));
    const data = await updateProject(projetoId, projetoAtualizado);
    setProjetos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
  }

  async function criarProjeto(novoProjeto) {
    const data = await createProject(novoProjeto);
    setProjetos((prev) => [...prev, data]);
    selecionarProjeto(data.id);
  }

  function selecionarProjeto(id) {
    setProjetoAtivoId(id);

    if (window.matchMedia('(max-width: 768px)').matches) {
      setSidebarOpen(false);
    }
  }

  async function excluirProjeto(projeto) {
    try {
      setDeletingProject(true);
      await deleteProject(projeto.id);
      setProjetos((prev) => prev.filter((item) => item.id !== projeto.id));
      setProjetoAtivoId(null);
      setProjetoParaMembrosId(null);
      showToast('success', 'Projeto excluído', 'O projeto foi excluído com sucesso.');
    } catch (error) {
      showToast(
        'error',
        'Erro ao excluir projeto',
        error.response?.data?.message || error.response?.data || 'Não foi possível excluir o projeto.'
      );
    } finally {
      setDeletingProject(false);
    }
  }

  function confirmarExclusaoProjeto(projeto) {
    confirmDialog({
      header: `Excluir ${projeto.nome}`,
      message: 'Todas as colunas e cards deste projeto serão excluídos. Deseja continuar?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      defaultFocus: 'reject',
      accept: () => excluirProjeto(projeto),
    });
  }

  // Cards são atualizados no mapa do projeto e depois reconciliados com a API.
  async function salvarCard(cardAtualizado) {
    if (!projetoAtivo) return;

    const projetoAtualizado = {
      ...projetoAtivo,
      cards: { ...projetoAtivo.cards, [cardAtualizado.id]: cardAtualizado },
    };
    setProjetos((prev) => prev.map((p) => (p.id === projetoAtualizado.id ? projetoAtualizado : p)));
    const data = await updateCard(cardAtualizado.id, cardAtualizado);
    setProjetos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    setCardSelecionado(null);
  }

  async function excluirCard(cardId) {
    if (!projetoAtivo) return;

    const cards = { ...projetoAtivo.cards };
    delete cards[cardId];
    const columns = projetoAtivo.columns.map((c) => ({
      ...c,
      cardIds: c.cardIds.filter((id) => id !== cardId),
    }));
    const projetoAtualizado = { ...projetoAtivo, cards, columns };

    setProjetos((prev) => prev.map((p) => (p.id === projetoAtualizado.id ? projetoAtualizado : p)));
    const data = await deleteCard(cardId);
    setProjetos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    setCardSelecionado(null);
  }

  const membrosDoProjetoAtivo = projetoAtivo
    ? projetoAtivo.memberIds.map((id) => usuarios.find((u) => u.id === id)).filter(Boolean)
    : [];

  // Usuários e projetos são independentes e podem ser carregados em paralelo.
  useEffect(() => {
    let active = true;

    async function loadProjects() {
      const [users, data] = await Promise.all([getUsers(), getProjects()]);
      if (!active) return;

      setUsuarios(users);
      setProjetos(data);
    }

    loadProjects();

    return () => {
      active = false;
    };
  }, []);

  // Orquestra sidebar, board Kanban e diálogos; regras internas ficam nos filhos.
  return (
    <div className={`projetos-page ${sidebarOpen ? 'projetos-page--sidebar-open' : 'projetos-page--sidebar-closed'}`}>
      <ConfirmDialog />
      <ProjectsSidebar
        projetos={meusProjetos}
        projetoAtivoId={projetoAtivo?.id}
        todosUsuarios={usuarios}
        currentUserId={currentUserId}
        onSelect={selecionarProjeto}
        onRename={renomearProjeto}
        onOpenMembers={(id) => setProjetoParaMembrosId(id)}
        onNovoProjeto={() => setNovoProjetoAberto(true)}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="projetos-board-wrapper">
        <div className="projetos-board-wrapper__topo">
          <div className="flex align-items-center gap-3">
            <Button
              icon={sidebarOpen ? 'pi pi-angle-left' : 'pi pi-bars'}
              text
              rounded
              aria-label={sidebarOpen ? 'Recolher projetos' : 'Mostrar projetos'}
              title={sidebarOpen ? 'Recolher projetos' : 'Trocar projeto'}
              onClick={() => setSidebarOpen((open) => !open)}
            />
            <h2 className="m-0 text-xl font-semibold">{projetoAtivo ? projetoAtivo.nome : 'Projetos'}</h2>
            {projetoAtivo && (
              <AvatarGroup>
                {membrosDoProjetoAtivo.map((m) => (
                  <ProjectMemberAvatar
                    key={m.id}
                    member={m}
                  />
                ))}
              </AvatarGroup>
            )}
          </div>

          <div className="flex align-items-center gap-2">
            {projetoAtivo && projetoAtivo.donoId === currentUserId && (
              <Button
                icon="pi pi-users"
                label="Membros"
                text
                onClick={() => setProjetoParaMembrosId(projetoAtivo.id)}
              />
            )}
            {projetoAtivo && projetoAtivo.donoId === currentUserId && (
              <Button
                icon="pi pi-trash"
                label="Excluir"
                severity="danger"
                text
                loading={deletingProject}
                onClick={() => confirmarExclusaoProjeto(projetoAtivo)}
              />
            )}
          </div>
        </div>

        {projetoAtivo ? (
          <KanbanBoard
            projeto={projetoAtivo}
            todosUsuarios={usuarios}
            onUpdateProjeto={atualizarProjeto}
            onOpenCard={setCardSelecionado}
          />
        ) : (
          <div className="flex flex-column align-items-center justify-content-center flex-1 gap-3 p-5">
            <i className="pi pi-inbox text-4xl text-color-secondary" />
            <p className="text-color-secondary m-0">
              Voce ainda nao tem projetos. Crie o primeiro ao lado.
            </p>
            <Button label="Novo projeto" icon="pi pi-plus" onClick={() => setNovoProjetoAberto(true)} />
          </div>
        )}
      </div>

      <CardDetailDialog
        visible={!!cardSelecionado}
        card={cardSelecionado}
        membrosDoProjeto={membrosDoProjetoAtivo}
        onHide={() => setCardSelecionado(null)}
        onSave={salvarCard}
        onDelete={excluirCard}
      />

      <MembersDialog
        visible={!!projetoParaMembros}
        projeto={projetoParaMembros}
        todosUsuarios={usuarios}
        onHide={() => setProjetoParaMembrosId(null)}
        onToggleMember={alternarMembro}
      />

      <NewProjectDialog
        visible={novoProjetoAberto}
        todosUsuarios={usuarios}
        currentUserId={currentUserId}
        onHide={() => setNovoProjetoAberto(false)}
        onCreate={criarProjeto}
      />
    </div>
  );
}
