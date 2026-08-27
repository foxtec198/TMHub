import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import './Termination.css'
import './pcd.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Chart } from 'primereact/chart';
import { Column } from 'primereact/column';
import { DataTable } from "../../components/tables/DataTable";
import { MultiSelect } from 'primereact/multiselect';
import { OverlayPanel } from 'primereact/overlaypanel';

import connect from '../../utils/request';
import { useLoading } from '../../contexts/LoadingContext';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader } from '../../components/PageHeader';
import { useChartTheme } from '../../theme/useTheme';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function dateParam(value) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function monthLabel(value) {
    const [year, month] = String(value).split('-').map(Number);
    return `${MONTHS[month - 1]}/${String(year).slice(-2)}`;
}

function formatCurrency(value, compact = false) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 2,
    }).format(Number(value || 0));
}

function formatCardNumber(value) {
    const number = Number(value || 0);
    const absolute = Math.abs(Number.isFinite(number) ? number : 0);
    const sign = number < 0 ? '-' : '';

    if (absolute < 100_000) {
        return `${sign}${Math.trunc(absolute).toLocaleString('pt-BR')}`;
    }

    const scale = absolute >= 1_000_000_000
        ? { divisor: 1_000_000_000, suffix: 'B' }
        : absolute >= 1_000_000
            ? { divisor: 1_000_000, suffix: 'M' }
            : { divisor: 1_000, suffix: 'K' };
    const scaled = scale.suffix === 'K'
        ? Math.trunc(absolute / scale.divisor)
        : Math.trunc((absolute / scale.divisor) * 10) / 10;

    return `${sign}${scaled.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${scale.suffix}`;
}

function formatCardCurrency(value) {
    const number = Number(value || 0);
    return `${number < 0 ? '-' : ''}R$ ${formatCardNumber(Math.abs(number))}`;
}

function formatDate(value) {
    if (!value) return '-';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
}

function SummaryCard({ icon, label, value, detail, tone = 'neutral' }) {
    return (
        <article className={`termination-dashboard-card tm-dashboard-card is-${tone}`}>
            <span className="termination-dashboard-card__icon">{typeof icon === "string" ? <AppIcon name={icon} /> : icon}</span>
            <span>
                <small>{label}</small>
                <strong>{value}</strong>
                <em>{detail}</em>
            </span>
        </article>
    );
}

function TerminationFilterButton({ panelRef, activeCount = 0 }) {
    return (
        <Button
            type="button"
            icon={<AppIcon name="filter-filled" />}
            label={activeCount ? `Filtros (${activeCount})` : 'Filtros'}
            className="dashboard-filter-trigger"
            aria-label="Abrir filtros do dashboard de rescisões"
            onClick={(event) => panelRef.current?.toggle(event)}
        />
    );
}

function TerminationFilterPanel({
    panelRef,
    period,
    onPeriodChange,
    fields,
    onClear,
}) {
    return (
        <OverlayPanel ref={panelRef} className="dashboard-filter-panel">
            <div className="dashboard-filter-title">
                <div>
                    <strong>Filtrar rescisões</strong>
                    <span>Os filtros abaixo respeitam as filiais selecionadas no menu principal.</span>
                </div>
                <Button
                    type="button"
                    icon={<AppIcon name="filter-off" />}
                    label="Limpar filtros"
                    text
                    severity="secondary"
                    onClick={onClear}
                />
            </div>

            <div className="dashboard-filter-grid">
                <label>
                    <span>Período</span>
                    <Calendar
                        value={period}
                        onChange={(event) => onPeriodChange(event.value)}
                        selectionMode="range"
                        readOnlyInput
                        hideOnRangeSelection
                        dateFormat="dd/mm/yy"
                        placeholder="Selecione o período"
                        showIcon
                        showButtonBar
                    />
                </label>

                {fields.map((field) => (
                    <label key={field.name}>
                        <span>{field.label}</span>
                        <MultiSelect
                            value={field.value || []}
                            options={field.options || []}
                            optionLabel="label"
                            optionValue="value"
                            onChange={(event) => field.onChange(event.value || [])}
                            placeholder={field.placeholder || `Todos os ${field.label.toLowerCase()}`}
                            display="chip"
                            filter
                            showClear
                            className="w-full"
                            maxSelectedLabels={2}
                            selectedItemsLabel="{0} selecionados"
                            panelClassName="dashboard-filter-dropdown"
                        />
                    </label>
                ))}
            </div>
        </OverlayPanel>
    );
}

