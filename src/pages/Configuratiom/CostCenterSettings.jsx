import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { Table } from "../../components/tables/Table";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";

const EMPTY_FORM = {
  empresa_id: null,
  numero: null,
  nome: "",
  capacidade_pessoas: null,
};

export function CostCenterSettings() {
  const [centers, setCenters] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    Promise.all([connect.get("/centro"), connect.get("/centro/empresas")])
      .then(([centerResponse, companyResponse]) => {
        if (!active) return;
        setCenters(Array.isArray(centerResponse.data) ? centerResponse.data : []);
        setCompanies((Array.isArray(companyResponse.data) ? companyResponse.data : [])
          .filter((company) => company.ativa)
          .map((company) => ({ label: company.nome, value: company.id })));
      })
      .catch((error) => {
        if (active) showToast("error", "Centros de custo", error.response?.data || "Não foi possível carregar os centros.");
      });
    return () => { active = false; };
  }, [showToast]);

  const save = async () => {
    setLoading(true);
    try {
      const { data } = await connect.post("/centro", form);
      setCenters((current) => [data.centro, ...current]);
      setVisible(false);
      setForm(EMPTY_FORM);
      showToast("success", "Centro de custo", data.message);
    } catch (error) {
      showToast("error", "Centro de custo", error.response?.data || "Confira os dados informados.");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { header: "Número", field: "numero", sortable: true },
    { header: "Nome / local", field: "local", sortable: true },
    { header: "Empresa", field: "empresa_nome", sortable: true, body: (row) => <Tag value={row.empresa_nome || "SEM EMPRESA"} severity={row.empresa_nome ? "info" : "warning"} /> },
    { header: "Departamento", body: (row) => row.departamento == null ? "—" : `DPTO. ${row.departamento}`, sortable: true },
    { header: "Capacidade", body: (row) => row.capacidade_pessoas == null ? "—" : `${row.capacidade_pessoas} pessoa(s)` },
  ];

  return <div>
    <article className="settings-card">
      <div className="settings-card-title">
        <i className="pi pi-building" />
        <div><h2>Centros de custo</h2><p>Cadastre contratos por empresa e mantenha a capacidade planejada quando necessário.</p></div>
        <Button label="Novo centro" icon="pi pi-plus" onClick={() => setVisible(true)} />
      </div>
      <Table data={centers} columns={columns} search rows={10} rowsPerPageOptions={[10, 25, 50, 100]} />
    </article>

    <Dialog
      header="Novo centro de custo"
      visible={visible}
      modal
      className="capacity-dialog"
      onHide={() => setVisible(false)}
      footer={<div className="dialog-actions"><Button label="Cancelar" text onClick={() => setVisible(false)} /><Button label="Cadastrar" icon="pi pi-check" disabled={!form.empresa_id || !form.numero || !form.nome.trim()} onClick={save} /></div>}
    >
      <div className="capacity-form">
        <label htmlFor="cost-center-company">Empresa *</label>
        <Dropdown id="cost-center-company" value={form.empresa_id} options={companies} filter placeholder="Selecione a empresa" onChange={(event) => setForm({ ...form, empresa_id: event.value })} />
        <label htmlFor="cost-center-number">Número *</label>
        <InputNumber id="cost-center-number" value={form.numero} useGrouping={false} min={1} onValueChange={(event) => setForm({ ...form, numero: event.value })} />
        <label htmlFor="cost-center-name">Nome / local *</label>
        <InputText id="cost-center-name" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex.: Contrato operacional" />
        <label htmlFor="cost-center-capacity">Capacidade (opcional)</label>
        <InputNumber id="cost-center-capacity" value={form.capacidade_pessoas} useGrouping={false} min={0} onValueChange={(event) => setForm({ ...form, capacidade_pessoas: event.value ?? null })} placeholder="Não definida" />
      </div>
    </Dialog>
  </div>;
}
