// Utilitários
import connect from "../utils/request";

// Envia a busca apenas com ao menos três caracteres.
export async function getEmployees(search = "") {
    const params = {};

    if (search.length >= 3)
        params.search = search;

    const { data } = await connect.get("/usuarios", {
        params
    });

    return data;
}