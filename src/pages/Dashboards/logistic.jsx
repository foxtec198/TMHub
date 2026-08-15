import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Chart } from 'primereact/chart';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { MultiSelect } from 'primereact/multiselect';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Tag } from 'primereact/tag';


import { PageHeader } from '../../components/PageHeader';
import { useLoading } from '../../contexts/LoadingContext';
import { useToast } from '../../contexts/ToastContext';
import { useChartTheme } from '../../theme/useTheme';
import connect from '../../utils/request';
import './logistic.css';

const today = new Date();
const DEFAULT_FILTERS = {
    period: [new Date(today.getFullYear(), today.getMonth(), 1), today],
    product: [],
    type: [],
    employee: [],
    center: [],
};

function isoDate(value) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function EmptyChart({ label }) {
    return <div className="logistic-empty"><i className="pi pi-chart-bar" /><span>{label}</span></div>;
}

export function DashboardLogistic() {
    const chartTheme = useChartTheme();
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [data, setData] = useState(null);
    const [refresh, setRefresh] = useState(0);
    const filterPanel = useRef(null);
    const setLoading = useLoading();
    const { showToast } = useToast();

    useEffect(() => {
        if (!filters.period?.[0] || !filters.period?.[1]) return;
        let active = true;
        setLoading(true);
        const params = {
            inicio: isoDate(filters.period[0]),
            fim: isoDate(filters.period[1]),
        };
        if (filters.product.length) params.produto_id = filters.product.join(',');
        if (filters.type.length) params.tipo = filters.type.join(',');
        if (filters.employee.length) params.colaborador_id = filters.employee.join(',');
        if (filters.center.length) params.centro_custo_id = filters.center.join(',');
        connect.get('/estoque/movimentos/dashboard', { params })
            .then(({ data: response }) => active && setData(response))
            .catch((error) => active && showToast(
                'error',
                'Dashboard de Logística',
                error.response?.data || 'Não foi possível carregar os indicadores.',
            ))
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [filters, refresh, setLoading, showToast]);

    const indicators = data?.indicadores || {};
    const options = data?.filtros || {};
    const activeFilterCount = ['product', 'type', 'employee', 'center']
        .filter((key) => filters[key]?.length).length;
    const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value || [] }));
    const clearFilters = () => setFilters({
        ...DEFAULT_FILTERS,
        period: [new Date(today.getFullYear(), today.getMonth(), 1), new Date()],
    });

    const movementChart = useMemo(() => ({
        labels: (data?.serie || []).map((item) => new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })),
        datasets: [
            {
                label: 'Entradas',
                data: (data?.serie || []).map((item) => item.entrada),
                borderColor: chartTheme.palette[0],
                backgroundColor: chartTheme.palette[0],
                fill: true,
                tension: .35,
            },
            {
                label: 'Saídas',
                data: (data?.serie || []).map((item) => item.saida),
                borderColor: chartTheme.danger,
                backgroundColor: chartTheme.danger,
                fill: true,
                tension: .35,
            },
        ],
    }), [data?.serie, chartTheme]);

    const topProductsChart = useMemo(() => ({
        labels: (data?.mais_movimentados || []).map((item) => item.produto),
        datasets: [{
            data: (data?.mais_movimentados || []).map((item) => item.quantidade),
            backgroundColor: chartTheme.palette[0],
            borderRadius: 7,
        }],
    }), [data?.mais_movimentados, chartTheme]);

    const collaboratorChart = useMemo(() => ({
        labels: (data?.produtos_por_colaborador || data?.epis_por_colaborador || []).map((item) => item.colaborador),
        datasets: [{
            data: (data?.produtos_por_colaborador || data?.epis_por_colaborador || []).map((item) => item.quantidade),
            backgroundColor: chartTheme.palette[4],
            borderRadius: 7,
        }],
    }), [data?.produtos_por_colaborador, data?.epis_por_colaborador, chartTheme]);

    const localChart = useMemo(() => ({
        labels: (data?.produtos_por_local || data?.epis_por_local || []).map((item) => item.local),
        datasets: [{
            data: (data?.produtos_por_local || data?.epis_por_local || []).map((item) => item.quantidade),
            backgroundColor: chartTheme.palette[5],
            borderRadius: 7,
        }],
    }), [data?.produtos_por_local, data?.epis_por_local, chartTheme]);

    const axisOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { beginAtZero: true, grid: { color: chartTheme.grid }, ticks: { color: chartTheme.text, precision: 0 } },
            y: { grid: { display: false }, ticks: { color: chartTheme.text } },
        },
    };
    const horizontalOptions = { ...axisOptions, indexAxis: 'y' };

    return (
        <main className="logistic-dashboard">
            <PageHeader
                section="Dashboards"
                title="Dashboard de Logística"
                description="Estoque, movimentações e rastreabilidade das saídas de produtos."
                actions={(
                    <>
                        <div className="logistic-period">
                            <i className="pi pi-calendar" />
                            {filters.period?.[0]?.toLocaleDateString('pt-BR')} — {filters.period?.[1]?.toLocaleDateString('pt-BR')}
                        </div>
                        <Button
                            type="button"
                            icon="pi pi-filter-fill"
                            label={activeFilterCount ? `Filtros (${activeFilterCount})` : 'Filtros'}
                            aria-label="Abrir filtros do dashboard"
                            onClick={(event) => filterPanel.current?.toggle(event)}
                        />
                    </>
                )}
            />

            <section className="logistic-kpis">
                <article className="tm-dashboard-card is-primary"><i className="pi pi-box" /><span>Produtos cadastrados</span><strong>{indicators.produtos || 0}</strong></article>
                <article className="tm-dashboard-card"><i className="pi pi-database" /><span>Itens em estoque</span><strong>{indicators.itens_estoque || 0}</strong></article>
                <article className="tm-dashboard-card is-success"><i className="pi pi-arrow-down" /><span>Entradas no período</span><strong>{indicators.entradas || 0}</strong></article>
                <article className="tm-dashboard-card is-danger"><i className="pi pi-arrow-up" /><span>Saídas no período</span><strong>{indicators.saidas || 0}</strong></article>
                <article className="tm-dashboard-card is-warning"><i className="pi pi-exclamation-triangle" /><span>Estoque baixo</span><strong>{indicators.estoque_baixo || 0}</strong></article>
                <article className="tm-dashboard-card is-danger"><i className="pi pi-times-circle" /><span>Sem estoque</span><strong>{indicators.sem_estoque || 0}</strong></article>
                <article className="tm-dashboard-card is-info"><i className="pi pi-box" /><span>Produtos entregues</span><strong>{indicators.produtos_entregues || indicators.epis_entregues || 0}</strong></article>
            </section>

            <section className="logistic-grid logistic-grid-main">
                <article className="logistic-panel tm-dashboard-panel">
                    <header><div><span>Fluxo do período</span><h2>Entradas e saídas</h2></div></header>
                    <div className="logistic-chart">
                        {data?.serie?.length
                            ? <Chart type="line" data={movementChart} options={{ ...axisOptions, plugins: { legend: { position: 'top', labels: { color: '#91a098' } } } }} />
                            : <EmptyChart label="Nenhuma movimentação no período." />}
                    </div>
                </article>
                <article className="logistic-panel tm-dashboard-panel">
                    <header><div><span>Giro de estoque</span><h2>Produtos mais movimentados</h2></div></header>
                    <div className="logistic-chart">
                        {data?.mais_movimentados?.length
                            ? <Chart type="bar" data={topProductsChart} options={horizontalOptions} />
                            : <EmptyChart label="Sem produtos movimentados." />}
                    </div>
                </article>
            </section>

            <section className="logistic-grid">
                <article className="logistic-panel tm-dashboard-panel">
                    <header><div><span>Distribuição de produtos</span><h2>Saídas por colaborador</h2></div></header>
                    <div className="logistic-chart">
                        {(data?.produtos_por_colaborador || data?.epis_por_colaborador)?.length
                            ? <Chart type="bar" data={collaboratorChart} options={horizontalOptions} />
                            : <EmptyChart label="Nenhuma saída para colaborador registrada." />}
                    </div>
                </article>
                <article className="logistic-panel tm-dashboard-panel">
                    <header><div><span>Contratos e locais</span><h2>Saídas por centro de custo</h2></div></header>
                    <div className="logistic-chart">
                        {(data?.produtos_por_local || data?.epis_por_local)?.length
                            ? <Chart type="bar" data={localChart} options={horizontalOptions} />
                            : <EmptyChart label="Nenhuma saída vinculada a local." />}
                    </div>
                </article>
            </section>

            <section className="logistic-grid logistic-grid-detail">
                <article className="logistic-panel tm-dashboard-panel">
                    <header><div><span>Atenção operacional</span><h2>Produtos abaixo do mínimo</h2></div></header>
                    <DataTable value={data?.estoque_baixo || []} rows={8} paginator size="small" emptyMessage="Nenhum produto com estoque baixo.">
                        <Column field="produto" header="Produto" sortable />
                        <Column field="quantidade" header="Atual" sortable />
                        <Column field="minimo" header="Mínimo" sortable />
                        <Column header="Situação" body={(row) => <Tag value={row.quantidade <= 0 ? 'SEM ESTOQUE' : 'BAIXO'} severity={row.quantidade <= 0 ? 'danger' : 'warning'} />} />
                    </DataTable>
                </article>
                <article className="logistic-panel tm-dashboard-panel">
                    <header><div><span>Histórico recente</span><h2>Últimas movimentações</h2></div></header>
                    <DataTable value={data?.recentes || []} rows={8} paginator size="small" emptyMessage="Nenhuma movimentação encontrada.">
                        <Column field="data_hora" header="Data" body={(row) => new Date(row.data_hora).toLocaleString('pt-BR')} />
                        <Column field="produto" header="Produto" />
                        <Column field="tipo" header="Tipo" body={(row) => <Tag value={row.tipo.toUpperCase()} severity={row.tipo === 'entrada' ? 'success' : 'danger'} />} />
                        <Column field="quantidade" header="Qtd." />
                        <Column field="responsavel" header="Responsável" />
                        <Column header="Destinatários" body={(row) => row.destinatarios?.map((item) => item.colaborador).join(', ') || '—'} />
                    </DataTable>
                </article>
            </section>

            <OverlayPanel ref={filterPanel} className="dashboard-filter-panel">
                <div className="dashboard-filter-title">
                    <div><strong>Filtrar logística</strong><span>Todos os indicadores usam o mesmo recorte.</span></div>
                    <Button icon="pi pi-filter-slash" label="Limpar filtros" text severity="secondary" onClick={clearFilters} />
                </div>
                <div className="dashboard-filter-grid">
                    <label className="is-wide"><span>Período</span><Calendar value={filters.period} onChange={(event) => setFilter('period', event.value)} selectionMode="range" readOnlyInput hideOnRangeSelection dateFormat="dd/mm/yy" showIcon /></label>
                    <label><span>Produto</span><MultiSelect value={filters.product} options={options.produtos || []} onChange={(event) => setFilter('product', event.value)} filter showClear display="chip" placeholder="Todos" /></label>
                    <label><span>Tipo</span><MultiSelect value={filters.type} options={[{ label: 'Entrada', value: 'entrada' }, { label: 'Saída', value: 'saida' }]} onChange={(event) => setFilter('type', event.value)} showClear display="chip" placeholder="Todos" /></label>
                    <label className="is-wide"><span>Colaborador</span><MultiSelect value={filters.employee} options={options.colaboradores || []} onChange={(event) => setFilter('employee', event.value)} filter showClear display="chip" placeholder="Todos" /></label>
                    <label className="is-wide"><span>Local, contrato ou centro de custo</span><MultiSelect value={filters.center} options={options.centros_custo || []} onChange={(event) => setFilter('center', event.value)} filter showClear display="chip" placeholder="Todos" /></label>
                </div>
            </OverlayPanel>
        </main>
    );
}
