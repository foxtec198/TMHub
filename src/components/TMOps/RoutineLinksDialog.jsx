import { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Dialog } from "primereact/dialog";
import { DataTable } from "../tables/DataTable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import connect from "../../utils/request";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import "./routineDialog.css";

const flattenLocations = (locations = [], parentPath = "") =>
  locations.flatMap((location) => {
    const path = parentPath
      ? `${parentPath} / ${location.nome}`
      : location.nome;
    return [
      { ...location, path },
      ...flattenLocations(location.filhos || [], path),
    ];
  });

export function RoutineLinksDialog({ visible, routine, onHide, onSaved }) {
  const [structure, setStructure] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [linkedInstances, setLinkedInstances] = useState([]);
  const [filter, setFilter] = useState("");
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    if (!visible || !routine?.id) return;
    let active = true;
    Promise.all([
      connect.get("/estrutura"),
      connect.get(`/tm-ops/rotinas/${routine.id}/vinculos`),
    ])
      .then(([{ data: structureData }, { data: linksData }]) => {
        if (!active) return;
        setStructure(structureData || []);
        setLinkedInstances(linksData?.instancias || []);
        setSelectedLocations([]);
        setFilter("");
      })
      .catch((error) =>
        showToast(
          "error",
          "Vincular rotina",
          error.response?.data || "Não foi possível carregar os locais.",
        ),
      );
    return () => {
      active = false;
    };
  }, [routine?.id, showToast, visible]);

  const locations = useMemo(
    () =>
      structure.flatMap((department) =>
        (department.contratos || []).flatMap((contract) =>
          flattenLocations(contract.estrutura || []).map((location) => ({
            id: location.id,
            centro_custo_id: contract.id,
            centro_custo: `${contract.id} - ${contract.contrato}`,
            local: location.path,
          })),
        ),
      ),
    [structure],
  );
  const availableLocations = locations.filter(
    (location) =>
      !(
        location.id === routine?.local_id &&
        location.centro_custo_id === routine?.centro_custo_id
      ) &&
      !linkedInstances.some(
        (instance) =>
          instance.local_id === location.id &&
          instance.centro_custo_id === location.centro_custo_id,
      ),
  );

  const save = async () => {
    const instances = selectedLocations.map((location) => ({
      centro_custo_id: location.centro_custo_id,
      local_id: location.id,
    }));
    if (!instances.length) {
      showToast("warn", "Vincular rotina", "Selecione ao menos um local.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await connect.post(
        `/tm-ops/rotinas/${routine.id}/vinculos`,
        { instancias: instances },
      );
      showToast("success", "Vincular rotina", data.message);
      onSaved?.();
      onHide();
    } catch (error) {
      showToast(
        "error",
        "Vincular rotina",
        error.response?.data || "Não foi possível vincular a rotina.",
      );
    } finally {
      setLoading(false);
    }
  };

  const removeLinkedInstance = (instance) => {
    confirmDialog({
      header: "Remover rotina vinculada",
      message: "A instância será removida e as tarefas ainda em aberto serão canceladas. As tarefas concluídas permanecerão no histórico.",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Remover rotina",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: async () => {
        setLoading(true);
        try {
          const { data } = await connect.delete(
            `/tm-ops/rotinas/${instance.id}`,
          );
          setLinkedInstances((rows) =>
            rows.filter((row) => row.id !== instance.id),
          );
          onSaved?.();
          showToast("success", "Rotina vinculada", data || "Rotina removida.");
        } catch (error) {
          showToast(
            "error",
            "Rotina vinculada",
            error.response?.data || "Não foi possível remover a rotina.",
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <>
      <ConfirmDialog />
      <Dialog
        header="Vincular rotina a outros locais"
        visible={visible}
        onHide={onHide}
        modal
        className="tm-ops-routine-dialog"
      >
        <div className="tm-ops-routine-form">
        <div className="tm-ops-routine-context">
          <strong>{routine?.nome}</strong>
          <span>
            Cada local recebe uma instância própria, sincronizada com esta
            rotina-pai.
          </span>
        </div>
        <div className="tm-ops-links-table is-wide">
          <div className="tm-ops-links-table-toolbar">
            <div>
              <strong>Locais disponíveis na sua filial</strong>
              <span>
                Selecione um, vários ou todos os destinos para gerar as
                instâncias.
              </span>
            </div>
            <div>
              <Button
                label="Selecionar todos"
                icon="pi pi-check-square"
                outlined
                onClick={() => setSelectedLocations(availableLocations)}
              />
              <Button
                label="Limpar"
                icon="pi pi-times"
                text
                onClick={() => setSelectedLocations([])}
              />
            </div>
          </div>
          <span className="p-input-icon-left tm-ops-links-search">
            <i className="pi pi-search" />
            <InputText
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Buscar centro de custo ou local"
            />
          </span>
          <DataTable
            value={availableLocations}
            dataKey="id"
            selection={selectedLocations}
            onSelectionChange={(event) => setSelectedLocations(event.value)}
            metaKeySelection={false}
            paginator
            rows={8}
            globalFilter={filter}
            globalFilterFields={["centro_custo", "local"]}
            size="small"
            stripedRows
            emptyMessage="Nenhum local disponível para vínculo."
          >
            <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
            <Column field="centro_custo" header="Centro de custo" sortable />
            <Column field="local" header="Local" sortable />
          </DataTable>
          <small>{selectedLocations.length} local(is) selecionado(s).</small>
        </div>
        {!!linkedInstances.length && (
          <div className="tm-ops-linked-instances is-wide">
            <strong>Instâncias já vinculadas</strong>
            {linkedInstances.map((instance) => (
              <div key={instance.id}>
                <span>{instance.estrutura || instance.nome}</span>
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  tooltip="Remover rotina vinculada"
                  aria-label={`Remover rotina vinculada de ${
                    instance.estrutura || instance.nome
                  }`}
                  onClick={() => removeLinkedInstance(instance)}
                />
              </div>
            ))}
          </div>
        )}
        <div className="is-wide tm-ops-routine-actions">
          <Button label="Cancelar" severity="secondary" text onClick={onHide} />
          <Button label="Vincular locais" icon="pi pi-link" onClick={save} />
        </div>
        </div>
      </Dialog>
    </>
  );
}
