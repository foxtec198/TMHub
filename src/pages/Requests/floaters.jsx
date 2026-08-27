import { AppIcon } from "../../components/icons/AppIcon";
// Widgets
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Dialog } from "primereact/dialog";
import { Calendar } from "primereact/calendar";
import { PageHeader } from "../../components/PageHeader";

// Utils
import { useEffect, useMemo, useState } from "react";
import { useLoading } from "../../contexts/LoadingContext";
import connect from "../../utils/request";
import { InputText } from "primereact/inputtext";
import { FloatLabel } from "primereact/floatlabel";
import { useToast } from "../../contexts/ToastContext";
import { get_first_name } from "../../utils/ui";
import { can } from "../../utils/permissions";
import { exportTechnicalReservationsXlsx } from "../../utils/exportTechnicalReservationsXlsx";
import "./floaters.css";

// Login and UI (uiiii)
export function Floaters() {
    // refresh coordena as duas listas após inclusão ou remoção de reserva.
    const setLoading = useLoading();
    const { showToast } = useToast();
    const canCreate = can("reservas", "create");
    const canEdit = can("reservas", "edit");
    const canExport = can("reservas", "view");
    const [refresh, setRefresh] = useState(false);

    // Handles de Reservas
    const [reservas, setReservas] = useState([]);
    const [searchReservas, setSearchReservas] = useState("");
    const [usageDialog, setUsageDialog] = useState(false);
    const [usageDate, setUsageDate] = useState(new Date());
    const [reservationUsage, setReservationUsage] = useState({ usadas: [], disponiveis: [], indisponiveis: [] });
    const [availabilityDialog, setAvailabilityDialog] = useState(null);

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

    // A tela precisa apenas das reservas; não carrega toda a base de colaboradores
    // somente para alimentar cards de resumo.
    useEffect(() => {
        async function loadReservations() {
            try {
                const { data } = await connect.get("/reservas");
                setReservas(data);
            } catch (err) {
                showToast("error", "Reservas", err.response?.data || "Não foi possível carregar as reservas.");
            }
        }
        loadReservations();
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

    async function updateAvailability(reserva, disponivel, motivo = null) {
        try {
            setLoading(true);
            await connect.patch("/reservas", {
                id: reserva.floater_id,
                disponivel,
                ...(motivo ? { motivo } : {}),
            });
            showToast(
                "success",
                "Reserva atualizada",
                disponivel
                    ? `${get_first_name(reserva.nome)} está disponível novamente.`
                    : `${get_first_name(reserva.nome)} foi marcada como indisponível por ${motivo.toLowerCase()}.`,
            );
            setAvailabilityDialog(null);
            setRefresh((previous) => !previous);
        } catch (error) {
            showToast("error", "Reserva", error.response?.data || "Não foi possível atualizar a disponibilidade.");
        } finally {
            setLoading(false);
        }
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

    function exportReservations() {
        if (!reservasFiltradas.length) {
            showToast("info", "Reservas", "Não há reservas para exportar com a busca atual.");
            return;
        }
        exportTechnicalReservationsXlsx(reservasFiltradas);
    }

    // Duas listas permitem promover colaboradores e remover reservas existentes.
    return (
        <main className="floaters-page">
            <PageHeader
                section="Reposições"
                title="Reservas Técnicas"
                description="Gerencie os colaboradores ativos e a equipe disponível para cobrir as reposições."
                actions={<div className="floaters-header-actions">
                    <Button
                        label="Exportar"
                        icon={<AppIcon name="download" />}
                        outlined
                        disabled={!canExport || !reservasFiltradas.length}
                        onClick={exportReservations}
                    />
                    <Button
                        label="Utilizadas x disponíveis"
                        icon={<AppIcon name="calendar" />}
                        outlined
                        onClick={() => {
                            setUsageDialog(true);
                            loadReservationUsage();
                        }}
                    />
                </div>}
            />

            <Splitter className="floaters-splitter" layout={isMobile ? "vertical" : "horizontal"} gutterSize={12}>
                <SplitterPanel className="floaters-panel" size={50} minSize={35}>
                    <header className="floaters-panel-header">
                        <div>
                            <span>Equipe disponível</span>
                            <h2>Colaboradores ativos</h2>
                            <p>Busque um colaborador e adicione-o à equipe de reservas.</p>
                        </div>
                        <Tag value={`${colaboradores.length} exibidos`} severity="info" rounded />
                    </header>

                    <FloatLabel className="floaters-search">
                        <InputText id="active-employees-search" value={search} onChange={(e) => setSearch(e.target.value)} />
                        <label htmlFor="active-employees-search">Nome ou matrícula</label>
                    </FloatLabel>

                    <div className="floaters-list">
                        {colaboradores.length ? colaboradores.map(colaborador => {
                            const data = new Date(colaborador.data_admissao);
                            return (
                                <article key={colaborador.id} className="floater-card">
                                    <div className="floater-card-content">
                                        <strong>{colaborador.nome}</strong>
                                        <div className="floater-card-details">
                                            <span><AppIcon name="id-badge"  /> Matrícula {colaborador.matricula}</span>
                                            <span><AppIcon name="calendar-plus"  /> Admissão {data.toLocaleDateString("pt-br")}</span>
                                        </div>
                                        <div className="floater-card-tags">
                                            <Tag value={colaborador.cargo || "Cargo não informado"} rounded />
                                            <Tag value={(colaborador.situacao || "Sem situação").toUpperCase()} severity="success" rounded />
                                        </div>
                                    </div>
                                    <Button
                                        rounded
                                        disabled={!canCreate}
                                        icon={<AppIcon name={isMobile ? "arrow-down" : "arrow-right"} />}
                                        tooltip="Adicionar às reservas"
                                        aria-label={`Adicionar ${colaborador.nome} às reservas`}
                                        onClick={() => setReserva(colaborador.id, colaborador.nome)}
                                    />
                                </article>
                            );
                        }) : (
                            <div className="floaters-empty">
                                <AppIcon name="search"  />
                                <strong>Nenhum colaborador encontrado</strong>
                                <span>Tente buscar por outro nome ou matrícula.</span>
                            </div>
                        )}
                    </div>
                </SplitterPanel>

                <SplitterPanel className="floaters-panel" size={50} minSize={35}>
                    <header className="floaters-panel-header">
                        <div>
                            <span>Equipe de cobertura</span>
                            <h2>Reservas selecionadas</h2>
                            <p>Colaboradores disponíveis para atender às reposições.</p>
                        </div>
                        <Tag value={`${reservasFiltradas.length} reservas`} severity="success" rounded />
                    </header>

                    <FloatLabel className="floaters-search">
                        <InputText id="reservations-search" value={searchReservas} onChange={(e) => setSearchReservas(e.target.value)} />
                        <label htmlFor="reservations-search">Buscar nas reservas</label>
                    </FloatLabel>

                    <div className="floaters-list">
                        {reservasFiltradas.length ? reservasFiltradas.map(reserva => {
                            const data = new Date(reserva.data);
                            return (
                                <article key={reserva.id} className="floater-card">
                                    <div className="floater-card-content">
                                        <strong>{reserva.nome}</strong>
                                        <div className="floater-card-details">
                                            <span><AppIcon name="id-badge"  /> Matrícula {reserva.matricula}</span>
                                            <span><AppIcon name="calendar"  /> Incluído em {data.toLocaleDateString("pt-br")}</span>
                                        </div>
                                        <div className="floater-card-tags">
                                            <Tag value={reserva.cargo || "Cargo não informado"} rounded />
                                            <Tag value={(reserva.situacao || "Sem situação").toUpperCase()} severity="success" rounded />
                                            {reserva.disponivel === false ? <Tag value={`INDISPONÍVEL · ${reserva.indisponibilidade_motivo || "SEM MOTIVO"}`} severity="warning" rounded /> : <Tag value="DISPONÍVEL" severity="success" rounded />}
                                        </div>
                                    </div>
                                    <div className="floater-card-actions">
                                        <Button
                                            rounded
                                            outlined
                                            icon={<AppIcon name={reserva.disponivel === false ? "check" : "ban"} />}
                                            disabled={!canEdit}
                                            severity={reserva.disponivel === false ? "success" : "warning"}
                                            tooltip={reserva.disponivel === false ? "Marcar como disponível" : "Marcar como indisponível"}
                                            aria-label={`Alterar disponibilidade de ${reserva.nome}`}
                                            onClick={() => reserva.disponivel === false ? updateAvailability(reserva, true) : setAvailabilityDialog(reserva)}
                                        />
                                        <Button
                                            rounded
                                            outlined
                                            icon={<AppIcon name="trash" />}
                                            disabled={!canEdit}
                                            severity="danger"
                                            tooltip="Remover das reservas"
                                            aria-label={`Remover ${reserva.nome} das reservas`}
                                            onClick={() => delReserva(reserva.floater_id, reserva.nome)}
                                        />
                                    </div>
                                </article>
                            );
                        }) : (
                            <div className="floaters-empty">
                                <AppIcon name="shield"  />
                                <strong>Nenhuma reserva encontrada</strong>
                                <span>Adicione um colaborador ativo ou ajuste a busca.</span>
                            </div>
                        )}
                    </div>
                </SplitterPanel>
            </Splitter>

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
                                            {item.ultimo_contrato && <small><AppIcon name="building"  /> Último contrato: {item.ultimo_contrato}</small>}
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
                    <section>
                        <h3>Indisponíveis ({reservationUsage.indisponiveis.length})</h3>
                        <div className="floaters-usage-list">
                            {reservationUsage.indisponiveis.length
                                ? reservationUsage.indisponiveis.map((item) => (
                                    <div className="floaters-usage-item" key={item.id}>
                                        <div className="floaters-usage-person">
                                            <strong>{item.nome}</strong>
                                            <span>Matrícula: {item.matricula}</span>
                                        </div>
                                        <div className="floaters-usage-meta">
                                            <Tag value={item.indisponibilidade_motivo || "INDISPONÍVEL"} severity="warning" rounded />
                                        </div>
                                    </div>
                                ))
                                : <span className="floaters-usage-empty">Nenhuma reserva indisponível nesta data.</span>}
                        </div>
                    </section>
                </div>
            </Dialog>

            <Dialog
                header="Marcar reserva como indisponível"
                visible={Boolean(availabilityDialog)}
                modal
                className="floater-availability-dialog"
                onHide={() => setAvailabilityDialog(null)}
            >
                <p>Por que <strong>{availabilityDialog?.nome}</strong> não pode atender às reposições?</p>
                <div className="floater-availability-options">
                    <Button label="Falta" icon={<AppIcon name="user-minus" />} severity="danger" onClick={() => updateAvailability(availabilityDialog, false, "FALTA")} />
                    <Button label="Apoio" icon={<AppIcon name="users" />} severity="warning" onClick={() => updateAvailability(availabilityDialog, false, "APOIO")} />
                </div>
            </Dialog>
        </main>
    )
}
