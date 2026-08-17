// Utilitários
import connect from "../../../utils/request";

// Encapsula as operações de persistência dos cards e comentários.
export async function updateCard(id, body) {
    // Atualiza os dados de um card existente no projeto.
    const { data } = await connect.patch(`/projetos/cards/${id}`, body);
    return data;
}

export async function createCard(projectId, body) {
    // Cria um card já vinculado ao projeto informado.
    const { data } = await connect.post(
        `/projetos/${projectId}/cards`,
        body
    );

    return data;
}

export async function deleteCard(id) {
    // Remove o card e deixa a API reconciliar seus vínculos.
    const { data } = await connect.delete(`/projetos/cards/${id}`);
    return data;
}

export async function createCardComment(cardId, conteudo) {
    // Adiciona uma mensagem ao histórico do card.
    const { data } = await connect.post(`/projetos/cards/${cardId}/comentarios`, { conteudo });
    return data;
}

export async function updateCardComment(commentId, conteudo) {
    const { data } = await connect.patch(`/projetos/comentarios/${commentId}`, { conteudo });
    return data;
}

export async function deleteCardComment(commentId) {
    const { data } = await connect.delete(`/projetos/comentarios/${commentId}`);
    return data;
}

export async function uploadCardFile(cardId, file) {
    const form = new FormData();
    form.append("arquivo", file);
    const { data } = await connect.post(`/projetos/cards/${cardId}/arquivos`, form);
    return data;
}

export async function deleteCardFile(cardId, fileId) {
    const { data } = await connect.delete(`/projetos/cards/${cardId}/arquivos/${fileId}`);
    return data;
}
