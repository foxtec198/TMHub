import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import './vacancies.css';

// Widgets
import { Accordion, AccordionTab } from 'primereact/accordion';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { AutoComplete } from 'primereact/autocomplete';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { SelectButton } from 'primereact/selectbutton';
import { FloatLabel } from 'primereact/floatlabel';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { DashCard } from '../../components/DashCard';
import { CollaboratorDropdown } from '../../components/CollaboratorDropdown';
import { InterviewHistoryDialog } from './InterviewHistoryDialog';
import { PageHeader } from '../../components/PageHeader';

// Utils
import { useEffect, useMemo, useState } from 'react';
import connect from '../../utils/request';
import { useLoading } from '../../contexts/LoadingContext';
import { useToast } from '../../contexts/ToastContext';

const VACANCIES_ENDPOINT = '/admissao/vagas';

const STATUS_OPTIONS = [
    { value: 'aberta', label: 'ABERTAS', color: 'var(--gray-600)' },
    { value: 'entrevista', label: 'ENTREVISTA', color: 'var(--blue-600)' },
    { value: 'certidao', label: 'CERTIDAO', color: 'var(--purple-600)' },
    { value: 'aso', label: 'ASO', color: 'var(--yellow-700)' },
    { value: 'unico', label: 'UNICO', color: 'var(--cyan-700)' },
    { value: 'concluido', label: 'CONCLUIDO', color: 'var(--green-700)' },
];

const MOTIVO_OPTIONS = [
    'PEDIDO DE DEMISSÃO',
    'DEMISSÃO SEM JUSTA CAUSA',
    'DEMISSÃO COM JUSTA CAUSA',
    'FIM DE CONTRATO DE EXPERIÊNCIA',
    'ABANDONO DE EMPREGO',
    'APOSENTADORIA',
    'REMANEJAMENTO',
    'AFASTAMENTO - INSS',
    'OUTROS',
];

const orderOptions = [
    { label: 'Mais recentes', value: 'desc' },
    { label: 'Mais antigas', value: 'asc' },
];

const CANDIDATE_RESULT_OPTIONS = [
    { label: 'DESISTIU', value: 'desistiu' },
    { label: 'REPROVADO', value: 'reprovado' },
    { label: 'OUTRO', value: 'outro' },
];

const CANDIDATE_RESULT_LABELS = {
    desistiu: 'DESISTIU',
    reprovado: 'REPROVADO',
    aprovado: 'APROVADO',
    outro: 'OUTRO',
};

// Uma fábrica garante que cada abertura do diálogo receba a data atual,
// em vez de reutilizar a data criada quando o módulo foi carregado.
const createEmptyForm = () => ({
    centro_custo_id: null,
    colaborador_id: null,
    supervisor_id: null,
    matricula: '',
    colaborador: '',
    colaborador_entrada: '',
    telefone_colaborador_entrada: '',
    data_aviso: new Date(),
    data_saida: null,
    horario_trabalho: '',
    motivo_saida: '',
});

