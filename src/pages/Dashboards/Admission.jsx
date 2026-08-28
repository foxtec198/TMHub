import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
import './admission.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Chart } from 'primereact/chart';
import { Column } from 'primereact/column';
import { DataTable } from "../../components/tables/DataTable";
import { MultiSelect } from 'primereact/multiselect';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Tag } from 'primereact/tag';

import connect from '../../utils/request';
import { useLoading } from '../../contexts/LoadingContext';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader } from '../../components/PageHeader';
import { useChartTheme } from '../../theme/useTheme';

const STATUS_LABELS = {
    aberta: 'ABERTAS',
    entrevista: 'ENTREVISTA',
    certidao: 'CERTIDAO',
    aso: 'ASO',
    unico: 'UNICO',
    concluido: 'CONCLUIDO',
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Mantém o período como data civil, sem deslocamentos provocados por UTC.
function dateParam(value) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function monthLabel(value) {
    const [year, month] = value.split('-').map(Number);
    return `${MONTHS[month - 1]}/${String(year).slice(-2)}`;
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
}

function formatDateOnly(value) {
    if (!value) return '-';

    const isoDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}

function formatHours(value) {
    // Acima de 24 horas a leitura em dias é mais útil para o acompanhamento executivo.
    if (value == null) return '-';
    return value >= 24 ? `${(value / 24).toFixed(1)} dias` : `${Number(value).toFixed(1)}h úteis`;
}

function SummaryCard({ icon, label, value, detail, tone = 'neutral' }) {
    return (
        <article className={`admission-summary-card tm-dashboard-card is-${tone}`}>
            <span className="admission-summary-card__icon">{typeof icon === "string" ? <AppIcon name={icon} /> : icon}</span>
            <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
        </article>
    );
}

export function AdmissionDashboard() {
    const chartTheme = useChartTheme();
    const now = new Date();
    const [period, setPeriod] = useState([new Date(now.getFullYear(), now.getMonth() - 5, 1), now]);
    const [filters, setFilters] = useState({ departamento: [], status: [], contrato: [], responsavel: [], colaborador: [] });
    const [data, setData] = useState(null);
    const [activeTable, setActiveTable] = useState('departments');
    const setGlobalLoading = useLoading();
    const { showToast } = useToast();
    const filterPanel = useRef(null);

    useEffect(() => {
        // Só consulta a API quando o intervalo estiver completo; refresh força uma nova leitura.
        if (!period?.[0] || !period?.[1]) return;
        let cancelled = false;
        const load = async () => {
            setGlobalLoading(true);
            try {
                const response = await connect.get('/admissao/vagas/dashboard', {
                    params: {
                        inicio: dateParam(period[0]), fim: dateParam(period[1]),
                        departamento: filters.departamento.join(',') || undefined,
                        status: filters.status.join(',') || undefined,
                        contrato: filters.contrato.join(',') || undefined,
                        responsavel: filters.responsavel.join(',') || undefined,
                        colaborador: filters.colaborador.join(',') || undefined,
                    },
                });
                if (!cancelled) setData(response.data);
            } catch (error) {
                console.warn(error);
                if (!cancelled) showToast('error', 'Dashboard de admissões', 'Não foi possível carregar os indicadores.');
            } finally {
                if (!cancelled) setGlobalLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [period, filters, setGlobalLoading, showToast]);

    // Barras mostram volume e a linha usa um segundo eixo para não distorcer a escala de vagas.
    const monthlyChart = useMemo(() => ({
        labels: (data?.mensal || []).map((item) => monthLabel(item.mes)),
        datasets: [
            { label: 'Vagas avisadas', data: (data?.mensal || []).map((item) => item.avisadas), backgroundColor: chartTheme.palette[0], borderRadius: 6, maxBarThickness: 34, order: 2 },
            { label: 'Vagas concluídas', data: (data?.mensal || []).map((item) => item.concluidas), backgroundColor: chartTheme.palette[1], borderRadius: 6, maxBarThickness: 34, order: 2 },
            { type: 'line', label: 'SLA primeira ação (h)', data: (data?.mensal || []).map((item) => item.sla_acao_horas), borderColor: chartTheme.warning, backgroundColor: chartTheme.warning, pointRadius: 4, pointHoverRadius: 5, tension: .35, yAxisID: 'sla', order: 1 },
        ],
    }), [data, chartTheme]);

    const chartOptions = {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } } },
        scales: {
            x: { grid: { display: false }, border: { display: false } },
            y: { beginAtZero: true, grid: { color: chartTheme.grid }, border: { display: false }, ticks: { precision: 0, color: chartTheme.text }, title: { display: true, text: 'Vagas' } },
            sla: { position: 'right', beginAtZero: true, suggestedMax: 30, grid: { display: false }, border: { display: false }, title: { display: true, text: 'Horas' } },
        },
    };

    const indicators = data?.indicadores || {};
    const filterOptions = data?.filtros || {};
    const activeFilterCount = Object.values(filters).filter((value) => value.length).length;
    const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value || [] }));
    const clearFilters = () => {
        setPeriod([new Date(now.getFullYear(), now.getMonth() - 5, 1), new Date()]);
        setFilters({ departamento: [], status: [], contrato: [], responsavel: [], colaborador: [] });
    };
    const actionTarget = data?.metas?.acao_horas ?? 24;
    const closeTargetDays = (data?.metas?.conclusao_horas ?? 120) / 24;
    // A cópia evita ordenar diretamente o array retornado pela API.
    const bestDepartment = useMemo(() => [...(data?.departamentos || [])]
        .filter((item) => item.percentual_no_prazo != null)
        .sort((a, b) => b.percentual_no_prazo - a.percentual_no_prazo)[0], [data]);

    // Os tons dos cards refletem a comparação de cada indicador com sua meta vigente.
    const summary = [
        { icon: appIcon("briefcase"), label: 'Vagas no período', value: indicators.total_vagas ?? 0, detail: `${indicators.vagas_concluidas ?? 0} concluídas`, tone: 'neutral' },
        { icon: appIcon("calendar-plus"), label: 'Com data prevista', value: indicators.vagas_data_prevista ?? 0, detail: 'não contabilizadas no SLA', tone: 'warning' },
        { icon: appIcon("bolt"), label: 'Primeira ação', value: formatHours(indicators.sla_acao_medio_horas), detail: `meta de até ${actionTarget}h úteis`, tone: indicators.sla_acao_medio_horas <= actionTarget ? 'success' : 'warning' },
        { icon: appIcon("circle-check"), label: 'Conclusão', value: indicators.sla_conclusao_medio_dias != null ? `${indicators.sla_conclusao_medio_dias} dias` : '-', detail: `meta de até ${closeTargetDays} dias úteis`, tone: indicators.sla_conclusao_medio_dias <= closeTargetDays ? 'success' : 'danger' },
        { icon: appIcon("chart-line"), label: 'Dentro do SLA', value: indicators.percentual_no_prazo != null ? `${indicators.percentual_no_prazo}%` : '-', detail: 'ação e conclusão', tone: indicators.percentual_no_prazo >= 80 ? 'success' : 'warning' },
        { icon: appIcon("hourglass"), label: 'Em andamento', value: indicators.vagas_em_andamento ?? 0, detail: `${indicators.sla_estourado ?? 0} fora do prazo`, tone: indicators.sla_estourado ? 'danger' : 'violet' },
    ];

    return (
        <section className="admission-dashboard">

            <PageHeader
                section="Dashboards"
                title="SLA de Admissões"
                description="Acompanhe a velocidade de resposta e conclusão. Vagas com saída prevista permanecem fora do SLA."
                actions={<>
                    <StandardFilterButton panelRef={filterPanel} count={activeFilterCount} />
                </>}
            />

            <div className="admission-summary">
                {summary.map((item) => <SummaryCard key={item.label} {...item} />)}
            </div>

            <div className="admission-analysis">
                <article className="admission-panel tm-dashboard-panel">
                    <header><div><span>Evolução mensal</span><h2>Volume de vagas e tempo de primeira ação</h2></div><Tag value={`Meta ${actionTarget}h`} severity="warning" rounded /></header>
                    <div className="admission-chart"><Chart type="bar" data={monthlyChart} options={chartOptions} /></div>
                </article>

                <article className="admission-panel tm-dashboard-panel admission-insight">
                    <span>Leitura executiva</span>
                    <h2>{indicators.percentual_no_prazo >= 80 ? 'Operação dentro da meta' : 'SLA exige atenção'}</h2>
                    <p>O indicador combina a primeira ação do responsável e o tempo total até a conclusão da vaga.</p>
                    <div><span><small>Melhor departamento</small><strong>{bestDepartment ? `DPTO. ${bestDepartment.departamento}` : '-'}</strong></span><em>{bestDepartment?.percentual_no_prazo ?? 0}% no prazo</em></div>
                    <div><span><small>Primeira ação</small><strong>{formatHours(indicators.sla_acao_medio_horas)}</strong></span><em>{indicators.sla_acao_medio_horas <= actionTarget ? 'dentro da meta' : 'acima da meta'}</em></div>
                    <div><span><small>Fechamento</small><strong>{indicators.sla_conclusao_medio_dias ?? '-'} dias úteis</strong></span><em>{indicators.sla_conclusao_medio_dias <= closeTargetDays ? 'dentro da meta' : 'acima da meta'}</em></div>
                    <div className="admission-status-strip">
                        {(data?.status || []).map((item) => (
                            <div className={`admission-status-card tm-dashboard-card is-${item.status}`} key={item.status}>
                                <span>{STATUS_LABELS[item.status]}</span>
                                <strong>{item.total}</strong>
                            </div>
                        ))}
                    </div>
                </article>
            </div>

            <article className="admission-table-panel tm-dashboard-panel">
                <nav className="admission-table-tabs" aria-label="Visualizações do dashboard">
                    <button className={activeTable === 'departments' ? 'is-active' : ''} type="button" onClick={() => setActiveTable('departments')}><AppIcon name="building"  /><span>SLA por departamento</span></button>
                    <button className={activeTable === 'recent' ? 'is-active' : ''} type="button" onClick={() => setActiveTable('recent')}><AppIcon name="history"  /><span>Vagas recentes</span></button>
                    <button className={activeTable === 'attention' ? 'is-active is-attention' : ''} type="button" onClick={() => setActiveTable('attention')}><AppIcon name="alert-triangle"  /><span>Atenção</span><em>{data?.atencao?.length || 0}</em></button>
                </nav>

                <div className="admission-table-content">
                    {activeTable === 'departments' && <DataTable value={data?.departamentos || []} size="small" stripedRows paginator rows={10} rowsPerPageOptions={[10, 20, 50]} emptyMessage="Sem dados no período.">
                        <Column field="departamento" header="Departamento" sortable />
                        <Column field="total" header="Vagas" sortable />
                        <Column field="data_prevista" header="Com data prevista" sortable />
                        <Column header="Primeira ação" body={(row) => formatHours(row.sla_acao_horas)} sortable sortField="sla_acao_horas" />
                        <Column header="Conclusão" body={(row) => row.sla_conclusao_dias != null ? `${row.sla_conclusao_dias} dias úteis` : '-'} sortable sortField="sla_conclusao_dias" />
                        <Column header="Dentro do SLA" body={(row) => <Tag value={row.percentual_no_prazo != null ? `${row.percentual_no_prazo}%` : '-'} severity={row.percentual_no_prazo >= 80 ? 'success' : row.percentual_no_prazo >= 60 ? 'warning' : 'danger'} rounded />} sortable sortField="percentual_no_prazo" />
                    </DataTable>}

                    {activeTable === 'recent' && <DataTable value={data?.recentes || []} size="small" stripedRows paginator rows={10} emptyMessage="Sem vagas no período.">
                        <Column header="Vaga" body={(row) => <div className="admission-vacancy-cell"><strong>{row.candidato || row.colaborador_saida || 'Sem candidato'}</strong><span>{row.candidato_matricula ? `Matrícula ${row.candidato_matricula} • ${row.contrato}` : row.contrato}</span></div>} style={{ minWidth: '18rem' }} />
                        <Column header="Aviso" body={(row) => formatDateTime(row.aviso_em)} sortable sortField="aviso_em" />
                        <Column
                            header="Saída prevista"
                            body={(row) => row.data_saida_prevista
                                ? <Tag value={formatDateOnly(row.data_saida)} severity="warning" icon={<AppIcon name="calendar" />} rounded />
                                : '-'}
                            sortable
                            sortField="data_saida"
                        />
                        <Column header="Responsável" field="responsavel" />
                        <Column header="Tentativas" field="tentativas" />
                        <Column
                            header="Primeira ação"
                            body={(row) => row.data_saida_prevista
                                ? <Tag value="Fora do SLA" severity="secondary" rounded />
                                : formatHours(row.sla_acao_horas ?? row.sla_acao_decorrido_horas)}
                        />
                        <Column header="Status" body={(row) => <Tag value={STATUS_LABELS[row.status] || row.status} severity={row.status === 'concluido' ? 'success' : 'info'} rounded />} />
                    </DataTable>}

                    {activeTable === 'attention' && <DataTable value={data?.atencao || []} size="small" stripedRows emptyMessage="Nenhuma vaga exige atenção no período.">
                        <Column header="Colaborador que saiu" field="colaborador_saida" />
                        <Column header="Contrato" field="contrato" style={{ minWidth: '18rem' }} />
                        <Column header="Responsável" field="responsavel" />
                        <Column header="Tentativas" field="tentativas" />
                        <Column header="Tempo decorrido" body={(row) => <strong className={row.sla_estourado ? 'admission-overdue' : ''}>{formatHours(row.sla_acao_decorrido_horas)}</strong>} />
                        <Column header="Status" body={(row) => <Tag value={STATUS_LABELS[row.status] || row.status} severity={row.sla_estourado ? 'danger' : 'warning'} rounded />} />
                    </DataTable>}
                </div>
            </article>
            <OverlayPanel ref={filterPanel} className="dashboard-filter-panel">
                <div className="dashboard-filter-title">
                    <div><strong>Filtrar admissões</strong><span>Combine os filtros para atualizar todos os indicadores e gráficos.</span></div>
                    <Button type="button" icon={<AppIcon name="filter-off" />} label="Limpar filtros" text severity="secondary" onClick={clearFilters} />
                </div>
                <StandardFilterFields date={{ value: period, onChange: setPeriod }} department={{ value: filters.departamento, options: (filterOptions.departamentos || []).map((value) => ({ label: `DPTO. ${value}`, value })), onChange: (value) => setFilter('departamento', value) }} center={{ value: filters.contrato, options: (filterOptions.contratos || []).map((value) => ({ label: value, value })), onChange: (value) => setFilter('contrato', value) }} />
                <div className="dashboard-filter-grid">
                    <label><span>Status</span><MultiSelect value={filters.status} options={(filterOptions.status || []).map((value) => ({ label: STATUS_LABELS[value] || value, value }))} onChange={(event) => setFilter('status', event.value)} placeholder="Todos os status" display="chip" filter showClear className="w-full" maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
                    <label><span>Responsáveis</span><MultiSelect value={filters.responsavel} options={(filterOptions.responsaveis || []).map((value) => ({ label: value, value }))} onChange={(event) => setFilter('responsavel', event.value)} placeholder="Todos os responsáveis" display="chip" filter showClear className="w-full" maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
                    <label className="is-wide"><span>Colaboradores</span><MultiSelect value={filters.colaborador} options={(filterOptions.colaboradores || []).map((value) => ({ label: value, value }))} onChange={(event) => setFilter('colaborador', event.value)} placeholder="Todos os colaboradores" display="chip" filter showClear className="w-full" maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
                </div>
            </OverlayPanel>
        </section>
    );
}
