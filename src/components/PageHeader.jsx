// Estilos
import "./page-header.css";

// Renderiza título, contexto e ações opcionais de forma consistente.
export function PageHeader({ section, title, description, actions = null, className = "" }) {
    return (
        <header className={`app-page-header ${className}`.trim()}>
            <div className="app-page-header__content">
                <span className="app-page-header__section">{section}</span>
                <h1>{title}</h1>
                {description && <p>{description}</p>}
            </div>
            {actions && <div className="app-page-header__actions">{actions}</div>}
        </header>
    );
}
