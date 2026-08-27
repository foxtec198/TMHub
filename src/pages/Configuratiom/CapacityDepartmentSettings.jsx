import { AppIcon } from "../../components/icons/AppIcon";
import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { Tag } from "primereact/tag";
import { Table } from "../../components/tables/Table";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";

export function CapacityDepartmentSettings() {
  const [data, setData] = useState({ departamentos: [] });
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { showToast } = useToast();
  const setLoading = useLoading();

  useEffect(() => {
    connect.get("/centro/configuracoes")
      .then(({ data: response }) => setData({
        departamentos: Array.isArray(response?.departamentos) ? response.departamentos : [],
      }))
      .catch((error) => showToast(
        "error",
        "Planejamento operacional",
        error.response?.data || "Não foi possível carregar as configurações.",
      ));
  }, [refresh, showToast]);

  const mergeSavedSettings = (response) => {
    setData((current) => {
      const changedDepartments = new Map(
        (response?.departamentos || []).map((department) => [
          department.departamento,
          department,
        ]),
      );

      return {
        departamentos: current.departamentos.map((department) => ({
          ...department,
          ...(changedDepartments.get(department.departamento) || {}),
        })),
      };
    });
  };

  const saveCapacity = async () => {
    if (!editingDepartment) return;
    setLoading(true);
    try {
      const { data: response } = await connect.patch("/centro/configuracoes", {
        capacidades_departamentos: [{
          departamento: editingDepartment.departamento,
          capacidade_pessoas: capacity,
        }],
      });
      mergeSavedSettings(response);
      setEditingDepartment(null);
      showToast("success", "Meta de QL atualizada", "A quantidade esperada do departamento foi salva.");
    } catch (error) {
      showToast("error", "Meta de QL", error.response?.data || "Informe uma capacidade válida.");
    } finally {
      setLoading(false);
    }
  };

  const updateDepartment = async (department, active) => {
    setLoading(true);
    try {
      const { data: response } = await connect.patch("/centro/configuracoes", {
        departamentos: [{ departamento: department, ativo: active }],
      });
      mergeSavedSettings(response);
      showToast("success", "Departamento atualizado", active ? "Departamento ativado." : "Departamento inativado.");
    } catch (error) {
      showToast("error", "Departamento", error.response?.data || "Não foi possível atualizar o departamento.");
    } finally {
      setLoading(false);
    }
  };

  const departmentColumns = [
    { header: "Departamento", body: (department) => `DPTO. ${department.departamento}`, sortable: true },
    {
      header: "Situação",
      body: (department) => <Tag
        value={department.ativo ? "ATIVO" : "INATIVO"}
        severity={department.ativo ? "success" : "secondary"}
      />,
    },
    {
      header: "Meta de QL",
      body: (department) => department.capacidade_pessoas == null
        ? <span className="capacity-unset">Não definida</span>
        : `${department.capacidade_pessoas} pessoa(s)`,
    },
    {
      header: "Trabalhando",
      body: (department) => `${department.colaboradores_cadastrados || 0} pessoa(s)`,
    },
    {
      header: "Ativar",
      style: { width: "6rem" },
      body: (department) => <InputSwitch
        checked={department.ativo !== false}
        onChange={(event) => updateDepartment(department.departamento, event.value)}
        aria-label={`Alterar situação do departamento ${department.departamento}`}
      />,
    },
    {
      header: "Meta",
      style: { width: "5rem" },
      body: (department) => <Button
        icon={<AppIcon name="users" />}
        rounded
        text
        aria-label={`Definir meta do departamento ${department.departamento}`}
        tooltip="Definir meta de QL"
        onClick={() => {
          setEditingDepartment(department);
          setCapacity(department.capacidade_pessoas ?? null);
        }}
      />,
    },
  ];

  return <div>
    <article className="settings-card">
      <div className="settings-card-title">
        <AppIcon name="hierarchy"  />
        <div><h2>Planejamento por departamento</h2><p>Defina a meta de QL e a situação de cada departamento.</p></div>
      </div>
      <Table data={data.departamentos} columns={departmentColumns} search rows={5} rowsPerPageOptions={[5, 10, 25, 50]} />
    </article>

    <Dialog
      header="Meta de QL por departamento"
      visible={Boolean(editingDepartment)}
      modal
      className="capacity-dialog"
      onHide={() => setEditingDepartment(null)}
      footer={<div className="dialog-actions"><Button label="Cancelar" text onClick={() => setEditingDepartment(null)} /><Button label="Salvar" icon={<AppIcon name="check" />} onClick={saveCapacity} /></div>}
    >
      <div className="capacity-form">
        <strong >DPTO. {editingDepartment?.departamento ?? "—"}</strong>
        <small>{editingDepartment?.colaboradores_cadastrados || 0} colaborador(es) trabalhando hoje.</small>
        <label htmlFor="department-capacity">Quantidade esperada de pessoas</label>
        <InputNumber
          id="department-capacity"
          value={capacity}
          onValueChange={(event) => setCapacity(event.value ?? null)}
          useGrouping={false}
          min={0}
          placeholder="Sem limite definido"
        />
        <span>Deixe em branco quando a capacidade ainda não estiver definida.</span>
      </div>
    </Dialog>
  </div>;
}
