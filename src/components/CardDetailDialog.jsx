// components/CardDetailDialog.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import ProjectMemberAvatar from './ProjectMemberAvatar';
import { createCardComment, deleteCardComment, deleteCardFile, updateCardComment, uploadCardFile } from '../pages/Projects/services/card';

export default function CardDetailDialog({ visible, card, membrosDoProjeto, onHide, onSave, onDelete, onProjectChange }) {
  // O formulário usa cópias locais para não alterar o card antes de Salvar.
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [memberIds, setMemberIds] = useState([]);
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [comentario, setComentario] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingComment, setEditingComment] = useState('');
  const fileInputRef = useRef(null);

  // Trocar o card selecionado reinicializa todos os campos do diálogo.
  useEffect(() => {
    if (card) {
      setTitulo(card.titulo || '');
      setDescricao(card.descricao || '');
      setEtiqueta(card.etiqueta || '');
      setMemberIds(card.memberIds || []);
      setDataInicio(card.data_inicio ? new Date(card.data_inicio) : new Date());
      setDataFim(card.data_fim ? new Date(card.data_fim) : null);
      setComentario('');
      setEditingCommentId(null);
    }
  }, [card]);

  if (!card) return null;

  // Preserva o título anterior quando o campo for enviado vazio.
  async function salvar() {
    setSaving(true);
    try {
      await onSave({
        ...card,
        titulo: titulo.trim() || card.titulo,
        descricao,
        etiqueta: etiqueta.trim() || null,
        memberIds,
        data_inicio: dataInicio?.toISOString(),
        data_fim: dataFim?.toISOString() || null,
      });
    } catch {
      // A página exibe o erro e recompõe o estado otimista do card.
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!comentario.trim()) return;
    setSending(true);
    try {
      onProjectChange?.(await createCardComment(card.id, comentario.trim()));
      setComentario('');
    } finally { setSending(false); }
  }

  async function addFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSending(true);
    try { onProjectChange?.(await uploadCardFile(card.id, file)); }
    finally { setSending(false); }
  }

  async function removeFile(fileId) {
    setSending(true);
    try { onProjectChange?.(await deleteCardFile(card.id, fileId)); }
    finally { setSending(false); }
  }

  async function removeComment(commentId) {
    setSending(true);
    try { onProjectChange?.(await deleteCardComment(commentId)); }
    finally { setSending(false); }
  }

  async function saveComment(commentId) {
    if (!editingComment.trim()) return;
    setSending(true);
    try {
      onProjectChange?.(await updateCardComment(commentId, editingComment.trim()));
      setEditingCommentId(null);
      setEditingComment('');
    } finally { setSending(false); }
  }

  return (
    <Dialog
      header="Detalhes do card"
      visible={visible}
      style={{ width: '32rem' }}
      onHide={onHide}
      footer={
        <div className="flex justify-content-between">
          <Button label="Excluir card" icon="pi pi-trash" severity="danger" text onClick={() => onDelete(card.id)} />
          <div>
            <Button label="Cancelar" text disabled={saving} onClick={onHide} />
            <Button label="Salvar" icon="pi pi-check" loading={saving} onClick={salvar} />
          </div>
        </div>
      }
    >
      <div className="flex flex-column gap-3">
        <div>
          <label className="block text-sm text-color-secondary mb-1">Título</label>
          <InputText className="w-full" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>

        <div className="grid">
          <label className="col-12 md:col-6 block text-sm text-color-secondary mb-1">Data inicial
            <Calendar className="w-full mt-1" value={dataInicio} onChange={(e) => setDataInicio(e.value)} showIcon showTime hourFormat="24" />
          </label>
          <label className="col-12 md:col-6 block text-sm text-color-secondary mb-1">Data final
            <Calendar className="w-full mt-1" value={dataFim} onChange={(e) => setDataFim(e.value)} showIcon showTime hourFormat="24" />
          </label>
        </div>

        <div>
          <label className="block text-sm text-color-secondary mb-1">Descrição</label>
          <InputTextarea
            className="w-full"
            rows={4}
            autoResize
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Adicione mais detalhes..."
          />
        </div>

        <div className="flex flex-column gap-2">
          <label className="block text-sm text-color-secondary">Arquivos</label>
          <div className="flex flex-wrap gap-2 align-items-center">
            <input ref={fileInputRef} type="file" hidden onChange={addFile} />
            <Button icon="pi pi-paperclip" label="Anexar arquivo" outlined loading={sending} onClick={() => fileInputRef.current?.click()} />
            {(card.arquivos || []).map((file) => (
              <span key={file.id} className="flex align-items-center gap-1 surface-100 border-round px-2 py-1 text-sm">
                <a href={`${import.meta.env.VITE_SERVER || ''}${file.url}`} target="_blank" rel="noreferrer">{file.nome_original}</a>
                <Button icon="pi pi-times" text rounded severity="danger" onClick={() => removeFile(file.id)} aria-label="Excluir arquivo" />
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-column gap-2">
          <label className="block text-sm text-color-secondary">Comentários</label>
          {(card.comentarios || []).map((item) => (
            <div key={item.id} className="surface-100 border-round p-2 text-sm flex justify-content-between gap-2"><span className="flex-1"><strong>{item.autor}</strong><br />{editingCommentId === item.id ? <InputTextarea className="w-full mt-2" value={editingComment} onChange={(event) => setEditingComment(event.target.value)} rows={2} /> : item.conteudo}</span><span className="flex align-items-start">{editingCommentId === item.id ? <><Button icon="pi pi-check" text rounded onClick={() => saveComment(item.id)} aria-label="Salvar comentário" /><Button icon="pi pi-times" text rounded onClick={() => setEditingCommentId(null)} aria-label="Cancelar edição" /></> : <Button icon="pi pi-pencil" text rounded onClick={() => { setEditingCommentId(item.id); setEditingComment(item.conteudo); }} aria-label="Editar comentário" />}<Button icon="pi pi-trash" text rounded severity="danger" onClick={() => removeComment(item.id)} aria-label="Excluir comentário" /></span></div>
          ))}
          <div className="flex gap-2">
            <InputTextarea className="flex-1" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escreva um comentário" />
            <Button icon="pi pi-send" onClick={addComment} loading={sending} aria-label="Enviar comentário" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-color-secondary mb-1">Etiqueta</label>
          <InputText className="w-full" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Ex: Compras, Financeiro..." />
        </div>

        <div>
          <label className="block text-sm text-color-secondary mb-1">Responsáveis</label>
          <MultiSelect
            className="w-full"
            value={memberIds}
            options={membrosDoProjeto}
            optionLabel="nome"
            optionValue="id"
            display="chip"
            placeholder="Selecione os membros"
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
