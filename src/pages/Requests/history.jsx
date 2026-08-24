import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { ButtonGroup } from "primereact/buttongroup";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";
import { Timeline } from "primereact/timeline";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Table } from "../../components/tables/Table";
import { DropdownWS } from "../../components/DropdownWithSearch";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import { PageHeader } from "../../components/PageHeader";
import { UserAvatar } from "../../components/UserAvatar";
import {
    CombinedFiltersProvider,
    CombinedMultiSelect,
    useCombinedFilters,
} from "../../contexts/CombinedFiltersContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import { exportRequestHistoryXlsx } from "../../utils/exportRequestHistoryXlsx";
import { socketio } from "../../utils/socketio";

// Endpoints do fluxo de histórico agrupados para evitar URLs espalhadas.
const HISTORY_API = {
    update: "/repo/history",
    delete: "/repo/history",
};

async function getTimelineByRequestId(requestId) {
    const response = await connect.get("/repo/timeline", {
        params: {
            requisicao_id: requestId,
        },
    });

    return response.data;
}

const REASON_OPTIONS = [
    "AFASTAMENTO",
    "ATESTADO",
    "DECLARAÇÃO",
    "POSTO VAGO",
    "REMANEJAMENTO",
    "INJUSTIFICADA",
    "OUTROS",
];

const NO_REPLACEMENT_OPTION = [
    { id: 0, nome: "SEM COBERTURA" },
];

const COLORS_FOR_STATUS = {
    approved: "var(--green-400)",
    reproved: "var(--red-400)",
    updated: "var(--yellow-200)",
    canceled: "var(--red-800)",
    pending: "var(--yellow-500)",
};

const STATUS_MAP = {
    approved: "APROVADO",
    reproved: "REPROVADO",
    updated: "ATUALIZADO",
    canceled: "CANCELADO",
    pending: "PENDENTE",
};

const HISTORY_FILTER_DEFINITIONS = {
    status: {
        getValue: (record) => record.status || "",
        getLabel: (record) => STATUS_MAP[record.status] || record.status,
    },
    departamento: {
        getValue: (record) => String(record.dpto ?? ""),
        getLabel: (record) => `DPTO. ${record.dpto}`,
    },
    supervisor: {
        getValue: (record) => record.supervisor || "",
        getLabel: (record) => record.supervisor,
    },
    motivo: {
        getValue: (record) => record.motivo || "",
        getLabel: (record) => record.motivo,
    },
    local: {
        getValue: (record) => record.local || "",
        getLabel: (record) => record.local,
    },
    ausente: {
        getValue: (record) => record.ausente || "",
        getLabel: (record) => record.ausente,
    },
    reserva: {
        getValue: (record) => record.reserva || "",
        getLabel: (record) => record.reserva,
    },
};

function currentMonthRange() {
    const now = new Date();
    return [
        new Date(now.getFullYear(), now.getMonth(), 1),
        new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    ];
}

function formatDate(value) {
    // Datas inválidas são exibidas como fallback em vez de quebrar a tabela.
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatFilterDate(value) {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
}

function shortName(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 2) return parts.join(" ") || "Usuário";
    return `${parts[0]} ${parts.at(-1)}`;
}

