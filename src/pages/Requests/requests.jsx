// Widgets
import { Table } from "../../components/tables/Table";
import { Button } from "primereact/button";
import { ButtonGroup } from "primereact/buttongroup"
import { Tag } from "primereact/tag";
import { DashCard } from "../../components/DashCard";
import { Inplace, InplaceDisplay, InplaceContent, } from 'primereact/inplace';
import { DropdownWS } from "../../components/DropdownWithSearch";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import { confirmDialog } from 'primereact/confirmdialog';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { SpeedDial } from "primereact/speeddial";
import { Tooltip } from "primereact/tooltip";
import { Dialog } from "primereact/dialog";
import { Calendar } from "primereact/calendar";
import { QuickRequestDialog } from "./QuickRequestDialog";
import { RequestImportDialog } from "./RequestImportDialog";
import { PageHeader } from "../../components/PageHeader";
import "./requests.css";

// Utils
import { useEffect, useMemo, useState } from "react"
import { socketio } from "../../utils/socketio";
import { useToast } from "../../contexts/ToastContext";
import { useLoading } from "../../contexts/LoadingContext";
import { useNavigate } from "react-router-dom";
import connect from "../../utils/request";
import { can } from "../../utils/permissions";

// Opção sentinela usada quando a requisição será concluída sem substituto.
const NO_REPLACEMENT_OPTION = [
    { id: 0, nome: "SEM COBERTURA" },
];

const REQUEST_STATUS = {
    pending: { label: "PENDENTE", color: "var(--yellow-600)" },
    updated: { label: "ALTERADA", color: "var(--blue-600)" },
};

// Centralized thresholds keep cards and table visibility on the same operational rule.
const REQUEST_TIME_LIMITS_HOURS = {
    late: 4,
    expired: 6,
};

const REQUEST_SITUATION = {
    open: { label: "ABERTA", severity: "success" },
    late: { label: "EM ATRASO", severity: "warning" },
    expired: { label: "EXPIRADA", severity: "danger" },
};

function getRequestSituation(requestDateValue, currentTime = Date.now()) {
    const requestDate = new Date(requestDateValue);
    if (Number.isNaN(requestDate.getTime())) return "open";

    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);

    const requestDay = new Date(requestDate);
    requestDay.setHours(0, 0, 0, 0);

    // Future requests remain open until their scheduled calendar day begins.
    if (requestDay.getTime() > today.getTime()) return "open";

    const elapsedHours = (currentTime - requestDate.getTime()) / 3_600_000;
    if (elapsedHours >= REQUEST_TIME_LIMITS_HOURS.expired) return "expired";
    if (elapsedHours >= REQUEST_TIME_LIMITS_HOURS.late) return "late";
    return "open";
}

function hasValidReplacement(row) {
    // Centraliza a regra de negócio usada nos botões e na representação do status.
    if (row.reserva_id !== undefined && Number(row.reserva_id) === 0) {
        return false;
    }

    const replacement = String(row.reserva || "").trim().toUpperCase();
    return Boolean(replacement) && !["SEM COBERTURA", "SEM INFORMAÇÃO", "NONE", "NULL"].includes(replacement);
}

function withCurrentTime(value) {
    const date = new Date(value)
    const now = new Date()
    date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
    return date
}

