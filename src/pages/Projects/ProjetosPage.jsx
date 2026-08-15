import { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { AvatarGroup } from 'primereact/avatargroup';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { SplitButton } from 'primereact/splitbutton';
import { createProject, deleteProject, getProjects, getUsers, renameProject, updateProject } from './services/project';
import { createCard, deleteCard, updateCard } from './services/card';
import ProjectsSidebar from '../../components/ProjectsSidebar';
import KanbanBoard from '../../components/KanbanBoard';
import CardDetailDialog from '../../components/CardDetailDialog';
import MembersDialog from '../../components/MembersDialog';
import NewProjectDialog from '../../components/NewProjectDialog';
import ProjectMemberAvatar from '../../components/ProjectMemberAvatar';
import { useToast } from '../../contexts/ToastContext';
import './ProjetosPage.css';

function enrichMembersWithPhotos(project, usersById) {
  const enrich = (member) => {
    const user = usersById.get(member?.id);
    return user?.foto_perfil && !member?.foto_perfil
      ? { ...member, foto_perfil: user.foto_perfil }
      : member;
  };

  return {
    ...project,
    members: (project.members || []).map(enrich),
    cards: Object.fromEntries(Object.entries(project.cards || {}).map(([cardId, card]) => [
      cardId,
      { ...card, members: (card.members || []).map(enrich) },
    ])),
  };
}

function hasSerializedMemberPhoto(projects) {
  return projects.some((project) => [
    ...(project.members || []),
    ...Object.values(project.cards || {}).flatMap((card) => card.members || []),
  ].some((member) => Boolean(member?.foto_perfil)));
}

export function ProjetosPage() {
  // Estado normalizado da tela: projetos carregados, seleção e diálogos abertos.
  const [projetos, setProjetos] = useState([]);
  const [currentUserId] = useState(() => {
    const storedId = Number(localStorage.getItem('current_id'));
    return Number.isInteger(storedId) && storedId > 0 ? storedId : null;
  });
  const [isAdmin] = useState(() => String(localStorage.getItem('role') || '').toUpperCase() === 'ADMIN');
  const [usuarios, setUsuarios] = useState([]);
  const [projetoAtivoId, setProjetoAtivoId] = useState(null);
  const [cardSelecionado, setCardSelecionado] = useState(null);
  const [projetoParaMembrosId, setProjetoParaMembrosId] = useState(null);
  const [novoProjetoAberto, setNovoProjetoAberto] = useState(false);
  const [novoCard, setNovoCard] = useState({ visible: false, titulo: '', colunaId: null });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deletingProject, setDeletingProject] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);
  const { showToast } = useToast();

  const projetoParaMembros = projetoParaMembrosId
    ? projetos.find((p) => p.id === projetoParaMembrosId) || null
    : null;

  // Administradores possuem a visão completa; os demais veem apenas projetos próprios ou compartilhados.
  const meusProjetos = useMemo(
    () => isAdmin
      ? projetos
      : projetos.filter((p) => p.donoId === currentUserId || (p.memberIds || []).includes(currentUserId)),
    [isAdmin, projetos, currentUserId]
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

    const projetoOriginal = projetoAtivo;
    const projetoAtualizado = {
      ...projetoAtivo,
      cards: { ...projetoAtivo.cards, [cardAtualizado.id]: cardAtualizado },
    };
    setProjetos((prev) => prev.map((p) => (p.id === projetoAtualizado.id ? projetoAtualizado : p)));
    try {
      const data = await updateCard(cardAtualizado.id, cardAtualizado);
      setProjetos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      setCardSelecionado(null);
    } catch (error) {
      setProjetos((prev) => prev.map((p) => (p.id === projetoOriginal.id ? projetoOriginal : p)));
      showToast('error', 'Salvar card', error.response?.data || 'Não foi possível salvar as alterações do card.');
      throw error;
    }
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

  const membrosDoProjetoAtivo = projetoAtivo?.members || [];

  async function carregarUsuariosSeNecessario() {
    if (usuarios.length) return;
    const users = await getUsers();
    setUsuarios(users);
  }

  async function abrirMembros(projetoId) {
    try {
      await carregarUsuariosSeNecessario();
      setProjetoParaMembrosId(projetoId);
    } catch {
      showToast('error', 'Membros', 'Não foi possível carregar os usuários.');
    }
  }

  async function abrirNovoProjeto() {
    try {
      await carregarUsuariosSeNecessario();
      setNovoProjetoAberto(true);
    } catch {
      showToast('error', 'Novo projeto', 'Não foi possível carregar os usuários.');
    }
  }

  function abrirNovoCard(colunaId = projetoAtivo?.columns?.[0]?.id) {
    if (!projetoAtivo || !colunaId) return;
    setNovoCard({ visible: true, titulo: '', colunaId });
  }

  async function criarCardNoProjeto() {
    const titulo = novoCard.titulo.trim();
    if (!projetoAtivo || !titulo || !novoCard.colunaId) return;

    setCreatingCard(true);
    try {
      const data = await createCard(projetoAtivo.id, {
        titulo,
        columnId: novoCard.colunaId,
      });
      setProjetos((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setNovoCard({ visible: false, titulo: '', colunaId: null });
      showToast('success', 'Card criado', 'O card foi criado no projeto.');
    } catch (error) {
      showToast('error', 'Criar card', error.response?.data || 'Não foi possível criar o card.');
    } finally {
      setCreatingCard(false);
    }
  }

  const criarCardItems = useMemo(
    () => (projetoAtivo?.columns || []).map((column) => ({
      label: `Criar em ${column.titulo}`,
      icon: 'pi pi-plus',
      command: () => abrirNovoCard(column.id),
    })),
    [projetoAtivo]
  );

  // A lista de usuários pode ser muito grande e só é necessária nos diálogos de membros.
  useEffect(() => {
    let active = true;

    async function loadProjects() {
      const data = await getProjects();
      const users = hasSerializedMemberPhoto(data) ? [] : await getUsers();
      if (!active) return;

      const usersById = new Map(users.map((user) => [user.id, user]));
      setUsuarios(users);
      setProjetos(data.map((project) => enrichMembersWithPhotos(project, usersById)));
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
        title={isAdmin ? 'Todos os projetos' : 'Meus projetos'}
        projetoAtivoId={projetoAtivo?.id}
        currentUserId={currentUserId}
        onSelect={selecionarProjeto}
        onRename={renomearProjeto}
        onOpenMembers={abrirMembros}
        onNovoProjeto={abrirNovoProjeto}
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
            {projetoAtivo && (
              <SplitButton
                label="Criar card"
                icon="pi pi-plus"
                onClick={() => abrirNovoCard()}
                model={criarCardItems}
                disabled={!projetoAtivo.columns?.length}
              />
            )}
            {projetoAtivo && projetoAtivo.donoId === currentUserId && (
              <Button
                icon="pi pi-users"
                label="Membros"
                text
                onClick={() => abrirMembros(projetoAtivo.id)}
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
            onUpdateProjeto={atualizarProjeto}
            onOpenCard={setCardSelecionado}
          />
        ) : (
          <div className="flex flex-column align-items-center justify-content-center flex-1 gap-3 p-5">
            <i className="pi pi-inbox text-4xl text-color-secondary" />
            <p className="text-color-secondary m-0">
              Voce ainda nao tem projetos. Crie o primeiro ao lado.
            </p>
            <Button label="Novo projeto" icon="pi pi-plus" onClick={abrirNovoProjeto} />
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
        onProjectChange={(data) => {
          setProjetos((prev) => prev.map((item) => (item.id === data.id ? data : item)));
          setCardSelecionado((current) => (current ? data.cards?.[current.id] || null : null));
        }}
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

      <Dialog
        header="Criar card"
        visible={novoCard.visible}
        modal
        style={{ width: '28rem', maxWidth: 'calc(100vw - 2rem)' }}
        onHide={() => !creatingCard && setNovoCard({ visible: false, titulo: '', colunaId: null })}
        footer={(
          <div className="flex justify-content-end gap-2">
            <Button label="Cancelar" text disabled={creatingCard} onClick={() => setNovoCard({ visible: false, titulo: '', colunaId: null })} />
            <Button label="Criar card" icon="pi pi-plus" loading={creatingCard} onClick={criarCardNoProjeto} />
          </div>
        )}
      >
        <div className="flex flex-column gap-3">
          <label className="flex flex-column gap-2">
            <span>Título</span>
            <InputText
              autoFocus
              value={novoCard.titulo}
              onChange={(event) => setNovoCard((current) => ({ ...current, titulo: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') criarCardNoProjeto();
              }}
              placeholder="Descreva o card"
            />
          </label>
          <label className="flex flex-column gap-2">
            <span>Coluna</span>
            <Dropdown
              value={novoCard.colunaId}
              options={projetoAtivo?.columns || []}
              optionLabel="titulo"
              optionValue="id"
              onChange={(event) => setNovoCard((current) => ({ ...current, colunaId: event.value }))}
              placeholder="Selecione a coluna"
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
