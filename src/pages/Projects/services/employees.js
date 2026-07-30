import connect from "../utils/request";

export async function getEmployees(search = "") {
    const params = {};

    if (search.length >= 3)
        params.search = search;

    const { data } = await connect.get("/usuarios", {
        params
    });

    return data;
}