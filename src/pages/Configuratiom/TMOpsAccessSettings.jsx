import { AppIcon } from "../../components/icons/AppIcon";
import { useCallback, useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Password } from "primereact/password";
import { Tag } from "primereact/tag";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import connect from "../../utils/request";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";

export function TMOpsAccessSettings() {
  const [accesses, setAccesses] = useState([]);
  const [accessTotal, setAccessTotal] = useState(0);
  const [accessPage, setAccessPage] = useState(1);
  const [accessPages, setAccessPages] = useState(0);
  const [employeeId, setEmployeeId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const setLoading = useLoading();
  const { showToast } = useToast();

  const load = useCallback(async (requestedPage = 1) => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const { data } = await connect.get("/tm-ops/acessos", {
        params: { page: requestedPage, per_page: 25 },
      });
      setAccesses(Array.isArray(data?.items) ? data.items : []);
      setAccessTotal(Number(data?.total) || 0);
      setAccessPage(Number(data?.page) || 1);
      setAccessPages(Number(data?.pages) || 0);
      setStatus("ready");
    } catch (error) {
      const forbidden = error.response?.status === 403;
      setErrorMessage(
        forbidden
          ? "Você não possui permissão para consultar os acessos do TM Ops."
          : error.response?.data || "Não foi possível carregar os acessos.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const save = async () => {
    if (!employeeId || !password) {
      showToast("warn", "TM Ops", "Selecione o colaborador e informe uma senha forte.");
      return;
    }
    setLoading(true);
    try {
      await connect.post("/tm-ops/acessos", {
        colaborador_id: employeeId,
        senha: password,
      });
      setEmployeeId(null);
      setSelectedEmployee(null);
      setPassword("");
      await load(1);
      showToast("success", "TM Ops", "Acesso criado ou atualizado com sucesso.");
    } catch (error) {
      showToast("error", "TM Ops", error.response?.data || "Não foi possível salvar o acesso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-grid">
      <article className="settings-card">
        <div className="settings-card-title">
          <AppIcon name="key"  />
          <div>
            <h2>Acessos do TM Ops</h2>
            <p>Credencial exclusiva, vinculada diretamente ao colaborador.</p>
          </div>
        </div>
        <div className="password-fields tm-ops-access-fields p-fluid">
          <CollaboratorDropdown
            value={employeeId}
            selectedOption={selectedEmployee}
            placeholder="Selecione um colaborador"
            emptyMessage="Nenhum colaborador encontrado"
            className="w-full"
            onChange={(id, option) => {
              setEmployeeId(id);
              setSelectedEmployee(option);
            }}
            onError={(error) => showToast(
              "error",
              "Colaboradores",
              error.response?.data || "Não foi possível carregar os colaboradores.",
            )}
          />

          <Password
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            feedback
            toggleMask
            placeholder="Senha forte"
            className="tm-ops-password"
          />
        </div>
        <Button label="Criar ou redefinir acesso" icon={<AppIcon name="device-floppy" />} className="mt-5" onClick={save} />
      </article>

      <article className="settings-card">
        <div className="settings-card-title">
          <AppIcon name="list"  />
          <div>
            <h2>Acessos cadastrados</h2>
            <p>{status === "ready" ? `${accessTotal} colaborador(es) com acesso.` : "Consulta paginada"}</p>
          </div>
        </div>
        {status === "loading" && <div className="settings-feedback"><AppIcon name="loader-2"  /> Carregando acessos...</div>}
        {status === "error" && <div className="settings-feedback is-error"><AppIcon name="alert-triangle"  /><span>{errorMessage}</span><Button label="Tentar novamente" text onClick={load} /></div>}
        {status === "ready" && (
          <div className="tm-ops-access-list">
            {accesses.map((access) => (
              <div key={access.colaborador_id}>
                <span>
                  <strong>{access.colaborador}</strong>
                  <small>Matrícula {access.matricula}</small>
                </span>
                <Tag value={access.ativo ? "ATIVO" : "INATIVO"} severity={access.ativo ? "success" : "danger"} />
              </div>
            ))}
            {!accesses.length && <div className="settings-feedback">Nenhum acesso do TM Ops foi cadastrado.</div>}
            {accessPages > 1 && <div className="settings-pagination">
              <Button label="Anterior" icon={<AppIcon name="chevron-left" />} text disabled={accessPage <= 1} onClick={() => load(accessPage - 1)} />
              <span>Página {accessPage} de {accessPages}</span>
              <Button label="Próxima" icon={<AppIcon name="chevron-right" />} iconPos="right" text disabled={accessPage >= accessPages} onClick={() => load(accessPage + 1)} />
            </div>}
          </div>
        )}
      </article>
    </div>
  );
}
