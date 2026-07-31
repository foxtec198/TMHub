import { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import connect from '../../utils/request';
import { useToast } from '../../contexts/ToastContext';

const HISTORY_ENDPOINT = '/admissao/vagas/historico-entrevistas';

// Datas antigas podem ter vindo da planilha como texto; o valor original evita perda de informação.
function formatDate(value, original) {
    if (value) {
        const [year, month, day] = value.split('-');
        if (year && month && day) return `${day}/${month}/${year}`;
    }
    return original || '-';
}

// Converte a variedade de status históricos para as quatro severidades visuais do PrimeReact.
function statusSeverity(status = '') {
    const value = status.toUpperCase();
    if (value.includes('REPROV') || value.includes('NÃO APROV')) return 'danger';
    if (value.includes('DESIST')) return 'warning';
    if (value.includes('ENTREVISTA') || value.includes('CONSULTAR')) return 'info';
    if (value.includes('APROV') || value.includes('CONTRAT') || value.includes('REMANEJ')) return 'success';
    return 'secondary';
}

export function InterviewHistoryDialog({ visible, onHide }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState(null);
    const { showToast } = useToast();

    useEffect(() => {
        // O histórico é estável durante a abertura do diálogo, então uma carga é suficiente.
        if (!visible || rows.length) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            setLoading(true);
            connect.get(HISTORY_ENDPOINT, { params: { limit: 2000 } })
                .then(({ data }) => { if (!cancelled) setRows(data ?? []); })
                .catch(() => { if (!cancelled) showToast('error', 'Histórico de entrevistas', 'Não foi possível carregar o histórico.'); })
                .finally(() => { if (!cancelled) setLoading(false); });
        }, 0);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [rows.length, showToast, visible]);

    // As opções são derivadas da própria base para incluir status legítimos do legado.
    const statusOptions = useMemo(() => [...new Set(rows.map((row) => row.status).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((value) => ({ label: value, value })), [rows]);

    // O filtro de texto continua delegado ao DataTable; aqui aplicamos apenas o status exato.
    const filteredRows = useMemo(() => status
        ? rows.filter((row) => row.status === status)
        : rows, [rows, status]);

    return (
        <Dialog header="Histórico de entrevistas" visible={visible} modal maximizable className="interview-history-dialog" onHide={onHide}>
            <div className="interview-history-toolbar">
                <span className="p-input-icon-left interview-history-search">
                    <i className="pi pi-search" />
                    <InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador que saiu, candidato ou contrato" />
                </span>
                <Dropdown value={status} options={statusOptions} onChange={(event) => setStatus(event.value)} placeholder="Todos os status" showClear />
                <strong>{filteredRows.length} registro(s)</strong>
            </div>

            <DataTable
                value={filteredRows}
                loading={loading}
                paginator
                rows={25}
                rowsPerPageOptions={[25, 50, 100]}
                scrollable
                scrollHeight="62vh"
                stripedRows
                size="small"
                emptyMessage="Nenhuma entrevista encontrada."
                globalFilter={search}
                globalFilterFields={['colaborador_saida_nome', 'colaborador_saida_matricula', 'candidato_nome', 'funcao', 'contrato', 'substituicao', 'supervisor', 'observacoes']}
            >
                <Column
                    header="Colaborador que saiu"
                    frozen
                    body={(row) => <div className="interview-candidate"><strong>{row.colaborador_saida_nome}</strong><span>Matrícula {row.colaborador_saida_matricula}</span></div>}
                    style={{ minWidth: '20rem' }}
                />
                <Column
                    header="Candidato"
                    body={(row) => row.candidato_nome ? (
                        <div className="interview-candidate">
                            <strong>{row.candidato_nome}</strong>
                            <Tag value={row.candidato_vinculado ? 'Vinculado' : 'Somente texto'} severity={row.candidato_vinculado ? 'success' : 'secondary'} rounded />
                        </div>
                    ) : '-'}
                    style={{ minWidth: '19rem' }}
                />
                <Column header="Entrevista" body={(row) => formatDate(row.entrevista_data, row.entrevista_data_original)} style={{ minWidth: '8rem' }} />
                <Column header="Início" body={(row) => formatDate(row.inicio_data, row.inicio_data_original)} style={{ minWidth: '8rem' }} />
                <Column field="funcao" header="Função" style={{ minWidth: '12rem' }} />
                <Column field="departamento" header="DPTO." style={{ minWidth: '5rem' }} />
                <Column header="Status" body={(row) => <Tag value={row.status || '-'} severity={statusSeverity(row.status)} rounded />} style={{ minWidth: '10rem' }} />
                <Column header="Contrato" body={(row) => `${row.centro_custo_id} - ${row.contrato}`} style={{ minWidth: '20rem' }} />
                <Column field="substituicao" header="Registro original da substituição" style={{ minWidth: '24rem' }} />
                <Column field="supervisor" header="Supervisor" style={{ minWidth: '10rem' }} />
                <Column field="responsavel" header="Responsável TMHub" style={{ minWidth: '12rem' }} />
                <Column field="observacoes" header="Observações" style={{ minWidth: '24rem' }} />
                <Column field="origem_aba" header="Origem" style={{ minWidth: '9rem' }} />
            </DataTable>
        </Dialog>
    );
}
