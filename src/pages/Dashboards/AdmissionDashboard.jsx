import './admissionDashboard.css';

import { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Chart } from 'primereact/chart';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Tag } from 'primereact/tag';

import connect from '../../utils/request';
import { useLoading } from '../../contexts/LoadingContext';
import { useToast } from '../../contexts/ToastContext';

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

function formatHours(value) {
    // Acima de 24 horas a leitura em dias é mais útil para o acompanhamento executivo.
    if (value == null) return '-';
    return value >= 24 ? `${(value / 24).toFixed(1)} dias úteis` : `${Number(value).toFixed(1)}h úteis`;
}

function SummaryCard({ icon, label, value, detail, tone = 'neutral' }) {
    return (
        <article className={`admission-summary-card is-${tone}`}>
            <span className="admission-summary-card__icon"><i className={icon} /></span>
            <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
        </article>
    );
}

export function AdmissionDashboard() {
    const now = new Date();
    const [period, setPeriod] = useState([new Date(now.getFullYear(), now.getMonth() - 5, 1), now]);
    const [data, setData] = useState(null);
    const [refresh, setRefresh] = useState(0);
    const [activeTable, setActiveTable] = useState('departments');
    const setGlobalLoading = useLoading();
    const { showToast } = useToast();

    useEffect(() => {
        // Só consulta a API quando o intervalo estiver completo; refresh força uma nova leitura.
        if (!period?.[0] || !period?.[1]) return;
        let cancelled = false;
        const load = async () => {
            setGlobalLoading(true);
            try {
                const response = await connect.get('/admissao/vagas/dashboard', {
                    params: { inicio: dateParam(period[0]), fim: dateParam(period[1]) },
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
    }, [period, refresh, setGlobalLoading, showToast]);

    // Barras mostram volume e a linha usa um segundo eixo para não distorcer a escala de vagas.
    const monthlyChart = useMemo(() => ({
        labels: (data?.mensal || []).map((item) => monthLabel(item.mes)),
        datasets: [
            { label: 'Vagas avisadas', data: (data?.mensal || []).map((item) => item.avisadas), backgroundColor: '#268f50', borderRadius: 6, maxBarThickness: 34, order: 2 },
            { label: 'Vagas concluídas', data: (data?.mensal || []).map((item) => item.concluidas), backgroundColor: '#93d8aa', borderRadius: 6, maxBarThickness: 34, order: 2 },
            { type: 'line', label: 'SLA primeira ação (h)', data: (data?.mensal || []).map((item) => item.sla_acao_horas), borderColor: '#d08a12', backgroundColor: '#d08a12', pointRadius: 4, pointHoverRadius: 5, tension: .35, yAxisID: 'sla', order: 1 },
        ],
    }), [data]);

    const chartOptions = {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } } },
        scales: {
            x: { grid: { display: false }, border: { display: false } },
            y: { beginAtZero: true, grid: { color: 'rgba(120, 130, 125, .14)' }, border: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Vagas' } },
            sla: { position: 'right', beginAtZero: true, suggestedMax: 30, grid: { display: false }, border: { display: false }, title: { display: true, text: 'Horas' } },
        },
    };

    const indicators = data?.indicadores || {};
    const actionTarget = data?.metas?.acao_horas ?? 24;
    const closeTargetDays = (data?.metas?.conclusao_horas ?? 120) / 24;
    // A cópia evita ordenar diretamente o array retornado pela API.
    const bestDepartment = useMemo(() => [...(data?.departamentos || [])]
        .filter((item) => item.percentual_no_prazo != null)
        .sort((a, b) => b.percentual_no_prazo - a.percentual_no_prazo)[0], [data]);

    // Os tons dos cards refletem a comparação de cada indicador com sua meta vigente.
    const summary = [
        { icon: 'pi pi-briefcase', label: 'Vagas no período', value: indicators.total_vagas ?? 0, detail: `${indicators.vagas_concluidas ?? 0} concluídas`, tone: 'neutral' },
        { icon: 'pi pi-bolt', label: 'Primeira ação', value: formatHours(indicators.sla_acao_medio_horas), detail: `meta de até ${actionTarget}h úteis`, tone: indicators.sla_acao_medio_horas <= actionTarget ? 'success' : 'warning' },
        { icon: 'pi pi-check-circle', label: 'Conclusão', value: indicators.sla_conclusao_medio_dias != null ? `${indicators.sla_conclusao_medio_dias} dias úteis` : '-', detail: `meta de até ${closeTargetDays} dias úteis`, tone: indicators.sla_conclusao_medio_dias <= closeTargetDays ? 'success' : 'danger' },
        { icon: 'pi pi-chart-line', label: 'Dentro do SLA', value: indicators.percentual_no_prazo != null ? `${indicators.percentual_no_prazo}%` : '-', detail: 'ação e conclusão', tone: indicators.percentual_no_prazo >= 80 ? 'success' : 'warning' },
        { icon: 'pi pi-hourglass', label: 'Em andamento', value: indicators.vagas_em_andamento ?? 0, detail: `${indicators.sla_estourado ?? 0} fora do prazo`, tone: indicators.sla_estourado ? 'danger' : 'violet' },
    ];

    return (
        <section className="admission-dashboard">
            <header className="admission-heading">
                <div><span>Dashboard</span><h1>SLA de Admissões</h1><p>Acompanhe a velocidade de resposta e conclusão das vagas.</p></div>
                <div className="admission-heading__actions">
                    <Calendar value={period} onChange={(event) => setPeriod(event.value)} selectionMode="range" dateFormat="dd/mm/yy" locale="pt-BR" placeholder="Selecione o período" showIcon readOnlyInput hideOnRangeSelection />
                    <Button icon="pi pi-refresh" label="Atualizar" outlined onClick={() => setRefresh((value) => value + 1)} />
                </div>
            </header>

            <div className="admission-summary">
                {summary.map((item) => <SummaryCard key={item.label} {...item} />)}
            </div>

            <div className="admission-analysis">
                <article className="admission-panel">
                    <header><div><span>Evolução mensal</span><h2>Volume de vagas e tempo de primeira ação</h2></div><Tag value={`Meta ${actionTarget}h`} severity="warning" rounded /></header>
                    <div className="admission-chart"><Chart type="bar" data={monthlyChart} options={chartOptions} /></div>
                </article>

                <article className="admission-panel admission-insight">
                    <span>Leitura executiva</span>
                    <h2>{indicators.percentual_no_prazo >= 80 ? 'Operação dentro da meta' : 'SLA exige atenção'}</h2>
                    <p>O indicador combina a primeira ação do responsável e o tempo total até a conclusão da vaga.</p>
                    <div><span><small>Melhor departamento</small><strong>{bestDepartment ? `DPTO. ${bestDepartment.departamento}` : '-'}</strong></span><em>{bestDepartment?.percentual_no_prazo ?? 0}% no prazo</em></div>
                    <div><span><small>Primeira ação</small><strong>{formatHours(indicators.sla_acao_medio_horas)}</strong></span><em>{indicators.sla_acao_medio_horas <= actionTarget ? 'dentro da meta' : 'acima da meta'}</em></div>
                    <div><span><small>Fechamento</small><strong>{indicators.sla_conclusao_medio_dias ?? '-'} dias úteis</strong></span><em>{indicators.sla_conclusao_medio_dias <= closeTargetDays ? 'dentro da meta' : 'acima da meta'}</em></div>
                    <div className="admission-status-strip">
                        {(data?.status || []).map((item) => (
                            <div className={`admission-status-card is-${item.status}`} key={item.status}>
                                <span>{STATUS_LABELS[item.status]}</span>
                                <strong>{item.total}</strong>
                            </div>
                        ))}
                    </div>
                </article>
            </div>

            <article className="admission-table-panel">
                <nav className="admission-table-tabs" aria-label="Visualizações do dashboard">
                    <button className={activeTable === 'departments' ? 'is-active' : ''} type="button" onClick={() => setActiveTable('departments')}><i className="pi pi-building" /><span>SLA por departamento</span></button>
                    <button className={activeTable === 'recent' ? 'is-active' : ''} type="button" onClick={() => setActiveTable('recent')}><i className="pi pi-history" /><span>Vagas recentes</span></button>
                    <button className={activeTable === 'attention' ? 'is-active is-attention' : ''} type="button" onClick={() => setActiveTable('attention')}><i className="pi pi-exclamation-triangle" /><span>Atenção</span><em>{data?.atencao?.length || 0}</em></button>
                </nav>

                <div className="admission-table-content">
                    {activeTable === 'departments' && <DataTable value={data?.departamentos || []} size="small" stripedRows paginator rows={10} rowsPerPageOptions={[10, 20, 50]} emptyMessage="Sem dados no período.">
                        <Column field="departamento" header="Departamento" sortable />
                        <Column field="total" header="Vagas" sortable />
                        <Column header="Primeira ação" body={(row) => formatHours(row.sla_acao_horas)} sortable sortField="sla_acao_horas" />
                        <Column header="Conclusão" body={(row) => row.sla_conclusao_dias != null ? `${row.sla_conclusao_dias} dias úteis` : '-'} sortable sortField="sla_conclusao_dias" />
                        <Column header="Dentro do SLA" body={(row) => <Tag value={row.percentual_no_prazo != null ? `${row.percentual_no_prazo}%` : '-'} severity={row.percentual_no_prazo >= 80 ? 'success' : row.percentual_no_prazo >= 60 ? 'warning' : 'danger'} rounded />} sortable sortField="percentual_no_prazo" />
                    </DataTable>}

                    {activeTable === 'recent' && <DataTable value={data?.recentes || []} size="small" stripedRows paginator rows={10} emptyMessage="Sem vagas no período.">
                        <Column header="Vaga" body={(row) => <div className="admission-vacancy-cell"><strong>{row.candidato || row.colaborador_saida || 'Sem candidato'}</strong><span>{row.candidato_matricula ? `Matrícula ${row.candidato_matricula} • ${row.contrato}` : row.contrato}</span></div>} style={{ minWidth: '18rem' }} />
                        <Column header="Aviso" body={(row) => formatDateTime(row.aviso_em)} sortable sortField="aviso_em" />
                        <Column header="Responsável" field="responsavel" />
                        <Column header="Tentativas" field="tentativas" />
                        <Column header="Primeira ação" body={(row) => formatHours(row.sla_acao_horas ?? row.sla_acao_decorrido_horas)} />
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
        </section>
    );
}
