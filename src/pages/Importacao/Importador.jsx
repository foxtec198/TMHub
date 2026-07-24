import { useState, useRef, useEffect } from "react";
import { FileUpload } from "primereact/fileupload";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Card } from "primereact/card";
import { Message } from "primereact/message";
import { ProgressBar } from "primereact/progressbar";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { Toolbar } from "primereact/toolbar";
import { InputSwitch } from "primereact/inputswitch";
import { TabView, TabPanel } from "primereact/tabview";
import connect from "../../utils/request";
import "./importador.css";

export function Importador() {
  const toast = useRef(null);
  const [etapa, setEtapa] = useState("upload");
  const [arquivo, setArquivo] = useState(null);
  const [caminhoServidor, setCaminhoServidor] = useState("");
  const [colunasPlanilha, setColunasPlanilha] = useState([]);
  const [amostra, setAmostra] = useState([]);
  const [totalLinhas, setTotalLinhas] = useState(0);
  const [tabelas, setTabelas] = useState([]);
  const [tabelaSelecionada, setTabelaSelecionada] = useState(null);
  const [mapeamento, setMapeamento] = useState({});
  const [modo, setModo] = useState("insert");
  const [colunaChave, setColunaChave] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [dialogVisivel, setDialogVisivel] = useState(false);
  const [dialogConteudo, setDialogConteudo] = useState(null);
  const [importandoGlosas, setImportandoGlosas] = useState(false);
  const [resultadoGlosas, setResultadoGlosas] = useState(null);

  useEffect(() => {
    connect.get("/importacao/tabelas")
      .then(({ data }) => setTabelas(data))
      .catch(() => showToast("error", "Erro", "Nao foi possivel carregar as tabelas."));
  }, []);

  const showToast = (sev, summary, detail) =>
    toast.current?.show({ severity: sev, summary, detail, life: 4000 });

  const handleUpload = async (event) => {
    const file = event.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("arquivo", file);
    try {
      const { data } = await connect.post("/importacao/preview", fd);
      setArquivo(file.name);
      setCaminhoServidor(data.arquivo);
      setColunasPlanilha(data.colunas);
      setAmostra(data.amostra);
      setTotalLinhas(data.total_linhas);
      setEtapa("mapear");
      autoMapear(data.colunas);
      showToast("success", "OK", data.total_linhas + " linhas lidas.");
    } catch (err) {
      showToast("error", "Falha", err.response?.data?.erro || "Erro ao ler.");
    }
  };

  const handlePathImport = async () => {
    if (!caminhoServidor) return;
    try {
      const { data } = await connect.post("/importacao/preview", { caminho: caminhoServidor });
      setArquivo(caminhoServidor.split("\\").pop());
      setCaminhoServidor(data.arquivo);
      setColunasPlanilha(data.colunas);
      setAmostra(data.amostra);
      setTotalLinhas(data.total_linhas);
      setEtapa("mapear");
      autoMapear(data.colunas);
      showToast("success", "OK", data.total_linhas + " linhas.");
    } catch (err) {
      showToast("error", "Erro", err.response?.data?.erro || "Falha.");
    }
  };

  const autoMapear = (cols) => {
    if (!tabelaSelecionada || !cols.length) return;
    const auto = {};
    cols.forEach((c) => {
      const m = tabelaSelecionada.colunas.find(
        (b) => b.nome.toLowerCase() === c.coluna.toLowerCase()
      );
      if (m) auto[c.coluna] = m.nome;
    });
    setMapeamento(auto);
  };

  const handleTabelaChange = (e) => {
    setTabelaSelecionada(e.value);
    setMapeamento({});
    setColunaChave(null);
    if (e.value && colunasPlanilha.length) {
      const auto = {};
      colunasPlanilha.forEach((c) => {
        const m = e.value.colunas.find(
          (b) => b.nome.toLowerCase() === c.coluna.toLowerCase()
        );
        if (m) auto[c.coluna] = m.nome;
      });
      setMapeamento(auto);
    }
  };

  const updateMapping = (cp, cb) =>
    setMapeamento((p) => {
      const n = { ...p };
      cb ? (n[cp] = cb) : delete n[cp];
      return n;
    });

  const handleImportar = async () => {
    if (!tabelaSelecionada || !Object.keys(mapeamento).length)
      return showToast("warn", "Atencao", "Selecione a tabela e mapeie colunas.");
    setImportando(true);
    try {
      const { data } = await connect.post("/importacao/importar", {
        arquivo: caminhoServidor,
        tabela: tabelaSelecionada.nome,
        mapeamento,
        modo,
        chave: modo === "upsert" ? colunaChave : undefined,
      });
      setResultado(data);
      setEtapa("resultado");
      showToast(data.erros?.length ? "warn" : "success", "Pronto",
        data.inseridos + " inseridos, " + data.atualizados + " atualiz." +
        (data.total_erros ? ", " + data.total_erros + " erros" : ""));
    } catch (err) {
      showToast("error", "Falha", err.response?.data?.erro || "Erro.");
    } finally {
      setImportando(false);
    }
  };

  const handleUploadGlosas = async (event) => {
    const file = event.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("arquivo", file);
    setImportandoGlosas(true);
    setResultadoGlosas(null);
    try {
      const { data } = await connect.post("/importacao/glosas", fd);
      setResultadoGlosas(data);
      showToast(data.total_erros ? "warn" : "success", "Glosas OK",
        data.inseridos + " registros" + (data.total_erros ? ", " + data.total_erros + " erros" : ""));
    } catch (err) {
      showToast("error", "Erro", err.response?.data?.erro || "Falha.");
    } finally {
      setImportandoGlosas(false);
    }
  };

  const handlePathGlosas = async () => {
    if (!caminhoServidor) return showToast("warn", "Atencao", "Informe o caminho da planilha.");
    setImportandoGlosas(true);
    setResultadoGlosas(null);
    try {
      const { data } = await connect.post("/importacao/glosas", { arquivo: caminhoServidor });
      setResultadoGlosas(data);
      showToast(data.total_erros ? "warn" : "success", "Glosas OK",
        data.inseridos + " registros" + (data.total_erros ? ", " + data.total_erros + " erros" : ""));
    } catch (err) {
      showToast("error", "Erro", err.response?.data?.erro || "Falha.");
    } finally {
      setImportandoGlosas(false);
    }
  };

  const novaImportacao = () => {
    setEtapa("upload");
    setArquivo(null);
    setCaminhoServidor("");
    setColunasPlanilha([]);
    setAmostra([]);
    setTotalLinhas(0);
    setMapeamento({});
    setColunaChave(null);
    setResultado(null);
    setResultadoGlosas(null);
  };

  const verAmostra = () => {
    setDialogConteudo(
      <DataTable value={amostra} scrollable scrollHeight="400px" size="small">
        {colunasPlanilha.map((c) => (
          <Column key={c.coluna} field={c.coluna} header={c.coluna} sortable />
        ))}
      </DataTable>
    );
    setDialogVisivel(true);
  };

  const cbo = tabelaSelecionada
    ? tabelaSelecionada.colunas.map((c) => ({ label: c.nome + " (" + c.tipo + ")", value: c.nome }))
    : [];

  const sc = {
    card: { marginBottom: "1rem" },
    row: { display: "flex", alignItems: "center", gap: "0.75rem" },
    statBox: { display: "flex", gap: "1.5rem", justifyContent: "center", flexWrap: "wrap" },
    statItem: { textAlign: "center", padding: "1.25rem", background: "var(--surface-card)", borderRadius: "8px", minWidth: "120px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" },
  };

  const renderUpload = () => (
    <Card title="Upload da Planilha" style={sc.card}>
      <FileUpload mode="basic" name="arquivo" accept=".xlsx,.xls,.csv"
        maxFileSize={50000000} auto chooseLabel="Selecionar planilha"
        uploadHandler={handleUpload} customUpload />
      <small className="text-secondary mt-2 block">Formatos: XLSX, XLS, CSV (50MB max.)</small>
      <p className="mt-3 text-sm text-color-secondary">Caminho no servidor:</p>
      <div className="flex gap-2 mt-2">
        <input type="text" className="p-inputtext p-component w-full"
          placeholder="C:/caminho/planilha.xlsx" value={caminhoServidor}
          onChange={(e) => setCaminhoServidor(e.target.value)} />
        <Button icon="pi pi-upload" label="Ler" severity="info" onClick={handlePathImport} />
      </div>
    </Card>
  );

  const renderMapeamento = () => (
    <>
      <Card title="Tabela de destino" style={sc.card}>
        <Dropdown value={tabelaSelecionada}
          options={tabelas.map((t) => ({ label: t.nome, value: t }))}
          onChange={handleTabelaChange} placeholder="Selecione..." filter className="w-full mb-2" />
        <div style={sc.row} className="mb-2">
          <span className="font-bold">Upsert</span>
          <InputSwitch checked={modo === "upsert"}
            onChange={(e) => setModo(e.value ? "upsert" : "insert")} />
          {modo === "upsert" && tabelaSelecionada && (
            <Dropdown value={colunaChave}
              options={tabelaSelecionada.colunas.map((c) => ({ label: c.nome, value: c.nome }))}
              onChange={(e) => setColunaChave(e.value)} placeholder="Chave" />
          )}
        </div>
        {tabelaSelecionada && <Message severity="info" text={tabelaSelecionada.nome + " (" + tabelaSelecionada.colunas.length + " colunas)"} />}
      </Card>

      {tabelaSelecionada && (
        <Card title="Mapear Colunas" style={sc.card}>
          <DataTable value={colunasPlanilha} size="small" stripedRows>
            <Column field="coluna" header="Planilha" style={{ width: "30%" }} />
            <Column field="tipo_detectado" header="Tipo" style={{ width: "15%" }}
              body={(r) => <Tag value={r.tipo_detectado} severity="info" />} />
            <Column header="Mapear para" style={{ width: "40%" }}
              body={(r) => (
                <Dropdown value={mapeamento[r.coluna] || null} options={cbo}
                  onChange={(e) => updateMapping(r.coluna, e.value)}
                  placeholder="ignorar" showClear filter className="w-full" />
              )} />
          </DataTable>
          <div style={{ ...sc.row, justifyContent: "space-between", marginTop: "1rem" }}>
            <Button icon="pi pi-eye" label="Amostra" severity="secondary" onClick={verAmostra} />
            <Button icon="pi pi-check" label={importando ? "Importando..." : "Importar"}
              onClick={handleImportar} disabled={importando || !Object.keys(mapeamento).length} />
          </div>
        </Card>
      )}
    </>
  );

  const renderGlosas = () => (
    <>
      <Card title="Planilha de Glosas - Prefeitura (CC 87)" style={sc.card}>
        <p className="text-color-secondary mb-3">
          Importa dados da planilha de glosas (formato especifico da prefeitura,
          centro de custo 87) para a tabela <b>controle_glosas</b>.
          Cada falta encontrada vira um registro individual no banco.
        </p>
        <FileUpload mode="basic" name="arquivo" accept=".xlsx,.xls"
          maxFileSize={50000000} auto chooseLabel="Upload planilha de glosas"
          uploadHandler={handleUploadGlosas} customUpload />
        <p className="mt-3 text-sm text-color-secondary">Ou informe o caminho local:</p>
        <div className="flex gap-2 mt-2">
          <input type="text" className="p-inputtext p-component w-full"
            placeholder="C:/caminho/para/glosa.xlsx" value={caminhoServidor}
            onChange={(e) => setCaminhoServidor(e.target.value)} />
          <Button icon="pi pi-upload" label="Importar Glosas" severity="danger"
            onClick={handlePathGlosas} loading={importandoGlosas} />
        </div>
      </Card>
      {importandoGlosas && <ProgressBar mode="indeterminate" className="mt-3" />}
      {resultadoGlosas && (
        <Card title="Resultado da Importacao de Glosas" className="mt-3">
          <div style={sc.statBox}>
            <div style={sc.statItem}><i className="pi pi-check-circle text-green-600 text-3xl" /><br /><b>{resultadoGlosas.inseridos}</b><br /><small>Registros</small></div>
            <div style={sc.statItem}><i className="pi pi-exclamation-triangle text-orange-600 text-3xl" /><br /><b>{resultadoGlosas.total_erros}</b><br /><small>Erros</small></div>
            <div style={sc.statItem}><i className="pi pi-file text-gray-600 text-3xl" /><br /><b>{resultadoGlosas.total_lidos || resultadoGlosas.inseridos}</b><br /><small>Faltas lidas</small></div>
          </div>
          {resultadoGlosas.erros?.length > 0 && (
            <div className="mt-3"><h4>Erros:</h4>
              <ul>{resultadoGlosas.erros.map((e, i) => <li key={i} className="text-red-600">{e}</li>)}</ul>
            </div>
          )}
        </Card>
      )}
    </>
  );

  return (
    <div className="importador-container">
      <Toast ref={toast} />
      <Toolbar className="mb-3"
        left={<div style={sc.row}><i className="pi pi-database text-2xl" /><h2 className="m-0">Importar Planilha</h2></div>}
        right={<Tag value={etapa === "resultado" ? "Resultado" : etapa === "mapear" ? "Mapeamento" : "Upload"} severity={etapa === "resultado" ? "success" : "info"} />}
      />
      <ProgressBar value={etapa === "upload" ? 33 : etapa === "mapear" ? 66 : 100} className="mb-4" displayValueTemplate={() => ""} />

      <TabView>
        <TabPanel header="Importacao Generica" leftIcon="pi pi-table">
          {etapa === "upload" && renderUpload()}
          {etapa === "mapear" && renderMapeamento()}
          {etapa === "resultado" && renderResultado()}
        </TabPanel>
        <TabPanel header="Importar Glosas (CC 87)" leftIcon="pi pi-exclamation-triangle">
          {renderGlosas()}
        </TabPanel>
      </TabView>

      <Dialog header="Amostra" visible={dialogVisivel} style={{ width: "80vw" }}
        maximizable onHide={() => setDialogVisivel(false)}>
        {dialogConteudo}
      </Dialog>
    </div>
  );
}
