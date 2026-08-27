// Componentes visuais ----------------------------------
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Stepper } from 'primereact/stepper';
import { StepperPanel } from 'primereact/stepperpanel';
import { Checkbox } from "primereact/checkbox";
import { SelectButton } from "primereact/selectbutton";

// Utilitários -------------------------------------------
import { useState, useRef, useEffect } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useLoading } from "../../contexts/LoadingContext";
import connect from "../../utils/request";
import { InputText } from "primereact/inputtext";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import { PageHeader } from "../../components/PageHeader";
import "./new.css";

function SelectedCollaborator({ title, collaborator, icon, disciplinaryContext, disciplinaryLoading }) {
    if (!collaborator) return null;

    const placeName = collaborator.centro_local || collaborator.lugar || collaborator.local || collaborator.posto;
    const centerId = String(collaborator.centro_id || "");
    const placeAlreadyIdentified = placeName && (String(placeName).trim() === centerId || String(placeName).trim().startsWith(`${centerId} -`));
    const place = placeName
        ? [placeAlreadyIdentified ? null : collaborator.centro_id, placeName, collaborator.departamento]
            .filter((part, index, parts) => part != null && part !== "" && parts.indexOf(part) === index)
            .join(" - ")
        : collaborator.centro_id
            ? `Centro ${collaborator.centro_id} - local não cadastrado`
            : "Não informado";
    return (
        <section className="request-collaborator-summary" aria-label={`${title} selecionado`}>
            <div className="request-collaborator-summary__heading">
                <i className={icon} aria-hidden="true" />
                <span>{title}</span>
            </div>
            <dl>
                <div>
                    <dt>Nome</dt>
                    <dd>{collaborator.nome || collaborator.name || "Não informado"}</dd>
                </div>
                <div>
                    <dt>Matrícula</dt>
                    <dd>{collaborator.matricula || "Não informada"}</dd>
                </div>
                <div>
                    <dt>Cargo</dt>
                    <dd>{collaborator.cargo || "Não informado"}</dd>
                </div>
                <div>
                    <dt>Lugar</dt>
                    <dd>{place}</dd>
                </div>
            </dl>
            {disciplinaryLoading && <div className="request-disciplinary-loading"><i className="pi pi-spin pi-spinner" /> Verificando histórico disciplinar...</div>}
            {disciplinaryContext?.avisos?.length > 0 && <aside className="request-disciplinary-alert" role="alert">
                <i className="pi pi-exclamation-triangle" aria-hidden="true" />
                <div>
                    <strong>Orientação do RH</strong>
                    <ul>{disciplinaryContext.avisos.map((message) => <li key={message}>{message}</li>)}</ul>
                    <small>{disciplinaryContext.contagens?.advertencias || 0} advertência(s) · {disciplinaryContext.contagens?.suspensoes || 0} suspensão(ões)</small>
                </div>
            </aside>}
        </section>
    );
}

