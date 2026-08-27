import { AppIcon } from "../../components/icons/AppIcon";
import { useCallback, useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputSwitch } from "primereact/inputswitch";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import { DataTable } from "../../components/tables/DataTable";
import { Column } from "primereact/column";
import { PageHeader } from "../../components/PageHeader";
import { RoutineDialog } from "../../components/TMOps/RoutineDialog";
import { RoutineLinksDialog } from "../../components/TMOps/RoutineLinksDialog";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import "./management.css";

const EVIDENCE_OPTIONS = [
  { label: "Código de barras", value: "barcode" },
  { label: "QR Code", value: "qrcode" },
  { label: "Foto pela câmera", value: "camera" },
  { label: "Imagem da galeria", value: "image" },
  { label: "Assinatura", value: "signature" },
];

const normalizeEvidences = (evidences = []) =>
  evidences
    .map((evidence) =>
      typeof evidence === "string"
        ? { tipo: evidence, obrigatoria: true }
        : {
            tipo: evidence?.tipo,
            obrigatoria: Boolean(evidence?.obrigatoria),
          },
    )
    .filter((evidence) => evidence.tipo);

export function TMOpsManagement({ mode = "routines" }) {
  const [routines, setRoutines] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [routineDialog, setRoutineDialog] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [linkingRoutine, setLinkingRoutine] = useState(null);
  const [checklistDialog, setChecklistDialog] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [checklist, setChecklist] = useState({
    nome: "",
    descricao: "",
    itens: [],
  });
  const setLoading = useLoading();
  const { showToast } = useToast();
  const isChecklistScreen = mode === "checklists";

  const load = useCallback(async () => {
    try {
      const requests = isChecklistScreen
        ? [connect.get("/tm-ops/checklists")]
        : [connect.get("/tm-ops/rotinas")];
      const [{ data }] = await Promise.all(requests);
      if (isChecklistScreen) setChecklists(data || []);
      else setRoutines(data || []);
    } catch (error) {
      showToast(
        "error",
        "TM Ops",
        error.response?.data || "Não foi possível carregar os dados.",
      );
    }
  }, [isChecklistScreen, showToast]);
  // Mantém cada rota do TM Ops sincronizada sem misturar os dois cadastros.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const saveChecklist = async () => {
    if (!checklist.nome.trim()) {
      showToast("warn", "Checklist", "Informe o nome.");
      return;
    }
    setLoading(true);
    try {
      if (editingChecklistId)
        await connect.patch(
          `/tm-ops/checklists/${editingChecklistId}`,
          checklist,
        );
      else await connect.post("/tm-ops/checklists", checklist);
      setChecklistDialog(false);
      setChecklist({ nome: "", descricao: "", itens: [] });
      setEditingChecklistId(null);
      await load();
      showToast(
        "success",
        "Checklist",
        editingChecklistId
          ? "Checklist atualizado."
          : "Checklist criado com sucesso.",
      );
    } catch (error) {
      showToast(
        "error",
        "Checklist",
        error.response?.data || "Não foi possível salvar o checklist.",
      );
    } finally {
      setLoading(false);
    }
  };
  const toggleRoutine = async (row) => {
    try {
      await connect.patch(`/tm-ops/rotinas/${row.id}`, {
        ativa: !row.ativa,
      });
      await load();
    } catch (error) {
      showToast(
        "error",
        "Rotina",
        error.response?.data || "Não foi possível alterar o status.",
      );
    }
  };
  const deleteRoutine = async (row) => {
    try {
      await connect.delete(`/tm-ops/rotinas/${row.id}`);
      await load();
      showToast("success", "Rotina", "Rotina excluída.");
    } catch (error) {
      showToast(
        "error",
        "Rotina",
        error.response?.data || "Não foi possível excluir.",
      );
    }
  };
  const editChecklist = (row) => {
    setChecklist({
      nome: row.nome,
      descricao: row.descricao || "",
      itens: row.itens || [],
    });
    setEditingChecklistId(row.id);
    setChecklistDialog(true);
  };
  const deleteChecklist = async (row) => {
    try {
      await connect.delete(`/tm-ops/checklists/${row.id}`);
      await load();
      showToast("success", "Checklist", "Checklist excluído.");
    } catch (error) {
      showToast(
        "error",
        "Checklist",
        error.response?.data || "Não foi possível excluir.",
      );
    }
  };
  const addItem = () =>
    setChecklist((current) => ({
      ...current,
      itens: [
        ...current.itens,
        { pergunta: "", tipo_resposta: "texto", obrigatorio: false },
      ],
    }));
  const updateItem = (index, patch) =>
    setChecklist((current) => ({
      ...current,
      itens: current.itens.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  const updateEvidenceTypes = (itemIndex, types) => {
    const current = normalizeEvidences(checklist.itens[itemIndex]?.evidencias);
    updateItem(itemIndex, {
      evidencias: types.map(
        (tipo) =>
          current.find((evidence) => evidence.tipo === tipo) || {
            tipo,
            obrigatoria: true,
          },
      ),
    });
  };
  const updateEvidenceRequired = (itemIndex, type, required) =>
    updateItem(itemIndex, {
      evidencias: normalizeEvidences(
        checklist.itens[itemIndex]?.evidencias,
      ).map((evidence) =>
        evidence.tipo === type
          ? { ...evidence, obrigatoria: required }
          : evidence,
      ),
    });

  const title = isChecklistScreen ? "Checklists" : "Rotinas";
  const description = isChecklistScreen
    ? "Monte e mantenha os checklists que serão usados nas tarefas do TM Ops."
    : "Programe tarefas recorrentes vinculadas aos contratos e locais da estrutura.";

  return (
    <main className="tm-ops-management">
      <PageHeader
        section="TM Ops"
        title={title}
        description={description}
        actions={
          <Button
            icon={<AppIcon name="refresh" />}
            outlined
            aria-label="Atualizar"
            tooltip="Atualizar"
            onClick={load}
          />
        }
      />
      <section className="tm-ops-content-card">
        <div className="tm-ops-toolbar">
          <div>
            <span className="tm-ops-section-kicker">
              {isChecklistScreen
                ? "Biblioteca de execução"
                : "Planejamento operacional"}
            </span>
            <h2>
              {isChecklistScreen
                ? "Checklists cadastrados"
                : "Rotinas cadastradas"}
            </h2>
          </div>
          <Button
            label={isChecklistScreen ? "Novo checklist" : "Nova rotina"}
            icon={<AppIcon name="plus" />}
            onClick={() => {
              if (isChecklistScreen) {
                setEditingChecklistId(null);
                setChecklist({ nome: "", descricao: "", itens: [] });
                setChecklistDialog(true);
              } else {
                setEditingRoutine(null);
                setRoutineDialog(true);
              }
            }}
          />
        </div>
        {!isChecklistScreen ? (
          <DataTable
            value={routines}
            paginator
            rows={10}
            emptyMessage="Nenhuma rotina cadastrada."
            responsiveLayout="scroll"
            className="tm-ops-table"
          >
            <Column field="nome" header="Nome" sortable />
            <Column field="colaborador" header="Responsável" />
            <Column field="checklist" header="Checklist" />
            <Column field="estrutura" header="Estrutura" />
            <Column
              header="Origem"
              body={(row) =>
                row.rotina_pai_id
                  ? `Vinculada à #${row.rotina_pai_id}`
                  : "Rotina-pai"
              }
            />
            <Column field="recorrencia_tipo" header="Recorrência" />
            <Column
              header="Próxima execução"
              body={(row) =>
                row.proxima_execucao
                  ? new Date(row.proxima_execucao).toLocaleString("pt-BR")
                  : "—"
              }
            />
            <Column
              header="Status"
              body={(row) => (
                <Tag
                  value={row.ativa ? "ATIVA" : "INATIVA"}
                  severity={row.ativa ? "success" : "danger"}
                />
              )}
            />
            <Column
              header="Ações"
              body={(row) => (
                <div className="tm-ops-row-actions">
                  <Button
                    icon={<AppIcon name="link" />}
                    text
                    rounded
                    tooltip="Vincular a outros locais"
                    onClick={() => setLinkingRoutine(row)}
                  />
                  <Button
                    icon={<AppIcon name="pencil" />}
                    text
                    rounded
                    tooltip="Editar"
                    onClick={() => {
                      setEditingRoutine(row);
                      setRoutineDialog(true);
                    }}
                  />
                  <Button
                    icon={<AppIcon name={row.ativa ? "pause" : "play"} />}
                    text
                    rounded
                    tooltip={row.ativa ? "Desativar" : "Ativar"}
                    onClick={() => toggleRoutine(row)}
                  />
                  <Button
                    icon={<AppIcon name="trash" />}
                    severity="danger"
                    text
                    rounded
                    tooltip="Excluir"
                    onClick={() => deleteRoutine(row)}
                  />
                </div>
              )}
            />
          </DataTable>
        ) : (
          <DataTable
            value={checklists}
            paginator
            rows={10}
            emptyMessage="Nenhum checklist cadastrado."
            responsiveLayout="scroll"
            className="tm-ops-table"
          >
            <Column field="nome" header="Nome" sortable />
            <Column field="descricao" header="Descrição" />
            <Column header="Itens" body={(row) => row.itens?.length || 0} />
            <Column
              header="Ações"
              body={(row) => (
                <div className="tm-ops-row-actions">
                  <Button
                    icon={<AppIcon name="pencil" />}
                    text
                    rounded
                    tooltip="Editar"
                    onClick={() => editChecklist(row)}
                  />
                  <Button
                    icon={<AppIcon name="trash" />}
                    severity="danger"
                    text
                    rounded
                    tooltip="Excluir"
                    onClick={() => deleteChecklist(row)}
                  />
                </div>
              )}
            />
          </DataTable>
        )}
      </section>
      <RoutineDialog
        visible={routineDialog}
        routine={editingRoutine}
        onHide={() => {
          setRoutineDialog(false);
          setEditingRoutine(null);
        }}
        onSaved={load}
      />
      <RoutineLinksDialog
        visible={Boolean(linkingRoutine)}
        routine={linkingRoutine}
        onHide={() => setLinkingRoutine(null)}
        onSaved={load}
      />
      <Dialog
        header={editingChecklistId ? "Editar checklist" : "Novo checklist"}
        visible={checklistDialog}
        onHide={() => setChecklistDialog(false)}
        modal
        className="tm-ops-checklist-dialog"
      >
        <div className="tm-ops-form-grid">
          <label className="is-wide">
            Nome
            <InputText
              value={checklist.nome}
              onChange={(event) =>
                setChecklist({ ...checklist, nome: event.target.value })
              }
            />
          </label>
          <label className="is-wide">
            Descrição
            <InputTextarea
              value={checklist.descricao}
              rows={2}
              onChange={(event) =>
                setChecklist({ ...checklist, descricao: event.target.value })
              }
            />
          </label>
          <div className="is-wide checklist-items-header">
            <strong>Itens do checklist</strong>
            <Button
              label="Adicionar item"
              icon={<AppIcon name="plus" />}
              outlined
              onClick={addItem}
            />
          </div>
          {checklist.itens.map((item, index) => (
            <div className="checklist-item-editor" key={index}>
              <InputText
                placeholder="Pergunta"
                value={item.pergunta}
                onChange={(event) =>
                  updateItem(index, { pergunta: event.target.value })
                }
              />
              <Dropdown
                value={item.tipo_resposta}
                options={[
                  { label: "Texto", value: "texto" },
                  { label: "Sim/Não", value: "booleano" },
                  { label: "Número", value: "numero" },
                ]}
                onChange={(event) =>
                  updateItem(index, { tipo_resposta: event.value })
                }
              />
              <Button
                icon={<AppIcon name="trash" />}
                severity="danger"
                text
                onClick={() =>
                  setChecklist((current) => ({
                    ...current,
                    itens: current.itens.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }))
                }
              />
              <MultiSelect
                className="checklist-evidence-select"
                value={normalizeEvidences(item.evidencias).map(
                  (evidence) => evidence.tipo,
                )}
                options={EVIDENCE_OPTIONS}
                optionLabel="label"
                optionValue="value"
                display="chip"
                placeholder="Evidências do item"
                onChange={(event) => updateEvidenceTypes(index, event.value)}
              />
              {normalizeEvidences(item.evidencias).map((evidence) => (
                <div
                  className="checklist-evidence-required"
                  key={evidence.tipo}
                >
                  <span>
                    {EVIDENCE_OPTIONS.find(
                      (option) => option.value === evidence.tipo,
                    )?.label || evidence.tipo}
                  </span>
                  <InputSwitch
                    checked={evidence.obrigatoria}
                    onChange={(event) =>
                      updateEvidenceRequired(index, evidence.tipo, event.value)
                    }
                  />
                  <b>{evidence.obrigatoria ? "Obrigatória" : "Opcional"}</b>
                </div>
              ))}
            </div>
          ))}
          <div className="is-wide tm-ops-dialog-actions">
            <Button
              label="Cancelar"
              severity="secondary"
              text
              onClick={() => setChecklistDialog(false)}
            />
            <Button
              label={
                editingChecklistId ? "Salvar alterações" : "Criar checklist"
              }
              icon={<AppIcon name="check" />}
              onClick={saveChecklist}
            />
          </div>
        </div>
      </Dialog>
    </main>
  );
}
