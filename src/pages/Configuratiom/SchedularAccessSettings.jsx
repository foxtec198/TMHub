import { useCallback, useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Password } from "primereact/password";
import { Tag } from "primereact/tag";
import connect from "../../utils/request";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";

export function SchedularAccessSettings() {
  const [accesses, setAccesses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const [password, setPassword] = useState("");
  const setLoading = useLoading();
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const [{ data: accessData }, { data: employeeData }] = await Promise.all([
        connect.get("/schedular/acessos"),
        connect.get("/funcionarios", { params: { situacao: 1, limit: 50000 } }),
      ]);
      setAccesses(accessData || []);
      setEmployees(
        (employeeData || []).map((employee) => ({
          ...employee,
          label: `${employee.matricula} - ${employee.nome}`,
        })),
      );
    } catch (error) {
      showToast(
        "error",
        "Schedular",
        error.response?.data || "Não foi possível carregar os acessos.",
      );
    }
  }, [showToast]);

  // A carga inicial sincroniza a tela com os dados administrativos da API.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const save = async () => {
    if (!employeeId || !password) {
      showToast(
        "warn",
        "Schedular",
        "Selecione o colaborador e informe uma senha forte.",
      );
      return;
    }
    setLoading(true);
    try {
      await connect.post("/schedular/acessos", {
        colaborador_id: employeeId,
        senha: password,
      });
      setEmployeeId(null);
      setPassword("");
      await load();
      showToast(
        "success",
        "Schedular",
        "Acesso criado/atualizado com sucesso.",
      );
    } catch (error) {
      showToast(
        "error",
        "Schedular",
        error.response?.data || "Não foi possível salvar o acesso.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-grid">
      <article className="settings-card">
        <div className="settings-card-title">
          <i className="pi pi-key" />
          <div>
            <h2>Acessos do Schedular</h2>
            <p>Credenciais independentes do login do TMHub.</p>
          </div>
        </div>
        <div className="password-fields">
          <Dropdown
            value={employeeId}
            options={employees}
            optionLabel="label"
            optionValue="id"
            filter
            filterBy="label"
            showClear
            placeholder="Colaborador ativo"
            onChange={(event) => setEmployeeId(event.value)}
          />
          <Password
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            feedback
            toggleMask
            placeholder="Senha forte"
          />
        </div>
        <Button
          label="Criar ou redefinir acesso"
          icon="pi pi-save"
          onClick={save}
        />
      </article>
      <article className="settings-card">
        <div className="settings-card-title">
          <i className="pi pi-list" />
          <div>
            <h2>Acessos cadastrados</h2>
            <p>{accesses.length} colaborador(es) com acesso.</p>
          </div>
        </div>
        <div className="schedular-access-list">
          {accesses.map((access) => (
            <div key={access.id}>
              <span>
                <strong>{access.colaborador}</strong>
                <small>Matrícula {access.matricula}</small>
              </span>
              <Tag
                value={access.ativo ? "ATIVO" : "INATIVO"}
                severity={access.ativo ? "success" : "danger"}
              />
            </div>
          ))}
          {!accesses.length && <small>Nenhum acesso criado.</small>}
        </div>
      </article>
    </div>
  );
}