function HistoryPage() {
    // Estado da consulta, edição, timeline e feedback de operações assíncronas.
    const [dateFilter, setDateFilter] = useState(currentMonthRange);
    const [tableData, setTableData] = useState([]);
    const [search, setSearch] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [timelineDialogVisible, setTimelineDialogVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [timelineEvents, setTimelineEvents] = useState([]);
    const filterPanel = useRef(null);
    const [editForm, setEditForm] = useState({
        ausente_id: null,
        reserva_id: null,
        motivo: null,
    });

    const { showToast } = useToast();
    const {
        options: filterOptions,
        clearFilters: clearCombinedFilters,
        filteredData: combinedFilteredHistory,
        activeFilterCount,
    } = useCombinedFilters(tableData);

    const filteredHistory = useMemo(() => {
        const term = search.trim().toLocaleLowerCase("pt-BR");
        if (!term) return combinedFilteredHistory;

        return combinedFilteredHistory.filter((record) => [
            record.ausente,
            record.reserva,
            record.local,
            record.supervisor,
            record.motivo,
            record.obs,
            record.dpto,
        ].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term)));
    }, [combinedFilteredHistory, search]);

    const clearFilters = () => {
        clearCombinedFilters();
        setDateFilter(currentMonthRange());
        setSearch("");
    };

    const exportHistory = () => {
        if (!filteredHistory.length) {
            showToast("warn", "Exportação", "Não há registros para exportar com os filtros atuais.");
            return;
        }
        exportRequestHistoryXlsx(filteredHistory);
        showToast("success", "Exportação concluída", "A planilha foi baixada com os filtros aplicados.");
    };

    // Carrega o histórico de acordo com a data selecionada.
    useEffect(() => {
        async function getHistory() {
            try {
                const init = formatFilterDate(dateFilter?.[0]);
                const end = formatFilterDate(dateFilter?.[1]);
                const filterData = init
                    ? { init, ...(end ? { end } : {}) }
                    : {};
                const response = await connect.post("/repo/history", filterData);
                const data = response.data.map((item) => ({
                    ...item,
                    newStatus: STATUS_MAP[item.status] ?? "DESCONHECIDO",
                    newAbertura: formatDate(item.abertura),
                    newFechamento: formatDate(item.fechamento),
                }));

                setTableData(data);
            } catch (error) {
                showToast(
                    "error",
                    "Erro ao carregar histórico",
                    error.response?.data?.message || error.response?.data || "Não foi possível carregar o histórico."
                );
            }
        }

        getHistory();
    }, [dateFilter, refresh, showToast]);

    // Atualiza o formulário somente quando uma requisição válida é selecionada.
    useEffect(() => {
        const refreshHistory = () => {
            setRefresh((current) => current + 1);
        };

        socketio.on("new_request", refreshHistory);
        socketio.on("new_history", refreshHistory);

        return () => {
            socketio.off("new_request", refreshHistory);
            socketio.off("new_history", refreshHistory);
        };
    }, []);

    function openEditDialog(row) {
        setSelectedRequest(row);
        setEditForm({
            ausente_id: null,
            reserva_id: null,
            motivo: row.motivo || null,
        });
        setEditDialogVisible(true);
    }

    async function submitEdit(event) {
        event.preventDefault();
        if (!selectedRequest) return;

        const payload = {};

        if (editForm.ausente_id !== null) {
            payload.ausente_id = editForm.ausente_id;
        }

        if (editForm.reserva_id !== null) {
            payload.reserva_id = editForm.reserva_id;
        }

        if (editForm.motivo && editForm.motivo !== selectedRequest.motivo) {
            payload.motivo = editForm.motivo;
        }

        if (!Object.keys(payload).length) {
            showToast("warn", "Nenhuma alteração", "Selecione ao menos um novo valor.");
            return;
        }

        try {
            setSaving(true);
            await connect.patch(HISTORY_API.update, {
                id: selectedRequest.id,
                ...payload,
            });
            showToast("success", "Requisição atualizada", "As alterações foram salvas com sucesso.");
            setEditDialogVisible(false);
            setRefresh((current) => current + 1);
        } catch (error) {
            showToast(
                "error",
                "Erro ao editar requisição",
                error.response?.data?.message || error.response?.data || "Não foi possível salvar as alterações."
            );
        } finally {
            setSaving(false);
        }
    }

    async function openTimelineDialog(row) {
        setSelectedRequest(row);
        setTimelineEvents([]);
        setTimelineDialogVisible(true);

        if (!row.requisicao_id) {
            setTimelineLoading(false);
            return;
        }

        try {
            setTimelineLoading(true);
            const response = await getTimelineByRequestId(row.requisicao_id);
            const events = Array.isArray(response)
                ? response
                : response?.timeline || [];

            setTimelineEvents(events);
        } catch (error) {
            showToast(
                "error",
                "Erro ao carregar timeline",
                error.response?.data?.message || error.response?.data || "Não foi possível carregar a timeline."
            );
        } finally {
            setTimelineLoading(false);
        }
    }

    async function deleteHistory(row) {
        try {
            setDeletingId(row.id);
            await connect.delete(HISTORY_API.delete, {
                data: { id: row.id },
            });
            showToast("success", "Histórico excluído", "O histórico foi excluído com sucesso.");
            setRefresh((current) => current + 1);
        } catch (error) {
            showToast(
                "error",
                "Erro ao excluir histórico",
                error.response?.data?.message || error.response?.data || "Não foi possível excluir o histórico."
            );
        } finally {
            setDeletingId(null);
        }
    }

    function confirmHistoryDeletion(row) {
        confirmDialog({
            header: `Excluir histórico #${row.id}`,
            message: "Essa ação também pode excluir a requisição e a timeline vinculadas. Deseja continuar?",
            icon: "pi pi-exclamation-triangle",
            acceptLabel: "Excluir",
            rejectLabel: "Cancelar",
            acceptClassName: "p-button-danger",
            defaultFocus: "reject",
            accept: () => deleteHistory(row),
        });
    }

    const timelineActor = (event) => {
        if (event.criado_por_usuario) {
            return { label: "Criado por", name: event.criado_por_usuario, id: event.criado_por_usuario_id, photo: event.criado_por_usuario_foto };
        }
        if (event.alterado_por) {
            return { label: "Alterado por", name: event.alterado_por, id: event.alterado_por_usuario_id, photo: event.alterado_por_foto };
        }
        if (event.criado_por) return { label: "Criado por", name: event.criado_por };
        if (event.supervisor) return { label: "Supervisor", name: event.supervisor };
        return null;
    };

    const timelineContent = (event) => {
        const actor = timelineActor(event);
        return (
        <div className="flex flex-column gap-1 pb-3">
            <span className="font-bold">
                {event.title || event.action || event.evento || event.tipo || STATUS_MAP[event.status] || "Atualização"}
            </span>
            {event.description || event.message || event.obs
                ? <span>{event.description || event.message || event.obs}</span>
                : null}
            {actor ? <div className="flex align-items-center gap-2 mt-1">
                <UserAvatar
                    userId={actor.id}
                    nome={actor.name}
                    foto_perfil={actor.photo}
                    style={{ width: "1.65rem", height: "1.65rem", fontSize: ".62rem" }}
                />
                <small className="text-600">{actor.label}: {shortName(actor.name)}</small>
            </div> : null}
        </div>
        );
    };

    const timelineOpposite = (event) => (
        <small className="text-600">
            {formatDate(event.created_at || event.timestamp || event.data_hora || event.data)}
        </small>
    );

    const columns = [
        {
            header: "Abertura",
            field: "newAbertura",
            body: (row) => <span className="text-truncate">{row.newAbertura}</span>,
        },
        {
            header: "Ausente",
            field: "ausente",
            sortable: true,
            body: (row) => <span className="text-truncate">{row.ausente}</span>,
        },
        {
            header: "Reserva",
            field: "reserva",
            sortable: true,
            body: (row) => (
                <span className="text-truncate" style={{ color: row.reserva === "SEM COBERTURA" ? "var(--red-700)" : null }}>
                    {row.reserva}
                </span>
            ),
        },
        {
            header: "Local",
            field: "local",
            body: (row) => <span className="text-truncate-400">{row.local}</span>,
        },
        {
            header: "Supervisor",
            field: "supervisor",
            body: (row) => <span className="text-truncate">{row.supervisor || "—"}</span>,
        },
        {
            header: "Motivo",
            field: "motivo",
            body: (row) => <span className="text-truncate">{row.motivo || "—"}</span>,
        },
        {
            header: "Dias",
            field: "dias",
            body: (row) => <span>{row.dias || 1}</span>,
        },
        {
            header: "Observações",
            field: "obs",
            body: (row) => {
                return <span className="text-truncate">
                    {row.obs}
                </span>
            } 
        },
        {
            header: "Status",
            field: "newStatus",
            body: (row) =>  <Tag value={row.newStatus} style={{ background: COLORS_FOR_STATUS[row.status?.toLowerCase()] }} rounded/>
        },
        {
            header: "Atualizado",
            field: "newFechamento",
            body: (row) => <span className="text-truncate">{row.newFechamento}</span>,
        },
        {
            header: "Ações",
            body: (row) => (
                <ButtonGroup className="flex justify-content-end align-items-end">
                    <Button
                        type="button"
                        icon="pi pi-pencil"
                        severity="warning"
                        aria-label={`Editar requisição ${row.id}`}
                        title="Editar requisição"
                        onClick={() => openEditDialog(row)}
                    />
                    <Button
                        type="button"
                        icon="pi pi-history"
                        severity="info"
                        aria-label={`Abrir timeline da requisição ${row.requisicao_id || "não vinculada"}`}
                        title="Abrir timeline"
                        onClick={() => openTimelineDialog(row)}
                    />
                    <Button
                        type="button"
                        icon="pi pi-trash"
                        severity="danger"
                        loading={deletingId === row.id}
                        disabled={deletingId !== null}
                        aria-label={`Excluir histórico ${row.id}`}
                        title="Excluir histórico"
                        onClick={() => confirmHistoryDeletion(row)}
                    />
                </ButtonGroup>
            ),
        },
    ];

    // Tela composta por filtro, tabela, edição e trilha de auditoria.
    return (
        <>
            <ConfirmDialog />
            <div className="px-4">
                <PageHeader
                    section="Reposições"
                    title="Histórico"
                    description="Consulte requisições concluídas por período, edite informações e acompanhe cada evento da timeline."
                    actions={<>
                        <Button
                            className="dashboard-filter-trigger"
                            icon="pi pi-filter-fill"
                            label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"}
                            onClick={(event) => filterPanel.current?.toggle(event)}
                        />
                        <Button
                            icon="pi pi-file-excel"
                            label="Exportar XLSX"
                            outlined
                            disabled={!filteredHistory.length}
                            onClick={exportHistory}
                        />
                    </>}
                />
            </div>

            <OverlayPanel ref={filterPanel} className="dashboard-filter-panel">
                <div className="dashboard-filter-title">
                    <div>
                        <strong>Filtrar histórico</strong>
                        <span>Período e opções são combinados para evitar resultados vazios.</span>
                    </div>
                    <Button
                        icon="pi pi-filter-slash"
                        label="Limpar filtros"
                        text
                        onClick={clearFilters}
                    />
                </div>
                <div className="dashboard-filter-grid">
                    <label className="is-wide">
                        <span>Período</span>
                        <Calendar
                            value={dateFilter}
                            onChange={(event) => setDateFilter(event.value)}
                            selectionMode="range"
                            readOnlyInput
                            hideOnRangeSelection
                            showIcon
                            dateFormat="dd/mm/yy"
                        />
                    </label>
                    <CombinedMultiSelect name="status" label="Status" options={filterOptions.status} placeholder="Todos os status" panelClassName="dashboard-filter-dropdown" />
                    <CombinedMultiSelect name="motivo" label="Motivo" options={filterOptions.motivo} placeholder="Todos os motivos" panelClassName="dashboard-filter-dropdown" />
                    <CombinedMultiSelect name="departamento" label="Departamento" options={filterOptions.departamento} placeholder="Todos os departamentos" panelClassName="dashboard-filter-dropdown" />
                    <CombinedMultiSelect name="supervisor" label="Supervisor" options={filterOptions.supervisor} placeholder="Todos os supervisores" panelClassName="dashboard-filter-dropdown" />
                    <CombinedMultiSelect name="local" label="Local / contrato" options={filterOptions.local} placeholder="Todos os locais" className="is-wide" panelClassName="dashboard-filter-dropdown" />
                    <CombinedMultiSelect name="ausente" label="Ausente" options={filterOptions.ausente} placeholder="Todos os ausentes" panelClassName="dashboard-filter-dropdown" />
                    <CombinedMultiSelect name="reserva" label="Reserva" options={filterOptions.reserva} placeholder="Todas as reservas" panelClassName="dashboard-filter-dropdown" />
                </div>
            </OverlayPanel>

            <div className="p-3 ms-3 border-round-xl shadow-6">
                <Table
                    search
                    searchValue={search}
                    onSearchChange={setSearch}
                    data={filteredHistory}
                    columns={columns}
                    rows={10}
                    tableClassName="overflow-scroll"
                />
            </div>

            <Dialog
                header={`Editar requisição #${selectedRequest?.id || ""}`}
                visible={editDialogVisible}
                modal
                style={{ width: "min(32rem, calc(100vw - 2rem))" }}
                onHide={() => !saving && setEditDialogVisible(false)}
            >
                <form className="flex flex-column gap-4 pt-2" onSubmit={submitEdit}>
                    <div className="flex flex-column gap-2">
                        <label className="font-bold">Ausente</label>
                        <small className="text-600">Atual: {selectedRequest?.ausente || "—"}</small>
                        <CollaboratorDropdown
                            value={editForm.ausente_id}
                            onChange={(value) => setEditForm((current) => ({ ...current, ausente_id: value }))}
                            className="w-full"
                            placeholder="Manter o ausente atual"
                        />
                    </div>

                    <div className="flex flex-column gap-2">
                        <label className="font-bold">Reserva</label>
                        <small className="text-600">Atual: {selectedRequest?.reserva || "SEM COBERTURA"}</small>
                        <DropdownWS
                            uri="/reservas"
                            staticOptions={NO_REPLACEMENT_OPTION}
                            value={editForm.reserva_id}
                            onChange={(value) => setEditForm((current) => ({ ...current, reserva_id: value }))}
                            className="w-full"
                            placeholder="Manter a reserva atual"
                        />
                        <small className="text-600">
                            Ao trocar a reserva, o backend reabre o histórico como pendente e atualiza a requisição vinculada.
                        </small>
                    </div>

                    <div className="flex flex-column gap-2">
                        <label className="font-bold" htmlFor="history-reason">Motivo</label>
                        <Dropdown
                            inputId="history-reason"
                            value={editForm.motivo}
                            options={REASON_OPTIONS}
                            onChange={(event) => setEditForm((current) => ({ ...current, motivo: event.value }))}
                            className="w-full"
                            placeholder="Selecione o motivo"
                        />
                    </div>

                    <div className="flex justify-content-end gap-2 pt-2">
                        <Button
                            type="button"
                            label="Cancelar"
                            severity="secondary"
                            outlined
                            disabled={saving}
                            onClick={() => setEditDialogVisible(false)}
                        />
                        <Button
                            type="submit"
                            label="Salvar alterações"
                            icon="pi pi-check"
                            loading={saving}
                        />
                    </div>
                </form>
            </Dialog>

            <Dialog
                header={selectedRequest?.requisicao_id
                    ? `Timeline da requisição #${selectedRequest.requisicao_id}`
                    : "Timeline da requisição"}
                visible={timelineDialogVisible}
                modal
                style={{ width: "min(42rem, calc(100vw - 2rem))" }}
                onHide={() => setTimelineDialogVisible(false)}
            >
                {timelineLoading
                    ? <div className="flex justify-content-center p-5"><i className="pi pi-spin pi-spinner text-3xl" /></div>
                    : timelineEvents.length
                        ? <Timeline
                            value={timelineEvents}
                            align="left"
                            content={timelineContent}
                            opposite={timelineOpposite}
                        />
                        : <div className="text-center text-600 p-5">Nenhum evento encontrado.</div>}
            </Dialog>
        </>
    );
}

export function History() {
    return (
        <CombinedFiltersProvider definitions={HISTORY_FILTER_DEFINITIONS}>
            <HistoryPage />
        </CombinedFiltersProvider>
    );
}
