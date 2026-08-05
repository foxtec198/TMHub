import { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { AutoComplete } from "primereact/autocomplete";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Checkbox } from "primereact/checkbox";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import "./routineDialog.css";

const emptyRoutine = (fixedStructure) => ({
  nome: "",
  descricao: "",
  centro_custo_id: fixedStructure?.contract?.id || null,
  local_id: fixedStructure?.location?.id || null,
  colaborador_ids: [],
  executar_apenas_um: false,
  checklist_id: null,
  recorrencia_tipo: "dia",
  intervalo_horas: null,
  estimativa_minutos: 15,
  configuracao: { intervalo_dias: 1 },
  proxima_execucao: null,
});

const flattenLocations = (locations = []) =>
  locations.flatMap((location) => [
    location,
    ...flattenLocations(location.filhos || []),
  ]);

export function RoutineDialog({
  visible,
  onHide,
  onSaved,
  routine: initialRoutine,
  fixedStructure,
}) {
  const [routine, setRoutine] = useState(emptyRoutine(fixedStructure));
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [employeeSuggestions, setEmployeeSuggestions] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [structure, setStructure] = useState([]);
  const [unlinkPrompt, setUnlinkPrompt] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const isEditing = Boolean(initialRoutine?.id);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const loadOptions = async () => {
      try {
        const [{ data: checklistData }, { data: structureData }] = await Promise.all([
          connect.get("/tm-ops/checklists"),
          connect.get("/estrutura"),
        ]);
        if (!active) return;
        setChecklists(checklistData || []);
        setStructure(structureData || []);
      } catch (error) {
        showToast(
          "error",
          "Rotina",
          error.response?.data ||
            "Não foi possível carregar os dados da rotina.",
        );
      }
    };
    const base = initialRoutine
      ? {
          ...emptyRoutine(fixedStructure),
          ...initialRoutine,
          colaborador_ids: initialRoutine.colaborador_ids || (initialRoutine.colaborador_responsavel_id ? [initialRoutine.colaborador_responsavel_id] : []),
          proxima_execucao: initialRoutine.proxima_execucao
            ? new Date(initialRoutine.proxima_execucao)
            : null,
        }
      : emptyRoutine(fixedStructure);
    // Ao abrir, o formulário precisa refletir a rotina/estrutura selecionada.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoutine(base);
    setSelectedEmployees(
      (initialRoutine?.colaboradores || []).map((item) => ({
        ...item,
        label: `${item.matricula} - ${item.nome}`,
      })),
    );
    loadOptions();
    return () => {
      active = false;
    };
  }, [visible, initialRoutine, fixedStructure, showToast]);

  const contracts = useMemo(
    () =>
      structure.flatMap((department) =>
        (department.contratos || []).map((contract) => ({
          label: `${contract.id} - ${contract.contrato}`,
          value: contract.id,
          locais: flattenLocations(contract.locais || []),
        })),
      ),
    [structure],
  );
  const selectedContract = contracts.find(
    (item) => item.value === routine.centro_custo_id,
  );

  const searchEmployees = async ({ query }) => {
    try {
      const { data } = await connect.get("/funcionarios", {
        params: {
          fields: "tm_ops",
          search: String(query || "").trim(),
          page: 1,
          per_page: 20,
        },
      });
      setEmployeeSuggestions(
        (data?.items || []).map((item) => ({
          ...item,
          label: `${item.matricula} - ${item.nome}`,
        })),
      );
    } catch (error) {
      setEmployeeSuggestions([]);
      showToast(
        "error",
        error.response?.status === 403 ? "Sem permissão" : "Colaboradores",
        error.response?.data || "Não foi possível buscar colaboradores.",
      );
    }
  };

  const submit = async (payload) => {
    const response = isEditing
      ? await connect.patch(`/tm-ops/rotinas/${initialRoutine.id}`, payload)
      : await connect.post("/tm-ops/rotinas", payload);
    showToast(
      "success",
      "Rotina",
      isEditing ? "Rotina atualizada." : "Rotina criada com sucesso.",
    );
    onSaved?.(response.data);
    setUnlinkPrompt(false);
    setPendingPayload(null);
    onHide();
  };

  const save = async () => {
    if (
      !routine.nome.trim() ||
      !routine.centro_custo_id ||
      !routine.local_id ||
      !routine.colaborador_ids?.length ||
      !routine.proxima_execucao
    ) {
      showToast(
        "warn",
        "Rotina",
        "Preencha nome, contrato, local, colaboradores e próxima execução.",
      );
      return;
    }
    if (
      routine.recorrencia_tipo === "horas" &&
      !(routine.intervalo_horas > 0)
    ) {
      showToast(
        "warn",
        "Rotina",
        "Informe um intervalo de horas maior que zero.",
      );
      return;
    }
    const payload = {
      ...routine,
      nome: routine.nome.trim(),
      proxima_execucao: routine.proxima_execucao.toISOString(),
    };
    setLoading(true);
    try {
      await submit(payload);
    } catch (error) {
      if (
        isEditing &&
        error.response?.status === 409 &&
        error.response?.data?.code === "ROTINA_VINCULADA"
      ) {
        setPendingPayload(payload);
        setUnlinkPrompt(true);
        return;
      }
      showToast(
        "error",
        "Rotina",
        error.response?.data || "Não foi possível salvar a rotina.",
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmUnlink = async () => {
    if (!pendingPayload) return;
    setLoading(true);
    try {
      await submit({ ...pendingPayload, desvincular_do_pai: true });
    } catch (error) {
      showToast(
        "error",
        "Rotina",
        error.response?.data || "Não foi possível desvincular a rotina.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      header={isEditing ? "Editar rotina" : "Nova rotina"}
      visible={visible}
      onHide={onHide}
      modal
      className="tm-ops-routine-dialog"
    >
      <div className="tm-ops-routine-form">
        {isEditing && initialRoutine.rotina_pai_id && (
          <div className="tm-ops-routine-linked-warning">
            Esta é uma instância vinculada a{" "}
            <strong>
              {initialRoutine.rotina_pai || `#${initialRoutine.rotina_pai_id}`}
            </strong>
            . Alterações exigem desvinculação.
          </div>
        )}
        {fixedStructure && (
          <div className="tm-ops-routine-context">
            <strong>{fixedStructure.location.nome}</strong>
            <span>
              {fixedStructure.contract.id} - {fixedStructure.contract.contrato}
            </span>
          </div>
        )}
        <label className="is-wide">
          Nome
          <InputText
            value={routine.nome}
            autoFocus
            onChange={(event) =>
              setRoutine({ ...routine, nome: event.target.value })
            }
          />
        </label>
        <label>
          Contrato
          <Dropdown
            value={routine.centro_custo_id}
            options={contracts}
            disabled={Boolean(fixedStructure)}
            filter
            placeholder="Selecione"
            onChange={(event) =>
              setRoutine({
                ...routine,
                centro_custo_id: event.value,
                local_id: null,
              })
            }
          />
        </label>
        <label>
          Local
          <Dropdown
            value={routine.local_id}
            options={(selectedContract?.locais || []).map((item) => ({
              label: item.nome,
              value: item.id,
            }))}
            disabled={Boolean(fixedStructure)}
            filter
            placeholder="Selecione"
            onChange={(event) =>
              setRoutine({ ...routine, local_id: event.value })
            }
          />
        </label>
        <label>
          Responsável
          <AutoComplete
            value={selectedEmployees}
            suggestions={employeeSuggestions}
            completeMethod={searchEmployees}
            field="label"
            multiple
            delay={350}
            minLength={0}
            dropdown
            forceSelection
            placeholder="Busque por nome, matrícula ou CPF"
            emptyMessage="Nenhum colaborador ativo encontrado."
            onChange={(event) => {
              const values = Array.isArray(event.value) ? event.value : [];
              setSelectedEmployees(values);
              setRoutine({
                ...routine,
                colaborador_ids: values.map((item) => item.id),
              });
            }}
          />
        </label>
        <label className="tm-ops-routine-exclusive">
          <Checkbox
            inputId="executar-apenas-um"
            checked={Boolean(routine.executar_apenas_um)}
            onChange={(event) => setRoutine({ ...routine, executar_apenas_um: event.checked })}
          />
          <span>
            <strong>Executar apenas por um colaborador</strong>
            <small>O primeiro a iniciar assume a execução exclusiva da tarefa.</small>
          </span>
        </label>
        <label>
          Checklist
          <Dropdown
            value={routine.checklist_id}
            options={checklists.map((item) => ({
              label: item.nome,
              value: item.id,
            }))}
            showClear
            placeholder="Opcional"
            onChange={(event) =>
              setRoutine({ ...routine, checklist_id: event.value })
            }
          />
        </label>
        <label>
          Recorrência
          <Dropdown
            value={routine.recorrencia_tipo}
            options={[
              { label: "Por data", value: "data" },
              { label: "Por dia", value: "dia" },
              { label: "Por horário", value: "horario" },
              { label: "Intervalo de horas", value: "horas" },
            ]}
            onChange={(event) =>
              setRoutine({ ...routine, recorrencia_tipo: event.value })
            }
          />
        </label>
        {routine.recorrencia_tipo === "horas" && (
          <label>
            Intervalo (horas)
            <InputNumber
              value={routine.intervalo_horas}
              min={1}
              onValueChange={(event) =>
                setRoutine({ ...routine, intervalo_horas: event.value })
              }
            />
          </label>
        )}
        {["dia", "diaria", "horario", "semanal"].includes(
          routine.recorrencia_tipo,
        ) && (
          <label>
            Repetir a cada (dias)
            <InputNumber
              value={routine.configuracao?.intervalo_dias || 1}
              min={1}
              onValueChange={(event) =>
                setRoutine({
                  ...routine,
                  configuracao: {
                    ...(routine.configuracao || {}),
                    intervalo_dias: event.value || 1,
                  },
                })
              }
            />
          </label>
        )}
        <label>
          Estimativa (minutos)
          <InputNumber
            value={routine.estimativa_minutos}
            min={1}
            onValueChange={(event) =>
              setRoutine({ ...routine, estimativa_minutos: event.value })
            }
          />
        </label>
        <label>
          Próxima execução
          <Calendar
            value={routine.proxima_execucao}
            onChange={(event) =>
              setRoutine({ ...routine, proxima_execucao: event.value })
            }
            showTime
            hourFormat="24"
            showIcon
          />
        </label>
        <label className="is-wide">
          Descrição
          <InputTextarea
            value={routine.descricao}
            rows={3}
            onChange={(event) =>
              setRoutine({ ...routine, descricao: event.target.value })
            }
          />
        </label>
        <div className="is-wide tm-ops-routine-actions">
          <Button label="Cancelar" severity="secondary" text onClick={onHide} />
          <Button
            label={isEditing ? "Salvar alterações" : "Criar rotina"}
            icon="pi pi-check"
            onClick={save}
          />
        </div>
      </div>
      <Dialog
        header="Desvincular instância da rotina-pai?"
        visible={unlinkPrompt}
        onHide={() => setUnlinkPrompt(false)}
        modal
        className="tm-ops-routine-unlink-dialog"
      >
        <p>
          Ao salvar esta alteração, esta instância deixará de receber mudanças
          da rotina-pai e se tornará uma rotina independente.
        </p>
        <div className="tm-ops-routine-actions">
          <Button
            label="Cancelar"
            severity="secondary"
            text
            onClick={() => setUnlinkPrompt(false)}
          />
          <Button
            label="Desvincular e salvar"
            severity="warning"
            onClick={confirmUnlink}
          />
        </div>
      </Dialog>
    </Dialog>
  );
}