export function Requests() {
    // Dados da fila, totais de resumo e estado de operações destrutivas.
    const [requests, setRequests] = useState([]);
    const [refresh, setRefresh] = useState(0);
    const [currentTime, setCurrentTime] = useState(() => Date.now())
    const [deletingId, setDeletingId] = useState(null)
    const [quickDialog, setQuickDialog] = useState(false)
    const [importDialog, setImportDialog] = useState(false)
    const [usageDialog, setUsageDialog] = useState(false)
    const [usageDate, setUsageDate] = useState(new Date())
    const [reservationUsage, setReservationUsage] = useState({ usadas: [], disponiveis: [], indisponiveis: [] })
    const [availabilityDialog, setAvailabilityDialog] = useState(null)

    const { showToast } = useToast();
    const setLoading = useLoading();
    const navigate = useNavigate();
    const canCreate = can("reposicoes", "create");
    const canEdit = can("reposicoes", "edit");

    const requestSummary = useMemo(() => requests.reduce((summary, request) => {
        const situation = getRequestSituation(request.data, currentTime);
        summary[situation] += 1;
        return summary;
    }, { open: 0, late: 0, expired: 0 }), [requests, currentTime]);

    // Consulta somente a data selecionada; cada requisição ocupa um único dia.
    const loadReservationUsage = async (date = usageDate) => {
        const value = new Date(date)
        const yyyyMmDd = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
        try {
            const { data } = await connect.get("/repo/reservas-uso", { params: { data: yyyyMmDd } })
            setReservationUsage(data)
        } catch (error) { showToast("error", "Uso das reservas", error.response?.data || "Não foi possível consultar as reservas.") }
    }

    // Quarter-circle actions keep the mobile trigger accessible without covering the table.
    const speedDialItems = [
        ...(canCreate ? [
        { label: "Abrir em um nova página", icon: "pi pi-external-link", command: () => navigate("/reposicoes/requisicao") },
        { label: "Lançamento rápido", icon: "pi pi-plus-circle", command: () => setQuickDialog(true) },
        { label: "Importar planilha", icon: "pi pi-upload", command: () => setImportDialog(true) },
        ] : []),
        { label: "Uso diário das reservas", icon: "pi pi-calendar", command: () => { setUsageDialog(true); loadReservationUsage() } },
    ]

    const reasonColors = {
        "AFASTAMENTO": "var(--red-900)",
        "ATESTADO": "var(--green-600)",
        "DECLARAÇÃO": "var(--violet-600)",
        "POSTO VAGO": "var(--red-500)",
        "INJUSTIFICADA": "var(--red-900)",
        "OUTROS": "var(--gray-900)",
    }

    async function setStatus(id, status) {
        try {
            setLoading(true)
            await connect.post("/repo", { id: id, status: status })
            showToast("success", "Sucesso", "Requisilçõ salva com sucesso!")
            setRefresh(prev => prev + 1)
        }
        catch (err) { showToast("error", status === "approved" ? "Erro na Aprovação" : "Erro na Reprovação", err.response?.data || "Não foi possível alterar o status.") }
        finally { setLoading(false) }
    }

    const accept = (value) => {
        async function updateReq() {
            try {
                setLoading(true)
                await connect.patch('/repo/request', value)
                setRefresh(prev => prev + 1)
                showToast("success", "Sucesso", "Alteração salva com sucesso!")
            }
            catch (err) { showToast("error", "Erro na requisição", err.response?.data || "Não foi possível atualizar a requisição.") }
            finally { setLoading(false) }
        }; updateReq();
    }

    const confirm = (campo, value) => {
        confirmDialog({
            message: `Deseja confirmar a alteração?`,
            header: `Troca de ${campo}`,
            icon: 'pi pi-exclamation-triangle',
            defaultFocus: 'accept',
            acceptLabel: "Sim",
            rejectLabel: "Não",
            accept: () => accept(value),
        });
    };

    async function updateReservationAvailability(motivo) {
        if (!availabilityDialog?.reserva_floater_id) return;
        try {
            setLoading(true);
            await connect.patch("/reservas", {
                id: availabilityDialog.reserva_floater_id,
                disponivel: false,
                motivo,
            });
            showToast("success", "Reserva indisponível", `${availabilityDialog.reserva} foi marcada como indisponível por ${motivo.toLowerCase()}.`);
            setAvailabilityDialog(null);
            setRefresh((previous) => previous + 1);
        } catch (error) {
            showToast("error", "Reserva", error.response?.data || "Não foi possível atualizar a disponibilidade.");
        } finally {
            setLoading(false);
        }
    }

    async function deleteRequest(row) {
        try {
            setDeletingId(row.id)
            await connect.delete("/repo/request", {
                data: { id: row.id }
            })
            showToast("success", "Requisição excluída", "A requisição foi excluída com sucesso.")
            setRefresh(prev => prev + 1)
        }
        catch (err) {
            showToast("error", "Erro ao excluir requisição", err.response?.data?.message || err.response?.data || "Não foi possível excluir a requisição.")
        }
        finally {
            setDeletingId(null)
        }
    }

    function confirmRequestDeletion(row) {
        confirmDialog({
            header: `Excluir requisição #${row.id}`,
            message: "Essa ação também pode excluir o histórico e a timeline vinculados. Deseja continuar?",
            icon: "pi pi-exclamation-triangle",
            acceptLabel: "Excluir",
            rejectLabel: "Cancelar",
            acceptClassName: "p-button-danger",
            defaultFocus: "reject",
            accept: () => deleteRequest(row),
        })
    }

    // Definição das colunas e ações disponíveis em cada fase da requisição.
    const table_itens = [
        {
            field: "data",
            header: "Data",
            class: "text-truncate",
            body: (row) => <Inplace closable disabled={!canEdit}><InplaceDisplay>{new Date(row.data).toLocaleDateString("pt-br")}</InplaceDisplay><InplaceContent><Calendar value={new Date(row.data)} onChange={(e) => e.value && confirm("Data", { id: row.id, data: withCurrentTime(e.value) })} dateFormat="dd/mm/yy" /></InplaceContent></Inplace>
        },
        {
            field: "status",
            header: "Status",
            body: (row) => {
                const status = REQUEST_STATUS[row.status] || {
                    label: row.status?.toUpperCase() || "DESCONHECIDO",
                    color: "var(--gray-600)",
                };

                return <Tag value={status.label} style={{ background: status.color }} rounded />;
            }
        },
        {
            field: "situacao",
            header: "Situação",
            body: (row) => {
                const situation = REQUEST_SITUATION[getRequestSituation(row.data, currentTime)];
                return <Tag value={situation.label} severity={situation.severity} rounded />;
            }
        },
        {
            field: "origem",
            header: "Origem",
            body: (row) => {
                const fromAbsenceControl = row.origem === "controle_faltas";
                return (
                    <Tag
                        value={fromAbsenceControl ? "CONTROLE DE FALTAS" : "REQUISIÇÃO"}
                        severity={fromAbsenceControl ? "warning" : "info"}
                        rounded
                    />
                );
            },
        },
        {
            field: "ausencia",
            header: "Ausente",
            class: "text-truncate",
            body: (row) => {
                return (
                    <div className="flex">
                        <Inplace closable disabled={!canEdit} className="text-sm">
                            <InplaceDisplay>{row.ausencia}</InplaceDisplay>

                            <InplaceContent>
                                <CollaboratorDropdown
                                    className="w-10rem text-truncate"
                                    onChange={(value) => { confirm("Ausente", { id: row.id, ausente_id: value }) }}
                                />
                            </InplaceContent>
                        </Inplace>
                    </div>
                )
            }
        },
        {
            field: "reserva",
            header: "Reserva",
            class: "text-truncate",
            body: (row) => {
                return (
                    <div className="flex">
                        <Inplace closable disabled={!canEdit} className="text-sm">
                            <InplaceDisplay>{row.reserva}</InplaceDisplay>

                            <InplaceContent>
                                <DropdownWS
                                    uri="/reservas"
                                    uriParams={{ disponivel: true }}
                                    staticOptions={NO_REPLACEMENT_OPTION}
                                    className="w-10rem text-truncate"
                                    onChange={(value) => { confirm("Reserva", { id: row.id, reserva_id: value }) }}
                                />
                            </InplaceContent>
                        </Inplace>
                        {row.reserva_floater_id ? <Button
                            icon="pi pi-ban"
                            text
                            rounded
                            severity="warning"
                            disabled={!canEdit}
                            aria-label={`Marcar ${row.reserva} como indisponível`}
                            tooltip="Marcar como indisponível"
                            onClick={() => setAvailabilityDialog(row)}
                        /> : null}
                    </div>
                )
            }
        },
        {
            field: "local",
            header: "Local",
            class: "text-truncate",
            body: (row) => {
                return (
                    <div className="flex">
                        <Inplace closable disabled={!canEdit} className="text-sm">
                            <InplaceDisplay>{row.local}</InplaceDisplay>

                            <InplaceContent>
                                <DropdownWS
                                    uri="/centro"
                                    className="w-10rem text-truncate"
                                    optionsValuesForDict={{ nome: "local" }}
                                    onChange={(centro) => { confirm("Local", { id: row.id, centro_id: centro }) }}
                                />
                            </InplaceContent>
                        </Inplace>
                    </div>
                )
            }

        },
        {
            field: "supervisor",
            header: "Supervisor",
            class: "text-truncate",
        },
        {
            header: "Motivos",
            body: (row) => {
                return <>
                    <Tag
                        value={row.motivo}
                        style={{
                            background: reasonColors[row.motivo]
                        }}
                        rounded
                    />
                </>
            }
        },
        {
            header: "Dias",
            field: "dias",
            body: (row) => <span>{row.dias || 1}</span>,
        },
        {
            header: "Ações",
            body: (row) => {
                if (!canEdit) return null;
                return <ButtonGroup className="request-actions-group flex">
                    <Button
                        icon="pi pi-times"
                        severity="help"
                        onClick={() => { setStatus(row.id, "reproved") }}
                        data-pr-tooltip="Reprovar Solicitação"
                    />
                    <Button
                        data-pr-tooltip="Aprovar Solicitação"
                        icon="pi pi-check-circle"
                        severity="success"
                        disabled={!hasValidReplacement(row)}
                        title={hasValidReplacement(row) ? "Aprovar solicitação" : "Selecione uma reserva antes de aprovar"}
                        onClick={() => { setStatus(row.id, "approved") }}
                    />
                    <Button
                        icon="pi pi-trash"
                        severity="danger"
                        loading={deletingId === row.id}
                        disabled={deletingId !== null}
                        aria-label={`Excluir requisição ${row.id}`}
                        title="Excluir requisição"
                        onClick={() => confirmRequestDeletion(row)}
                    />
                </ButtonGroup>
            },
        },
    ];

    // Busca a fila novamente depois de qualquer alteração bem-sucedida.
    useEffect(() => {
        async function get_requests() {
            const res = await connect.get("/repo/request?status=pending,updated")
            setRequests(res.data)
        }; get_requests();
    }, [refresh]);

    // Re-evaluate elapsed time without requiring a socket event or manual page refresh.
    useEffect(() => {
        const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    // Mantém os indicadores superiores sincronizados com a fila carregada.
    useEffect(() => {
        const refreshRequests = () => {
            setRefresh(prev => prev + 1)
        }

        socketio.on("new_request", refreshRequests);
        socketio.on("new_history", refreshRequests);

        return () => {
            socketio.off("new_request", refreshRequests)
            socketio.off("new_history", refreshRequests)
        }
    }, []);

    // Renderiza indicadores, tabela operacional e diálogos de confirmação.
    return (
        <main className="flex flex-column gap-1 p-2">
            <ConfirmDialog />

            <PageHeader
                section="Reposições"
                title="Requisições"
                description="Acompanhe as reposições abertas, atualize os dados e acesse rapidamente novos lançamentos e relatórios."
            />

            <div className="requests-speed-dial">
                <Tooltip target=".requests-speed-dial .p-speeddial-action" position="left" showDelay={150} />
                <SpeedDial model={speedDialItems} type="quarter-circle" direction="up-left" radius={132} showIcon="pi pi-plus" hideIcon="pi pi-times" aria-label="Ações de requisições" />
            </div>

            <div className="flex gap-2 align-items-center">
                <DashCard
                    title="Abertas"
                    className="border-round-lg p-1 spaceg flex-grow-1"
                    style={{
                        background: 'var(--green-700)',
                        color: "#fff"
                    }}
                    value={requestSummary.open}
                />
                <DashCard
                    title="Em Atraso"
                    className="border-round-lg p-1 spaceg flex-grow-1"
                    style={{
                        background: 'var(--yellow-700)',
                        color: "#fff"
                    }}
                    value={requestSummary.late}
                />
                <DashCard
                    title="Expiradas"
                    className="border-round-lg p-1 spaceg flex-grow-1"
                    style={{
                        background: 'var(--red-700)',
                        color: "#fff"
                    }}
                    value={requestSummary.expired}
                />
            </div>
            <div className="flex flex-column overflow-auto h-full">
                <Table
                    data={requests}
                    tableClassName="w-full h-full"
                    rows={5}
                    search={true}
                    style={{
                        width: "100%",
                        height: "100dvh",
                        fontSize: "12px  "
                    }}
                    columns={table_itens}
                    setRefresh={setRefresh}
                />
            </div>
            <QuickRequestDialog visible={quickDialog} onHide={() => setQuickDialog(false)} onCreated={() => setRefresh((value) => value + 1)} />
            <RequestImportDialog visible={importDialog} onHide={() => setImportDialog(false)} onImported={() => setRefresh((value) => value + 1)} />
            <Dialog header="Uso diário das reservas" visible={usageDialog} modal className="reserve-usage-dialog" onHide={() => setUsageDialog(false)}>
                <Calendar value={usageDate} onChange={(e) => { if (e.value) { setUsageDate(e.value); loadReservationUsage(e.value) } }} className="mt-4" dateFormat="dd/mm/yy" showIcon readOnlyInput />
                <div className="reserve-usage-grid">
                    <section>
                        <h3>Usadas ({reservationUsage.usadas.length})</h3>
                        <div className="reserve-usage-list">
                            {reservationUsage.usadas.length ? reservationUsage.usadas.map((item) => (
                                <div className="reserve-usage-item" key={item.id}>
                                    <div className="reserve-usage-person">
                                        <strong>{item.nome}</strong>
                                        {item.ultimo_contrato && <small><i className="pi pi-building" /> Último contrato: {item.ultimo_contrato}</small>}
                                    </div>
                                    <div className="reserve-usage-meta">
                                        <Tag value={item.situacao || "Sem situação"} severity={["ATIVO", "TRABALHANDO"].includes(item.situacao?.toUpperCase()) ? "success" : "warning"} rounded />
                                        <span>{item.matricula}</span>
                                    </div>
                                </div>
                            )) : <span className="reserve-usage-empty">Nenhuma reserva usada nesta data.</span>}
                        </div>
                    </section>
                    <section>
                        <h3>Disponíveis ({reservationUsage.disponiveis.length})</h3>
                        <div className="reserve-usage-list">
                            {reservationUsage.disponiveis.length ? reservationUsage.disponiveis.map((item) => (
                                <div className="reserve-usage-item" key={item.id}>
                                    <div className="reserve-usage-person"><strong>{item.nome}</strong></div>
                                    <div className="reserve-usage-meta">
                                        <Tag value={item.situacao || "Sem situação"} severity={["ATIVO", "TRABALHANDO"].includes(item.situacao?.toUpperCase()) ? "success" : "warning"} rounded />
                                        <span>{item.matricula}</span>
                                    </div>
                                </div>
                            )) : <span className="reserve-usage-empty">Nenhuma reserva disponível nesta data.</span>}
                        </div>
                    </section>
                    <section>
                        <h3>Indisponíveis ({reservationUsage.indisponiveis.length})</h3>
                        <div className="reserve-usage-list">
                            {reservationUsage.indisponiveis.length ? reservationUsage.indisponiveis.map((item) => (
                                <div className="reserve-usage-item" key={item.id}>
                                    <div className="reserve-usage-person"><strong>{item.nome}</strong></div>
                                    <div className="reserve-usage-meta">
                                        <Tag value={item.indisponibilidade_motivo || "INDISPONÍVEL"} severity="warning" rounded />
                                        <span>{item.matricula}</span>
                                    </div>
                                </div>
                            )) : <span className="reserve-usage-empty">Nenhuma reserva indisponível nesta data.</span>}
                        </div>
                    </section>
                </div>
            </Dialog>
            <Dialog
                header="Marcar reserva como indisponível"
                visible={Boolean(availabilityDialog)}
                modal
                className="reserve-availability-dialog"
                onHide={() => setAvailabilityDialog(null)}
            >
                <p>Por que <strong>{availabilityDialog?.reserva}</strong> não pode atender à reposição?</p>
                <div className="reserve-availability-options">
                    <Button label="Falta" icon="pi pi-user-minus" severity="danger" onClick={() => updateReservationAvailability("FALTA")} />
                    <Button label="Apoio" icon="pi pi-users" severity="warning" onClick={() => updateReservationAvailability("APOIO")} />
                </div>
            </Dialog>
        </main>
    );
};
