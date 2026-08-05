import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import tmOpsRequest from "../../utils/tmOpsRequest";
import { useToast } from "../../contexts/ToastContext";
import { TaskQrScanner } from "./TaskQrScanner";
import { TaskEvidenceCapture } from "./TaskEvidenceCapture";
import { TaskExecutionMetrics } from "../../components/TMOps/TaskExecutionMetrics";
import "./styles.css";

const elapsed = (start, now) => {
  if (!start) return "00:00:00";
  const seconds = Math.max(
    0,
    Math.floor(((now || Date.now()) - new Date(start).getTime()) / 1000),
  );
  return [seconds / 3600, (seconds % 3600) / 60, seconds % 60]
    .map((value) => String(Math.floor(value)).padStart(2, "0"))
    .join(":");
};

const formatEstimate = (minutes) => {
  const total = Math.max(1, Number(minutes) || 15);
  const hours = Math.floor(total / 60);
  const remaining = total % 60;
  return hours
    ? `${hours}h${remaining ? ` ${remaining}min` : ""}`
    : `${remaining}min`;
};

const formatRemainingTime = (milliseconds) => {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h${minutes ? ` ${minutes}min` : ""}`;
  return `${Math.max(1, minutes)}min`;
};

const taskDeadlineStatus = (task, now) => {
  const estimate = Math.max(1, Number(task.estimativa_minutos) || 15);
  const deadline = task.prazo_em
    ? new Date(task.prazo_em).getTime()
    : new Date(task.agendada_para).getTime() + estimate * 60 * 1000;
  const difference = deadline - (now || Date.now());
  const late = difference < 0;
  return {
    late,
    value: formatRemainingTime(Math.abs(difference)),
    label: late ? "em atraso" : "para atrasar",
  };
};

const GEO_MIN_INTERVAL_MS = 60_000;
const GEO_MIN_DISTANCE_METERS = 20;

const geolocationPayload = (position) => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
});

const distanceInMeters = (first, second) => {
  const earthRadius = 6_371_000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const latitude1 = toRadians(first.latitude);
  const latitude2 = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const captureCurrentGeolocation = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(geolocationPayload(position)),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 8_000,
      },
    );
  });

export function TMOps() {
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId } = useParams();
  const { showToast } = useToast();
  const [matricula, setMatricula] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [clock, setClock] = useState(0);
  const [taskSearch, setTaskSearch] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const lastExecutionLocation = useRef(null);
  const load = async () => {
    const { data } = await tmOpsRequest.get("/tm-ops/tarefas/minhas");
    setTasks(data || []);
    return data || [];
  };
  const screen = taskId
    ? location.pathname.endsWith("/executar")
      ? "checklist"
      : "details"
    : "list";

  useEffect(() => {
    document.body.classList.add("tm-ops-executor-active");
    const manifest = document.querySelector("#app-manifest");
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const previousManifest = manifest?.getAttribute("href");
    const previousThemeColor = themeColor?.getAttribute("content");
    const previousTitle = document.title;

    manifest?.setAttribute("href", "/manifest-tm-ops.webmanifest");
    themeColor?.setAttribute("content", "#087842");
    document.title = "TM Ops";

    return () => {
      document.body.classList.remove("tm-ops-executor-active");
      if (previousManifest) manifest?.setAttribute("href", previousManifest);
      if (previousThemeColor) themeColor?.setAttribute("content", previousThemeColor);
      document.title = previousTitle;
    };
  }, []);
  useEffect(() => {
    if (sessionStorage.getItem("tm_ops_token"))
      tmOpsRequest
        .get("/tm-ops/sessao")
        .then(({ data }) => setSession(data))
        .catch(() => sessionStorage.removeItem("tm_ops_token"));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session) load().catch(() => setTasks([]));
  }, [session]);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);
  const active = useMemo(
    () =>
      tasks.find(
        (task) => Number(task.id) === Number(taskId || selected?.id),
      ) || selected,
    [taskId, tasks, selected],
  );
  useEffect(() => {
    if (!session || !active?.id || active.status !== "em_andamento") {
      return undefined;
    }
    if (!navigator.geolocation) return undefined;

    let disposed = false;
    lastExecutionLocation.current = null;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = geolocationPayload(position);
        const now = Date.now();
        const previous = lastExecutionLocation.current;
        const isNewTask = previous?.taskId !== active.id;
        const movedEnough =
          previous && distanceInMeters(previous.location, location) >= GEO_MIN_DISTANCE_METERS;
        const intervalElapsed =
          previous && now - previous.sentAt >= GEO_MIN_INTERVAL_MS;
        if (!isNewTask && !movedEnough && !intervalElapsed) return;

        lastExecutionLocation.current = {
          taskId: active.id,
          location,
          sentAt: now,
        };
        tmOpsRequest
          .post(`/tm-ops/tarefas/${active.id}/geolocalizacoes`, {
            geolocalizacao: location,
          })
          .then(({ data }) => {
            if (disposed || !data?.metricas) return;
            setSelected((current) =>
              current?.id === active.id
                ? { ...current, ...data.metricas }
                : current,
            );
            setTasks((rows) =>
              rows.map((row) =>
                row.id === active.id ? { ...row, ...data.metricas } : row,
              ),
            );
          })
          .catch(() => {
            if (!disposed) lastExecutionLocation.current = previous || null;
          });
      },
      () => {
        // GPS can be unavailable indoors. The task remains executable and the
        // next position update will be attempted by the browser.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 20_000,
      },
    );
    return () => {
      disposed = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [active?.id, active?.status, session]);
  const openTask = useCallback(
    (task, destination = "details") => {
      setSelected(task);
      navigate(
        `/tm-ops/tarefa/${task.id}${
          destination === "checklist" ? "/executar" : ""
        }`,
      );
    },
    [navigate],
  );
  const visibleTasks = useMemo(() => {
    const query = taskSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return tasks;
    return tasks.filter((task) =>
      `${task.id} ${task.tarefa} ${task.local} ${task.rotina}`
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [taskSearch, tasks]);
  const openTaskFromQr = useCallback(
    (taskId) => {
      const task = tasks.find((item) => Number(item.id) === Number(taskId));
      if (!task) {
        showToast(
          "warn",
          "QR Code",
          "A tarefa não está aberta ou não pertence a este executor.",
        );
        return;
      }
      setScannerVisible(false);
      openTask(task);
    },
    [openTask, showToast, tasks],
  );
  const login = async (event) => {
    event.preventDefault();
    try {
      const { data } = await tmOpsRequest.post("/tm-ops/login", {
        matricula,
        password,
      });
      sessionStorage.setItem("tm_ops_token", data.access_token);
      setSession(data);
    } catch (error) {
      showToast(
        "error",
        "Login",
        error.response?.data || "Não foi possível entrar.",
      );
    }
  };
  const action = async (acao) => {
    try {
      const geolocalizacao = ["iniciar", "finalizar"].includes(acao)
        ? await captureCurrentGeolocation()
        : null;
      const { data } = await tmOpsRequest.post(
        `/tm-ops/tarefas/${active.id}/acao`,
        { acao, geolocalizacao },
      );
      setSelected(data.tarefa);
      setTasks((rows) =>
        rows
          .map((row) => (row.id === active.id ? data.tarefa : row))
          .filter((row) => row.status !== "concluida"),
      );
      if (acao === "iniciar" || acao === "continuar") {
        navigate(`/tm-ops/tarefa/${active.id}/executar`);
      }
      if (acao === "finalizar") {
        setSelected(null);
        navigate("/tm-ops");
      }
    } catch (error) {
      showToast(
        "error",
        "Tarefa",
        error.response?.data || "Não foi possível atualizar.",
      );
    }
  };
  const answer = async (item, valor) => {
    try {
      const { data } = await tmOpsRequest.post(
        `/tm-ops/tarefas/${active.id}/respostas`,
        { respostas: [{ checklist_item_id: item.id, valor }] },
      );
      setSelected(data.tarefa);
      setTasks((rows) =>
        rows.map((row) => (row.id === active.id ? data.tarefa : row)),
      );
    } catch (error) {
      showToast(
        "error",
        "Checklist",
        error.response?.data || "Não foi possível salvar a resposta.",
      );
    }
  };
  if (!session)
    return (
      <main className="tm-ops-shell">
        <section className="tm-ops-panel">
          <img src="/brands/main_brand.svg" alt="TM Hub" />
          <h1>Entrar no TM Ops</h1>
          <form onSubmit={login} className="tm-ops-form">
            <label>
              Matrícula
              <InputText
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <Password
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                feedback={false}
                required
              />
            </label>
            <Button label="Entrar" />
          </form>
        </section>
      </main>
    );
  const header = (
    <header className="executor-top" data-clock={clock}>
      <div className="executor-top-row">
        {screen !== "list" ? (
          <Button
            className="executor-back"
            icon="pi pi-arrow-left"
            aria-label={
              screen === "checklist"
                ? "Voltar aos detalhes"
                : "Voltar às tarefas"
            }
            rounded
            text
            onClick={() =>
              navigate(
                screen === "checklist"
                  ? `/tm-ops/tarefa/${active?.id}`
                  : "/tm-ops",
              )
            }
          />
        ) : (
          <span className="executor-top-spacer" aria-hidden="true" />
        )}
        <img src="/brands/main_brand.svg" alt="TM Ops" />
        <Button
          className="executor-account"
          icon="pi pi-sign-out"
          aria-label="Sair do Executor"
          rounded
          text
          onClick={() => {
            sessionStorage.removeItem("tm_ops_token");
            setSession(null);
            navigate("/tm-ops/login");
          }}
        />
      </div>
      {screen !== "list" && (
        <div className="executor-breadcrumb">
          <span>Tarefas</span>
          <i className="pi pi-angle-right" />
          <strong>
            {screen === "checklist" ? "Executar tarefa" : "Detalhes"}
          </strong>
        </div>
      )}
    </header>
  );
  if (screen === "list")
    return (
      <main className="executor-app">
        {header}
        <div className="executor-task-search">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText
              value={taskSearch}
              onChange={(event) => setTaskSearch(event.target.value)}
              placeholder="Pesquisar tarefas abertas"
            />
          </span>
          <Button
            icon="pi pi-qrcode"
            aria-label="Ler QR Code"
            tooltip="Ler QR Code"
            onClick={() => setScannerVisible(true)}
          />
        </div>
        <section className="executor-cards">
          {visibleTasks.map((task) => {
            const deadline = taskDeadlineStatus(task, clock);
            const statusLabel =
              task.status === "em_andamento"
                ? "Iniciada"
                : task.status === "pausada"
                  ? "Pausada"
                  : "Aberta";
            return (
              <button
                className={`executor-list-card ${deadline.late ? "late" : "on-time"}`}
                onClick={() => openTask(task)}
                key={task.id}
              >
                <span className="executor-deadline">
                  <i className="pi pi-clock" />
                  <strong>{deadline.value}</strong>
                  <small>{deadline.label}</small>
                </span>
                <span className="executor-card-content">
                  <strong>{task.tarefa}</strong>
                  <small>
                    #{task.rotina_id} · {task.local}
                  </small>
                  <p>
                    {task.centro_custo || "Contrato"} / {task.local}
                  </p>
                  <span className="executor-card-meta">
                    <span
                      className="executor-origin"
                      title={
                        task.origem === "workflow"
                          ? "Tarefa de workflow"
                          : "Tarefa de rotina"
                      }
                    >
                      <i
                        className={
                          task.origem === "workflow"
                            ? "pi pi-sitemap"
                            : "pi pi-sync"
                        }
                      />
                    </span>
                    <em
                      className={
                        task.status === "em_andamento"
                          ? "started"
                          : task.status === "pausada"
                            ? "paused"
                            : ""
                      }
                    >
                      <i className="pi pi-circle-fill" /> {statusLabel}
                    </em>
                    <b>Estimativa: {formatEstimate(task.estimativa_minutos)}</b>
                  </span>
                </span>
              </button>
            );
          })}
        </section>
        {!visibleTasks.length && (
          <div className="executor-empty">
            Nenhuma tarefa aberta encontrada.
          </div>
        )}
        <TaskQrScanner
          visible={scannerVisible}
          onHide={() => setScannerVisible(false)}
          onTaskId={openTaskFromQr}
        />
      </main>
    );
  if (screen === "details")
    return (
      <main className="executor-app">
        {header}
        {!active ? (
          <div className="executor-empty">Carregando tarefa...</div>
        ) : (
          <section className="executor-details">
            <h1>{active.tarefa}</h1>
            <small>
              #{active.rotina_id} ·{" "}
              {active.origem === "workflow" ? "Workflow" : "Rotina"}
            </small>
            <TaskExecutionMetrics task={active} now={clock} />
            <div className="executor-status">
              <span
                className={active.status === "em_andamento" ? "started" : ""}
              >
                ● {active.status === "em_andamento"
                  ? "Iniciada"
                  : active.status === "pausada"
                    ? "Pausada"
                    : "Aberta"}
              </span>
              <b>
                {active.status === "em_andamento"
                  ? elapsed(active.iniciada_em, clock)
                  : `Estimativa: ${active.estimativa_minutos || 15} min`}
              </b>
            </div>
            <h2>Informações do Checklist</h2>
            {(active.itens || []).map((item, index) => (
              <p className="executor-question" key={item.id}>
                {index + 1}.) {item.pergunta} — {item.tipo_resposta}
              </p>
            ))}
          </section>
        )}
        {active && (
          <footer className="executor-footer">
            {active.status === "pausada" ? (
              <Button
                label="CONTINUAR TAREFA"
                onClick={() => action("continuar")}
              />
            ) : active.status === "em_andamento" ? (
              <Button
                label="CONTINUAR EXECUÇÃO"
                onClick={() =>
                  navigate(`/tm-ops/tarefa/${active.id}/executar`)
                }
              />
            ) : (
              <Button
                label="INICIAR TAREFA"
                onClick={() => action("iniciar")}
              />
            )}
          </footer>
        )}
      </main>
    );
  if (!active)
    return (
      <main className="executor-app">
        {header}
        <div className="executor-empty">Carregando tarefa...</div>
      </main>
    );
  return (
    <main className="executor-app">
      {header}
      <section className="executor-checklist">
        <h1>{active.tarefa}</h1>
        <TaskExecutionMetrics task={active} now={clock} />
        {(active.itens || []).map((item) => (
          <article key={item.id}>
            <strong>{item.pergunta}</strong>
            {item.tipo_resposta === "booleano" ? (
              <Dropdown
                value={item.resposta?.valor ?? item.resposta}
                options={[
                  { label: "Selecione uma opção", value: null },
                  { label: "Sim", value: true },
                  { label: "Não", value: false },
                ]}
                onChange={(e) => answer(item, e.value)}
              />
            ) : (
              <InputText
                value={item.resposta?.valor ?? item.resposta ?? ""}
                onBlur={(e) => answer(item, e.target.value)}
                placeholder="Digite sua resposta"
              />
            )}
            <TaskEvidenceCapture
              task={active}
              item={item}
              onSaved={(updatedTask) => {
                setSelected(updatedTask);
                setTasks((rows) =>
                  rows.map((row) =>
                    row.id === updatedTask.id ? updatedTask : row,
                  ),
                );
              }}
            />
          </article>
        ))}
      </section>
      <footer className="executor-footer">
        {active.status === "em_andamento" && (
          <Button
            label="PAUSAR"
            severity="secondary"
            onClick={() => action("pausar")}
          />
        )}
        <Button label="FINALIZAR TAREFA" onClick={() => action("finalizar")} />
      </footer>
    </main>
  );
}
