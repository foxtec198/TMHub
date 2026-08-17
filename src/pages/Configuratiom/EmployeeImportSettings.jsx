// React
import { useEffect, useRef, useState } from "react";
// PrimeReact
import { Button } from "primereact/button";
import { ProgressBar } from "primereact/progressbar";
import { Tag } from "primereact/tag";
// Utilitários
import connect from "../../utils/request";
// Contextos
import { useToast } from "../../contexts/ToastContext";


// Traduz as etapas técnicas da importação para mensagens exibidas ao usuário.
const PHASE_LABELS = {
  preparando: "Preparando dados",
  cargos: "Conferindo e cadastrando cargos",
  centros: "Sincronizando centros de custo",
  colaboradores: "Sincronizando colaboradores",
  supervisores: "Vinculando supervisores",
  concluido: "Importação concluída",
  erro: "Falha na importação",
};

const UPLOAD_CHUNK_SIZE = 512 * 1024;

export function CollaboratorImportSettings() {
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const inputRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!jobId) return undefined;
    let active = true;
    let polling = false;
    const loadStatus = async () => {
      if (polling) return;
      polling = true;
      try {
        const { data } = await connect.get(`/importacao-colaboradores/${jobId}`);
        if (!active) return;
        setJob(data);
        if (data.status === "completed") {
          setStage("completed");
          setJobId(null);
          showToast("success", "Colaboradores", `${data.total} colaboradores processados.`);
        } else if (data.status === "error") {
          setStage("error");
          setJobId(null);
          showToast("error", "Importação interrompida", data.erro || "Não foi possível concluir.");
        }
      } catch (error) {
        if (!active) return;
        setStage("error");
        setJobId(null);
        showToast("error", "Acompanhamento da importação", error.response?.data || "Não foi possível consultar o progresso.");
      } finally {
        polling = false;
      }
    };
    loadStatus();
    const interval = window.setInterval(loadStatus, 700);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [jobId, showToast]);

  const selectFile = (selected) => {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".json")) {
      showToast("warn", "Arquivo inválido", "Selecione o arquivo de colaboradores no formato .json.");
      return;
    }
    if (selected.size > 60 * 1024 * 1024) {
      showToast("warn", "Arquivo muito grande", "O JSON deve ter no máximo 60 MB.");
      return;
    }
    setFile(selected);
    setJob(null);
    setStage("idle");
    setUploadProgress(0);
  };

  const startImport = async () => {
    if (!file) return;
    setStage("uploading");
    setUploadProgress(0);
    setJob(null);
    try {
      const totalChunks = Math.ceil(file.size / UPLOAD_CHUNK_SIZE);
      const { data: upload } = await connect.post("/importacao-colaboradores/upload/iniciar", {
        filename: file.name,
        size: file.size,
        chunks: totalChunks,
      });
      setJob(upload);

      for (let index = 0; index < totalChunks; index += 1) {
        const start = index * UPLOAD_CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(file.size, start + UPLOAD_CHUNK_SIZE));
        const payload = new FormData();
        payload.append("chunk", chunk, `${file.name}.part`);
        payload.append("index", String(index));
        await connect.post(`/importacao-colaboradores/${upload.id}/parte`, payload, {
          timeout: 120000,
          onUploadProgress: (event) => {
            const loadedInChunk = event.total ? Math.min(event.loaded, event.total) : chunk.size;
            const loaded = Math.min(file.size, start + loadedInChunk);
            setUploadProgress(Math.round((loaded / file.size) * 100));
          },
        });
      }

      setUploadProgress(100);
      const { data } = await connect.post(`/importacao-colaboradores/${upload.id}/concluir`, null, {
        timeout: 120000,
      });
      setJob(data);
      setStage("processing");
      setJobId(data.id);
    } catch (error) {
      setStage("error");
      const serverMessage = typeof error.response?.data === "string"
        ? error.response.data
        : error.response?.data?.message;
      const message = error.response?.status === 413
        ? "O servidor recusou o tamanho enviado. Tente novamente ou contate o suporte."
        : serverMessage || "Não foi possível enviar o JSON. Verifique a conexão e tente novamente.";
      showToast("error", "Importação de colaboradores", message);
    }
  };

  const reset = () => {
    setFile(null);
    setJob(null);
    setJobId(null);
    setStage("idle");
    setUploadProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const processing = ["uploading", "processing"].includes(stage);
  const progress = stage === "uploading" ? uploadProgress : Number(job?.percentual || 0);
  const progressLabel = stage === "uploading"
    ? `Enviando arquivo: ${uploadProgress}%`
    : `${PHASE_LABELS[job?.phase] || "Processando"}: ${job?.processados || 0} de ${job?.total || 0}`;

  return (
    <div className="collaborator-import-layout">
      <article className="settings-card collaborator-import-card">
        <div className="settings-card-title">
          <i className="pi pi-database" />
          <div>
            <h2>Importar colaboradores</h2>
            <p>Sincronize colaboradores, centros de custo, cargos e supervisores pelo JSON.</p>
          </div>
        </div>

        <div
          className={`collaborator-json-dropzone ${file ? "has-file" : ""}`}
          role="button"
          tabIndex={processing ? -1 : 0}
          onClick={() => !processing && inputRef.current?.click()}
          onKeyDown={(event) => {
            if (!processing && ["Enter", " "].includes(event.key)) inputRef.current?.click();
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!processing) selectFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            hidden
            disabled={processing}
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <i className={`pi ${file ? "pi-file" : "pi-cloud-upload"}`} />
          <strong>{file?.name || "Arraste ou clique para selecionar o JSON"}</strong>
          <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Arquivo funcionarios.json · máximo 60 MB"}</span>
        </div>

        {stage !== "idle" && (
          <div className="collaborator-import-progress">
            <div><strong>{progressLabel}</strong><span>{progress.toFixed(2)}%</span></div>
            <ProgressBar value={progress} showValue={false} />
          </div>
        )}

        <div className="collaborator-import-actions">
          <Button label="Limpar" icon="pi pi-times" text disabled={processing || !file} onClick={reset} />
          <Button label={processing ? "Importação em andamento" : "Iniciar importação"} icon="pi pi-upload" disabled={!file || processing} onClick={startImport} />
        </div>
      </article>

      <aside className="settings-card collaborator-import-summary">
        <div className="settings-card-title">
          <i className="pi pi-chart-bar" />
          <div><h2>Resultado da carga</h2><p>Contadores reais da última importação</p></div>
        </div>
        {job ? (
          <div className="collaborator-import-stats">
            <div><span>Total válido</span><strong>{job.total || 0}</strong></div>
            <div><span>Criados</span><strong>{job.colaboradores_criados || 0}</strong></div>
            <div><span>Atualizados</span><strong>{job.colaboradores_atualizados || 0}</strong></div>
            <div><span>Ignorados</span><strong>{job.colaboradores_ignorados || 0}</strong></div>
            <div><span>Cargos criados</span><strong>{job.cargos_criados || 0}</strong></div>
            <div><span>Duplicidades</span><strong>{job.duplicidades || 0}</strong></div>
            <Tag
              className={stage === "completed" || stage === "error" ? "" : "collaborator-import-status-running"}
              value={stage === "completed" ? "CONCLUÍDA" : stage === "error" ? "ERRO" : "EM ANDAMENTO"}
              severity={stage === "completed" ? "success" : stage === "error" ? "danger" : "info"}
            />
            {job.erro && <p className="collaborator-import-error">{job.erro}</p>}
          </div>
        ) : (
          <div className="collaborator-import-empty">
            <i className="pi pi-info-circle" />
            <p>O resumo será preenchido durante a importação.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
