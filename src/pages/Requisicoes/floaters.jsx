// Widgets
import { Divider } from "primereact/divider";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Dialog } from "primereact/dialog";
import { Calendar } from "primereact/calendar";
import { DashCard } from "../../components/DashCard";

// Utils
import { useEffect, useMemo, useState } from "react";
import { useLoading } from "../../contexts/LoadingContext";
import connect from "../../utils/request";
import { InputText } from "primereact/inputtext";
import { FloatLabel } from "primereact/floatlabel";
import { useToast } from "../../contexts/ToastContext";
import { get_first_name } from "../../utils/ui";
import { can } from "../../utils/permissions";
import "./floaters.css";

// Login and UI (uiiii)
export function Floaters() {
    // refresh coordena as duas listas após inclusão ou remoção de reserva.
    const setLoading = useLoading();
    const { showToast } = useToast();
    const canCreate = can("reservas", "create");
    const canEdit = can("reservas", "edit");
    const [refresh, setRefresh] = useState(false);

    // Handles de Reservas
    const [reservas, setReservas] = useState([]);
    const [totalColaboradores, setTotalColaboradores] = useState(0);
    const [searchReservas, setSearchReservas] = useState("");
    const [usageDialog, setUsageDialog] = useState(false);
    const [usageDate, setUsageDate] = useState(new Date());
    const [reservationUsage, setReservationUsage] = useState({ usadas: [], disponiveis: [] });

    // Handles de busca para colaboradores
    const [colaboradores, setColaboradores] = useState([])
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);

    useEffect(() => {
        const media = window.matchMedia("(max-width: 760px)");
        const update = (event) => setIsMobile(event.matches);
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    const reservasFiltradas = useMemo(() => {
        const busca = searchReservas.trim().toLowerCase();
        if (!busca) return reservas;
        return reservas.filter(c => {
            return (
                c.nome.toLowerCase().includes(busca) ||
                c.cargo.toLowerCase().includes(busca) ||
                c.matricula.toString().includes(busca)
            );
        });
    }, [reservas, searchReservas]);

    // Debounce evita consultar colaboradores a cada tecla digitada.
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 400);

        return () => clearTimeout(timer);
    }, [search]);

    // Consulta o catálogo filtrado sem alterar os totais do resumo.
    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const cobs = await connect.get(`/funcionarios?search=${debouncedSearch}&situacao=1&limit=50`);
                setColaboradores(cobs.data);

            }
            catch (err) { showToast("error", "Erro na requisição", err.response.data) }
            finally { setLoading(false) }
        }; load();
    }, [debouncedSearch, setLoading, showToast]);

    // Keep summary totals independent from the debounced search result shown in the splitter.
    useEffect(() => {
        async function loadSummary() {
            try {
                const [employeesResponse, reservationsResponse] = await Promise.all([
                    connect.get("/funcionarios"),
                    connect.get("/reservas"),
                ]);
                setTotalColaboradores(employeesResponse.data.length);
                setReservas(reservationsResponse.data);
            } catch (err) {
                showToast("error", "Erro nos indicadores", err.response?.data || "Não foi possível carregar os totais.");
            }
        }
        loadSummary();
    }, [refresh, showToast]);

    async function setReserva(id, nome) {
        try {
            setLoading(true)
            await connect.post("/reservas", { id: id })
            showToast("success", "Sucesso com o reservista", `${get_first_name(nome)}, movido com sucesso para Reservas Técnicas (Voltantes)`)
            setRefresh(prev => !prev)
        } catch (err) {
            console.warn(err); showToast("error", "Erro ao solicitar reservista", err.response.data)
        } finally { setLoading(false) }
    }

    async function delReserva(id, nome) {
        try {
            setLoading(true)
            await connect.delete(`/reservas?id=${id}`)
            showToast("success", "Sucesso", `${get_first_name(nome)}, removido com sucesso.`)
            setRefresh(prev => !prev)

        } catch (err) {
            console.warn(err); showToast("error", "Erro ao solicitar exclusão", err.response.data)
        } finally { setLoading(false) }
    }

    // Consulta um único dia operacional e mantém o mesmo contrato usado na tela de requisições.
    async function loadReservationUsage(date = usageDate) {
        const value = new Date(date);
        const yyyyMmDd = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

        try {
            const { data } = await connect.get("/repo/reservas-uso", { params: { data: yyyyMmDd } });
            setReservationUsage(data);
        } catch (error) {
            showToast("error", "Uso das reservas", error.response?.data || "Não foi possível consultar as reservas.");
        }
    }

    // Duas listas permitem promover colaboradores e remover reservas existentes.
    return (
        <main className="h-full p-3">
            {/* Header */}
            <div className="flex flex-wrap justify-content-between align-items-center w-full p-2">
                <div className="flex flex-column">
                    <h2
                        className="inter flex align-items-center gap-2 mb-2"
                        style={{ color: "var(--green-600)", fontWeight: 900 }}>
                        Reservas Tecnicas
                    </h2>
                    <p className="mb-3 text-secondary mt-0">Gerencie os colaboradores ativos e a equipe disponível para cobrir as reposições.</p>
                </div>
                <Button
                    label="Utilizadas x disponíveis"
                    icon="pi pi-calendar"
                    outlined
                    onClick={() => {
                        setUsageDialog(true);
                        loadReservationUsage();
                    }}
                />
            </div>

            {/* Cards */}
            <div className="flex flex-wrap gap-4 justify-content-between align-items-center w-full p-3">
                <DashCard title="Total de colaboradores" icon="pi pi-users" value={totalColaboradores} className="floater-summary-card flex-grow-1" />
                <DashCard title="Reservas técnicas" icon="pi pi-shield" value={reservas.length} className="floater-summary-card flex-grow-1" />
            </div>

            {/* FRAME */}
            <div className="flex flex-wrap gap-4 justify-content-between align-items-center w-full p-3">
                {/* Colaboradores aparecem primeiro e podem ser promovidos para o painel seguinte. */}
                <div className="flex flex-column gap-2 flex-grow-1 overflow-y-auto h-screen">
                    <span className="spaceg mb-3">Colaboradores Ativos: </span>

                    <FloatLabel className="w-full mb-2">
                        <InputText
                            id="active-employees-search"
                            className="w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <label htmlFor="active-employees-search">Buscar Colaboradores.</label>
                    </FloatLabel>
                    {colaboradores.map(colaborador => {
                        const data = new Date(colaborador.data_admissao)
                        return (
                            <div
                                key={colaborador.id}
                                className="floater-card flex flex-grow-1 justify-content-between align-items-center border-round-lg p-2 shadow-5"
                            >
                                <div className="flex flex-column gap-2">
                                    <div className="flex justify-content-center align-items-center">
                                        <span className="inter font-bold text-truncate">{colaborador.matricula} - {colaborador.nome}</span>
                                        <Divider className="h-1rem" layout="vertical" />
                                        <span className="spaceg flex align-items-center gap-1">
                                            <i className="pi pi-calendar-plus"></i>
                                            {data.toLocaleDateString("pt-br", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 align-items-center">
                                        <Tag className="bg-primary" rounded> {colaborador.cargo} </Tag>
                                        <Tag style={{ background: "var(--gray-700)" }} rounded> <span>{colaborador.situacao.toUpperCase()}</span> </Tag>
                                    </div>
                                </div>
                                <Button
                                    className="bg-primary"
                                    disabled={!canCreate}
                                    icon={isMobile ? "pi pi-caret-down" : "pi pi-caret-right"}
                                    aria-label={`Adicionar ${colaborador.nome} às reservas`}
                                    onClick={() => setReserva(colaborador.id, colaborador.nome)}
                                />
                            </div>
                        )
                    })}
                </div>

                {/* Reservas técnicas aparecem depois dos colaboradores. */}
                <div className="flex flex-column gap-2 flex-grow-1 overflow-y-auto h-screen">
                    <span className="spaceg mb-3">Reservas Selecionadas: </span>

                    <FloatLabel className="w-full mb-2">
                        <InputText
                            id="reservations-search"
                            className="w-full"
                            value={searchReservas}
                            onChange={(e) => setSearchReservas(e.target.value)}
                        />
                        <label htmlFor="reservations-search">Buscar Reservas.</label>
                    </FloatLabel>
                    {reservasFiltradas.map(reserva => {
                        const data = new Date(reserva.data)
                        return (
                            <div
                                key={reserva.id}
                                className="floater-card flex flex-grow-1 justify-content-between align-items-center border-round-lg p-2 shadow-5"
                            >
                                <div className="flex flex-column gap-2">
                                    <div className="flex justify-content-center align-items-center">
                                        <span className="inter font-bold text-truncate">{reserva.matricula} - {reserva.nome}</span>
                                        <Divider className="h-1rem" layout="vertical" />
                                        <span className="spaceg flex align-items-center gap-1">
                                            <i className="pi pi-calendar-plus"></i>
                                            Criado em: {data.toLocaleDateString("pt-br", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 align-items-center">
                                        <Tag className="bg-primary" rounded> {reserva.cargo} </Tag>
                                        <Tag style={{ background: "var(--gray-700)" }} rounded> <span>{reserva.situacao.toUpperCase()}</span> </Tag>
                                    </div>
                                </div>
                                <Button
                                    icon="pi pi-trash"
                                    disabled={!canEdit}
                                    severity="danger"
                                    onClick={() => delReserva(reserva.floater_id, reserva.nome)}
                                />
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* A data pode ser alterada sem fechar o diálogo; cada troca refaz a consulta no backend. */}
            <Dialog header="Utilizadas x disponíveis" visible={usageDialog} modal className="floaters-usage-dialog" onHide={() => setUsageDialog(false)}>
                <Calendar
                    value={usageDate}
                    onChange={(e) => {
                        if (e.value) {
                            setUsageDate(e.value);
                            loadReservationUsage(e.value);
                        }
                    }}
                    className="mt-4"
                    dateFormat="dd/mm/yy"
                    showIcon
                    readOnlyInput
                />
                <div className="floaters-usage-grid">
                    <section>
                        <h3>Utilizadas ({reservationUsage.usadas.length})</h3>
                        <div className="floaters-usage-list">
                            {reservationUsage.usadas.length
                                ? reservationUsage.usadas.map((item) => (
                                    <div className="floaters-usage-item" key={item.id}>
                                        <div className="floaters-usage-person">
                                            <strong>{item.nome}</strong>
                                            {item.ultimo_contrato && <small><i className="pi pi-building" /> Último contrato: {item.ultimo_contrato}</small>}
                                        </div>
                                        <div className="floaters-usage-meta">
                                            <Tag value={item.situacao || "Sem situação"} severity={["ATIVO", "TRABALHANDO"].includes(item.situacao?.toUpperCase()) ? "success" : "warning"} rounded />
                                            <span>{item.matricula}</span>
                                        </div>
                                    </div>
                                ))
                                : <span className="floaters-usage-empty">Nenhuma reserva utilizada nesta data.</span>}
                        </div>
                    </section>
                    <section>
                        <h3>Disponíveis ({reservationUsage.disponiveis.length})</h3>
                        <div className="floaters-usage-list">
                            {reservationUsage.disponiveis.length
                                ? reservationUsage.disponiveis.map((item) => (
                                    <div className="floaters-usage-item" key={item.id}>
                                        <div className="floaters-usage-person">
                                            <strong>{item.nome}</strong>
                                            <span>Matricula: {item.matricula}</span>
                                        </div>
                                        <div className="floaters-usage-meta">
                                            <Tag value={item.situacao || "Sem situação"} severity={["ATIVO", "TRABALHANDO"].includes(item.situacao?.toUpperCase()) ? "success" : "warning"} rounded />
                                        </div>
                                    </div>
                                ))
                                : <span className="floaters-usage-empty">Nenhuma reserva disponível nesta data.</span>}
                        </div>
                    </section>
                </div>
            </Dialog>
        </main>
    )
}
