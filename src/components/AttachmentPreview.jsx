import { AppIcon } from "../components/icons/AppIcon";
import { Button } from "primereact/button";

export function AttachmentPreview({ attachment, onRemove }) {
  const { filename, type, url, id } = attachment;
  const extension = filename.split('.').pop().toLowerCase();

  // Preview para imagens
  if (type === 'image' || ['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
    return (
      <div className="attachment-preview image-preview">
        <div className="attachment-thumb">
          <img src={url} alt={filename} />
        </div>
        <div className="attachment-info">
          <span className="attachment-name">{filename}</span>
          <span className="attachment-type">Imagem</span>
        </div>
        <Button
          icon={<AppIcon name="trash" />}
          onClick={() => onRemove(id)}
          outlined
          severity="danger"
          rounded
        />
      </div>
    );
  }

  // Preview para PDF
  if (type === 'pdf' || extension === 'pdf') {
    return (
      <div className="attachment-preview pdf-preview">
        <div className="attachment-thumb pdf-icon">
          <AppIcon name="file-pdf" />
        </div>
        <div className="attachment-info">
          <span className="attachment-name">{filename}</span>
          <span className="attachment-type">PDF</span>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="attachment-view">
          <AppIcon name="eye" />
        </a>
      </div>
    );
  }

  // Preview para Excel
  if (type === 'excel' || ['xlsx', 'xls'].includes(extension)) {
    return (
      <div className="attachment-preview excel-preview">
        <div className="attachment-thumb excel-icon">
          <AppIcon name="file-excel" />
        </div>
        <div className="attachment-info">
          <span className="attachment-name">{filename}</span>
          <span className="attachment-type">Excel</span>
        </div>
        <Button
          icon={<AppIcon name="download" />}
          onClick={() => window.open(url, '_blank')}
          outlined
          rounded
        />
      </div>
    );
  }

  // Preview genérico para outros arquivos
  return (
    <div className="attachment-preview generic-preview">
      <div className="attachment-thumb generic-icon">
        <AppIcon name="file" />
      </div>
      <div className="attachment-info">
        <span className="attachment-name">{filename}</span>
        <span className="attachment-type">Outro arquivo</span>
      </div>
      <a href={url} target="_blank" rel="noreferrer" className="attachment-view">
        <AppIcon name="eye" />
      </a>
    </div>
  );
}

export function AttachmentList({ attachments, onRemove }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="attachment-list">
      {attachments.map((attachment) => (
        <AttachmentPreview
          key={attachment.id || attachment.filename}
          attachment={attachment}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
