import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { PageHeader } from "../../components/PageHeader";
import connect from "../../utils/request";
import "./management.css";

export function TMOpsTasks() {
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const load = useCallback(async () => {
    const { data } = await connect.get("/tm-ops/tarefas");
    setTasks(data || []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  const filtered = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (!status || task.status === status) &&
          `${task.tarefa} ${task.local} ${task.colaborador}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [tasks, query, status],
  );
  const count = (predicate) => tasks.filter(predicate).length;
  const formatAnswer = (value) => {
    if (value === true) return "Sim";
    if (value === false) return "Não";
    if (value === null || value === undefined || value === "")
      return "Não respondida";
    if (typeof value === "object")
      return Object.keys(value).length ? JSON.stringify(value) : "Sem texto";
    return String(value);
  };
  return (
    <main className="tm-ops-management">
      <PageHeader
        section="TM Ops"
        title="Tarefas"
        description="Acompanhe as tarefas geradas pelas rotinas e suas execuções."
        actions={<Button icon="pi pi-refresh" outlined onClick={load} />}
      />
      <section className="tm-ops-task-cards">
        <div>
          <b>{tasks.length}</b>
          <span>Total</span>
        </div>
        <div>
          <b>{count((t) => t.status === "aberta")}</b>
          <span>Abertas</span>
        </div>
        <div>
          <b>{count((t) => t.atrasada)}</b>
          <span>Atrasadas</span>
        </div>
        <div>
          <b>{count((t) => t.status === "pausada")}</b>
          <span>Pausadas</span>
        </div>
        <div>
          <b>{count((t) => t.status === "concluida")}</b>
          <span>Finalizadas</span>
        </div>
      </section>
      <section className="tm-ops-content-card">
        <div className="tm-ops-toolbar">
          <InputText
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tarefa, local ou colaborador"
          />
          <Dropdown
            value={status}
            showClear
            placeholder="Status"
            options={[
              "aberta",
              "em_andamento",
              "pausada",
              "concluida",
              "cancelada",
            ].map((value) => ({ label: value.replace("_", " "), value }))}
            onChange={(e) => setStatus(e.value)}
          />
        </div>
        <DataTable
          value={filtered}
          paginator
          rows={10}
          responsiveLayout="scroll"
          emptyMessage="Nenhuma tarefa encontrada."
        >
          <Column field="tarefa" header="Tarefa" />
          <Column field="local" header="Estrutura" />
          <Column field="colaborador" header="Colaborador" />
          <Column
            header="Início"
            body={(row) => new Date(row.agendada_para).toLocaleString("pt-BR")}
          />
          <Column
            header="Prazo previsto"
            body={(row) =>
              row.prazo_em
                ? new Date(row.prazo_em).toLocaleString("pt-BR")
                : "—"
            }
          />
          <Column
            header="Status"
            body={(row) => (
              <Tag
                value={
                  row.atrasada
                    ? "ATRASADA"
                    : row.status.replace("_", " ").toUpperCase()
                }
                severity={row.atrasada ? "danger" : "info"}
              />
            )}
          />
          <Column
            header="Início"
            body={(row) =>
              row.iniciada_em
                ? new Date(row.iniciada_em).toLocaleString("pt-BR")
                : "—"
            }
          />
          <Column
            header="Conclusão"
            body={(row) =>
              row.concluida_em
                ? new Date(row.concluida_em).toLocaleString("pt-BR")
                : "—"
            }
          />
          <Column
            header="Respostas"
            body={(row) => (
              <Button
                icon="pi pi-eye"
                text
                rounded
                tooltip="Ver checklist respondido"
                disabled={row.status !== "concluida"}
                onClick={() => setSelectedTask(row)}
              />
            )}
          />
        </DataTable>
      </section>
      <Dialog
        header={
          selectedTask ? `Checklist · ${selectedTask.tarefa}` : "Checklist"
        }
        visible={Boolean(selectedTask)}
        onHide={() => setSelectedTask(null)}
        className="tm-ops-task-history-dialog"
        modal
      >
        {selectedTask && (
          <div className="tm-ops-response-timeline">
            <div className="tm-ops-response-summary">
              <strong>{selectedTask.local || "Estrutura não informada"}</strong>
              <span>
                Concluída em{" "}
                {selectedTask.concluida_em
                  ? new Date(selectedTask.concluida_em).toLocaleString("pt-BR")
                  : "—"}
              </span>
            </div>
            {(selectedTask.itens || []).map((item, index) => {
              const response = item.resposta;
              return (
                <article className="tm-ops-response-event" key={item.id}>
                  <span className="tm-ops-response-marker">{index + 1}</span>
                  <div>
                    <strong>{item.pergunta}</strong>
                    <p>{formatAnswer(response?.valor)}</p>
                    {response?.respondido_em && (
                      <small>
                        Respondida por {response.respondido_por || "Executor"}{" "}
                        em{" "}
                        {new Date(response.respondido_em).toLocaleString(
                          "pt-BR",
                        )}
                      </small>
                    )}
                    {!!response?.evidencias?.length && (
                      <div className="tm-ops-response-evidences">
                        {response.evidencias.map((evidence) => (
                          <span key={evidence.id}>
                            <i
                              className={
                                evidence.tipo === "qrcode"
                                  ? "pi pi-qrcode"
                                  : evidence.tipo === "barcode"
                                    ? "pi pi-barcode"
                                    : evidence.tipo === "signature"
                                      ? "pi pi-pencil"
                                      : "pi pi-image"
                              }
                            />
                            {evidence.url ? (
                              <a
                                href={`${import.meta.env.VITE_SERVER || ""}${evidence.url}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Abrir {evidence.tipo}
                              </a>
                            ) : (
                              <b>
                                {evidence.tipo}: {evidence.valor}
                              </b>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Dialog>
    </main>
  );
}
