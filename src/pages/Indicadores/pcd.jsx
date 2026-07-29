import { useEffect, useMemo, useRef, useState } from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import connect from "../../utils/request";
import { useToast } from "../../contexts/ToastContext";
import { useLoading } from "../../contexts/LoadingContext";
import { can } from "../../utils/permissions";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import "./pcd.css";

const TIPOS_PCD = ["Motora", "Visual", "Auditiva", "Intelectual", "Outras", "Reabilitado"];

function matches(colaborador, search) {
  if (!search) return true;
  const term = search.toLowerCase();
  return (
    colaborador.nome?.toLowerCase().includes(term) ||
    String(colaborador.matricula ?? "").includes(term) ||
    colaborador.cargo?.toLowerCase().includes(term) ||
    colaborador.type_pcd?.toLowerCase().includes(term)
  );
}

export function Pcd() {
  const [tree, setTree] = useState({});
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [manageForm, setManageForm] = useState(null); // { id, nome, matricula, pcd, type_pcd, obs_pcd, isNew }
  const [importOpen, setImportOpen] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const fileInput = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canEdit = can("indicador_pcd", "edit");
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    setLoading(true);
    connect.get("/pcd")
      .then(({ data }) => { setTree(data?.filiais || {}); setTotal(data?.total || 0); })
      .catch((error) => showToast("error", "Indicador PCD", error.response?.data || "Não foi possível carregar os colaboradores PCD."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const filteredTree = useMemo(() => {
    const result = {};
    for (const [filial, departamentos] of Object.entries(tree)) {
      const filialResult = {};
      for (const [departamento, info] of Object.entries(departamentos)) {
        const filtered = info.colaboradores.filter((colaborador) => matches(colaborador, search));
        if (filtered.length) filialResult[departamento] = { supervisor: info.supervisor, colaboradores: filtered };
      }
      if (Object.keys(filialResult).length) result[filial] = filialResult;
    }
    return result;
  }, [tree, search]);

  const summaryByType = useMemo(() => {
    const counts = {};
    for (const departamentos of Object.values(tree)) {
      for (const info of Object.values(departamentos)) {
        for (const colaborador of info.colaboradores) {
          (colaborador.type_pcd || "Não informado").split(",").map((t) => t.trim()).filter(Boolean).forEach((tipo) => {
            counts[tipo] = (counts[tipo] || 0) + 1;
          });
        }
      }
    }
    return counts;
  }, [tree]);

  function openEdit(colaborador) {
    setManageForm({
      id: colaborador.id,
      nome: colaborador.nome,
      matricula: colaborador.matricula,
      pcd: true,
      type_pcd: colaborador.type_pcd || "",
      obs_pcd: colaborador.obs_pcd || "",
      isNew: false,
    });
  }

  function openNew() {
    setManageForm({ id: null, nome: "", matricula: "", pcd: true, type_pcd: "", obs_pcd: "", isNew: true });
  }

  async function saveManage() {
    if (!manageForm?.id) return showToast("warn", "Indicador PCD", "Selecione um colaborador.");
    if (!manageForm.type_pcd) return showToast("warn", "Indicador PCD", "Selecione o tipo de deficiência.");
    setSaving(true);
    try {
      await connect.patch("/pcd", {
        id: manageForm.id,
        pcd: manageForm.pcd,
        type_pcd: manageForm.type_pcd,
        obs_pcd: manageForm.obs_pcd,
      });
      showToast("success", "Indicador PCD", manageForm.pcd ? "Colaborador atualizado." : "Colaborador removido do indicador PCD.");
      setManageForm(null);
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Indicador PCD", error.response?.data || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function removePcd(colaborador) {
    setSaving(true);
    try {
      await connect.patch("/pcd", { id: colaborador.id, pcd: false });
      showToast("success", "Indicador PCD", `${colaborador.nome} removido(a) do indicador PCD.`);
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Indicador PCD", error.response?.data || "Não foi possível remover.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAll() {
    setDeletingAll(true);
    try {
      const { data } = await connect.delete("/pcd/todos");
      showToast("success", "Indicador PCD", data?.message || "Todos os dados de PCD foram excluídos.");
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Indicador PCD", error.response?.data || "Não foi possível excluir os dados.");
    } finally {
      setDeletingAll(false);
    }
  }

  function confirmDeleteAll() {
    confirmDialog({
      header: "Excluir todos os dados de PCD",
      message: "Isso remove a marcação de PCD, o tipo e a observação de todos os colaboradores. Use apenas em caso de erro na importação. Deseja continuar?",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Excluir tudo",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      defaultFocus: "reject",
      accept: deleteAll,
    });
  }

  function closeImport() {
    if (importing) return;
    setSpreadsheet(null);
    if (fileInput.current) fileInput.current.value = "";
    setImportOpen(false);
  }

  async function importSpreadsheet(event) {
    event.preventDefault();
    if (!spreadsheet) return showToast("warn", "Importar planilha", "Selecione um arquivo .xlsx.");

    const payload = new FormData();
    payload.append("file", spreadsheet);
    setImporting(true);
    try {
      const { data } = await connect.post("/pcd/importar", payload, { timeout: 120000 });
      showToast("success", "Importação concluída", data?.message || "Planilha importada.");
      if (data?.nao_encontrados?.length) {
        showToast("warn", "Matrículas não encontradas", `${data.nao_encontrados.length} matrícula(s) da planilha não foram localizadas no cadastro.`);
      }
      closeImport();
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Falha na importação", error.response?.data || "Confira a planilha e tente novamente.");
    } finally {
      setImporting(false);
    }
  }

  return <section className="pcd-page">
    <header className="pcd-header">
      <div className="pcd-title"><span>Indicadores</span><h1>Controle de PCD</h1><p>Colaboradores com deficiência, organizados por filial, departamento e supervisor.</p></div>
      {canEdit && <div className="pcd-header-actions">
        <Button icon="pi pi-upload" label="Importar planilha" outlined onClick={() => setImportOpen(true)} />
        <Button icon="pi pi-plus" label="Marcar colaborador como PCD" onClick={openNew} />
        <Button icon="pi pi-refresh" label="Atualizar" outlined onClick={() => setRefresh((value) => value + 1)} />
        {isAdmin && <Button icon="pi pi-trash" label="Excluir todos os dados" severity="danger" outlined loading={deletingAll} onClick={confirmDeleteAll} />}
      </div>}
    </header>

    <div className="pcd-summary">
      <article className="pcd-summary-card"><i className="pi pi-users" /><div><small>Total PCD</small><strong>{total}</strong></div></article>
      {Object.entries(summaryByType).map(([tipo, count]) => (
        <article className="pcd-summary-card" key={tipo}><i className="pi pi-tag" /><div><small>{tipo}</small><strong>{count}</strong></div></article>
      ))}
    </div>

    <div className="pcd-panel">
      <div className="pcd-filters">
        <span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, matrícula, cargo ou tipo" /></span>
      </div>

      {Object.keys(filteredTree).length === 0 && <p className="pcd-empty">Nenhum colaborador PCD encontrado.</p>}

      <Accordion multiple>
        {Object.entries(filteredTree).map(([filial, departamentos]) => {
          const filialTotal = Object.values(departamentos).reduce((sum, info) => sum + info.colaboradores.length, 0);
          return (
            <AccordionTab key={filial} header={<span className="pcd-tab-header">{filial} <Tag value={filialTotal} rounded /></span>}>
              <Accordion multiple className="pcd-subaccordion">
                {Object.entries(departamentos).map(([departamento, info]) => (
                  <AccordionTab key={departamento} header={
                    <span className="pcd-tab-header pcd-tab-header-split">
                      <span className="pcd-tab-header-left">{departamento} <Tag value={info.colaboradores.length} rounded /></span>
                      <span className="pcd-tab-header-supervisor"><i className="pi pi-user" /> {info.supervisor}</span>
                    </span>
                  }>
                    <ul className="pcd-employee-list">
                      {info.colaboradores.map((colaborador) => (
                        <li key={colaborador.id} className="pcd-employee">
                          <div className="pcd-employee-info">
                            <span className="pcd-employee-name">{colaborador.nome}</span>
                            <span className="pcd-employee-subtitle">Matrícula {colaborador.matricula} • {colaborador.cargo || "Sem cargo"}</span>
                          </div>
                          <div className="pcd-employee-meta">
                            {colaborador.type_pcd && <Tag className="pcd-employee-tipo" value={colaborador.type_pcd} />}
                            {colaborador.obs_pcd && <span className="pcd-employee-obs">{colaborador.obs_pcd}</span>}
                          </div>
                          {canEdit && <div className="pcd-employee-actions">
                            <Button icon="pi pi-pencil" rounded text aria-label={`Editar ${colaborador.nome}`} onClick={() => openEdit(colaborador)} />
                            <Button icon="pi pi-times" rounded text severity="danger" aria-label={`Remover PCD de ${colaborador.nome}`} onClick={() => removePcd(colaborador)} />
                          </div>}
                        </li>
                      ))}
                    </ul>
                  </AccordionTab>
                ))}
              </Accordion>
            </AccordionTab>
          );
        })}
      </Accordion>
    </div>

    <Dialog header={manageForm?.isNew ? "Marcar colaborador como PCD" : `Editar PCD · ${manageForm?.nome || ""}`} visible={Boolean(manageForm)} modal className="pcd-dialog" onHide={() => setManageForm(null)}>
      {manageForm && <div className="pcd-form">
        {manageForm.isNew && <div className="pcd-field">
          <label>Colaborador</label>
          <CollaboratorDropdown
            value={manageForm.id}
            selectedOption={manageForm.id ? { id: manageForm.id, nome: manageForm.nome, matricula: manageForm.matricula } : null}
            onChange={(employeeId, employee) => setManageForm((current) => ({
              ...current,
              id: employeeId,
              nome: employee?.nome || "",
              matricula: employee?.matricula || "",
            }))}
            placeholder="Selecione ou pesquise o colaborador"
          />
        </div>}
        {!manageForm.isNew && <div className="pcd-context"><strong>{manageForm.nome}</strong><span>Matrícula {manageForm.matricula}</span></div>}

        <div className="pcd-field">
          <label>Tipo de deficiência</label>
          <Dropdown value={manageForm.type_pcd || null} options={TIPOS_PCD} onChange={(event) => setManageForm({ ...manageForm, type_pcd: event.value })} placeholder="Selecione o tipo" showClear />
        </div>
        <div className="pcd-field">
          <label>Observação</label>
          <InputTextarea value={manageForm.obs_pcd} onChange={(event) => setManageForm({ ...manageForm, obs_pcd: event.target.value })} rows={6} placeholder="Descrição livre da condição, laudo, restrições, etc." />
        </div>

        <div className="pcd-dialog-actions">
          <Button label="Cancelar" text disabled={saving} onClick={() => setManageForm(null)} />
          <Button label="Salvar" icon="pi pi-check" loading={saving} onClick={saveManage} />
        </div>
      </div>}
    </Dialog>

    <Dialog header="Importar planilha de PCD" visible={importOpen} modal className="pcd-import-dialog" closable={!importing} closeOnEscape={!importing} onHide={closeImport}>
      <form className="pcd-import-form" onSubmit={importSpreadsheet}>
        <p>A planilha deve seguir o modelo do relatório "Relação de Empregados - Cadastro" (com a coluna <strong>Matricula</strong>). A matrícula é usada para localizar o colaborador e marcá-lo como PCD.</p>
        <input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importing} onChange={(event) => setSpreadsheet(event.target.files?.[0] || null)} />
        {spreadsheet && <small>Arquivo selecionado: {spreadsheet.name}</small>}
        <div className="pcd-dialog-actions">
          <Button type="button" label="Cancelar" text disabled={importing} onClick={closeImport} />
          <Button type="submit" label={importing ? "Importando..." : "Importar"} icon="pi pi-upload" loading={importing} disabled={!spreadsheet || importing} />
        </div>
      </form>
    </Dialog>
    <ConfirmDialog />
  </section>;
}
