import { AppIcon } from "../components/icons/AppIcon";
import { Button } from "primereact/button";
import { safeExternalUrl } from "../utils/safeUrl";
import connect from "../utils/request";
import { downloadProtectedFile } from "../utils/protectedFile";

export function AttachmentPreview({ attachment, onRemove }) {
  const { filename = "Arquivo", type, url, id } = attachment;
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const safeUrl = safeExternalUrl(url);

  if (type === "image" || ["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return (
      <div className="attachment-preview image-preview">
        <div className="attachment-thumb">
          {safeUrl ? <img src={safeUrl} alt={filename} /> : <AppIcon name="file" />}
        </div>
        <div className="attachment-info">
          <span className="attachment-name">{filename}</span>
          <span className="attachment-type">Imagem</span>
        </div>
        {onRemove && <Button icon={<AppIcon name="trash" />} onClick={() => onRemove(id)} outlined severity="danger" rounded />}
      </div>
    );
  }

  const fileType = type === "pdf" || extension === "pdf" ? "PDF" : type === "excel" || ["xlsx", "xls"].includes(extension) ? "Excel" : "Outro arquivo";
  const icon = fileType === "PDF" ? "file-pdf" : fileType === "Excel" ? "file-excel" : "file";
  return (
    <div className="attachment-preview generic-preview">
      <div className="attachment-thumb generic-icon"><AppIcon name={icon} /></div>
      <div className="attachment-info">
        <span className="attachment-name">{filename}</span>
        <span className="attachment-type">{fileType}</span>
      </div>
      {safeUrl
        ? safeUrl.startsWith("blob:")
          ? <a href={safeUrl} target="_blank" rel="noreferrer" className="attachment-view"><AppIcon name={fileType === "Excel" ? "download" : "eye"} /></a>
          : <Button className="attachment-view" icon={<AppIcon name={fileType === "Excel" ? "download" : "eye"} />} text onClick={() => downloadProtectedFile(connect, safeUrl, filename)} aria-label={`Baixar ${filename}`} />
        : <span className="attachment-view" title="Endereço de anexo inválido"><AppIcon name="ban" /></span>}
    </div>
  );
}

export function AttachmentList({ attachments, onRemove }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="attachment-list">
      {attachments.map((attachment) => (
        <AttachmentPreview key={attachment.id || attachment.filename} attachment={attachment} onRemove={onRemove} />
      ))}
    </div>
  );
}
