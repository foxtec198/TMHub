export function TimoBubble({ message, type = "info", onClose }) {
  if (!message) return null;

  return (
    <section className={`timo-bubble timo-bubble--${type}`} role="status" aria-live="polite">
      <button type="button" className="timo-bubble-close" onClick={onClose} aria-label="Fechar resposta do Timo">
        <i className="pi pi-times" aria-hidden="true" />
      </button>
      <p>{message}</p>
    </section>
  );
}
