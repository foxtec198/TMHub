import { AppIcon } from "../../components/icons/AppIcon";
import { useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";

import connect from "../../utils/request";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";

const emptyNews = {
  eyebrow: "Novidades",
  title: "",
  description: "",
  icon: "speakerphone",
  accent: "#64ea8a",
  image: null,
  link: "",
  order: 0,
  active: true,
};

export function NewsSettings() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();

  const load = async () => {
    try {
      const { data } = await connect.get("/updates/noticias/admin");
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast("error", "Notícias", error.response?.data || "Não foi possível carregar os slides.");
    }
  };

  useEffect(() => {
    connect.get("/updates/noticias/admin")
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch((error) => showToast("error", "Notícias", error.response?.data || "Não foi possível carregar os slides."));
  }, [showToast]);

  const save = async () => {
    if (!editing?.title?.trim() || !editing?.description?.trim()) {
      showToast("warn", "Preencha os dados", "Título e descrição são obrigatórios.");
      return;
    }
    setLoading(true);
    try {
      if (editing.id) await connect.put(`/updates/noticias/${editing.id}`, editing);
      else await connect.post("/updates/noticias", editing);
      showToast("success", "Notícias", editing.id ? "Slide atualizado." : "Slide criado.");
      setEditing(null);
      await load();
    } catch (error) {
      showToast("error", "Não foi possível salvar", error.response?.data || "Confira os dados.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Excluir o slide “${item.title}”?`)) return;
    setLoading(true);
    try {
      await connect.delete(`/updates/noticias/${item.id}`);
      showToast("success", "Notícias", "Slide excluído.");
      await load();
    } catch (error) {
      showToast("error", "Não foi possível excluir", error.response?.data || "Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const selectImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2_500_000) {
      showToast("warn", "Imagem inválida", "Use PNG, JPG ou WEBP de até 2,5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditing((current) => ({ ...current, image: reader.result }));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <section className="news-settings">
      <header className="news-settings-header">
        <div>
          <h2>Notícias do login</h2>
          <p>Gerencie os slides e comunicados exibidos antes do acesso ao TM Hub.</p>
        </div>
        <Button label="Nova notícia" icon={<AppIcon name="plus" />} onClick={() => setEditing({ ...emptyNews, order: items.length + 1 })} />
      </header>

      <div className="news-settings-list">
        {items.length === 0 && (
          <div className="news-empty">
            <AppIcon name="speakerphone"  />
            <strong>Nenhuma notícia personalizada</strong>
            <span>Enquanto isso, o login continuará mostrando os informativos padrão.</span>
          </div>
        )}
        {items.map((item) => (
          <article className={`news-item ${!item.active ? "is-inactive" : ""}`} key={item.id}>
            <div className="news-item-preview" style={{ "--news-accent": item.accent }}>
              {item.image ? <img src={item.image} alt="" /> : <AppIcon icon={item.icon || "speakerphone"} />}
            </div>
            <div className="news-item-copy">
              <span>{item.eyebrow} · ordem {item.order}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
            <span className={`news-state ${item.active ? "is-active" : ""}`}>{item.active ? "Ativa" : "Oculta"}</span>
            <div className="news-item-actions">
              <Button icon={<AppIcon name="pencil" />} rounded text aria-label="Editar" onClick={() => setEditing({ ...item })} />
              <Button icon={<AppIcon name="trash" />} rounded text severity="danger" aria-label="Excluir" onClick={() => remove(item)} />
            </div>
          </article>
        ))}
      </div>

      <Dialog
        header={editing?.id ? "Editar notícia" : "Nova notícia"}
        visible={Boolean(editing)}
        onHide={() => setEditing(null)}
        className="news-dialog"
        footer={(
          <div className="dialog-actions">
            <Button label="Cancelar" text onClick={() => setEditing(null)} />
            <Button label="Salvar notícia" icon={<AppIcon name="check" />} onClick={save} />
          </div>
        )}
      >
        {editing && (
          <div className="news-form">
            <label>Chamada<InputText value={editing.eyebrow} maxLength={120} onChange={(e) => setEditing({ ...editing, eyebrow: e.target.value })} /></label>
            <label>Título<InputText value={editing.title} maxLength={180} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
            <label className="full">Descrição<InputTextarea rows={3} autoResize value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
            <label>Ícone Tabler<InputText value={editing.icon} placeholder="speakerphone" onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></label>
            <label>Cor de destaque<div className="news-color-field"><input type="color" value={editing.accent} onChange={(e) => setEditing({ ...editing, accent: e.target.value })} /><InputText value={editing.accent} onChange={(e) => setEditing({ ...editing, accent: e.target.value })} /></div></label>
            <label>Ordem<InputNumber value={editing.order} min={0} onValueChange={(e) => setEditing({ ...editing, order: e.value ?? 0 })} /></label>
            <label className="news-active">Exibir no login<InputSwitch checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.value })} /></label>
            <label className="full">Link opcional<InputText value={editing.link || ""} placeholder="https://..." onChange={(e) => setEditing({ ...editing, link: e.target.value })} /></label>
            <div className="news-image-field full">
              <div>
                <strong>Arte do slide</strong>
                <small>PNG, JPG ou WEBP de até 2,5 MB. Sem imagem, o TM Hub monta a arte automaticamente.</small>
              </div>
              {editing.image && <img src={editing.image} alt="Prévia da arte" />}
              <div>
                <Button label={editing.image ? "Trocar imagem" : "Selecionar imagem"} icon={<AppIcon name="photo" />} outlined onClick={() => fileRef.current?.click()} />
                {editing.image && <Button label="Remover" icon={<AppIcon name="x" />} text severity="danger" onClick={() => setEditing({ ...editing, image: null })} />}
              </div>
              <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={selectImage} />
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
