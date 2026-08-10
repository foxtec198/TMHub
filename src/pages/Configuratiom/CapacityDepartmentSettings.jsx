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
  const [data, setData] = useState({ centros_custo: [], departamentos: [] });
  const [editingCenter, setEditingCenter] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { showToast } = useToast();
  const setLoading = useLoading();

  useEffect(() => {
    connect.get("/centro/configuracoes")
      .then(({ data: response }) => setData({
        centros_custo: Array.isArray(response?.centros_custo) ? response.centros_custo : [],
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
      const changedCenters = new Map(
        (response?.centros_custo || []).map((center) => [center.id, center]),
      );
      const changedDepartments = new Map(
        (response?.departamentos || []).map((department) => [
          department.departamento,
          department,
        ]),
      );

      return {
        centros_custo: current.centros_custo.map((center) => ({
          ...center,
          ...(changedCenters.get(center.id) || {}),
        })),
        departamentos: current.departamentos.map((department) => ({
          ...department,
          ...(changedDepartments.get(department.departamento) || {}),
        })),
      };
    });
  };

  const saveCapacity = async () => {
    if (!editingCenter) return;
    setLoading(true);
    try {
      const { data: response } = await connect.patch("/centro/configuracoes", {
        capacidades: [{
          centro_custo_id: editingCenter.id,
          capacidade_pessoas: capacity,
        }],
      });
      mergeSavedSettings(response);
      setEditingCenter(null);
      showToast("success", "Capacidade atualizada", "O limite planejado do centro de custo foi salvo.");
    } catch (error) {
      showToast("error", "Capacidade", error.response?.data || "Informe uma capacidade válida.");
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

  const centerColumns = [
    { header: "Centro de custo", field: "local", sortable: true },
    { header: "DPTO.", field: "departamento", sortable: true, style: { width: "7rem" } },
    {
      header: "Capacidade planejada",
      body: (center) => center.capacidade_pessoas == null
        ? <span className="capacity-unset">Não definida</span>
        : `${center.capacidade_pessoas} pessoa(s)`,
    },
    {
      header: "Ações",
      style: { width: "6rem" },
      body: (center) => <Button
        icon="pi pi-users"
        rounded
        text
        aria-label={`Definir capacidade de ${center.local}`}
        tooltip="Definir capacidade"
        onClick={() => {
          setEditingCenter(center);
          setCapacity(center.capacidade_pessoas ?? null);
        }}
      />,
    },
  ];

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
      header: "Ativar",
      style: { width: "6rem" },
      body: (department) => <InputSwitch
        checked={department.ativo !== false}
        onChange={(event) => updateDepartment(department.departamento, event.value)}
        aria-label={`Alterar situação do departamento ${department.departamento}`}
      />,
    },
  ];

  return <div className="capacity-settings-layout">
    <article className="settings-card capacity-centers-card">
      <div className="settings-card-title">
        <i className="pi pi-building" />
        <div><h2>Capacidade dos centros de custo</h2><p>Defina quantas pessoas cada contrato pode comportar.</p></div>
      </div>
      <Table data={data.centros_custo} columns={centerColumns} search rows={10} rowsPerPageOptions={[10, 25, 50]} />
    </article>

    <article className="settings-card capacity-departments-card">
      <div className="settings-card-title">
        <i className="pi pi-sitemap" />
        <div><h2>Situação dos departamentos</h2><p>O status ficará disponível para as próximas regras operacionais.</p></div>
      </div>
      <Table data={data.departamentos} columns={departmentColumns} search rows={10} rowsPerPageOptions={[10, 25, 50]} />
      <Button label="Atualizar" icon="pi pi-refresh" text onClick={() => setRefresh((value) => value + 1)} />
    </article>

    <Dialog
      header="Capacidade planejada"
      visible={Boolean(editingCenter)}
      modal
      className="capacity-dialog"
      onHide={() => setEditingCenter(null)}
      footer={<div className="dialog-actions"><Button label="Cancelar" text onClick={() => setEditingCenter(null)} /><Button label="Salvar" icon="pi pi-check" onClick={saveCapacity} /></div>}
    >
      <div className="capacity-form">
        <strong>{editingCenter?.local}</strong>
        <small>DPTO. {editingCenter?.departamento ?? "—"}</small>
        <label htmlFor="center-capacity">Quantidade máxima de pessoas</label>
        <InputNumber
          id="center-capacity"
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
