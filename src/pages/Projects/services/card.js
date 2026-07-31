import connect from "../../../utils/request";

export async function updateCard(id, body) {
    const { data } = await connect.patch(`/projetos/cards/${id}`, body);
    return data;
}

export async function createCard(projectId, body) {
    const { data } = await connect.post(
        `/projetos/${projectId}/cards`,
        body
    );

    return data;
}

export async function deleteCard(id) {
    const { data } = await connect.delete(`/projetos/cards/${id}`);
    return data;
}
