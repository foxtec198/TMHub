// Widgets ----------------------------------------------
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Stepper } from 'primereact/stepper';
import { StepperPanel } from 'primereact/stepperpanel';
import { Checkbox } from "primereact/checkbox";
import { SelectButton } from "primereact/selectbutton";

// Utils ------------------------------------------------
import { useState, useRef, useEffect } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useLoading } from "../../contexts/LoadingContext";
import connect from "../../utils/request";
import { InputText } from "primereact/inputtext";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import "./new.css";

function SelectedCollaborator({ title, collaborator, icon }) {
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
                    <dt>Lugar</dt>
                    <dd>{place}</dd>
                </div>
            </dl>
        </section>
    );
}

export function Request() {
    // Campos do formulário e seleções relacionadas ao colaborador ausente.
    const [user, selectedUser] = useState(null)
    const [replace, selectedReplace] = useState(null)
    const [absent, selectedAbsent] = useState(null)
    const [absentDetails, setAbsentDetails] = useState(null)
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
    const setLoading = useLoading();
    const { showToast } = useToast();

    function selectedRequestDate() {
        // The API requires the actual submission time even when tomorrow is selected.
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

    // Valida os campos obrigatórios e envia a nova requisição ao backend.
    async function createRequest() {
        setLoading(true);
        try {
            const disciplinaryMeasureInformed = reason !== "INJUSTIFICADA" || Boolean(warning);
            if(user && absent && reason && disciplinaryMeasureInformed && (checked || replace)){
                const data = {
                    supervisor_id: user.id,
                    ausente_id: absent,
                    reserva_id: checked ? 0 : replace.id,
                    motivo: reason,
                    advertencia: warning,
                    data: selectedRequestDate(),
                    obs: obs,
                    // Identifica o fluxo público no backend para que o
                    // supervisor não limite os colaboradores atendidos.
                    publico: true,
                }
                const response = await connect.post("/repo/request", data)
                showToast("success", "Sucesso na requisição", "Sua requisição foi criada com sucesso, aguarde novidades por email!")
                const disciplinarySummary = response.data?.resumo_disciplinar;
                if (disciplinarySummary) {
                    showToast(
                        "info",
                        "Histórico disciplinar",
                        `${disciplinarySummary.advertencias || 0} advertência(s) e ${disciplinarySummary.suspensoes || 0} suspensão(ões) registradas.`,
                    );
                }
                (response.data?.avisos || []).forEach((message) => {
                    showToast("warn", "Orientação do RH", message);
                });
                selectedReplace(null); selectedAbsent(null); setAbsentDetails(null); selectedReason(null); setObs(""); selectedWarning(null); setDateChoice("today")
            }
            else{showToast("warn", "Atenção!", "Preencha todos os dados")}
        }
        catch (err) { console.warn(err); showToast("error", "Erro ao enviar requisição", err.response.data) }
        finally { setLoading(false) }

    }

    // Pré-carrega os supervisores usados no primeiro passo do formulário.
    useEffect(() => {
        async function getSups() {
            const res = await connect.get("/supervisores");
            const sups = []
            res.data.map(item => sups.push({ name: item.nome, id: item.id }))
            setSupsOptions(sups)
        }

        getSups();
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
                        publico: 1,
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

    // Formulário público e responsivo de abertura de reposição.
    return (
        <>
            <div className="request-create-page flex min-h-screen px-4 py-6 flex-column justify-content-between align-items-center">
                {/* HEADER */}
                <div className="flex flex-column align-items-center justify-content-center text-center">
                    <img
                        src="/brands/main_brand.svg"
                        alt="Logo"
                        className="request-create-logo px-5 fadein animation-duration-2000"
                    />

                    <span
                        className="font-bold fadeinleft animation-duration-1000 text-2xl text-secondary inter uppercase">
                        Gestão de Reposições
                    </span>
                </div>

                {/* MAIN */}
                <div className="request-stepper-shell flex" style={{ minWidth: "22rem" }}>
                    <Stepper ref={stepperRef}>
                        <StepperPanel header="Login">
                            <div className="flex flex-column text-medium text-center">
                                <span className="font-xl mb-4">Selecione seu nome na lista, caso não encontre, entre em contato com o suporte!</span>
                                <Dropdown
                                    className="w-full mb-6"
                                    value={user}
                                    onChange={(e) => {
                                        selectedUser(e.value);
                                        selectedAbsent(null);
                                        setAbsentDetails(null);
                                        selectedReplace(null);
                                        setReplaces([]);
                                    }}
                                    options={supsOtions}
                                    placeholder="Selecione seu nome na lista"
                                    optionLabel="name"
                                    filter
                                />
                                <Button
                                    label="Realizar Login"
                                    icon="pi pi-sign-in"
                                    iconPos="right"
                                    onClick={() => {
                                        user
                                            ? stepperRef.current.nextCallback()
                                            : showToast("error", "Erro no Login", "Selecione um usuário primeiro!")
                                    }}
                                />
                            </div>
                        </StepperPanel>

                        <StepperPanel header="Reserva">
                            <div className="flex flex-column p-4 text-medium" style={{
                                maxWidth: "40rem",
                                flexGrow: 1,
                                width: "90dvw"
                            }}>
                                <CollaboratorDropdown
                                    appendTo="self"
                                    panelStyle={{ width: '100%' }}
                                    className="w-full mb-3"
                                    value={absent}
                                    queryParams={{ publico: 1 }}
                                    onChange={(id, collaborator) => {
                                        selectedAbsent(id);
                                        setAbsentDetails(collaborator);
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
                                />
                                <Dropdown
                                    appendTo="self"
                                    panelStyle={{ width: '100%' }}
                                    className={`w-full mb-3 ${checked? "hidden":null}`}
                                    value={replace}
                                    virtualScrollerOptions={{ itemSize: 38 }}
                                    onChange={(e) => selectedReplace(e.value)}
                                    options={replaces}
                                    placeholder="Quem vai repor?"
                                    optionLabel="name"
                                    optionDisabled="disabled"
                                    loading={loadingReplaces}
                                    itemTemplate={(option) => (
                                        <div className="request-reserve-option">
                                            <span>{option.name}</span>
                                            <small className={option.disabled ? "request-reserve-unavailable" : "request-reserve-available"}>
                                                {option.disabled ? "Indisponível nesta data" : "Disponível"}
                                            </small>
                                        </div>
                                    )}
                                    filter
                                />
                                <Dropdown
                                    appendTo="self"
                                    panelStyle={{ maxWidth: '100%' }}
                                    className="w-full mb-3"
                                    value={reason}
                                    onChange={(e) => {
                                        selectedReason(e.value);
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
                                    onChange={(e) => selectedWarning(e.value)}
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
                                    <SelectButton value={dateChoice} options={dateOptions} onChange={(e) => e.value && setDateChoice(e.value)} allowEmpty={false} />
                                </div>

                                <div className="flex justify-content-end align-items-center text-end">
                                    <Checkbox inputId="req" name="pizza" value="Cheese" onChange={(e) => setChecked(e.checked)} checked={checked} />
                                    <label htmlFor="req" className="ml-2">Posto sem Cobertura?</label>
                                </div>


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
