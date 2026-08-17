// React
import { useMemo, useState } from "react";
// PrimeReact
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
// Estilos
import './main.css'

// Filtra colaboradores ainda disponíveis para a seleção.
export function FloatPicker({
    colaboradores = [],
    selecionados = [],
    onAdd,
    onRemove
}) {

    const [search, setSearch] = useState("");

    const disponiveis = useMemo(() => {
        return colaboradores
            .filter(c =>
                !selecionados.some(s => s.id === c.id)
            )
            .filter(c =>
                c.nome.toLowerCase().includes(search.toLowerCase())
            );
    }, [colaboradores, selecionados, search]);

    return (
        <div className="reservation-picker">

            <div className="picker-left">

                <InputText
                    className="w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar colaborador..."
                />

                <div className="picker-list">

                    {disponiveis.map(colaborador => (

                        <div
                            key={colaborador.id}
                            className="picker-item"
                            onClick={() => {
                                onAdd(colaborador);
                                setSearch("");
                            }}
                        >
                            <div>

                                <div className="picker-name">
                                    {colaborador.nome}
                                </div>

                                <small>
                                    {colaborador.cargo}
                                </small>

                            </div>

                            <Button
                                icon="pi pi-plus"
                                rounded
                                text
                            />

                        </div>

                    ))}

                </div>

            </div>

            <div className="picker-right">

                <h4>Reservas Selecionadas</h4>

                <div className="picker-list">

                    {selecionados.length === 0 &&
                        <small>Nenhuma reserva definida.</small>
                    }

                    {selecionados.map(colaborador => (

                        <div
                            key={colaborador.id}
                            className="picker-item"
                        >

                            <div>

                                <div className="picker-name">
                                    {colaborador.nome}
                                </div>

                                <small>
                                    {colaborador.cargo}
                                </small>

                            </div>

                            <Button
                                icon="pi pi-trash"
                                severity="danger"
                                rounded
                                text
                                onClick={() => onRemove(colaborador)}
                            />

                        </div>

                    ))}

                </div>

            </div>

        </div>
    );
}