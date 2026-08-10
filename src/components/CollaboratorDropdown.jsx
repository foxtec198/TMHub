import { useEffect, useMemo, useRef, useState } from "react";
import { Dropdown } from "primereact/dropdown";
import connect from "../utils/request";
import "./collaborator-dropdown.css";

const DEFAULT_LIMIT = 50;
const DEFAULT_DEBOUNCE = 350;

function collaboratorMeta(collaborator) {
    if (!collaborator) return "";
    const centerId = collaborator.centro_id ? String(collaborator.centro_id) : "";
    const local = String(collaborator.centro_local || collaborator.local || "").trim();
    const center = local
        ? (centerId && !local.startsWith(`${centerId} -`) ? `${centerId} - ${local}` : local)
        : centerId;
    return [collaborator.matricula, center, collaborator.departamento]
        .filter((part, index, parts) => part != null && part !== "" && parts.indexOf(part) === index)
        .join(" · ");
}

function CollaboratorOption({ collaborator, selected = false }) {
    if (!collaborator) return null;
    return (
        <div className={selected ? "collaborator-dropdown-option is-selected" : "collaborator-dropdown-option"}>
            <strong>{collaborator.nome || "Nome não informado"}</strong>
            <small>{collaboratorMeta(collaborator) || "Matrícula e contrato não informados"}</small>
        </div>
    );
}

/**
 * Dropdown reutilizável de colaboradores.
 * A busca, o limite, o debounce e o virtual scroll ficam encapsulados para que
 * todas as telas consultem o banco da mesma forma, sem carregar a base inteira.
 */
export function CollaboratorDropdown({
    value,
    onChange,
    selectedOption = null,
    queryParams = {},
    limit = DEFAULT_LIMIT,
    debounce = DEFAULT_DEBOUNCE,
    minSearch = 0,
    className = "",
    placeholder = "Selecione um colaborador",
    emptyMessage = "Nenhum colaborador encontrado",
    showClear = true,
    disabled = false,
    appendTo,
    panelStyle,
    onError,
}) {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState("");
    const selectedOptionRef = useRef(null); // Preserva a opção escolhida mesmo fora dos 50 resultados seguintes.
    const requestIdRef = useRef(0); // Identifica respostas antigas de buscas que terminaram fora de ordem.
    const serializedParams = useMemo(() => JSON.stringify(queryParams), [queryParams]);

    useEffect(() => {
        if (selectedOption && selectedOption.id) {
            selectedOptionRef.current = {
                ...selectedOption,
                label: selectedOption.nome || selectedOption.label,
            };
        } else if (!value) {
            selectedOptionRef.current = null;
        }
    }, [selectedOption, value]);

    useEffect(() => {
        const requestId = ++requestIdRef.current;
        const normalizedFilter = filter.trim();
        if (normalizedFilter.length < minSearch) {
            return () => { requestIdRef.current += 1; };
        }

        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const { data } = await connect.get("/funcionarios", {
                    params: { ...queryParams, search: normalizedFilter, limit },
                });
                if (requestId !== requestIdRef.current) return;

                // O objeto completo acompanha a opção para consumidores que precisam de nome/matrícula.
                const remoteOptions = data.map((item) => ({
                    ...item,
                    label: item.matricula ? `${item.matricula} - ${item.nome}` : item.nome,
                }));
                const selected = selectedOptionRef.current;
                setOptions(selected && selected.id && !remoteOptions.some((item) => item.id === selected.id)
                    ? [selected, ...remoteOptions]
                    : remoteOptions);
            } catch (error) {
                if (requestId !== requestIdRef.current) return;
                setOptions(selectedOptionRef.current ? [selectedOptionRef.current] : []);
                onError?.(error);
            } finally {
                if (requestId === requestIdRef.current) setLoading(false);
            }
        }, filter ? debounce : 0);

        return () => {
            window.clearTimeout(timer);
            requestIdRef.current += 1;
        };
        // serializedParams representa as propriedades individuais de queryParams.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounce, filter, limit, minSearch, serializedParams]);

    function handleChange(event) {
        // O primeiro argumento mantém compatibilidade com formulários que armazenam somente o ID.
        selectedOptionRef.current = event.value == null
            ? null
            : options.find((item) => item.id === event.value) || null;
        onChange?.(event.value, selectedOptionRef.current);
    }

    function handleFilter(event) {
        const nextFilter = event.filter || "";
        setFilter(nextFilter);
        if (nextFilter.trim().length < minSearch) {
            requestIdRef.current += 1;
            setLoading(false);
            setOptions(selectedOptionRef.current ? [selectedOptionRef.current] : []);
        }
    }

    return (
        <Dropdown
            value={value}
            options={options}
            optionLabel="label"
            optionValue="id"
            onChange={handleChange}
            onFilter={handleFilter}
            filter
            resetFilterOnHide
            loading={loading}
            virtualScrollerOptions={{ itemSize: 62 }} // Duas linhas por opção sem renderizar a lista inteira.
            itemTemplate={(option) => <CollaboratorOption collaborator={option} />}
            valueTemplate={(option, props) => option
                ? <CollaboratorOption collaborator={option} selected />
                : <span className="p-placeholder">{props.placeholder}</span>}
            className={`${className} collaborator-dropdown`.trim()}
            placeholder={placeholder}
            emptyMessage={filter.trim().length < minSearch ? `Digite pelo menos ${minSearch} caracteres para buscar` : emptyMessage}
            emptyFilterMessage={filter.trim().length < minSearch ? `Digite pelo menos ${minSearch} caracteres para buscar` : emptyMessage}
            showClear={showClear}
            disabled={disabled}
            appendTo={appendTo}
            panelStyle={panelStyle}
        />
    );
}
