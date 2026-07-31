import { useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import connect from "../../utils/request";
import { useToast } from "../../contexts/ToastContext";

export function RequestImportDialog({ visible, onHide, onImported }) {
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef(null);
  const { showToast } = useToast();

  // Keep the dialog mounted during upload so users cannot interrupt an active batch.
  const close = () => {
    if (importing) return;
    setSpreadsheet(null);
    if (fileInput.current) fileInput.current.value = "";
    onHide();
  };

  // Always download the backend-generated template because its reference tabs are live data.
  const downloadTemplate = async () => {
    try {
      const { data } = await connect.get("/repo/request/modelo-importacao", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "modelo_importacao_requisicoes.xlsx";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      showToast("error", "Modelo da planilha", error.response?.data || "Não foi possível baixar o modelo.");
    }
  };

  // The backend owns row validation and transaction rollback; the client only transports the file.
  const importRequests = async (event) => {
    event.preventDefault();
    if (!spreadsheet) return showToast("warn", "Planilha", "Selecione um arquivo .xlsx.");
    if (spreadsheet.size > 15 * 1024 * 1024) return showToast("warn", "Planilha", "O arquivo deve ter no máximo 15 MB.");

    const payload = new FormData();
    payload.append("file", spreadsheet);
    setImporting(true);
    try {
      const { data } = await connect.post("/repo/request/importar", payload, { timeout: 120000 });
      showToast("success", "Importação concluída", data?.message || "Requisições importadas.");
      setSpreadsheet(null);
      if (fileInput.current) fileInput.current.value = "";
      onHide();
      onImported?.();
    } catch (error) {
      const response = error.response?.data;
      const details = Array.isArray(response?.errors) ? response.errors.slice(0, 4).join(" ") : null;
      const message = typeof response === "string" ? response : response?.message;
      showToast("error", "Falha na importação", details || message || (error.code === "ECONNABORTED" ? "A importação excedeu o tempo limite." : "Confira a planilha e tente novamente."));
    } finally {
      setImporting(false);
    }
  };

  return <Dialog header="Importar requisições" visible={visible} modal className="request-import-dialog" closable={!importing} closeOnEscape={!importing} onHide={close}>
    <form className="request-import-form" onSubmit={importRequests}>
      <p>A operação é transacional: se uma linha estiver inválida, nenhuma requisição será criada.</p>
      <Button type="button" label="Baixar planilha modelo" icon="pi pi-download" outlined disabled={importing} onClick={downloadTemplate} />
      <input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importing} onChange={(event) => setSpreadsheet(event.target.files?.[0] || null)} />
      {spreadsheet && <small>Arquivo selecionado: {spreadsheet.name}</small>}
      <div className="flex justify-content-end gap-2">
        <Button type="button" label="Cancelar" text disabled={importing} onClick={close} />
        <Button type="submit" label={importing ? "Importando..." : "Importar requisições"} icon="pi pi-upload" loading={importing} disabled={!spreadsheet || importing} />
      </div>
    </form>
  </Dialog>;
}
