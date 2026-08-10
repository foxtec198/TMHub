// Widgets
import { Chart } from "primereact/chart"
import { MeterGroup } from "primereact/metergroup"
import { Calendar } from "primereact/calendar"
import { Divider } from "primereact/divider"
import { TabView } from "primereact/tabview"
import { TabPanel } from "primereact/tabview"
import { Knob } from 'primereact/knob';
import { Button } from "primereact/button"
import { OverlayPanel } from "primereact/overlaypanel"
import { FloatLabel } from "primereact/floatlabel"
import { MultiSelect } from "primereact/multiselect"

// Components
import { DashCard } from "../../components/DashCard"
import { Table } from "../../components/tables/Table"
import { PageHeader } from "../../components/PageHeader"
import { DashboardFilterButton } from "../../components/DashboardFilterPanel"

// Utils
import { useEffect, useState, useRef, useMemo } from "react"
import { to_real } from "../../utils/ui"
import connect from "../../utils/request"
import { useChartTheme } from "../../theme/useTheme"

// CSS
import "./request.css"


// MOCKS
const totalOfReplaces = 19

function getReferencePeriodDays(range) {
    const firstReference = range?.[0] instanceof Date && !Number.isNaN(range[0].getTime())
        ? range[0]
        : new Date();
    const lastReference = range?.[1] instanceof Date && !Number.isNaN(range[1].getTime())
        ? range[1]
        : firstReference;
    const today = new Date();
    const periodStart = new Date(firstReference.getFullYear(), firstReference.getMonth(), 1);
    const includesCurrentMonth = lastReference.getFullYear() === today.getFullYear()
        && lastReference.getMonth() === today.getMonth();
    const periodEnd = includesCurrentMonth
        ? today
        : new Date(lastReference.getFullYear(), lastReference.getMonth() + 1, 0);

    const startUtc = Date.UTC(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
    const endUtc = Date.UTC(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());

    return Math.max(Math.floor((endUtc - startUtc) / 86400000) + 1, 0);
}

// Dados de fallback mantidos apenas para desenvolvimento visual sem API.
const MOCK = {
    res: {
        "data": {
            "abertas": 0
        }
    },
    hist: [
        {
            "ausente": "LINCOLN GUSTAVO MENDES",
            "created_at": "Fri, 22 Jun 2026 13:27:42 GMT",
            "dpto": "87",
            "local": "ED.LONDRINA - ENCARREGADOS",
            "motivo": "LAVAÇÃO DE TOLDO",
            "multa": 180,
            "obs": "None",
            "reserva": "SEM INFORMAÇÃO",
            "status": "reproved",
            "supervisor": "PAULO TORRES"
        }, {
            "ausente": "PAULO AQUINO DE ALMEIDA JUNIOR",
            "created_at": "Fri, 15 Jun 2026 13:27:41 GMT",
            "dpto": "269",
            "local": "LONDRINA - VOLANTES ",
            "motivo": "REMANEJAMENTO",
            "multa": 250,
            "obs": "None",
            "reserva": "SEM INFORMAÇÃO",
            "status": "approve",
            "supervisor": "PAULO TORRES"
        },
        {
            "ausente": "LUZIA DE OLIVEIRA",
            "created_at": "Fri, 8 Jun 2026 13:27:41 GMT",
            "dpto": "269",
            "local": "LONDRINA - VOLANTES ",
            "motivo": "INSS",
            "multa": 320,
            "obs": "None",
            "reserva": "LUZIA CAZARIN",
            "status": "approve",
            "supervisor": "PAULO TORRES"
        }, {
            "ausente": "FULANINHO DA SILVA",
            "created_at": "Fri, 8 Jun 2026 13:27:41 GMT",
            "dpto": "269",
            "local": "SCHERER - CONS A LONDRINA",
            "motivo": "ATESTADO",
            "multa": 0,
            "obs": "None",
            "reserva": null,
            "status": "approve",
            "supervisor": "PAULO TORRES"
        }, {
            "ausente": "FULANINHO DA ROÇA",
            "created_at": "Fri, 8 Jun 2026 13:27:41 GMT",
            "dpto": "87",
            "local": "SCHERER - CONS A LONDRINA",
            "motivo": "AFASTAMENTO",
            "multa": 250,
            "obs": "None",
            "reserva": "FULANINHA DA COBERTURA",
            "status": "approve",
            "supervisor": "PAULO TORRES"
        }
    ]
}

// Logic and UI
export function RequestReport() {
    const chartTheme = useChartTheme();
    // Filtros enviados ao backend e referência do painel flutuante de filtros.
    const op_filters = useRef(); // Overlay Panel Ref

    const defaultFilters = {
        contrato: [],
        departamento: [],
        supervisor: [],
        motivo: [],
        status: [],
        colaborador: [],
    };

    // Filtros
    const [filters, setFilters] = useState(defaultFilters);

    // Dar refresh na pagina com os novos dados
    // Alterar refresh força uma nova consulta sem acoplar os handlers ao efeito.
    const [refresh, setRefresh] = useState(null);

    // Historico de reposições
    const [histOriginal, setHistOriginal] = useState([]);

    // Filtros
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const [filter, setFilter] = useState([primeiroDia, ultimoDia]);

    // Statics
    // Indicadores consolidados exibidos nos cards superiores.
    const [realizadas, setRealizadas] = useState(0);
    const [abertas, setAbertas] = useState(0);
    const [postosCobertos, setPostosCobertos] = useState(0);
    const [postosDescobertos, setPostoDescobertos] = useState(0);
    const [localComMaisFaltas, setLocalComMaisFaltas] = useState(0);
    const [valorDoLocalComMaisFaltas, setValorDoLocalComMaisFaltas] = useState(0);
    const [totalDeMultas, setTotalDeMultas] = useState(0);
    const [departamentos, setDepartamentos] = useState([]);

    // Dados para CHARTS
    // Chart de Reposicoes
    // Séries derivadas para os gráficos Chart.js.
    const [labelReposicoes, setLabels] = useState(null)
    const [dadosReposicoes, setDadosReposicoes] = useState(null)
    const [labelLocal, setlabelLocal] = useState(null)
    const [dadosAusentes, setDadosAusentes] = useState(null)

    // Dados do Vertical Bar - Locais
    const [dadosLocais, setDadosLocais] = useState(null)

    // Chart de multas
    const [labelForMult, setlabelForMult] = useState(null)
    const [dataForMult, setdataForMult] = useState(null)

    // Dados da Tabela
    // Recorte tabular e percentuais do MeterGroup.
    const [dadosTabela, setDadosTabela] = useState([])

    // Dados do Meter Group
    const [meterGroupValues, setMeterGroupValues] = useState([]);

    const totalRequisicoes = realizadas + abertas;
    const percentageOfTotal = (value) => {
        if (!totalRequisicoes || !value) return 0;
        return Math.max(1, Math.round((value / totalRequisicoes) * 100));
    };
    const referencePeriodDays = getReferencePeriodDays(filter);
    const averageDailyCost = referencePeriodDays
        ? totalDeMultas / referencePeriodDays
        : 0;

    // Use Memo para setar 
    const hist = useMemo(() => {
        return histOriginal.filter(item => {
            if (filters.contrato.length && !filters.contrato.includes(item.local)) return false;
            if (filters.departamento.length && !filters.departamento.includes(item.dpto)) return false;
            if (filters.supervisor.length && !filters.supervisor.includes(item.supervisor)) return false;
            if (filters.colaborador.length && !filters.colaborador.includes(item.ausente)) return false;
            if (filters.motivo.length && !filters.motivo.includes(item.motivo)) return false;
            if (filters.status.length && !filters.status.includes(item.status)) return false;
            return true;
        });
    }, [histOriginal, filters.contrato, filters.departamento, filters.supervisor, filters.colaborador, filters.motivo, filters.status]);

    const clearFilters = () => {
        setFilters(() => ({ ...defaultFilters }));
    };
    const activeFilterCount = Object.values(filters).filter((value) => value?.length).length;

    const contratosOptions = useMemo(() => {
        const histFiltro = histOriginal.filter(item => {
            if (filters.departamento.length && !filters.departamento.includes(item.dpto)) return false;
            if (filters.supervisor.length && !filters.supervisor.includes(item.supervisor)) return false;
            if (filters.motivo.length && !filters.motivo.includes(item.motivo)) return false;
            if (filters.status.length && !filters.status.includes(item.status)) return false;

            return true;
        });

        return [...new Set(histFiltro.map(i => i.local))]
            .sort()
            .map(i => ({ label: i, value: i }));

    }, [histOriginal, filters]);

    const dptoOptions = useMemo(() => {
        const histFiltro = histOriginal.filter(item => {
            if (filters.contrato.length && !filters.contrato.includes(item.local)) return false;
            if (filters.supervisor.length && !filters.supervisor.includes(item.supervisor)) return false;
            if (filters.motivo.length && !filters.motivo.includes(item.motivo)) return false;
            if (filters.status.length && !filters.status.includes(item.status)) return false;

            return true;
        });

        return [...new Set(histFiltro.map(i => i.dpto))]
            .sort()
            .map(i => ({ label: i, value: i }));

    }, [histOriginal, filters]);

    const motivoOptions = useMemo(() => {
        const histFiltro = histOriginal.filter(item => {
            if (filters.departamento.length && !filters.departamento.includes(item.dpto)) return false;
            if (filters.contrato.length && !filters.contrato.includes(item.local)) return false;
            if (filters.supervisor.length && !filters.supervisor.includes(item.supervisor)) return false;
            if (filters.status.length && !filters.status.includes(item.status)) return false;

            return true;
        });

        return [...new Set(histFiltro.map(i => i.motivo))]
            .sort()
            .map(i => ({ label: i, value: i }));

    }, [histOriginal, filters]);

    const supervisorOptions = useMemo(() => {
        const histFiltro = histOriginal.filter(item => {
            if (filters.departamento.length && !filters.departamento.includes(item.dpto)) return false;
            if (filters.contrato.length && !filters.contrato.includes(item.local)) return false;
            if (filters.motivo.length && !filters.motivo.includes(item.motivo)) return false;
            if (filters.status.length && !filters.status.includes(item.status)) return false;

            return true;
        });

        return [...new Set(histFiltro.map(i => i.supervisor))]
            .sort()
            .map(i => ({ label: i, value: i }));

    }, [histOriginal, filters]);

    const statusOptions = useMemo(() => {
        const histFiltro = histOriginal.filter(item => {
            if (filters.departamento.length && !filters.departamento.includes(item.dpto)) return false;
            if (filters.contrato.length && !filters.contrato.includes(item.local)) return false;
            if (filters.supervisor.length && !filters.supervisor.includes(item.supervisor)) return false;
            if (filters.motivo.length && !filters.motivo.includes(item.motivo)) return false;

            return true;
        });

        return [...new Set(histFiltro.map(i => i.status))]
            .sort()
            .map(i => ({ label: i, value: i }));

    }, [histOriginal, filters]);

    // Use Effect para a consulta
    // Carrega o histórico bruto sempre que o período/refresh mudar.
    useEffect(() => {
        async function getData() {

            const filterData = filter
                ? {
                    init: new Date(filter[0]).toLocaleDateString("pt-BR"),
                    end: new Date(filter[1]).toLocaleDateString("pt-BR")
                }
                : {};

            const res = await connect.post("/dash/reposicoes", filterData);

            setHistOriginal(res.data.historico);
            setAbertas(res.data.abertas);
        }; getData();
    }, [refresh]);

    // Use Effect para os filtros
    // Recalcula cards, gráficos e tabela a partir do histórico já carregado.
    useEffect(() => {
        if (!hist.length) return;

        const getStatus = (item) => {
            if (item.status === "reproved") return "descoberta";
            return "coberta";
        };

        const cobertos = hist.filter(item => getStatus(item) === "coberta").length;
        const descobertos = hist.filter(item => getStatus(item) === "descoberta").length;

        const total = hist.length;

        const dias = [...new Set(
            hist.map(item =>
                new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit" })
            )
        )].sort((a, b) => a - b);

        const totalMulta = hist.reduce((acc, item) => acc + item.multa, 0);

        // Contratos
        const contratos = hist.reduce((acc, { local }) => {
            acc[local] = (acc[local] || 0) + 1;
            return acc;
        }, {});

        const betters = Object.entries(contratos)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);

        const locaisLabels = betters.map(([local]) =>
            local.replaceAll(/\d+/g, "")
                .replaceAll("-", "")
                .trim()
        );

        const locaisValues = betters.map(([, quantidade]) => quantidade);

        // Departamentos
        const dptos = hist.reduce((acc, { dpto, ...item }) => {
            acc[dpto] ??= {
                cobertas: 0,
                descobertas: 0
            };

            acc[dpto][
                getStatus(item) === "coberta"
                    ? "cobertas"
                    : "descobertas"
            ]++;

            return acc;
        }, {});

        setDepartamentos(Object.entries(dptos));

        // Cards
        setRealizadas(total);
        setAbertas(abertas);
        setTotalDeMultas(totalMulta);

        setLocalComMaisFaltas(locaisLabels[0]);

        setPostosCobertos(cobertos);
        setPostoDescobertos(descobertos);

        setValorDoLocalComMaisFaltas(
            Math.round((locaisValues[0] / total) * 100) || 0
        );


        // Chart Locais
        setlabelLocal(locaisLabels);
        setDadosLocais(locaisValues);


        // Chart Reposições
        setLabels(dias);

        setDadosAusentes(
            dias.map(day =>
                hist.filter(item =>
                    new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit" }) === day
                ).length
            )
        );

        setDadosReposicoes(
            dias.map(day =>
                hist.filter(item =>
                    new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit" }) === day &&
                    getStatus(item) === "coberta"
                ).length
            )
        );


        // Tabela
        setDadosTabela(hist);


        // Chart Multas
        setlabelForMult(dias);

        setdataForMult(
            dias.map(day =>
                hist
                    .filter(item =>
                        new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit" }) === day
                    )
                    .reduce((soma, item) => soma + (Number(item.multa) || 0), 0)
            )
        );

        // Meter Group
        setMeterGroupValues([
            {
                label: "Postos Cobertos",
                color: "#22c55e",
                value: Math.round(cobertos / total * 100)
            },
            {
                label: "Descobertos",
                color: "#ef4444",
                value: Math.round(descobertos / total * 100)
            },
            {
                label: "Pendentes",
                color: "#f3eb09",
                value: Math.round(abertas / total * 100)
            }
        ]);

    }, [hist, abertas]);

    // Configuração compartilhada pelos doughnuts de departamento.
    const optionsDptos = {
        cutout: '60%',
        plugins: {
            legend: false
        }
    };

    // Datasets são recriados com o estado atual para o wrapper do Chart.js.
    const dataRepos = {
        labels: labelReposicoes,
        datasets: [{
            type: 'line',
            tension: 0.4,
            label: 'Reposições',
            borderColor: chartTheme.palette[0],
            pointBackgroundColor: chartTheme.palette[0],
            data: dadosReposicoes,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBorderWidth: 2,
        }, {
            type: 'bar',
            borderRadius: 10,
            borderSkipped: false,
            label: 'Ausências',
            maxBarThickness: 40,
            categoryPercentage: 0.6,
            barPercentage: 0.7,
            backgroundColor: chartTheme.palette[1],
            data: dadosAusentes,
            borderColor: chartTheme.surface,
            borderWidth: 2
        },]
    };

    const dataMults = {
        labels: labelForMult,
        datasets: [{
            type: "line",
            tension: 0.4,
            fill: true,
            backgroundColor: 'rgba(241, 67, 67, 0.42)',
            label: "Custo de Reservas Técnicas por dia.",
            data: dataForMult
        }]
    };

    const dataLocals = {
        labels: labelLocal,
        datasets: [{
            type: "bar",
            backgroundColor: chartTheme.palette[2],
            label: "Dados",
            data: dadosLocais,
            barPercentage: 0.7,
            categoryPercentage: 0.7,

        }]
    };

    const dadosTabelaFiltraveis = dadosTabela.map(row => ({
        ...row,
        cobertura_search: `${row.ausente ?? ""} ${!row.reserva ? "SEM COBERTURA" : row.reserva}`
    }));

    // Contrato declarativo consumido pelo componente Table reutilizável.
    const columns = [
        {
            header: "Local da Falta",
            field: "local",
            class: "text-truncate"
        },
        {
            header: "DPTO.",
            field: "dpto"
        },
        {
            header: "Data",
            body: (row) => new Date(row.created_at).toLocaleDateString("pt-BR",)
        },
        {
            // header: "Coberturas",
            header:
                <div className="flex justify-content-between gap-4">
                    <span className="text-truncate inter">Ausencias</span>
                    <i className="pi pi-arrow-right"></i>
                    <span className="font-bold text-truncate"> Coberturas</span>
                </div>,
            style: { maxWidth: "20rem" },
            field: "cobertura_search",
            body: (row) => {
                return <div className="flex justify-content-between gap-2">
                    <span className="text-truncate inter">{row.ausente.split(" ")[0]} {row.ausente.split(" ").at(-1)}</span>
                    <i className="pi pi-arrow-right" style={{ color: `var(--${!row.reserva || row.reserva == "SEM COBERTURA" ? "red-500" : "green-500"})` }}></i>
                    <span className="font-bold text-truncate">{row.reserva ? row.reserva.split(" ")[0] : "SEM"}  {row.reserva ? row.reserva.split(" ").at(-1) : "COBERTURA"}
                    </span>
                </div>
            }
        },
        {
            header: "Supervisor",
            field: 'supervisor'
        },
        {
            header: "Motivo",
            field: "motivo"
        },
        {
            header: "Observação",
            field: "obs"
        }
    ];

    const cores = [
        ['rgba(76, 175, 80, 0.75)', 'rgba(244, 67, 54, 0.75)'],
        ['rgba(67, 160, 71, 0.75)', 'rgba(229, 57, 53, 0.75)'],
        ['rgba(56, 142, 60, 0.75)', 'rgba(211, 47, 47, 0.75)'],
        ['rgba(102, 187, 106, 0.75)', 'rgba(239, 83, 80, 0.75)'],
        ['rgba(46, 125, 50, 0.75)', 'rgba(198, 40, 40, 0.75)'],
        ['rgba(129, 199, 132, 0.75)', 'rgba(229, 115, 115, 0.75)'],
        ['rgba(27, 94, 32, 0.75)', 'rgba(183, 28, 28, 0.75)'],
        ['rgba(165, 214, 167, 0.75)', 'rgba(255, 138, 128, 0.75)'],
        ['rgba(104, 159, 56, 0.75)', 'rgba(230, 74, 25, 0.75)'],
        ['rgba(85, 139, 47, 0.75)', 'rgba(216, 67, 21, 0.75)']
    ];

    // A tela é dividida em toolbar, indicadores, gráficos, tabela e painel lateral.
    return (
        <main className="request-dashboard flex flex-column p-2 gap-2 w-full">
            <PageHeader
                section="Dashboards"
                title="Dashboard de Reposições"
                description="Acompanhe volume, cobertura, motivos e desempenho das requisições."
            />
            <div className="dashboard-toolbar flex justify-content-between align-items-center w-full">
                <div className="dashboard-summary flex gap-2 p-2 w-full">
                    <DashCard
                        icon="pi pi-verified"
                        title="Total"
                        className="border-round-lg flex-grow-1"
                        style={{
                            backgroundColor: 'var(--primary)',
                            height: "5rem",
                            color: "#fff",
                        }}
                        value={totalRequisicoes}
                        cont="100%"
                        contSeverity="info"
                        contClassName="request-metric-tag request-metric-tag-total"
                    />
                    <DashCard
                        icon="pi pi-folder-open "
                        title="Abertas"
                        className="border-round-lg flex-grow-1"
                        style={{
                            backgroundColor: 'var(--chart-1)',
                            height: "5rem",
                            color: "#fff",
                        }}
                        value={abertas}
                        cont={`${percentageOfTotal(abertas)}%`}
                        contSeverity="warning"
                        contClassName="request-metric-tag request-metric-tag-open"
                    />
                    <DashCard
                        icon="pi pi-calendar "
                        title="Cobertas"
                        className="border-round-lg flex-grow-1"
                        style={{
                            backgroundColor: 'var(--secondary)',
                            height: "5rem",
                            color: "#fff",
                        }}
                        value={postosCobertos}
                        cont={`${percentageOfTotal(postosCobertos)}%`}
                        contSeverity="success"
                        contClassName="request-metric-tag request-metric-tag-covered"
                    />
                    <DashCard
                        icon="pi pi-paperclip"
                        title="Descobertas"
                        className="border-round-lg flex-grow-1"
                        style={{
                            backgroundColor: 'var(--accent)',
                            height: "5rem",
                            color: "#fff",
                        }}
                        value={postosDescobertos}
                        cont={`${percentageOfTotal(postosDescobertos)}%`}
                        contSeverity="danger"
                        contClassName="request-metric-tag request-metric-tag-uncovered"
                    />
                    <DashCard
                        icon="pi pi-dollar"
                        title="Custo Total"
                        className="dashboard-financial-card border-round-lg flex-grow-1"
                        style={{
                            backgroundColor: 'var(--surface-3)',
                            height: "5rem",
                            color: "#fff",
                        }}
                        value={to_real(totalDeMultas)}
                        valueClassName="text-2xl"
                    />
                    <DashCard
                        icon="pi pi-chart-line"
                        title="Média por dia"
                        className="dashboard-financial-card border-round-lg flex-grow-1"
                        style={{
                            backgroundColor: 'var(--chart-7)',
                            height: "5rem",
                            color: "#fff",
                        }}
                        value={to_real(averageDailyCost)}
                        valueClassName="text-2xl"
                    />
                    <div
                        className="dashboard-highlight flex justify-content-center flex-grow-1 gap-2 align-items-center border-round-lg shadow-6 p-3"
                        style={{ backgroundColor: 'var(--surface-1)', height: "5rem", color: 'var(--text-primary)' }}>
                        <Knob
                            value={valorDoLocalComMaisFaltas}
                            valueTemplate="{value}%"
                            min={0}
                            max={100}
                            valueColor={valorDoLocalComMaisFaltas >= totalOfReplaces ? "var(--red-600)" : "var(--green-600)"}
                            textColor="#fff"
                            size={60}
                        />
                        <div className="flex flex-column flex-grow-1 justify-content-between">
                            <span className="spaceg text-lg font-bold spaceg text-1xl">Contrato com mais faltas</span>
                            <span className="inter" style={{ maxWidth: "250px" }}>{localComMaisFaltas}</span>
                        </div>
                    </div>
                </div>

                <OverlayPanel ref={op_filters} className="dashboard-filter-panel p-3 flex flex-column w-25rem">
                    <span className="inter mb-5 font-bold">Filtre os dados do Dashboard.</span>

                    <Divider className="my-5"></Divider>

                    <FloatLabel className="w-full mb-4">
                        <Calendar
                            inputId="dashboard-period"
                            locale="pt-BR"
                            value={filter}
                            placeholder="Selecione um período."
                            dateFormat="dd/mm/yy"
                            onChange={(e) => { setFilter(e.value); setRefresh(prev => !prev) }}
                            selectionMode="range"
                            readOnlyInput
                            // showButtonBar
                            className="w-full"
                        />
                        <label htmlFor="dashboard-period">Selecione um período</label>
                    </FloatLabel>

                    <FloatLabel className="w-full mb-4">
                        <MultiSelect
                            inputId="dashboard-contract"
                            filter
                            appendTo="self"
                            className="w-full"
                            panelClassName="w-full dashboard-filter-dropdown"
                            value={filters.contrato}
                            options={contratosOptions}
                            onChange={(e) =>
                                setFilters(prev => ({
                                    ...prev,
                                    contrato: e.value
                                }))
                            }
                        />
                        <label htmlFor="dashboard-contract">Contratos: </label>
                    </FloatLabel>

                    <FloatLabel className="w-full mb-4">
                        <MultiSelect
                            inputId="dashboard-department"
                            panelClassName="dashboard-filter-dropdown"
                            className="w-full"
                            value={filters.departamento}
                            options={dptoOptions}
                            onChange={(e) =>
                                setFilters(prev => ({
                                    ...prev,
                                    departamento: e.value
                                }))
                            }
                        />
                        <label htmlFor="dashboard-department">Departamentos: </label>
                    </FloatLabel>

                    <FloatLabel className="w-full mb-4">
                        <MultiSelect
                            inputId="dashboard-reason"
                            panelClassName="dashboard-filter-dropdown"
                            options={motivoOptions}
                            value={filters.motivo}
                            className="w-full"
                            onChange={(e) =>
                                setFilters(prev => ({
                                    ...prev,
                                    motivo: e.value
                                }))
                            }
                        />
                        <label htmlFor="dashboard-reason">Motivos: </label>
                    </FloatLabel>

                    <FloatLabel className="w-full mb-4">
                        <MultiSelect
                            inputId="dashboard-supervisor"
                            panelClassName="dashboard-filter-dropdown"
                            options={supervisorOptions}
                            value={filters.supervisor}
                            className="w-full"
                            onChange={(e) =>
                                setFilters(prev => ({
                                    ...prev,
                                    supervisor: e.value
                                }))
                            }
                        />
                        <label htmlFor="dashboard-supervisor">Supervisores: </label>
                    </FloatLabel>

                    <FloatLabel className="w-full mb-4">
                        <MultiSelect
                            inputId="dashboard-status"
                            panelClassName="dashboard-filter-dropdown"
                            options={statusOptions}
                            value={filters.status}
                            className="w-full"
                            onChange={(e) =>
                                setFilters(prev => ({
                                    ...prev,
                                    status: e.value
                                }))
                            }
                        />
                        <label htmlFor="dashboard-status">Status: </label>
                    </FloatLabel>

                    <Divider className="mt-4" />
                    <Button
                        className="font-bold w-full border-none"
                        icon="pi pi-filter-slash"
                        label="Limpar Filtros"
                        onClick={clearFilters}
                    />
                </OverlayPanel>

                <DashboardFilterButton panelRef={op_filters} activeCount={activeFilterCount} className="shadow-2" />
            </div>

            <div className="dashboard-content flex w-full min-h-full gap-4">
                <div className="dashboard-main flex flex-column flex-grow-1 gap-4">
                    {/* CHARTS FRAME */}
                    <div className="dashboard-charts flex flex-grow-1 gap-4 max-h-15rem">
                        <div className="dashboard-chart-card border-round-lg p-3 gap-2 flex flex-column justify-content-center align-items-center shadow-6 flex-grow-1">
                            <Chart data={dataRepos}
                                options={{
                                    aspectRatio: 2.5,
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    y: {
                                        beginAtZero: true,
                                    },
                                    plugins: {
                                        legend: {
                                            labels: {
                                                usePointStyle: true,
                                                pointStyle: 'rectRounded',
                                                padding: 20
                                            }
                                        },
                                        tooltip: {
                                            mode: 'index',
                                            intersect: false,
                                            callbacks: {
                                                title(items) {
                                                    return `Dia ${items[0].label}`;
                                                },
                                                label(context) {
                                                    return `${context.dataset.label}: ${context.raw}`;
                                                }
                                            }
                                        }
                                    }
                                }}
                                className="dashboard-chart flex align-items-center justify-content-center h-full"
                            />
                        </div>
                        <div className="dashboard-chart-card border-round-lg p-4 flex flex-column justify-content-center align-items-center shadow-6 flex-grow-1">
                            <Chart data={dataMults}
                                className="w-full h-full"
                                options={{
                                    aspectRatio: 2.5,
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            labels: {
                                                usePointStyle: true,
                                                pointStyle: 'rectRounded',
                                                padding: 20
                                            }
                                        },
                                        tooltip: {
                                            mode: 'index',
                                            intersect: false,
                                            callbacks: {
                                                title(items) {
                                                    return `Dia ${items[0].label}`;
                                                },
                                                label(context) {
                                                    return `${context.dataset.label}: ${to_real(context.raw)}`;
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* TABLE FRAME */}
                    <div className="dashboard-table flex overflow-hidden flex-grow-1 p-2 border-round-lg shadow-6">
                        <Table
                            tableClassName="w-full"
                            columns={columns}
                            data={dadosTabelaFiltraveis}
                            rowsPerPageOptions={[3, 5, 10, 50, 100]}
                            rows={5}
                            style={{
                                fontSize: "10px"
                            }}
                            search
                        />
                    </div>
                </div>

                {/* STATUS CARD */}
                <div className="dashboard-status flex flex-column p-4 flex-grow-1 border-round-lg shadow-6">
                    <TabView className="h-full">
                        <TabPanel header="Departamentos">
                            <div className="flex flex-column h-full">
                                <div className="flex flex-wrap justify-content-between align-items-center gap-2 p-2" >
                                    {departamentos.map((item, index) => {
                                        const [cor1, cor2] = cores[index % cores.length];
                                        const testeData = {
                                            labels: ['Cobertas', 'Descobertas'],
                                            datasets: [
                                                {
                                                    data: [item[1]["cobertas"], item[1]["descobertas"]],
                                                    backgroundColor: [cor1, cor2]
                                                }
                                            ]
                                        };

                                        return (
                                            <div key={item} className="dashboard-department-card flex flex-column flex-grow-1 justify-content-center align-items-center text-center shadow-6 border-round-lg" style={{ flexBasis: "100px" }}>
                                                <Chart className="flex-grow-1" type="doughnut" data={testeData} options={optionsDptos} style={{
                                                    width: '70px',
                                                }} />
                                                <span className="font-bold inter"> Dpto. {item[0]}</span>
                                            </div>
                                        )
                                    })
                                    }
                                </div>
                            </div>
                        </TabPanel>
                        <TabPanel header="Contratos">
                            <Chart
                                className="h-full"
                                data={dataLocals}
                                options={{
                                    aspectRatio: 1,
                                    autoPadding: true,
                                    indexAxis: 'y',
                                    plugins: {
                                        legend: {
                                            display: false
                                        },
                                        tooltip: {
                                            callbacks: {
                                                label: (self) => `Faltas: ${self.parsed.x}`
                                            }
                                        }
                                    },
                                    scales: {
                                        x: {
                                            display: false,
                                            ticks: {
                                                font: { size: 5 }
                                            }
                                        },
                                        y: {
                                            display: true,
                                            grid: {
                                                display: false,
                                                drawBorder: false
                                            },
                                            ticks: {
                                                font: { size: 8 },
                                                callback(value) {
                                                    const label = this.getLabelForValue(value);

                                                    return label.length > 20
                                                        ? label.slice(0, 20) + '...'
                                                        : label;
                                                }
                                            }
                                        }
                                    },
                                }}
                            />
                        </TabPanel>
                    </TabView>
                    <Divider />
                    <span className="font-bold mb-2">Status:</span>
                    <MeterGroup
                        className="h-full"
                        values={meterGroupValues}
                        orientation="vertical"
                        labelOrientation="vertical"
                    />
                </div>
            </div>
        </main>
    )
}
