import "./pcdDashboard.css";
//teste
import { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { Tag } from "primereact/tag";

import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { PageHeader } from "../../components/PageHeader";

const TYPE_COLORS = [
    "#268f50",
    "#4da3ff",
    "#a878e8",
    "#e3a72f",
    "#e47d55",
    "#5f6b64",
    "#31b765",
];

function SummaryCard({ icon, label, value, detail, tone = "neutral" }) {
    return (
        <article className={`pcd-dashboard-summary-card is-${tone}`}>
            <span className="pcd-dashboard-summary-card__icon">
                <i className={icon} />
            </span>
            <span>
                <small>{label}</small>
                <strong>{value}</strong>
                <em>{detail}</em>
            </span>
        </article>
    );
}

function EmptyChart({ text }) {
    return (
        <div className="pcd-dashboard-empty">
            <i className="pi pi-chart-bar" />
            <span>{text}</span>
        </div>
    );
}

export function PcdDashboard() {
    const [data, setData] = useState(null);
    const [refresh, setRefresh] = useState(0);
    const setGlobalLoading = useLoading();
    const { showToast } = useToast();

    useEffect(() => {
        const updateDashboard = () => (
            setRefresh((value) => value + 1)
        );

        socketio.on("pcd_update", updateDashboard);
        window.addEventListener("tmhub:filiais-changed", updateDashboard);
        return () => {
            socketio.off("pcd_update", updateDashboard);
            window.removeEventListener("tmhub:filiais-changed", updateDashboard);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadDashboard = async () => {
            setGlobalLoading(true);
            try {
                const response = await connect.get("/dash/pcd");
                if (!cancelled) setData(response.data);
            } catch (error) {
                if (!cancelled) {
                    showToast(
                        "error",
                        "Dashboard PCD",
                        error.response?.data
                        || "Não foi possível carregar os indicadores.",
                    );
                }
            } finally {
                if (!cancelled) setGlobalLoading(false);
            }
        };

        loadDashboard();
        return () => { cancelled = true; };
    }, [
        refresh,
        setGlobalLoading,
        showToast,
    ]);

    const summary = data?.resumo || {};
    const branches = useMemo(() => data?.filiais || [], [data]);
    const disabilityTypes = useMemo(
        () => data?.tipos_deficiencia || [],
        [data],
    );
    const currentPercentage = Number(summary.percentual_pcd || 0);
    const targetPercentage = Number(summary.meta_percentual || 5);
    const totalEmployees = Number(summary.total_colaboradores || 0);
    const totalPcd = Number(summary.total_pcd || 0);
    const targetHeadcount = Math.ceil(
        totalEmployees * (targetPercentage / 100),
    );
    const missingPcd = Math.max(targetHeadcount - totalPcd, 0);
    const targetReached = totalEmployees > 0 && missingPcd === 0;

    const statusChart = useMemo(() => ({
        labels: branches.map((branch) => branch.nome),
        datasets: [
            {
                label: "PCD ativos",
                data: branches.map((branch) => branch.pcd_ativos),
                backgroundColor: "#268f50",
                borderRadius: 6,
                maxBarThickness: 42,
                categoryPercentage: .72,
                barPercentage: .96,
            },
            {
                label: "PCD afastados",
                data: branches.map((branch) => branch.pcd_afastados),
                backgroundColor: "#d59b19",
                borderRadius: 6,
                maxBarThickness: 42,
                categoryPercentage: .72,
                barPercentage: .96,
            },
        ],
    }), [branches]);

    const statusOptions = useMemo(() => ({
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: {
                position: "top",
                align: "end",
                labels: { usePointStyle: true, boxWidth: 8 },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
            },
            y: {
                beginAtZero: true,
                grid: { color: "rgba(120, 130, 125, .14)" },
                border: { display: false },
                ticks: { precision: 0 },
            },
        },
    }), []);

    const typeChart = useMemo(() => ({
        labels: disabilityTypes.map((item) => item.tipo),
        datasets: [{
            label: "Colaboradores",
            data: disabilityTypes.map((item) => item.total),
            backgroundColor: disabilityTypes.map(
                (_, index) => TYPE_COLORS[index % TYPE_COLORS.length],
            ),
            borderWidth: 0,
            borderRadius: 6,
            maxBarThickness: 30,
        }],
    }), [disabilityTypes]);

    const typeOptions = useMemo(() => ({
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
            legend: { display: false },
        },
        scales: {
            x: {
                beginAtZero: true,
                grid: { color: "rgba(120, 130, 125, .14)" },
                border: { display: false },
                ticks: { precision: 0 },
            },
            y: {
                grid: { display: false },
                border: { display: false },
            },
        },
    }), []);

    const scopeLabel = branches.length === 1
        ? branches[0].nome
        : branches.length > 1
            ? `${branches.length} filiais selecionadas no menu principal`
            : "Nenhuma filial selecionada no menu principal";

    const cards = [
        {
            icon: "pi pi-users",
            label: "Colaboradores ativos",
            value: summary.total_colaboradores ?? 0,
            detail: "afastados excluídos",
        },
        {
            icon: "pi pi-heart",
            label: "Total PCD",
            value: summary.total_pcd ?? 0,
            detail: "ativos e afastados",
            tone: "violet",
        },
        {
            icon: "pi pi-user",
            label: "PCD ativos",
            value: summary.pcd_ativos ?? 0,
            detail: "Ativos",
            tone: "success",
        },
        {
            icon: "pi pi-clock",
            label: "PCD afastados",
            value: summary.pcd_afastados ?? 0,
            detail: "Afastados",
            tone: "warning",
        },
        {
            icon: "pi pi-percentage",
            label: "Percentual PCD",
            value: `${currentPercentage.toLocaleString(
                "pt-BR",
                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
            )}%`,
            detail: `meta de ${targetPercentage}%`,
            tone: targetReached ? "success" : "danger",
        },
    ];

    return (
        <section className="pcd-dashboard">
            <PageHeader
                section="Dashboards"
                title="Dashboard PCD"
                description="Acompanhe o quadro de colaboradores PCD e o comparativo com a meta."
                actions={(
                    <Button
                        icon="pi pi-refresh"
                        label="Atualizar"
                        outlined
                        onClick={() => (
                            setRefresh((value) => value + 1)
                        )}
                    />
                )}
            />

            <div className="pcd-dashboard-summary">
                {cards.map((card) => (
                    <SummaryCard key={card.label} {...card} />
                ))}
            </div>

            <div className="pcd-dashboard-grid">
                <article className="pcd-dashboard-panel pcd-dashboard-panel--status">
                    <header>
                        <div>
                            <span>Quadro PCD</span>
                            <h2>Ativos x afastados por filial</h2>
                        </div>
                        <Tag
                            value={`${summary.total_pcd ?? 0} PCD`}
                            severity="success"
                            rounded
                        />
                    </header>
                    <div className="pcd-dashboard-chart">
                        {branches.length ? (
                            <Chart
                                type="bar"
                                data={statusChart}
                                options={statusOptions}
                            />
                        ) : (
                            <EmptyChart text="Nenhuma filial com dados para exibir." />
                        )}
                    </div>
                </article>

                <article className="pcd-dashboard-panel pcd-dashboard-insight">
                    <span>Leitura executiva</span>
                    <h2>
                        {!totalEmployees
                            ? "Sem dados para o período"
                            : targetReached
                                ? "Meta de PCD atingida"
                                : "Meta de PCD exige atenção"}
                    </h2>
                    <p>
                        O indicador considera os colaboradores PCD ativos e
                        afastados sobre o total de colaboradores ativos no
                        escopo selecionado.
                    </p>

                    <div>
                        <span>
                            <small>Percentual atual</small>
                            <strong>
                                {currentPercentage.toLocaleString(
                                    "pt-BR",
                                    {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    },
                                )}
                                %
                            </strong>
                        </span>
                        <em>meta de {targetPercentage}%</em>
                    </div>

                    <div>
                        <span>
                            <small>PCD no quadro</small>
                            <strong>{totalPcd} colaboradores</strong>
                        </span>
                        <em>{targetHeadcount} necessários para a meta</em>
                    </div>

                    <div>
                        <span>
                            <small>Faltam para atingir 5%</small>
                            <strong>
                                {missingPcd
                                    ? `${missingPcd} colaboradores`
                                    : "Meta atingida"}
                            </strong>
                        </span>
                        <em>{scopeLabel}</em>
                    </div>

                    <div className="pcd-dashboard-status-strip">
                        <div className="is-active">
                            <span>Ativos</span>
                            <strong>{summary.pcd_ativos ?? 0}</strong>
                        </div>
                        <div className="is-away">
                            <span>Afastados</span>
                            <strong>{summary.pcd_afastados ?? 0}</strong>
                        </div>
                        <div className="is-total">
                            <span>Total PCD</span>
                            <strong>{totalPcd}</strong>
                        </div>
                        <div className="is-base">
                            <span>Base ativa</span>
                            <strong>{totalEmployees}</strong>
                        </div>
                    </div>
                </article>

                <article className="pcd-dashboard-panel pcd-dashboard-panel--types">
                    <header>
                        <div>
                            <span>Perfil</span>
                            <h2>Tipos de deficiência</h2>
                        </div>
                    </header>
                    <div className="pcd-dashboard-chart pcd-dashboard-chart--types">
                        {disabilityTypes.length ? (
                            <Chart
                                type="bar"
                                data={typeChart}
                                options={typeOptions}
                            />
                        ) : (
                            <EmptyChart text="Nenhum tipo de deficiência informado." />
                        )}
                    </div>
                </article>
            </div>
        </section>
    );
}
