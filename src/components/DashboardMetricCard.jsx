import { DashCard } from "./DashCard";

export function DashboardMetricCard({ className = "", ...props }) {
    return (
        <DashCard
            {...props}
            className={`tm-dashboard-card ${className}`.trim()}
        />
    );
}
