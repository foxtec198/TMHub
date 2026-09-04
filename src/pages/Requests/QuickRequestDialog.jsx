import { AppIcon } from "../../components/icons/AppIcon";
import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import { CostCenterDropdown } from "../../components/CostCenterDropdown";
import connect from "../../utils/request";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";

const REASONS = ["AFASTAMENTO", "ATESTADO", "DECLARAÇÃO", "FÉRIAS", "POSTO VAGO", "REMANEJAMENTO", "INJUSTIFICADA", "OUTROS"];
const initialForm = () => ({ supervisor: null, absent: null, reservation: null, center: null, reason: null, warning: null, obs: "", noCoverage: false, date: new Date() });
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
  const [options, setOptions] = useState({ supervisors: [], reservations: [] });
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [canChooseSupervisor, setCanChooseSupervisor] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [form, setForm] = useState(initialForm);
  const setLoading = useLoading();
  const { showToast } = useToast();

  const selectAbsent = (value, collaborator) => {
    console.log("[selectAbsent] Collaborator:", collaborator);
    const centerId = collaborator?.centro_id ?? null;
    setSelectedCenter(centerId ? {
      id: centerId,
      numero: collaborator?.centro_numero,
      local: collaborator?.centro_local,
      departamento: collaborator?.departamento,
    } : null);
    
    // Se o ausente for uma reserva (floater_id existe), automaticamente preenche reserva e marca sem cobertura
    const isFloater = Boolean(collaborator?.floater_id);
    console.log("[selectAbsent] isFloater:", isFloater, "value:", value);
    setForm((current) => ({
      ...current, 
      absent: value, 
      center: centerId,
      noCoverage: isFloater,
      reservation: isFloater ? value : null
    }));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!visible) setOptionsLoaded(false);
  }, [visible]);

  // Carrega apenas os catálogos pequenos ao abrir o diálogo. Funcionários ficam fora
  // deste lote porque a quantidade de registros tornava a abertura da tela muito lenta.
  useEffect(() => {
    if (!visible || optionsLoaded) return;
    Promise.all([connect.get("/repo/request/solicitante"), connect.get("/reservas", { params: { disponivel: false } })])
      .then(([requester, reservations]) => {
        const requesterData = requester.data || {};
        const supervisorOptions = (requesterData.supervisores || []).map((item) => ({ label: item.nome, value: item.id }));
        const currentSupervisor = requesterData.supervisor?.id || null;
        setCanChooseSupervisor(Boolean(requesterData.pode_selecionar_supervisor));
        setOptions({
        supervisors: supervisorOptions,
        reservations: reservations.data.map((item) => ({ ...item, label: item.nome, value: item.id })),
        });
        setForm((current) => ({ ...current, supervisor: currentSupervisor }));
        console.log("[QuickRequest] Reservations loaded:", reservations.data.length, "items");
        setOptionsLoaded(true);
      })
      .catch(() => showToast("error", "Lançamento rápido", "Não foi possível carregar as opções."));
  }, [visible, optionsLoaded, showToast]);

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
        supervisor_usuario_id: form.supervisor,
        ausente_id: form.absent,
        reserva_id: form.noCoverage ? 0 : form.reservation,
        centro_id: form.center,
        // Diferencia a escolha explícita do usuário de uma reserva ainda não
        // selecionada. Alguns cargos exigem cobertura adicional, mas a tela
        // rápida precisa permitir registrar o posto descoberto.
        sem_cobertura: Boolean(form.noCoverage),
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
      {canChooseSupervisor ? <Dropdown value={form.supervisor} options={options.supervisors} onChange={(e) => setForm({ ...form, supervisor: e.value })} placeholder="Supervisor" filter /> : <div className="quick-request-supervisor">Supervisor autenticado</div>}
      <CollaboratorDropdown
        value={form.absent}
        onChange={selectAbsent}
        queryParams={{ com_local: 1 }}
        placeholder="Colaborador ausente"
        onError={() => showToast("error", "Lançamento rápido", "Não foi possível buscar os colaboradores.")}
      />
      <CostCenterDropdown value={form.center} selectedOption={selectedCenter} onChange={(value, center) => { setSelectedCenter(center); setForm({ ...form, center: value }); }} placeholder="Centro de custo" />
      {!form.noCoverage && <Dropdown value={form.reservation} options={options.reservations} onChange={(e) => setForm({ ...form, reservation: e.value })} placeholder="Reserva" filter itemTemplate={(option) => reservationTemplate(option)} valueTemplate={(option, props) => option ? reservationTemplate(option, true) : <span className="p-placeholder">{props.placeholder}</span>} />}
      <Dropdown value={form.reason} options={REASONS} onChange={(e) => setForm({ ...form, reason: e.value })} placeholder="Motivo" />
      {form.reason === "INJUSTIFICADA" && <Dropdown value={form.warning} options={["Aplicado", "Não Aplicado"]} onChange={(e) => setForm({ ...form, warning: e.value })} placeholder="Advertência" />}
      <InputText value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} placeholder="Observação (opcional)" />
      <Calendar value={form.date} onChange={(e) => e.value && setForm({ ...form, date: e.value })} dateFormat="dd/mm/yy" placeholder="Data da ausência" showIcon readOnlyInput />
      <label className="flex align-items-center gap-2"><Checkbox checked={form.noCoverage} onChange={(e) => setForm({ ...form, noCoverage: e.checked, reservation: e.checked ? null : form.reservation })} />Sem cobertura</label>
      <div className="flex justify-content-end gap-2"><Button type="button" label="Cancelar" text onClick={onHide} /><Button type="submit" label="Criar requisição" icon={<AppIcon name="check" />} /></div>
    </form>
  </Dialog>;
}