// Envia apenas o dia civil para que conversões de fuso não alterem a data escolhida.
function toApiDate(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Aceita tanto o formato ISO do banco quanto o formato HTTP serializado pelo Flask.
function formatDateOnly(value) {
    if (!value) return '-';

    const isoDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-br');
}

function isFutureDate(value) {
    if (!value) return false;

    const isoDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const date = isoDate
        ? new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]))
        : new Date(value);

    if (Number.isNaN(date.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date > today;
}

function toApiDateTime(value) {
    // Segundos são irrelevantes para o SLA e são removidos para manter dados consistentes.
    const date = new Date(value);
    date.setSeconds(0, 0);
    return date.toISOString();
}

function firstScheduleTime(value) {
    // A conclusão usa automaticamente o primeiro HH:mm da jornada cadastrada na vaga.
    const match = String(value || '').match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

function InfoField({ label, value }) {
    return (
        <div className="vaga-info-field">
            <span>{label}</span>
            <span>{value || '-'}</span>
        </div>
    );
}

function VagaHeader({ vaga }) {
    return (
        <div className="flex align-items-center justify-content-between w-full pr-2 flex-wrap gap-2">
            <div className="flex flex-column">
                <span className="font-bold mb-2">{vaga.colaborador_entrada || 'Novo colaborador não definido'}</span>
                <span className="text-500 text-sm">
                    {vaga.tipo === 'aditivo' ? 'Aditivo contratual' : `Substitui ${vaga.colaborador}`} • {vaga.departamento} • {vaga.centro_custo}
                </span>
            </div>
            <div className="vacancy-exit-summary">
                {vaga.tipo !== 'aditivo' && vaga.data_saida && (
                    <Tag
                        value={`${isFutureDate(vaga.data_saida) ? 'SAÍDA PREVISTA' : 'SAÍDA'} · ${formatDateOnly(vaga.data_saida)}`}
                        severity={isFutureDate(vaga.data_saida) ? 'warning' : 'secondary'}
                        icon={<AppIcon name="calendar" />}
                        rounded
                    />
                )}
                <span className="text-500 text-sm">
                    Vaga criada em {new Date(vaga.created_at).toLocaleDateString('pt-br')}
                </span>
            </div>
        </div>
    );
}

function VagaItem({ vaga, supervisors, onUpdate, onCandidateResult, onDelete }) {
    // Dados estruturados de conclusão ficam separados dos campos livres usados durante o processo.
    const [entrevistador, setEntrevistador] = useState(vaga.entrevistador || '');
    const [entrevistaDia, setEntrevistaDia] = useState(vaga.entrevista_data ? new Date(vaga.entrevista_data) : null);
    const [entrevistaHora, setEntrevistaHora] = useState(vaga.entrevista_data ? new Date(vaga.entrevista_data) : null);
    const [showInterviewForm, setShowInterviewForm] = useState(false);
    const [showCompletionForm, setShowCompletionForm] = useState(false);
    const [completionRegistration, setCompletionRegistration] = useState(vaga.colaborador_entrada_matricula || '');
    const [completionDate, setCompletionDate] = useState(vaga.data_inicio ? new Date(vaga.data_inicio) : new Date());
    const [completionText, setCompletionText] = useState(vaga.colaborador_entrada || '');
    const [completionObservation, setCompletionObservation] = useState(vaga.observacao_conclusao || '');
    const [candidateName, setCandidateName] = useState(vaga.colaborador_entrada || '');
    const [candidatePhone, setCandidatePhone] = useState(vaga.telefone_colaborador_entrada || '');
    const [supervisorId, setSupervisorId] = useState(vaga.supervisor_id || null);
    const [candidateResultVisible, setCandidateResultVisible] = useState(false);
    const [candidateHistoryVisible, setCandidateHistoryVisible] = useState(false);
    const [candidateResult, setCandidateResult] = useState(null);
    const [candidateJustification, setCandidateJustification] = useState('');
    const { showToast } = useToast();

    async function handleStatusSelect(newStatus) {
        // Conclusão e entrevista exigem dados extras, por isso abrem fluxos próprios antes do PATCH.
        if (newStatus === 'concluido') {
            setCompletionRegistration(vaga.colaborador_entrada_matricula || '');
            setCompletionDate(vaga.data_inicio ? new Date(vaga.data_inicio) : new Date());
            setCompletionText(vaga.colaborador_entrada || '');
            setCompletionObservation(vaga.observacao_conclusao || '');
            setShowCompletionForm(true);
            return;
        }

        if (newStatus === 'entrevista' && !(vaga.entrevistador && vaga.entrevista_data)) {
            setShowInterviewForm(true);
            return;
        }

        setShowInterviewForm(false);
        await onUpdate(vaga.id, { status: newStatus });
    }

    function confirmInterview() {
        if (!entrevistador) {
            showToast('warn', 'Atenção!', 'Informe quem vai realizar a entrevista.');
            return;
        }

        if (!entrevistaDia) {
            showToast('warn', 'Atenção!', 'Selecione o dia da entrevista.');
            return;
        }

        if (!entrevistaHora) {
            showToast('warn', 'Atenção!', 'Selecione o horário da entrevista.');
            return;
        }

        const dataHora = new Date(entrevistaDia);
        dataHora.setHours(entrevistaHora.getHours(), entrevistaHora.getMinutes(), 0, 0);

        onUpdate(vaga.id, { status: 'entrevista', entrevistador, entrevista_data: dataHora });
        setShowInterviewForm(false);
    }

    async function confirmCompletion() {
        if (!completionRegistration.trim()) {
            showToast('warn', 'Atenção!', 'Informe a matrícula do colaborador que vai entrar.');
            return;
        }
        if (!completionDate) {
            showToast('warn', 'Atenção!', 'Informe a data de início.');
            return;
        }

        const updated = await onUpdate(vaga.id, {
            status: 'concluido',
            colaborador_entrada_matricula: completionRegistration.trim(),
            colaborador_entrada: completionText.trim(),
            data_inicio: toApiDate(completionDate),
            observacao_conclusao: completionObservation.trim() || null,
        });
        if (updated) setShowCompletionForm(false);
    }

    async function saveCandidateText() {
        // Até ÚNICO, nome e telefone são informações livres e podem ser corrigidos sem criar vínculo.
        await onUpdate(vaga.id, {
            colaborador_entrada: candidateName.trim() || null,
            telefone_colaborador_entrada: candidatePhone.trim() || null,
        });
    }

    async function saveSupervisor() {
        const updated = await onUpdate(vaga.id, { supervisor_id: supervisorId });
        if (!updated) setSupervisorId(vaga.supervisor_id || null);
    }

    async function registerCandidateResult() {
        if (!candidateName.trim()) {
            showToast('warn', 'Atenção!', 'Informe o nome do candidato antes de registrar o resultado.');
            return;
        }
        if (!candidateResult) {
            showToast('warn', 'Atenção!', 'Selecione o resultado do candidato.');
            return;
        }
        if (!candidateJustification.trim()) {
            showToast('warn', 'Atenção!', 'Informe a justificativa para manter o histórico completo.');
            return;
        }

        const updated = await onCandidateResult({
            vaga_id: vaga.id,
            candidato_nome: candidateName.trim(),
            telefone: candidatePhone.trim() || null,
            resultado: candidateResult,
            observacao: candidateJustification.trim(),
        });
        if (updated) {
            setCandidateName('');
            setCandidatePhone('');
            setCandidateResult(null);
            setCandidateJustification('');
            setCandidateResultVisible(false);
        }
    }

    return (
        <div className="flex flex-column gap-3 p-2">
            <div className="vaga-info-grid">
                <InfoField label="Matrícula" value={vaga.matricula} />
                {vaga.tipo !== 'aditivo' && <InfoField label="Colaborador substituído" value={vaga.colaborador} />}
                {vaga.tipo === 'aditivo' && <InfoField label="Tipo da vaga" value="Aditivo contratual" />}
                <InfoField label="Responsável TMHub" value={vaga.responsavel} />
                <InfoField label="Supervisor da vaga" value={vaga.supervisor} />
                <InfoField label="Novo colaborador" value={vaga.colaborador_entrada} />
                {vaga.telefone_colaborador_entrada && <InfoField label="Telefone do candidato" value={vaga.telefone_colaborador_entrada} />}
                <InfoField
                    label="Aviso ao responsável"
                    value={vaga.aviso_em ? new Date(vaga.aviso_em).toLocaleString('pt-br') : formatDateOnly(vaga.data_aviso)}
                />
                <InfoField label="Departamento" value={vaga.departamento} />
                <InfoField label="Centro de Custo" value={vaga.centro_custo} />
                <InfoField label="Função" value={vaga.funcao} />
                <InfoField label="Carga Horária" value={vaga.carga_horaria} />
                <InfoField label="Horário de Trabalho" value={vaga.horario_trabalho} />
                <InfoField label="Motivo da Saída" value={vaga.motivo_saida} />
                {vaga.tipo !== 'aditivo' && vaga.data_saida && (
                    <InfoField
                        label={isFutureDate(vaga.data_saida) ? 'Data prevista de saída' : 'Data de saída'}
                        value={formatDateOnly(vaga.data_saida)}
                    />
                )}
                {vaga.entrevistador && <InfoField label="Entrevistadora" value={vaga.entrevistador} />}
                {vaga.entrevista_data && <InfoField label="Data da Entrevista" value={new Date(vaga.entrevista_data).toLocaleString('pt-br')} />}
                {vaga.status === 'concluido' && <InfoField label="Matrícula do contratado" value={vaga.colaborador_entrada_matricula} />}
                {vaga.status === 'concluido' && <InfoField
                    label="Colaborador que entrou"
                    value={vaga.colaborador_entrada_cadastrado || 'Colaborador contratado ainda não encontrado'}
                />}
                {vaga.data_inicio && <InfoField label="Data de início" value={new Date(vaga.data_inicio).toLocaleString('pt-br')} />}
                {vaga.concluido_por_usuario && <InfoField label="Concluída por" value={vaga.concluido_por_usuario} />}
                {vaga.observacao_conclusao && <InfoField label="Observação da conclusão" value={vaga.observacao_conclusao} />}
            </div>

            {vaga.status !== 'concluido' && (
                <form className="candidate-text-editor" onSubmit={(event) => { event.preventDefault(); saveCandidateText(); }}>
                    <div className="candidate-text-editor__heading mb-3">
                        <span><AppIcon name="user-edit"  /> Pessoa que será contratada</span>
                        <Tag className="candidate-text-editor__tag" value="Somente texto até a conclusão" severity="secondary" rounded />
                    </div>
                    <div className="candidate-text-editor__fields">
                        <FloatLabel>
                            <InputText
                                id={`candidate-name-${vaga.id}`}
                                className="w-full"
                                value={candidateName}
                                onChange={(event) => setCandidateName(event.target.value)}
                            />
                            <label htmlFor={`candidate-name-${vaga.id}`}>Nome do candidato</label>
                        </FloatLabel>
                        <FloatLabel>
                            <InputText
                                id={`candidate-phone-${vaga.id}`}
                                className="w-full"
                                value={candidatePhone}
                                onChange={(event) => setCandidatePhone(event.target.value)}
                                maxLength={50}
                            />
                            <label htmlFor={`candidate-phone-${vaga.id}`}>Telefone (opcional)</label>
                        </FloatLabel>
                        <Button type="submit" label="Salvar candidato" icon={<AppIcon name="device-floppy" />} outlined />
                        <Button type="button" label="Registrar resultado" icon={<AppIcon name="flag" />} severity="warning" outlined onClick={() => setCandidateResultVisible(true)} />
                    </div>
                </form>
            )}

            <Button
                className="align-self-start"
                type="button"
                label={`Histórico de candidatos (${vaga.historico_candidatos?.length || 0})`}
                icon={<AppIcon name="history" />}
                text
                onClick={() => setCandidateHistoryVisible(true)}
            />

            <div className="flex gap-3 align-items-center flex-wrap mt-5">
                <FloatLabel>
                    <Dropdown
                        id={`status-${vaga.id}`}
                        className="w-15rem"
                        value={vaga.status}
                        onChange={(e) => handleStatusSelect(e.value)}
                        options={STATUS_OPTIONS}
                        optionLabel="label"
                        optionValue="value"
                    />
                    <label htmlFor={`status-${vaga.id}`}>Status da vaga</label>
                </FloatLabel>

                <FloatLabel>
                    <Dropdown
                        id={`supervisor-${vaga.id}`}
                        className="w-18rem"
                        value={supervisorId}
                        onChange={(event) => setSupervisorId(event.value)}
                        options={supervisors}
                        optionLabel="label"
                        optionValue="value"
                        filter
                    />
                    <label htmlFor={`supervisor-${vaga.id}`}>Supervisor da vaga</label>
                </FloatLabel>

                <Button
                    icon={<AppIcon name="device-floppy" />}
                    outlined
                    aria-label="Salvar supervisor"
                    tooltip="Salvar supervisor"
                    disabled={!supervisorId || supervisorId === vaga.supervisor_id}
                    onClick={saveSupervisor}
                />

                <Button icon={<AppIcon name="trash" />} text rounded severity="danger" tooltip="Excluir vaga" onClick={() => onDelete(vaga)} />
            </div>

            {showInterviewForm && (
                <form
                    className="interview-box flex flex-column gap-3 p-3 border-round-lg"
                    onSubmit={(e) => { e.preventDefault(); confirmInterview(); }}
                >
                    <div className="flex align-items-center gap-2">
                        <AppIcon name="calendar-plus" style={{ color: 'var(--primary-color-dark)' }} />
                        <span className="font-bold">Agendar entrevista</span>
                    </div>

                    <FloatLabel>
                        <InputText
                            id={`entrevistador-${vaga.id}`}
                            className="w-full"
                            value={entrevistador}
                            onChange={(e) => setEntrevistador(e.target.value)}
                        />
                        <label htmlFor={`entrevistador-${vaga.id}`}>Quem vai realizar a entrevista</label>
                    </FloatLabel>

                    <div className="flex gap-3">
                        <FloatLabel className="w-full">
                            <Calendar
                                id={`dia-${vaga.id}`}
                                className="w-full"
                                value={entrevistaDia}
                                onChange={(e) => setEntrevistaDia(e.value)}
                                dateFormat="dd/mm/yy"
                                locale="pt-BR"
                                minDate={new Date()}
                                showIcon
                                readOnlyInput
                            />
                            <label htmlFor={`dia-${vaga.id}`}>Dia</label>
                        </FloatLabel>

                        <FloatLabel className="w-full">
                            <Calendar
                                id={`hora-${vaga.id}`}
                                className="w-full"
                                value={entrevistaHora}
                                onChange={(e) => setEntrevistaHora(e.value)}
                                timeOnly
                                hourFormat="24"
                                stepMinute={5}
                                icon={<AppIcon name="clock" />}
                                showIcon
                                readOnlyInput
                            />
                            <label htmlFor={`hora-${vaga.id}`}>Horário</label>
                        </FloatLabel>
                    </div>

                    <Button type="submit" label="Confirmar e mudar status" icon={<AppIcon name="check" />} />
                </form>
            )}

            <Dialog
                header="Concluir vaga"
                visible={showCompletionForm}
                modal
                style={{ width: 'min(38rem, calc(100vw - 2rem))' }}
                onHide={() => setShowCompletionForm(false)}
            >
                <form className="flex flex-column gap-4 pt-3" onSubmit={(event) => { event.preventDefault(); confirmCompletion(); }}>
                    <div className="completion-recruiter">
                        <AppIcon name="user"  />
                        <span>Recrutador: <strong>{localStorage.getItem('display_name') || 'Usuário do TMHub'}</strong></span>
                    </div>

                    <FloatLabel>
                        <InputText
                            id={`completion-registration-${vaga.id}`}
                            value={completionRegistration}
                            onChange={(event) => setCompletionRegistration(event.target.value)}
                            className="w-full"
                            maxLength={50}
                            autoFocus
                        />
                        <label htmlFor={`completion-registration-${vaga.id}`}>Matrícula do colaborador contratado *</label>
                    </FloatLabel>

                    <small className="completion-schedule-hint">
                        <AppIcon name="info-circle"  /> A vaga pode ser concluída mesmo que essa matrícula ainda não esteja na base de colaboradores.
                    </small>

                    {/* O nome continua livre para preservar o candidato enquanto a importação não ocorre. */}
                    <FloatLabel>
                        <InputText
                            id={`completion-text-${vaga.id}`}
                            className="w-full"
                            value={completionText}
                            onChange={(event) => setCompletionText(event.target.value)}
                        />
                        <label htmlFor={`completion-text-${vaga.id}`}>Nome do colaborador contratado (opcional)</label>
                    </FloatLabel>

                    {/* A data de início mantém a composição automática com a jornada da vaga. */}
                    <FloatLabel>
                        <Calendar
                            id={`completion-date-${vaga.id}`}
                            className="w-full"
                            value={completionDate}
                            onChange={(event) => setCompletionDate(event.value)}
                            dateFormat="dd/mm/yy"
                            locale="pt-BR"
                            showIcon
                            readOnlyInput
                        />
                        <label htmlFor={`completion-date-${vaga.id}`}>Data de início *</label>
                    </FloatLabel>

                    <small className="completion-schedule-hint">
                        <AppIcon name="clock"  /> Horário inicial automático: <strong>{firstScheduleTime(vaga.horario_trabalho) || 'horário inválido'}</strong>
                        <span> ({vaga.horario_trabalho})</span>
                    </small>

                    <FloatLabel>
                        <InputTextarea
                            id={`completion-observation-${vaga.id}`}
                            className="w-full"
                            value={completionObservation}
                            onChange={(event) => setCompletionObservation(event.target.value)}
                            rows={4}
                            autoResize
                        />
                        <label htmlFor={`completion-observation-${vaga.id}`}>Observação (opcional)</label>
                    </FloatLabel>

                    <div className="flex justify-content-end gap-2">
                        <Button type="button" label="Cancelar" severity="secondary" text onClick={() => setShowCompletionForm(false)} />
                        <Button type="submit" label="Concluir vaga" icon={<AppIcon name="check" />} />
                    </div>
                </form>
            </Dialog>

            <Dialog
                header="Registrar resultado do candidato"
                visible={candidateResultVisible}
                modal
                style={{ width: 'min(34rem, calc(100vw - 2rem))' }}
                onHide={() => setCandidateResultVisible(false)}
            >
                <form className="flex flex-column gap-4 pt-3" onSubmit={(event) => { event.preventDefault(); registerCandidateResult(); }}>
                    <div className="candidate-result-person">
                        <AppIcon name="user"  />
                        <span><strong>{candidateName || 'Candidato não informado'}</strong>{candidatePhone && <small>{candidatePhone}</small>}</span>
                    </div>
                    <FloatLabel>
                        <Dropdown id={`candidate-result-${vaga.id}`} className="w-full" value={candidateResult} options={CANDIDATE_RESULT_OPTIONS} onChange={(event) => setCandidateResult(event.value)} />
                        <label htmlFor={`candidate-result-${vaga.id}`}>Resultado *</label>
                    </FloatLabel>
                    <FloatLabel>
                        <InputTextarea id={`candidate-justification-${vaga.id}`} className="w-full" value={candidateJustification} onChange={(event) => setCandidateJustification(event.target.value)} rows={4} autoResize />
                        <label htmlFor={`candidate-justification-${vaga.id}`}>Justificativa *</label>
                    </FloatLabel>
                    <small>Ao confirmar, o candidato será preservado no histórico e os campos ficarão livres para a próxima pessoa.</small>
                    <div className="flex justify-content-end gap-2">
                        <Button type="button" label="Cancelar" severity="secondary" text onClick={() => setCandidateResultVisible(false)} />
                        <Button type="submit" label="Registrar e liberar vaga" icon={<AppIcon name="check" />} severity="warning" />
                    </div>
                </form>
            </Dialog>

            <Dialog
                header="Histórico de candidatos da vaga"
                visible={candidateHistoryVisible}
                modal
                style={{ width: 'min(46rem, calc(100vw - 2rem))' }}
                onHide={() => setCandidateHistoryVisible(false)}
            >
                <div className="candidate-history-list">
                    {vaga.historico_candidatos?.length ? vaga.historico_candidatos.map((item) => (
                        <article className="candidate-history-item" key={item.id}>
                            <div className="candidate-history-item__heading">
                                <div><strong>{item.candidato_nome}</strong>{item.telefone && <small>{item.telefone}</small>}</div>
                                <Tag value={CANDIDATE_RESULT_LABELS[item.resultado] || item.resultado} severity={item.resultado === 'aprovado' ? 'success' : item.resultado === 'reprovado' ? 'danger' : 'warning'} rounded />
                            </div>
                            {item.observacao && <p>{item.observacao}</p>}
                            <footer>
                                <span><AppIcon name="user-edit"  /> {item.registrado_por || 'Usuário não identificado'}</span>
                                <span><AppIcon name="clock"  /> {item.ocorrido_em ? new Date(item.ocorrido_em).toLocaleString('pt-br') : '-'}</span>
                            </footer>
                        </article>
                    )) : <span className="empty-status">Nenhum candidato finalizado nesta vaga.</span>}
                </div>
            </Dialog>
        </div>
    );
}

export function Vacancies({ vacancyType = 'substituicao' }) {
    const isAdditive = vacancyType === 'aditivo';
    const [vacancies, setVacancies] = useState([]);
    const [refresh, setRefresh] = useState(false);

    const [departFilter, setDepartFilter] = useState(null);
    const [order, setOrder] = useState('desc');

    const [dialogVisible, setDialogVisible] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [form, setForm] = useState(createEmptyForm);
    const [scheduleSuggestions, setScheduleSuggestions] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [costCenters, setCostCenters] = useState([]);

    const setLoading = useLoading();
    const { showToast } = useToast();

    useEffect(() => {
        async function getVacancies() {
            setVacancies([]);
            setLoading(true);
            try {
                const res = await connect.get(VACANCIES_ENDPOINT, { params: { tipo: vacancyType } });
                setVacancies(res.data ?? []);
            } catch (err) {
                console.warn(err);
                showToast('error', 'Erro!', 'Não foi possível carregar as vagas.');
            } finally {
                setLoading(false);
            }
        }
        getVacancies();
    }, [refresh, setLoading, showToast, vacancyType]);

    useEffect(() => {
        // Supervisores alimentam tanto o cadastro quanto a edição rápida de cada vaga.
        connect.get('/supervisores')
            .then(({ data }) => setSupervisors((data ?? []).map((item) => ({ label: item.nome, value: item.id }))))
            .catch(() => showToast('error', 'Erro!', 'Não foi possível carregar os supervisores.'));
    }, [showToast]);

    useEffect(() => {
        if (!isAdditive) return;
        connect.get('/centro')
            .then(({ data }) => setCostCenters((data ?? []).map((item) => ({
                label: `${item.local} · DPTO. ${item.departamento ?? '-'}`,
                value: item.id,
            }))))
            .catch(() => showToast('error', 'Erro!', 'Não foi possível carregar os contratos.'));
    }, [isAdditive, showToast]);

    const departamentoOptions = useMemo(() => {
        const set = new Set(vacancies.map((v) => v.departamento).filter(Boolean));
        return [...set].map((d) => ({ label: d, value: d }));
    }, [vacancies]);

    const filtered = useMemo(() => {
        let list = [...vacancies];
        if (departFilter) list = list.filter((v) => v.departamento === departFilter);

        list.sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return order === 'asc' ? dateA - dateB : dateB - dateA;
        });

        return list;
    }, [vacancies, departFilter, order]);

    const grouped = useMemo(() => {
        // Inicializar todos os status garante que colunas vazias também sejam exibidas.
        const g = {};
        STATUS_OPTIONS.forEach((s) => { g[s.value] = []; });
        filtered.forEach((v) => {
            if (g[v.status]) g[v.status].push(v);
            else g.aberta.push(v);
        });
        return g;
    }, [filtered]);

    const openCreate = () => {
        setForm(createEmptyForm());
        setScheduleSuggestions([]);
        setDialogVisible(true);
    };

    const handleSave = async () => {
        if (isAdditive && !form.centro_custo_id) {
            showToast('warn', 'Atenção!', 'Selecione o contrato que receberá o aditivo.');
            return;
        }

        if (!isAdditive && !form.colaborador_id) {
            showToast('warn', 'Atenção!', 'Busque e selecione um colaborador pela matrícula ou nome.');
            return;
        }

        if (!isAdditive && !form.supervisor_id) {
            showToast('warn', 'Atenção!', 'Selecione o supervisor responsável pela vaga.');
            return;
        }

        if (!form.horario_trabalho) {
            showToast('warn', 'Atenção!', 'Informe o horário de trabalho da vaga.');
            return;
        }

        if (!isAdditive && !form.motivo_saida) {
            showToast('warn', 'Atenção!', 'Informe o motivo da saída.');
            return;
        }

        if (!form.data_aviso) {
            showToast('warn', 'Atenção!', 'Selecione a data em que a vaga foi avisada ou o currículo foi enviado.');
            return;
        }

        setLoading(true);
        try {
            await connect.post(VACANCIES_ENDPOINT, {
                tipo: vacancyType,
                centro_custo_id: isAdditive ? form.centro_custo_id : null,
                colaborador_id: form.colaborador_id,
                supervisor_id: form.supervisor_id,
                colaborador_entrada: form.colaborador_entrada.trim() || null,
                telefone_colaborador_entrada: form.telefone_colaborador_entrada.trim() || null,
                aviso_em: toApiDateTime(form.data_aviso),
                data_saida: !isAdditive && form.data_saida ? toApiDate(form.data_saida) : null,
                horario_trabalho: form.horario_trabalho,
                motivo_saida: form.motivo_saida,
            });
            showToast('success', 'Sucesso!', 'Vaga cadastrada com sucesso.');
            setDialogVisible(false);
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', err.response?.data ?? 'Não foi possível cadastrar a vaga.');
        } finally {
            setLoading(false);
        }
    };

    const searchSchedules = async (event) => {
        try {
            const res = await connect.get(`${VACANCIES_ENDPOINT}/horarios`, {
                params: { q: event.query?.trim() || '' },
            });
            setScheduleSuggestions(res.data ?? []);
        } catch (err) {
            console.warn(err);
            setScheduleSuggestions([]);
        }
    };

    const handleUpdateVaga = async (id, patch) => {
        setLoading(true);
        try {
            await connect.patch(VACANCIES_ENDPOINT, { id, ...patch });
            showToast('success', 'Sucesso!', 'Vaga atualizada com sucesso.');
            setRefresh((prev) => !prev);
            return true;
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', err.response?.data ?? 'Não foi possível atualizar a vaga.');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleCandidateResult = async (payload) => {
        setLoading(true);
        try {
            await connect.post(`${VACANCIES_ENDPOINT}/candidatos-historico`, payload);
            showToast('success', 'Histórico atualizado!', 'O resultado foi registrado e a vaga está pronta para outro candidato.');
            setRefresh((prev) => !prev);
            return true;
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', err.response?.data ?? 'Não foi possível registrar o resultado do candidato.');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVaga = async (vaga) => {
        setLoading(true);
        try {
            await connect.delete(VACANCIES_ENDPOINT, { params: { id: vaga.id } });
            showToast('success', 'Sucesso!', 'Vaga removida com sucesso.');
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', 'Não foi possível remover a vaga.');
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (vaga) => {
        confirmDialog({
            message: `Deseja realmente excluir a vaga de "${vaga.tipo === 'aditivo' ? vaga.centro_custo : vaga.colaborador}"?`,
            header: 'Confirmar exclusão',
            icon: appIcon("alert-triangle"),
            acceptClassName: 'p-button-danger',
            acceptLabel: 'Excluir',
            rejectLabel: 'Cancelar',
            accept: () => handleDeleteVaga(vaga),
        });
    };

    return (
        <main className="flex flex-column gap-3 admissao-page">
            <ConfirmDialog />

            <PageHeader
                section="Admissão"
                title={isAdditive ? 'Vagas de Aditivos' : 'Gerenciamento de Vagas'}
                description={isAdditive ? 'Gerencie novas vagas contratuais sem colaborador de saída.' : 'Gerencie as vagas por status, colaboradores e departamentos.'}
            />

            <div className="flex gap-2 align-items-center flex-wrap">
                {STATUS_OPTIONS.map((s) => (
                    <DashCard
                        key={s.value}
                        title={s.label}
                        className="border-round-lg p-1 spaceg flex-grow-1"
                        style={{ background: s.color, color: '#fff', flexBasis: '10rem', height: "6rem" }}
                        value={grouped[s.value]?.length || 0}
                    />
                ))}
            </div>

            <div className="flex justify-content-between align-items-center flex-wrap gap-2 mt-5">
                <div className="flex align-items-center gap-2">
                    <FloatLabel>
                        <Dropdown
                            id="departamento-filtro"
                            className="w-18rem"
                            value={departFilter}
                            onChange={(e) => setDepartFilter(e.value)}
                            options={departamentoOptions}
                            showClear
                        />
                        <label htmlFor="departamento-filtro">Filtrar por departamento</label>
                    </FloatLabel>

                    {departFilter && (
                        <Button
                            icon={<AppIcon name="filter-off" />}
                            text
                            rounded
                            severity="secondary"
                            tooltip="Limpar filtro"
                            onClick={() => setDepartFilter(null)}
                        />
                    )}
                </div>

                <div className="flex align-items-center gap-2">
                    {!isAdditive && <Button label="Histórico de entrevistas" icon={<AppIcon name="history" />} outlined onClick={() => setHistoryVisible(true)} />}
                    <SelectButton value={order} onChange={(e) => e.value && setOrder(e.value)} options={orderOptions} />
                </div>
            </div>

            <div className="flex flex-column overflow-auto h-full">
                <Accordion multiple>
                    {STATUS_OPTIONS.map((status) => (
                        <AccordionTab
                            key={status.value}
                            header={
                                <div className="flex align-items-center gap-2 w-full">
                                    <span className="status-dot" style={{ background: status.color }}></span>
                                    <span className="font-bold">{status.label}</span>
                                    <Tag value={grouped[status.value]?.length || 0} rounded style={{ background: status.color, color: '#fff', marginLeft: 'auto' }} />
                                </div>
                            }
                        >
                            {grouped[status.value]?.length
                                ? (
                                    <Accordion multiple className="vaga-accordion">
                                        {grouped[status.value].map((vaga) => (
                                            <AccordionTab key={vaga.id} header={<VagaHeader vaga={vaga} />}>
                                                <VagaItem vaga={vaga} supervisors={supervisors} onUpdate={handleUpdateVaga} onCandidateResult={handleCandidateResult} onDelete={confirmDelete} />
                                            </AccordionTab>
                                        ))}
                                    </Accordion>
                                )
                                : <span className="empty-status">Nenhuma vaga neste status.</span>
                            }
                        </AccordionTab>
                    ))}
                </Accordion>
            </div>

            <Button
                icon={<AppIcon name="plus" />}
                size="large"
                className="p-4"
                rounded
                onClick={openCreate}
                style={{ position: 'absolute', right: '20px', bottom: '20px' }}
            />

            <Dialog header={isAdditive ? 'Nova Vaga de Aditivo' : 'Nova Vaga'} visible={dialogVisible} style={{ width: '32rem' }} onHide={() => setDialogVisible(false)}>
                <form className="flex flex-column gap-4 pt-3" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    {isAdditive ? (
                        <FloatLabel className="mt-4">
                            <Dropdown
                                id="centro_custo_id"
                                className="w-full"
                                value={form.centro_custo_id}
                                onChange={(event) => setForm({ ...form, centro_custo_id: event.value })}
                                options={costCenters}
                                filter
                                virtualScrollerOptions={{ itemSize: 44 }}
                            />
                            <label htmlFor="centro_custo_id">Contrato que receberá o aditivo *</label>
                        </FloatLabel>
                    ) : <CollaboratorDropdown
                        value={form.colaborador_id}
                        className="w-full mt-4"
                        placeholder="Matrícula ou nome do colaborador que saiu"
                        onChange={(colaboradorId, employee) => setForm({
                            ...form,
                            colaborador_id: colaboradorId,
                            matricula: employee?.matricula || '',
                            colaborador: employee?.nome || '',
                        })}
                        onError={() => showToast('error', 'Erro!', 'Não foi possível buscar os colaboradores.')}
                    />}

                    {!isAdditive && <FloatLabel>
                        <Dropdown
                            id="supervisor_id"
                            className="w-full"
                            value={form.supervisor_id}
                            onChange={(event) => setForm({ ...form, supervisor_id: event.value })}
                            options={supervisors}
                            optionLabel="label"
                            optionValue="value"
                            filter
                        />
                        <label htmlFor="supervisor_id">Supervisor da vaga *</label>
                    </FloatLabel>}

                    <FloatLabel className='mt-3'>
                        <InputText
                            id="colaborador_entrada"
                            className="w-full"
                            value={form.colaborador_entrada}
                            onChange={(e) => setForm({ ...form, colaborador_entrada: e.target.value })}
                        />
                        <label htmlFor="colaborador_entrada">Nome do colaborador que vai entrar (opcional)</label>
                    </FloatLabel>

                    <FloatLabel className='mt-3'>
                        <InputText
                            id="telefone_colaborador_entrada"
                            className="w-full"
                            value={form.telefone_colaborador_entrada}
                            onChange={(e) => setForm({ ...form, telefone_colaborador_entrada: e.target.value })}
                            maxLength={50}
                        />
                        <label htmlFor="telefone_colaborador_entrada">Telefone do candidato (opcional)</label>
                    </FloatLabel>

                    <FloatLabel className='mt-3'>
                        <Calendar
                            id="data_aviso"
                            className="w-full"
                            value={form.data_aviso}
                            onChange={(e) => setForm({ ...form, data_aviso: e.value })}
                            dateFormat="dd/mm/yy"
                            locale="pt-BR"
                            showIcon
                            showTime
                            hourFormat="24"
                            stepMinute={5}
                            readOnlyInput
                        />
                        <label htmlFor="data_aviso">Data e hora do aviso ao responsável</label>
                    </FloatLabel>

                    <FloatLabel className='mt-3'>
                        <AutoComplete
                            id="horario_trabalho"
                            className="w-full"
                            inputClassName="w-full"
                            value={form.horario_trabalho}
                            suggestions={scheduleSuggestions}
                            completeMethod={searchSchedules}
                            field="descricao"
                            delay={350}
                            dropdown
                            forceSelection={false}
                            onChange={(e) => setForm({
                                ...form,
                                horario_trabalho: typeof e.value === 'string' ? e.value : e.value?.descricao || '',
                            })}
                        />
                        <label htmlFor="horario_trabalho">Horário de trabalho (se for novo, será cadastrado)</label>
                    </FloatLabel>

                    {!isAdditive && <FloatLabel className='mt-3'>
                        <Dropdown
                            id="motivo_saida"
                            className="w-full"
                            value={form.motivo_saida}
                            onChange={(e) => setForm({ ...form, motivo_saida: e.value })}
                            options={MOTIVO_OPTIONS}
                        />
                        <label htmlFor="motivo_saida">Motivo da saída</label>
                    </FloatLabel>}

                    {!isAdditive && (
                        <>
                            <FloatLabel className="mt-3">
                                <Calendar
                                    id="data_saida"
                                    className="w-full"
                                    value={form.data_saida}
                                    onChange={(event) => setForm({
                                        ...form,
                                        data_saida: event.value,
                                    })}
                                    dateFormat="dd/mm/yy"
                                    locale="pt-BR"
                                    showIcon
                                    showButtonBar
                                    readOnlyInput
                                />
                                <label htmlFor="data_saida">Data prevista de saída (opcional)</label>
                            </FloatLabel>

                            <small className="departure-date-hint">
                                <AppIcon name="info-circle"  />
                                Essa data não bloqueia a vaga. O processo seletivo pode começar e ser concluído antes da saída.
                            </small>
                        </>
                    )}

                    <Button type="submit" className='mt-3' label="Cadastrar vaga" icon={<AppIcon name="check" />} />
                </form>
            </Dialog>
            {!isAdditive && <InterviewHistoryDialog visible={historyVisible} onHide={() => setHistoryVisible(false)} />}
        </main>
    );
}
