// React
import { useEffect, useRef, useState } from "react";
// PrimeReact
import { Dropdown } from "primereact/dropdown";
// Utilitários
import connect from "../utils/request";

// Busca opções remotamente e controla o valor selecionado.
export function DropdownWS({
    uri,
    uriParams = {},
    optionsValuesForDict = { nome: "nome"},
    className = "",
    placeholder = "Selecione",
    optionValue = "id",
    optionLabel = "nome",
    limit = 50,
    fetchAll = false,
    minSearch = 2,
    debounce = 400,
    staticOptions = [],
    value,
    onChange
}) {
    const [internalValue, setInternalValue] = useState(null);
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    const timeoutRef = useRef(null);

    const selectedValue = value !== undefined ? value : internalValue;

    async function buscarOptions(search = "") {
        try {
            if (search && search.length < minSearch) {
                setOptions([]);
                return;
            }

            setLoading(true);

            const params = new URLSearchParams();

            if (!fetchAll) {
                params.append("limit", limit);
            }

            if (search) {
                params.append("search", search);
            }

            Object.entries(uriParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    params.append(key, value);
                }
            });

            const response = await connect.get(`${uri}?${params.toString()}`);

            const remoteOptions = response.data.map(item => ({
                nome: item[optionsValuesForDict.nome],
                id: item.id
            }));

            const staticIds = new Set(staticOptions.map((item) => item.id));
            setOptions([
                ...staticOptions,
                ...remoteOptions.filter((item) => !staticIds.has(item.id)),
            ]);
        } catch (error) {
            console.error(error);
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }

    // Busca opções conforme o texto, limite e parâmetros externos da consulta.
    useEffect(() => {
        buscarOptions();

        return () => {
            clearTimeout(timeoutRef.current);
        };
    }, [uri, JSON.stringify(uriParams)]);

    function handleFilter(e) {
    // Atualiza o termo local para acionar o debounce da busca remota.
        const search = e.filter?.trim() || "";

        clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            buscarOptions(search);
        }, debounce);
    }

    function handleChange(e) {
    // Mantém o valor interno somente quando o componente não é controlado.
        if (onChange) { onChange(e.value); }
        else { setInternalValue(e.value); }
    }

    return (
        <Dropdown
            value={selectedValue}
            onChange={handleChange}
            options={options}
            optionLabel={optionLabel}
            optionValue={optionValue}
            onFilter={handleFilter}
            className={className}
            placeholder={placeholder}
            loading={loading}
            showClear
            filter
        />
    );
}
