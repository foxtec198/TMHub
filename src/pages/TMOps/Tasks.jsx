import { AppIcon } from "../../components/icons/AppIcon";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import { TaskExecutionMetrics } from "../../components/TMOps/TaskExecutionMetrics";
import { TaskGeolocationMap } from "../../components/TMOps/TaskGeolocationMap";
import connect from "../../utils/request";
import "./management.css";

export function TMOpsTasks() {
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(null);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const loadSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await connect.get("/tm-ops/tarefas", {
        params: {
          page: Math.floor(first / rows) + 1,
          limit: rows,
          q: query.trim() || undefined,
          status: status || undefined,
        },
      });
      if (sequence !== loadSequence.current) return;
      setTasks(data?.items || []);
      setTotalRecords(Number(data?.total) || 0);
      setStats(data?.stats || {});
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      setTasks([]);
      setTotalRecords(0);
      setLoadError(
        typeof error.response?.data === "string"
          ? error.response.data
          : "Não foi possível carregar as tarefas.",
      );
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [first, query, rows, status]);
  useEffect(() => {
    const timer = setTimeout(load, 350);
    return () => clearTimeout(timer);
  }, [load]);
  const openTaskDetail = async (task) => {
    setSelectedTask(task);
    setDetailLoading(true);
    setDetailError("");
    try {
      const { data } = await connect.get(`/tm-ops/tarefas/${task.id}`);
      setSelectedTask(data);
    } catch (error) {
      setDetailError(
        typeof error.response?.data === "string"
          ? error.response.data
          : "Não foi possível carregar os detalhes da tarefa.",
      );
    } finally {
      setDetailLoading(false);
    }
  };
  const closeTaskDetail = () => {
    setSelectedTask(null);
    setDetailLoading(false);
    setDetailError("");
  };
  const formatAnswer = (value) => {
    if (value === true) return "Sim";
    if (value === false) return "Não";
    if (value === null || value === undefined || value === "")
      return "Não respondida";
    if (typeof value === "object")
      return Object.keys(value).length ? JSON.stringify(value) : "Sem texto";
    return String(value);
  };
  const columns = [
    { field: "tarefa", header: "Tarefa" },
    { field: "local", header: "Estrutura" },
    { field: "colaborador", header: "Colaborador" },
    { header: "Agendada para", body: (row) => new Date(row.agendada_para).toLocaleString("pt-BR") },
    { header: "Prazo previsto", body: (row) => row.prazo_em ? new Date(row.prazo_em).toLocaleString("pt-BR") : "—" },
    {
      header: "Status",
      body: (row) => (
        <Tag
          value={row.atrasada ? "ATRASADA" : row.status.replace("_", " ").toUpperCase()}
          severity={row.atrasada ? "danger" : "info"}
        />
      ),
    },
    { header: "Iniciada em", body: (row) => row.iniciada_em ? new Date(row.iniciada_em).toLocaleString("pt-BR") : "—" },
    { header: "Conclusão", body: (row) => row.concluida_em ? new Date(row.concluida_em).toLocaleString("pt-BR") : "—" },
    {
      header: "Respostas",
      body: (row) => (
        <Button
          icon={<AppIcon name="eye" />}
          text
          rounded
          tooltip="Ver checklist respondido"
          disabled={row.status !== "concluida"}
          onClick={() => openTaskDetail(row)}
        />
      ),
    },
  ];
  return (
    <main className="tm-ops-management">
      <PageHeader
        section="TM Ops"
        title="Tarefas"
        description="Acompanhe as tarefas geradas pelas rotinas e suas execuções."
      />
      <section className="tm-ops-task-cards">
        <div>
          <AppIcon name="list-check" />
          <b>{stats.total || 0}</b>
          <span>Total</span>
        </div>
        <div>
          <AppIcon name="folder-open" />
          <b>{stats.abertas || 0}</b>
          <span>Abertas</span>
        </div>
        <div>
          <AppIcon name="alert-triangle" />
          <b>{stats.atrasadas || 0}</b>
          <span>Atrasadas</span>
        </div>
        <div>
          <AppIcon name="pause" />
          <b>{stats.pausadas || 0}</b>
          <span>Pausadas</span>
        </div>
        <div>
          <AppIcon name="circle-check" />
          <b>{stats.concluidas || 0}</b>
          <span>Finalizadas</span>
        </div>
      </section>
      <section className="tm-ops-content-card">
        <div className="tm-ops-toolbar">
          <InputText
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFirst(0);
            }}
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
            onChange={(e) => {
              setStatus(e.value);
              setFirst(0);
            }}
          />
        </div>
        <Table
          data={tasks}
          columns={columns}
          loading={loading}
          rows={rows}
          rowsPerPageOptions={[10, 20, 50]}
          remotePagination={{
            totalRecords,
            first,
            onPageChange: (event) => {
              setFirst(event.first);
              setRows(event.rows);
            },
          }}
          emptyTitle={loadError || "Nenhuma tarefa encontrada."}
          tableStyle={{ minWidth: "1040px" }}
        />
      </section>
      <Dialog
        header={
          selectedTask ? `Checklist · ${selectedTask.tarefa}` : "Checklist"
        }
        visible={Boolean(selectedTask)}
        onHide={closeTaskDetail}
        className="tm-ops-task-history-dialog"
        modal
      >
        {detailLoading && (
          <div className="tm-ops-task-detail-state">
            <AppIcon name="loader-2"  />
            <span>Carregando checklist, percurso e indicadores...</span>
          </div>
        )}
        {!detailLoading && detailError && (
          <div className="tm-ops-task-detail-state is-error">
            <AppIcon name="alert-triangle"  />
            <span>{detailError}</span>
            <Button label="Tentar novamente" onClick={() => openTaskDetail(selectedTask)} />
          </div>
        )}
        {!detailLoading && !detailError && selectedTask && (
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
            <TaskExecutionMetrics task={selectedTask} />
            <TaskGeolocationMap
              geolocations={selectedTask.geolocalizacoes || []}
            />
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
                            <AppIcon
                              name={
                                evidence.tipo === "qrcode"
                                  ? "qrcode"
                                  : evidence.tipo === "barcode"
                                    ? "barcode"
                                    : evidence.tipo === "signature"
                                      ? "pencil"
                                      : "photo"
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
