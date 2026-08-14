import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import connect from "../../utils/request";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";

const REASONS = ["AFASTAMENTO", "ATESTADO", "DECLARAÇÃO", "FÉRIAS", "POSTO VAGO", "REMANEJAMENTO", "INJUSTIFICADA", "OUTROS"];
const initialForm = () => ({ supervisor: null, absent: null, reservation: null, center: null, reason: null, warning: null, obs: "", noCoverage: false, date: new Date() });
const centerLabel = (center) => {
  const local = String(center.local || "").trim();
  const id = String(center.id);
  const identifiedLocal = local === id || local.startsWith(`${id} -`) ? local : `${id} - ${local}`;
  return `${identifiedLocal} - DPTO. ${center.departamento}`;
};

const reservationTemplate = (reservation, selected = false) => {
  if (!reservation) return null;
  return (
    <div className={selected ? "collaborator-dropdown-option is-selected" : "collaborator-dropdown-option"}>
      <strong>{reservation.nome}</strong>
      <small>{[reservation.matricula, reservation.cargo].filter(Boolean).join(" · ") || "Cargo não informado"}</small>
    </div>
  );
};

export function QuickRequestDialog({ visible, onHide, onCreated }) {
  const [options, setOptions] = useState({ supervisors: [], reservations: [], centers: [] });
  const [form, setForm] = useState(initialForm);
  const setLoading = useLoading();
  const { showToast } = useToast();

  const selectAbsent = (value, collaborator) => {
    const centerId = collaborator?.centro_id ?? null;
    if (centerId && !options.centers.some((center) => center.value === centerId)) {
      setOptions((current) => ({
        ...current,
        centers: [...current.centers, {
          label: centerLabel({ id: centerId, local: collaborator.centro_local, departamento: collaborator.departamento }),
          value: centerId,
        }],
      }));
    }
    setForm((current) => ({ ...current, absent: value, center: centerId }));
  };

  // Carrega apenas os catálogos pequenos ao abrir o diálogo. Funcionários ficam fora
  // deste lote porque a quantidade de registros tornava a abertura da tela muito lenta.
  useEffect(() => {
    if (!visible || options.supervisors.length) return;
    Promise.all([connect.get("/supervisores"), connect.get("/reservas"), connect.get("/centro")])
      .then(([supervisors, reservations, centers]) => setOptions({
        supervisors: supervisors.data.map((item) => ({ label: item.nome, value: item.id })),
        reservations: reservations.data.map((item) => ({ ...item, label: item.nome, value: item.id })),
        centers: centers.data.map((item) => ({ label: centerLabel(item), value: item.id })),
      }))
      .catch(() => showToast("error", "Lançamento rápido", "Não foi possível carregar as opções."));
  }, [visible, options.supervisors.length, showToast]);

  // Mirror the full-page request payload so both entry points follow the same API contract.
  const save = async (event) => {
    event.preventDefault();
    if (!form.supervisor || !form.absent || !form.center || !form.reason || (!form.noCoverage && !form.reservation)) {
      return showToast("warn", "Lançamento rápido", "Preencha os campos obrigatórios.");
    }
    // Preserve the current clock time while allowing any absence date in quick creation.
    const date = new Date(form.date);
    const now = new Date();
    date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

    setLoading(true);
    try {
      await connect.post("/repo/request", {
        supervisor_id: form.supervisor,
        ausente_id: form.absent,
        reserva_id: form.noCoverage ? 0 : form.reservation,
        centro_id: form.center,
        motivo: form.reason,
        advertencia: form.warning,
        obs: form.obs,
        data: date,
      });
      showToast("success", "Lançamento rápido", "Requisição criada com sucesso.");
      setForm(initialForm());
      onHide();
      onCreated?.();
    } catch (error) {
      showToast("error", "Lançamento rápido", error.response?.data || "Não foi possível criar a requisição.");
    } finally { setLoading(false); }
  };

  return <Dialog header="Lançamento rápido" visible={visible} modal className="quick-request-dialog" onHide={onHide}>
    <form className="quick-request-form" onSubmit={save}>
      <Dropdown value={form.supervisor} options={options.supervisors} onChange={(e) => setForm({ ...form, supervisor: e.value })} placeholder="Supervisor" filter />
      <CollaboratorDropdown
        value={form.absent}
        onChange={selectAbsent}
        queryParams={{ com_local: 1 }}
        placeholder="Colaborador ausente"
        onError={() => showToast("error", "Lançamento rápido", "Não foi possível buscar os colaboradores.")}
      />
      <Dropdown value={form.center} options={options.centers} onChange={(e) => setForm({ ...form, center: e.value })} placeholder="Centro de custo" filter />
      {!form.noCoverage && <Dropdown value={form.reservation} options={options.reservations} onChange={(e) => setForm({ ...form, reservation: e.value })} placeholder="Reserva" filter itemTemplate={(option) => reservationTemplate(option)} valueTemplate={(option, props) => option ? reservationTemplate(option, true) : <span className="p-placeholder">{props.placeholder}</span>} />}
      <Dropdown value={form.reason} options={REASONS} onChange={(e) => setForm({ ...form, reason: e.value })} placeholder="Motivo" />
      {form.reason === "INJUSTIFICADA" && <Dropdown value={form.warning} options={["Aplicado", "Não Aplicado"]} onChange={(e) => setForm({ ...form, warning: e.value })} placeholder="Advertência" />}
      <InputText value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} placeholder="Observação (opcional)" />
      <Calendar value={form.date} onChange={(e) => e.value && setForm({ ...form, date: e.value })} dateFormat="dd/mm/yy" placeholder="Data da ausência" showIcon readOnlyInput />
      <label className="flex align-items-center gap-2"><Checkbox checked={form.noCoverage} onChange={(e) => setForm({ ...form, noCoverage: e.checked, reservation: e.checked ? null : form.reservation })} />Sem cobertura</label>
      <div className="flex justify-content-end gap-2"><Button type="button" label="Cancelar" text onClick={onHide} /><Button type="submit" label="Criar requisição" icon="pi pi-check" /></div>
    </form>
  </Dialog>;
}
