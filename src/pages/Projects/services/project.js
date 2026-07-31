import connect from "../../../utils/request";

export async function getProjects() {
    const { data } = await connect.get("/projetos");
    return data;
}

export async function getProject(id) {
    const { data } = await connect.get(`/projetos?id=${id}`);
    return data;
}

export async function createProject(body) {
    const { data } = await connect.post("/projetos", body);
    return data;
}

export async function renameProject(id, nome) {
    const { data } = await connect.patch(`/projetos?id=${id}`, {
        nome
    });
    return data;
}

export async function updateProject(id, body) {
    const { data } = await connect.patch(`/projetos?id=${id}`, body);
    return data;
}

export async function deleteProject(id) {
    const { data } = await connect.delete("/projetos", {
        params: { id }
    });
    return data;
}

export async function getUsers(){
    const { data }  = await connect.get("/usuarios", { params: { include_photo: 1 } })
    const colors = ["#7c5cff", "#22a3a3", "#e0763a", "#c14b6b", "#3d78c9", "#2f9e44"];

    return data.map((user, index) => {
        const parts = (user.nome || "").split(" ");
        return {
            ...user,
            iniciais: parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U",
            avatarColor: colors[index % colors.length],
        };
    });
}
