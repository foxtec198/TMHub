import { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import "./routineDialog.css";

const emptyRoutine = (fixedStructure) => ({
  nome: "",
  descricao: "",
  centro_custo_id: fixedStructure?.contract?.id || null,
  local_id: fixedStructure?.location?.id || null,
  colaborador_responsavel_id: null,
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
  const [employees, setEmployees] = useState([]);
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
        const [
          { data: employeeData },
          { data: checklistData },
          { data: structureData },
        ] = await Promise.all([
          connect.get("/funcionarios", {
            params: { situacao: 1, limit: 50000 },
          }),
          connect.get("/schedular/checklists"),
          connect.get("/estrutura"),
        ]);
        if (!active) return;
        setEmployees(
          (employeeData || []).map((item) => ({
            ...item,
            label: `${item.matricula} - ${item.nome}`,
          })),
        );
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
          proxima_execucao: initialRoutine.proxima_execucao
            ? new Date(initialRoutine.proxima_execucao)
            : null,
        }
      : emptyRoutine(fixedStructure);
    // Ao abrir, o formulário precisa refletir a rotina/estrutura selecionada.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoutine(base);
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

  const submit = async (payload) => {
    const response = isEditing
      ? await connect.patch(`/schedular/rotinas/${initialRoutine.id}`, payload)
      : await connect.post("/schedular/rotinas", payload);
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
      !routine.colaborador_responsavel_id ||
      !routine.proxima_execucao
    ) {
      showToast(
        "warn",
        "Rotina",
        "Preencha nome, contrato, local, responsável e próxima execução.",
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
      className="schedular-routine-dialog"
    >
      <div className="schedular-routine-form">
        {isEditing && initialRoutine.rotina_pai_id && (
          <div className="schedular-routine-linked-warning">
            Esta é uma instância vinculada a{" "}
            <strong>
              {initialRoutine.rotina_pai || `#${initialRoutine.rotina_pai_id}`}
            </strong>
            . Alterações exigem desvinculação.
          </div>
        )}
        {fixedStructure && (
          <div className="schedular-routine-context">
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
          <Dropdown
            value={routine.colaborador_responsavel_id}
            options={employees}
            optionLabel="label"
            optionValue="id"
            filter
            placeholder="Colaborador"
            onChange={(event) =>
              setRoutine({
                ...routine,
                colaborador_responsavel_id: event.value,
              })
            }
          />
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
        <div className="is-wide schedular-routine-actions">
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
        className="schedular-routine-unlink-dialog"
      >
        <p>
          Ao salvar esta alteração, esta instância deixará de receber mudanças
          da rotina-pai e se tornará uma rotina independente.
        </p>
        <div className="schedular-routine-actions">
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