export function TerminationDashboard() {
    const chartTheme = useChartTheme();
    const now = new Date();
    const defaultPeriod = () => [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31)];
    const emptyFilters = () => ({ departamento: [], motivo: [], contrato: [], supervisor: [], aviso: [] });

    const [period, setPeriod] = useState(defaultPeriod);
    const [filters, setFilters] = useState(emptyFilters);
    const [data, setData] = useState(null);
    const [refresh, setRefresh] = useState(0);
    const [activeTable, setActiveTable] = useState('branches');
    const setGlobalLoading = useLoading();
    const { showToast } = useToast();
    const filterPanel = useRef(null);

    useEffect(() => {
        if (!period?.[0] || !period?.[1]) return undefined;
        let cancelled = false;

        const load = async () => {
            setGlobalLoading(true);
            try {
                const response = await connect.get('/dash/rescisoes', {
                    params: {
                        inicio: dateParam(period[0]),
                        fim: dateParam(period[1]),
                        departamento: filters.departamento.join(',') || undefined,
                        motivo: filters.motivo.join(',') || undefined,
                        contrato: filters.contrato.join(',') || undefined,
                        supervisor: filters.supervisor.join(',') || undefined,
                        aviso: filters.aviso.join(',') || undefined,
                    },
                });
                if (!cancelled) setData(response.data);
            } catch (error) {
                console.warn(error);
                if (!cancelled) showToast('error', 'Dashboard de rescisões', 'Não foi possível carregar os indicadores.');
            } finally {
                if (!cancelled) setGlobalLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [period, filters, refresh, setGlobalLoading, showToast]);

    const monthsWithData = useMemo(() => (data?.mensal || []).filter(
        (item) => Number(item.quantidade || 0) > 0 || Number(item.custo_total || 0) > 0,
    ), [data]);

    const monthlyChart = useMemo(() => ({
        labels: monthsWithData.map((item) => monthLabel(item.mes)),
        datasets: [
            {
                label: 'Rescisões',
                data: monthsWithData.map((item) => item.quantidade),
                backgroundColor: chartTheme.palette[0],
                borderRadius: 5,
                maxBarThickness: 36,
                categoryPercentage: .72,
                barPercentage: .92,
                yAxisID: 'volume',
                order: 2,
            },
            {
                type: 'line',
                label: 'Custo total',
                data: monthsWithData.map((item) => item.custo_total),
                borderColor: chartTheme.palette[1],
                backgroundColor: chartTheme.palette[1],
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 5,
                tension: 0.25,
                yAxisID: 'cost',
                order: 1,
            },
        ],
    }), [monthsWithData, chartTheme]);

    const monthlyOptions = {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
            tooltip: {
                callbacks: {
                    label: (context) => context.dataset.yAxisID === 'cost'
                        ? `${context.dataset.label}: ${formatCurrency(context.raw)}`
                        : `${context.dataset.label}: ${context.raw}`,
                },
            },
        },
        scales: {
            x: { grid: { display: false }, border: { display: false } },
            volume: { beginAtZero: true, ticks: { precision: 0 }, border: { display: false }, title: { display: true, text: 'Rescisões' } },
            cost: { position: 'right', beginAtZero: true, grid: { display: false }, border: { display: false }, ticks: { callback: (value) => formatCurrency(value, true) }, title: { display: true, text: 'Custo' } },
        },
    };

    const indicators = data?.indicadores || {};
    const filterOptions = data?.filtros || {};
    const activeFilterCount = Object.values(filters).filter((value) => value.length).length;
    const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value || [] }));
    const clearFilters = () => {
        setPeriod(defaultPeriod());
        setFilters(emptyFilters());
    };

    const summary = [
        { icon: appIcon("user-minus"), label: 'Rescisões', value: formatCardNumber(indicators.total_rescisoes), detail: 'no período selecionado' },
        { icon: appIcon("chart-line"), label: 'Custo total', value: formatCardCurrency(indicators.custo_total), detail: 'proventos + FGTS', tone: 'primary' },
        { icon: appIcon("calculator"), label: 'Custo médio', value: formatCardCurrency(indicators.custo_medio), detail: 'por rescisão' },
        { icon: appIcon("arrow-up-right"), label: 'Proventos', value: formatCardCurrency(indicators.proventos), detail: 'valor bruto', tone: 'success' },
        { icon: appIcon("arrow-down-right"), label: 'Descontos', value: formatCardCurrency(indicators.descontos), detail: 'retenções informadas', tone: 'danger' },
        { icon: appIcon("building-bank"), label: 'FGTS rescisório', value: formatCardCurrency(indicators.fgts_rescisorio), detail: 'guias rescisórias', tone: 'warning' },
    ];

    const moneyColumn = (field) => (row) => formatCurrency(row[field]);
    const mainReason = data?.motivos?.[0];
    const highestImpactBranch = data?.filiais?.[0];
    const highestCostMonth = useMemo(() => [...monthsWithData]
        .sort((first, second) => Number(second.custo_total || 0) - Number(first.custo_total || 0))[0], [monthsWithData]);

    return (
        <section className="termination-dashboard">
            <PageHeader
                section="Dashboards"
                title="Rescisões"
                description="Acompanhe o volume e os valores das rescisões por período, filial e contrato."
            />

            <div className="termination-dashboard-summary">
                {summary.map((item) => <SummaryCard key={item.label} {...item} />)}
            </div>

            <div className="termination-dashboard-charts">
                <article className="termination-dashboard-panel tm-dashboard-panel is-monthly">
                    <header>
                        <div><span>EVOLUÇÃO MENSAL</span><h2>Volume e custo das rescisões</h2></div>
                    </header>
                    <div className="termination-dashboard-chart">
                        {monthsWithData.length ? (
                            <Chart type="bar" data={monthlyChart} options={monthlyOptions} />
                        ) : (
                            <div className="termination-dashboard-empty-chart">
                                <AppIcon name="chart-bar"  />
                                <span>Nenhuma rescisão encontrada no período.</span>
                            </div>
                        )}
                    </div>
                </article>

                <article className="termination-dashboard-panel tm-dashboard-panel pcd-dashboard-insight">
                    <span>Leitura executiva</span>
                    <h2>
                        {!indicators.total_rescisoes
                            ? 'Sem rescisões no período'
                            : indicators.total_rescisoes === 1
                                ? '1 rescisão no período'
                                : `${indicators.total_rescisoes} rescisões no período`}
                    </h2>
                    <p>
                        A leitura considera o volume e o impacto financeiro das rescisões dentro do período e das filiais selecionadas.
                    </p>

                    <div>
                        <span>
                            <small>Motivo predominante</small>
                            <strong title={mainReason?.motivo}>{mainReason?.motivo || '-'}</strong>
                        </span>
                        <em>{mainReason ? `${mainReason.quantidade} · ${mainReason.percentual}%` : 'Sem dados'}</em>
                    </div>

                    <div>
                        <span>
                            <small>Mês de maior custo</small>
                            <strong>{highestCostMonth ? monthLabel(highestCostMonth.mes) : '-'}</strong>
                        </span>
                        <em>{highestCostMonth ? formatCurrency(highestCostMonth.custo_total) : 'Sem dados'}</em>
                    </div>

                    <div>
                        <span>
                            <small>Filial de maior impacto</small>
                            <strong title={highestImpactBranch?.filial}>{highestImpactBranch?.filial || '-'}</strong>
                        </span>
                        <em>{highestImpactBranch ? formatCurrency(highestImpactBranch.custo_total) : 'Sem dados'}</em>
                    </div>

                    <div className="pcd-dashboard-status-strip">
                        <div className="tm-dashboard-card is-active">
                            <span>Rescisões</span>
                            <strong>{formatCardNumber(indicators.total_rescisoes)}</strong>
                        </div>
                        <div className="tm-dashboard-card is-earnings">
                            <span>Proventos</span>
                            <strong>{formatCardCurrency(indicators.proventos)}</strong>
                        </div>
                        <div className="tm-dashboard-card is-discounts">
                            <span>Descontos</span>
                            <strong>{formatCardCurrency(indicators.descontos)}</strong>
                        </div>
                        <div className="tm-dashboard-card is-cost">
                            <span>Custo total</span>
                            <strong>{formatCardCurrency(indicators.custo_total)}</strong>
                        </div>
                    </div>
                </article>
            </div>

            <article className="termination-dashboard-table-panel tm-dashboard-panel">
                <nav className="termination-dashboard-tabs" aria-label="Visualizações do dashboard de rescisões">
                    <button type="button" className={activeTable === 'branches' ? 'is-active' : ''} onClick={() => setActiveTable('branches')}><AppIcon name="building"  /><span>Por filial</span></button>
                    <button type="button" className={activeTable === 'contracts' ? 'is-active' : ''} onClick={() => setActiveTable('contracts')}><AppIcon name="briefcase"  /><span>Por contrato</span></button>
                    <button type="button" className={activeTable === 'recent' ? 'is-active' : ''} onClick={() => setActiveTable('recent')}><AppIcon name="history"  /><span>Rescisões recentes</span></button>
                </nav>

                <div className="termination-dashboard-table-content">
                    {activeTable === 'branches' && (
                        <DataTable value={data?.filiais || []} size="small" stripedRows paginator rows={10} rowsPerPageOptions={[10, 20, 50]} emptyMessage="Sem rescisões no período.">
                            <Column field="filial" header="Filial" sortable style={{ minWidth: '14rem' }} />
                            <Column field="quantidade" header="Rescisões" sortable />
                            <Column header="Proventos" body={moneyColumn('proventos')} sortable sortField="proventos" />
                            <Column header="Descontos" body={moneyColumn('descontos')} sortable sortField="descontos" />
                            <Column header="Líquido" body={moneyColumn('liquido')} sortable sortField="liquido" />
                            <Column header="FGTS rescisório" body={moneyColumn('fgts_rescisorio')} sortable sortField="fgts_rescisorio" />
                            <Column header="Custo total" body={moneyColumn('custo_total')} sortable sortField="custo_total" />
                            <Column header="Custo médio" body={moneyColumn('custo_medio')} sortable sortField="custo_medio" />
                        </DataTable>
                    )}

                    {activeTable === 'contracts' && (
                        <DataTable value={data?.contratos || []} size="small" stripedRows paginator rows={10} rowsPerPageOptions={[10, 20, 50]} emptyMessage="Sem contratos no período.">
                            <Column field="contrato" header="Contrato" sortable style={{ minWidth: '16rem' }} />
                            <Column field="filial" header="Filial" sortable />
                            <Column field="departamento" header="Departamento" sortable />
                            <Column field="supervisor" header="Supervisor" sortable />
                            <Column field="quantidade" header="Rescisões" sortable />
                            <Column header="Líquido" body={moneyColumn('liquido')} sortable sortField="liquido" />
                            <Column header="Custo total" body={moneyColumn('custo_total')} sortable sortField="custo_total" />
                            <Column header="Custo médio" body={moneyColumn('custo_medio')} sortable sortField="custo_medio" />
                        </DataTable>
                    )}

                    {activeTable === 'recent' && (
                        <DataTable value={data?.recentes || []} size="small" stripedRows paginator rows={10} emptyMessage="Sem rescisões no período.">
                            <Column header="Colaborador" body={(row) => <div className="termination-dashboard-person"><strong>{row.nome}</strong><span>Matrícula {row.matricula}</span></div>} style={{ minWidth: '16rem' }} />
                            <Column header="Demissão" body={(row) => formatDate(row.data_demissao)} sortable sortField="data_demissao" />
                            <Column field="motivo" header="Motivo" sortable style={{ minWidth: '16rem' }} />
                            <Column field="filial" header="Filial" sortable />
                            <Column field="contrato" header="Contrato" sortable style={{ minWidth: '14rem' }} />
                            <Column header="Líquido" body={moneyColumn('liquido')} sortable sortField="liquido" />
                            <Column header="Custo total" body={moneyColumn('custo_total')} sortable sortField="custo_total" />
                        </DataTable>
                    )}
                </div>
            </article>

            <TerminationFilterPanel
                panelRef={filterPanel}
                period={period}
                onPeriodChange={setPeriod}
                onClear={clearFilters}
                fields={[
                    { name: 'departamento', label: 'Departamentos', value: filters.departamento, options: (filterOptions.departamentos || []).map((value) => ({ label: `DPTO. ${value}`, value: String(value) })), onChange: (value) => setFilter('departamento', value) },
                    { name: 'motivo', label: 'Motivos', value: filters.motivo, options: (filterOptions.motivos || []).map((value) => ({ label: value, value })), onChange: (value) => setFilter('motivo', value) },
                    { name: 'contrato', label: 'Contratos', value: filters.contrato, options: (filterOptions.contratos || []).map((value) => ({ label: value, value })), onChange: (value) => setFilter('contrato', value) },
                    { name: 'supervisor', label: 'Supervisores', value: filters.supervisor, options: (filterOptions.supervisores || []).map((value) => ({ label: value, value })), onChange: (value) => setFilter('supervisor', value) },
                    { name: 'aviso', label: 'Tipos de aviso', value: filters.aviso, options: (filterOptions.avisos || []).map((value) => ({ label: value, value })), onChange: (value) => setFilter('aviso', value) },
                ]}
            />
        </section>
    );
}
