// Componentes
import { DashCard } from "./DashCard";

// Repassa as propriedades ao card base mantendo a classe de métricas.
export function DashboardMetricCard({ className = "", ...props }) {
    return (
        <DashCard
            {...props}
            className={`tm-dashboard-card ${className}`.trim()}
        />
    );
}