export function Request() {
    // Campos do formulário e seleções relacionadas ao colaborador ausente.
    const [user, selectedUser] = useState(null)
    const [canChooseSupervisor, setCanChooseSupervisor] = useState(false)
    const [requesterLoading, setRequesterLoading] = useState(true)
    const [requesterError, setRequesterError] = useState(null)
    const [replace, selectedReplace] = useState(null)
    const [absent, selectedAbsent] = useState(null)
    const [absentDetails, setAbsentDetails] = useState(null)
    const [disciplinaryContext, setDisciplinaryContext] = useState(null)
    const [disciplinaryLoading, setDisciplinaryLoading] = useState(false)
    const [additionalContext, setAdditionalContext] = useState(null)
    const [additionalLoading, setAdditionalLoading] = useState(false)
    const [manualCoverage, setManualCoverage] = useState(null)
    const [activeStep, setActiveStep] = useState(0)
    const [additionalStepReleased, setAdditionalStepReleased] = useState(false)
    const [warning, selectedWarning] = useState(null)
    const [reason, selectedReason] = useState(null)
    const [obs, setObs] = useState("")
    const [checked, setChecked] = useState(false)
    const [dateChoice, setDateChoice] = useState("today")

    // Opções remotas carregadas para os dropdowns do formulário.
    const [supsOtions, setSupsOptions] = useState(null)
    const [replaces, setReplaces] = useState([])
    const [loadingReplaces, setLoadingReplaces] = useState(false)
    const dateOptions = [{ label: "Hoje", value: "today" }, { label: "Amanhã", value: "tomorrow" }]

    const reasonOptions = [
        "AFASTAMENTO",
        "ATESTADO",
        "DECLARAÇÃO",
        "FÉRIAS",
        "POSTO VAGO",
        "REMANEJAMENTO",
        "INJUSTIFICADA",
    ]

    const stepperRef = useRef(null)
    const disciplinaryRequestRef = useRef(0)
    const additionalRequestRef = useRef(0)
    const setLoading = useLoading();
    const { showToast } = useToast();

    function changeStep(step) {
        // Mantém o estado do React e o Stepper sincronizados quando a etapa
        // é alterada por um botão ou por uma navegação permitida no cabeçalho.
        setActiveStep(step);
        stepperRef.current?.setActiveStep(step);
    }

    function handleStepChange(event) {
        const { index } = event;
        const canGoBack = index < activeStep;
        const canOpenAdditional = index === 1 && additionalStepReleased;

        // O supervisor pode voltar às etapas anteriores, mas só avança quando
        // a etapa necessária já foi concluída e liberada pela regra de negócio.
        if (index === activeStep || canGoBack || canOpenAdditional) {
            setActiveStep(index);
            return;
        }

        event.originalEvent?.preventDefault?.();
        window.requestAnimationFrame(() => stepperRef.current?.setActiveStep(activeStep));
    }

    function selectedRequestDate() {
        // A API exige o horário real de envio, mesmo quando a data selecionada é amanhã.
        const now = new Date();
        if (dateChoice === "tomorrow") now.setDate(now.getDate() + 1);
        return now;
    }

    function selectedRequestDateKey() {
        const selectedDate = selectedRequestDate();
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    async function loadDisciplinaryContext(collaboratorId) {
        const requestId = ++disciplinaryRequestRef.current;
        setDisciplinaryContext(null);

        if (!collaboratorId) {
            setDisciplinaryLoading(false);
            return;
        }

        setDisciplinaryLoading(true);
        try {
            const { data } = await connect.post("/repo/request/contexto-disciplinar", {
                colaborador_id: collaboratorId,
            });
            if (requestId === disciplinaryRequestRef.current) setDisciplinaryContext(data);
        } catch {
            // O histórico é apenas orientativo; a indisponibilidade não bloqueia a requisição.
            if (requestId === disciplinaryRequestRef.current) setDisciplinaryContext(null);
        } finally {
            if (requestId === disciplinaryRequestRef.current) setDisciplinaryLoading(false);
        }
    }

    async function loadAdditionalContext(collaboratorId, reserveId) {
        const requestId = ++additionalRequestRef.current;
        setAdditionalContext(null);

        if (!collaboratorId) {
            setAdditionalLoading(false);
            return;
        }

        setAdditionalLoading(true);
        try {
            const { data } = await connect.post("/repo/request/contexto-adicional", {
                ausente_id: collaboratorId,
                reserva_id: reserveId || 0,
            });
            if (requestId === additionalRequestRef.current) setAdditionalContext(data);
        } catch (error) {
            if (requestId === additionalRequestRef.current) {
                setAdditionalContext({
                    modo: "desabilitado",
                    motivo: error.response?.data || "Não foi possível validar o adicional do cargo.",
                });
            }
        } finally {
            if (requestId === additionalRequestRef.current) setAdditionalLoading(false);
        }
    }

    function advanceToAdditional() {
        const disciplinaryMeasureInformed = reason !== "INJUSTIFICADA" || Boolean(warning);
        const reservationSelected = checked || replace;

        if (!absent || !reason || !disciplinaryMeasureInformed || !reservationSelected) {
            showToast("warn", "Complete a reserva", "Informe o ausente, o motivo e a reserva técnica ou a ausência dela.");
            return;
        }

        if (additionalLoading || !additionalContext) {
            showToast("warn", "Aguarde", "Estamos verificando se o cargo exige cobertura de adicional.");
            return;
        }

        // Quando não há adicional, o passo 3 permanece bloqueado e o envio
        // acontece diretamente no passo de Reserva.
        if (additionalContext.modo !== "selecionar_cobertura") {
            createRequest();
            return;
        }

        setAdditionalStepReleased(true);
        changeStep(1);
    }

    // Valida os campos obrigatórios e envia a nova requisição ao backend.
    async function createRequest() {
        setLoading(true);
        try {
            const disciplinaryMeasureInformed = reason !== "INJUSTIFICADA" || Boolean(warning);
            const manualCoverageRequired = additionalContext?.modo === "selecionar_cobertura";
            const requestReady = user
                && absent
                && reason
                && disciplinaryMeasureInformed
                && (checked || replace)
                && (!manualCoverageRequired || manualCoverage);
            if (requestReady) {
                const data = {
                    supervisor_usuario_id: user.id,
                    ausente_id: absent,
                    reserva_id: checked ? 0 : replace?.id,
                    cobertura_colaborador_id: checked ? manualCoverage?.id : null,
                    motivo: reason,
                    advertencia: warning,
                    data: selectedRequestDate(),
                    obs: obs,
                }
                await connect.post("/repo/request", data)
                showToast("success", "Sucesso na requisição", "Sua requisição foi criada com sucesso, aguarde novidades por email!")
                selectedReplace(null); selectedAbsent(null); setAbsentDetails(null); setDisciplinaryContext(null); setAdditionalContext(null); setManualCoverage(null); selectedReason(null); setObs(""); selectedWarning(null); setChecked(false); setDateChoice("today"); setAdditionalStepReleased(false)
            }
            else{showToast("warn", "Atenção!", "Preencha todos os dados")}
        }
        catch (err) { console.warn(err); showToast("error", "Erro ao enviar requisição", err.response?.data || "Não foi possível enviar a requisição.") }
        finally { setLoading(false) }

    }

    // O supervisor é resolvido a partir do usuário autenticado. Somente
    // administradores podem trocar o responsável dentro do escopo selecionado.
    useEffect(() => {
        let active = true;
        async function loadRequester() {
            setRequesterLoading(true);
            setRequesterError(null);
            try {
                const { data } = await connect.get("/repo/request/solicitante");
                if (!active) return;
                setCanChooseSupervisor(Boolean(data.pode_selecionar_supervisor));
                setSupsOptions((data.supervisores || []).map((item) => ({
                    id: item.id,
                    name: item.nome,
                })));
                selectedUser(data.supervisor ? {
                    id: data.supervisor.id,
                    name: data.supervisor.nome,
                } : null);
            } catch (error) {
                if (!active) return;
                selectedUser(null);
                setRequesterError(error.response?.data || "Não foi possível identificar seu acesso de supervisor.");
            } finally {
                if (active) setRequesterLoading(false);
            }
        }
        loadRequester();
        return () => { active = false; };
    }, [])

    // A disponibilidade considera somente a data escolhida para a requisição.
    useEffect(() => {
        let active = true;

        async function getReplaces() {
            setLoadingReplaces(true);
            try {
                const { data } = await connect.get("/repo/reservas-uso", {
                    params: {
                        data: selectedRequestDateKey(),
                    },
                });
                if (!active) return;
                const available = data.disponiveis.map((item) => ({ ...item, name: item.nome, disabled: false }));
                const unavailable = data.usadas.map((item) => ({ ...item, name: item.nome, disabled: true }));
                const options = [...available, ...unavailable].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
                setReplaces(options);
                if (replace && options.find((item) => item.id === replace.id)?.disabled) selectedReplace(null);
            } catch (error) {
                if (active) {
                    setReplaces([]);
                    selectedReplace(null);
                    showToast("error", "Reservas", error.response?.data || "Não foi possível consultar a disponibilidade.");
                }
            } finally {
                if (active) setLoadingReplaces(false);
            }
        }

        if (user?.id) getReplaces();
        return () => { active = false; };
        // replace não dispara uma nova consulta; ele é apenas invalidado quando a data muda.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateChoice, user?.id])

    // Revalida o item 3 quando o ausente ou a reserva técnica forem alterados.
    useEffect(() => {
        // Agenda a consulta após a renderização e evita atualizar o estado de
        // uma seleção anterior enquanto o usuário troca os campos rapidamente.
        const timer = window.setTimeout(() => {
            loadAdditionalContext(absent, checked ? 0 : replace?.id);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [absent, checked, replace?.id])

    // Qualquer alteração dos dados que definem a regra do adicional exige uma
    // nova validação no passo 2 antes de liberar novamente o passo 3.
    useEffect(() => {
        setAdditionalStepReleased(false);
    }, [absent, checked, replace?.id, reason, warning])

    // Formulário autenticado e responsivo de abertura de reposição.
    return (
        <>
            <div className="request-create-page request-create-page--authenticated flex px-4 py-4 flex-column justify-content-start align-items-center">
                <PageHeader
                    section="Operacional"
                    title="Nova requisição"
                    description="Informe uma ausência e a cobertura necessária para o posto."
                />

                {/* MAIN */}
                <div className={`request-stepper-shell ${additionalStepReleased ? "is-additional-released" : "is-additional-locked"}`}>
                    <div className="request-authenticated-supervisor">
                        {requesterLoading ? <><i className="pi pi-spin pi-spinner" /> Identificando supervisor responsável...</> : null}
                        {!requesterLoading && requesterError ? <span className="request-authenticated-supervisor__error">{requesterError}</span> : null}
                        {!requesterLoading && !requesterError && canChooseSupervisor ? <Dropdown
                            className="w-full"
                            value={user}
                            options={supsOtions}
                            optionLabel="name"
                            placeholder="Selecione o supervisor responsável"
                            filter
                            onChange={(event) => {
                                selectedUser(event.value);
                                selectedAbsent(null);
                                setAbsentDetails(null);
                                selectedReplace(null);
                                setReplaces([]);
                                setAdditionalStepReleased(false);
                            }}
                        /> : null}
                        {!requesterLoading && !requesterError && !canChooseSupervisor && user ? <><i className="pi pi-user" /> Requisição em nome de <strong>{user.name}</strong></> : null}
                    </div>
                    <Stepper ref={stepperRef} activeStep={activeStep} onChangeStep={handleStepChange}>
                        <StepperPanel header="Requisição">
                            <div className="request-reservation-step request-form-step flex flex-column">
                                <CollaboratorDropdown
                                    appendTo="self"
                                    panelStyle={{ width: '100%' }}
                                    className="w-full mb-3 collaborator-dropdown--wrap"
                                    value={absent}
                                    virtualScrollerOptions={null}
                                    onChange={(id, collaborator) => {
                                        selectedAbsent(id);
                                        setAbsentDetails(collaborator);
                                        setManualCoverage(null);
                                        setAdditionalStepReleased(false);
                                        loadDisciplinaryContext(id);
                                    }}
                                    placeholder="Busque quem faltou"
                                    minSearch={2}
                                    showClear={false}
                                    onError={() => showToast("error", "Erro na busca", "Não foi possível buscar os colaboradores.")}
                                />
                                <SelectedCollaborator
                                    title="Ausente"
                                    collaborator={absentDetails}
                                    icon="pi pi-user-minus"
                                    disciplinaryContext={disciplinaryContext}
                                    disciplinaryLoading={disciplinaryLoading}
                                />
                                <Dropdown
                                    appendTo="self"
                                    panelStyle={{ width: '100%' }}
                                    className={`w-full mb-3 ${checked? "hidden":null}`}
                                    value={replace}
                                    // Os textos de cargo e situação podem ocupar mais de uma linha
                                    // no celular; sem altura fixa, cada opção cresce quando necessário.
                                    virtualScrollerOptions={null}
                                    onChange={(e) => {
                                        selectedReplace(e.value);
                                        setManualCoverage(null);
                                        setAdditionalStepReleased(false);
                                    }}
                                    options={replaces}
                                    placeholder="Quem vai repor?"
                                    optionLabel="name"
                                    optionDisabled="disabled"
                                    loading={loadingReplaces}
                                    itemTemplate={(option) => (
                                        <div className="request-reserve-option request-reserve-option--availability">
                                            <span>{option.name}</span>
                                            <small>{option.cargo || "Cargo não informado"}</small>
                                            <em className={option.disabled ? "request-reserve-unavailable" : "request-reserve-available"}>
                                                {option.disabled ? "Indisponível nesta data" : "Disponível"}
                                            </em>
                                        </div>
                                    )}
                                    valueTemplate={(option, props) => option ? (
                                        <div className="request-reserve-option">
                                            <span>{option.name}</span>
                                            <small>{option.cargo || "Cargo não informado"}</small>
                                        </div>
                                    ) : <span className="p-placeholder">{props.placeholder}</span>}
                                    filter
                                />
                                <Dropdown
                                    appendTo="self"
                                    panelStyle={{ maxWidth: '100%' }}
                                    className="w-full mb-3"
                                    value={reason}
                                    onChange={(e) => {
                                        selectedReason(e.value);
                                        setAdditionalStepReleased(false);
                                        if (e.value !== "INJUSTIFICADA") selectedWarning(null);
                                    }}
                                    options={reasonOptions}
                                    placeholder="Selecione o Motivo"
                                    optionLabel="name"
                                />

                                <Dropdown
                                    appendTo="self"
                                    panelStyle={{ width: "100%" }}
                                    className={`w-full mb-3 ${reason != "INJUSTIFICADA" ? "hidden" : null}`}
                                    value={warning}
                                    onChange={(e) => {
                                        selectedWarning(e.value);
                                        setAdditionalStepReleased(false);
                                    }}
                                    options={["Aplicado", "Não Aplicado"]}
                                    placeholder="Medida disciplinar"
                                    optionLabel="name"
                                />

                                <InputText
                                    className="w-full mb-3"
                                    value={obs}
                                    onChange={(e) => setObs(e.target.value)}
                                    placeholder="Observação (opcional)"
                                />
                                
                                <div className="flex justify-content-between align-items-center gap-3 mb-4">
                                    <span className="font-medium">Data da ausência</span>
                                    <SelectButton
                                        id="request-date-choice"
                                        value={dateChoice}
                                        options={dateOptions}
                                        onChange={(e) => e.value && setDateChoice(e.value)}
                                        allowEmpty={false}
                                    />
                                </div>

                                <div className="flex justify-content-end align-items-center text-end">
                                    <Checkbox
                                        inputId="req"
                                        name="sem-reserva"
                                        onChange={(e) => {
                                            setChecked(e.checked);
                                            if (e.checked) selectedReplace(null);
                                            if (!e.checked) setManualCoverage(null);
                                            setAdditionalStepReleased(false);
                                        }}
                                        checked={checked}
                                    />
                                    <label htmlFor="req" className="ml-2">Sem reserva técnica?</label>
                                </div>

                                <Button
                                    label={additionalContext?.modo === "selecionar_cobertura" ? "Continuar" : "Enviar Requisição"}
                                    icon={additionalContext?.modo === "selecionar_cobertura" ? "pi pi-arrow-right" : "pi pi-send"}
                                    iconPos="right"
                                    className="w-full mt-4"
                                    onClick={advanceToAdditional}
                                />
                            </div>
                        </StepperPanel>

                        <StepperPanel header="Adicional">
                            <div className="request-additional-step request-form-step flex flex-column">
                                <section className={`request-additional-coverage ${additionalContext?.modo !== "selecionar_cobertura" ? "is-disabled" : ""}`}>
                                    <div className="request-additional-coverage__heading">
                                        <span>3</span>
                                        <div>
                                            <strong>Cobertura para adicional</strong>
                                            <small>Use somente quando não houver reserva técnica.</small>
                                        </div>
                                    </div>

                                    {additionalLoading && <p className="request-additional-coverage__message"><i className="pi pi-spin pi-spinner" /> Verificando o cargo selecionado...</p>}

                                    {!additionalLoading && additionalContext?.modo === "selecionar_cobertura" && (
                                        <>
                                            <dl className="request-additional-coverage__summary">
                                                <div><dt>Colaborador</dt><dd>{absentDetails?.nome || "Não informado"}</dd></div>
                                                <div><dt>Matrícula</dt><dd>{absentDetails?.matricula || "Não informada"}</dd></div>
                                                <div><dt>Centro de custo</dt><dd>{absentDetails?.centro_id || "Não informado"}</dd></div>
                                                <div><dt>Departamento</dt><dd>{absentDetails?.departamento || "Não informado"}</dd></div>
                                                <div className="is-wide"><dt>Motivo</dt><dd>{reason || "Selecione o motivo da ausência"}</dd></div>
                                            </dl>
                                            <Dropdown
                                                appendTo="self"
                                                panelStyle={{ width: "100%" }}
                                                className="w-full"
                                                value={manualCoverage}
                                                onChange={(e) => {
                                                    setManualCoverage(e.value);
                                                    setChecked(true);
                                                }}
                                                options={additionalContext.candidatos || []}
                                                optionLabel="nome"
                                                placeholder="Selecione quem cobrirá o posto"
                                                filter
                                                itemTemplate={(option) => (
                                                    <div className="request-reserve-option">
                                                        <span>{option.nome}</span>
                                                        <small>{[option.matricula && `Matrícula ${option.matricula}`, option.cargo].filter(Boolean).join(" · ")}</small>
                                                    </div>
                                                )}
                                                valueTemplate={(option, props) => option ? (
                                                    <div className="request-reserve-option">
                                                        <span>{option.nome}</span>
                                                        <small>{option.cargo || "Cargo não informado"}</small>
                                                    </div>
                                                ) : <span className="p-placeholder">{props.placeholder}</span>}
                                            />
                                        </>
                                    )}

                                    {!additionalLoading && additionalContext?.modo !== "selecionar_cobertura" && (
                                        <p className="request-additional-coverage__message">{additionalContext?.motivo || "Selecione o colaborador ausente para verificar esta etapa."}</p>
                                    )}
                                </section>


                                <Button
                                    label="Enviar Requisição"
                                    icon="pi pi-send"
                                    iconPos="right"
                                    className="w-full mt-3"
                                    onClick={() => { createRequest() }}
                                />
                            </div>
                        </StepperPanel>
                    </Stepper>
                </div>
            </div>
        </>
    );
};
