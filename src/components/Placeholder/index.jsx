import { Skeleton } from "primereact/skeleton";

import "./placeholder.css";

const DASHBOARD_METRICS = Array.from({ length: 6 }, (_, index) => index);
const TABLE_ROWS = Array.from({ length: 5 }, (_, index) => index);

function DashboardSkeleton() {
  return (
    <div className="tm-placeholder-dashboard" aria-hidden="true">
      <div className="tm-placeholder-dashboard__metrics">
        {DASHBOARD_METRICS.map((index) => (
          <Skeleton key={index} height="7.4rem" borderRadius="14px" />
        ))}
      </div>
      <div className="tm-placeholder-dashboard__charts">
        <Skeleton height="23rem" borderRadius="16px" />
        <Skeleton height="23rem" borderRadius="16px" />
      </div>
      <Skeleton height="19rem" borderRadius="16px" />
    </div>
  );
}

function TableSkeleton({ rows }) {
  return (
    <div className="tm-placeholder-table" aria-hidden="true">
      <Skeleton height="1rem" width="42%" />
      {TABLE_ROWS.slice(0, rows).map((index) => (
        <div key={index} className="tm-placeholder-table__row">
          <Skeleton height=".85rem" width="22%" />
          <Skeleton height=".85rem" width="31%" />
          <Skeleton height=".85rem" width="16%" />
          <Skeleton height=".85rem" width="18%" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="tm-placeholder-card" aria-hidden="true">
      <Skeleton shape="circle" size="2.6rem" />
      <div>
        <Skeleton height=".75rem" width="5rem" />
        <Skeleton height="1.8rem" width="4rem" className="mt-2" />
        <Skeleton height=".65rem" width="7.5rem" className="mt-2" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="tm-placeholder-chart" height="100%" borderRadius="12px" aria-hidden="true" />;
}

/**
 * Estado visual padrão para carregamento e ausência de conteúdo.
 *
 * Use `loading` para skeleton e omita-o para o estado vazio.
 * Variantes disponíveis: content, chart, table, card e dashboard.
 */
export function Placeholder({
  loading = false,
  variant = "content",
  icon = "pi-inbox",
  title,
  description,
  action = null,
  rows = 5,
  className = "",
}) {
  if (loading) {
    if (variant === "dashboard") return <DashboardSkeleton />;
    if (variant === "table") return <TableSkeleton rows={rows} />;
    if (variant === "card") return <CardSkeleton />;
    if (variant === "chart") return <ChartSkeleton />;
    return <Skeleton className="tm-placeholder-content-skeleton" height="12rem" borderRadius="14px" aria-hidden="true" />;
  }

  return (
    <div className={`tm-placeholder tm-placeholder--${variant} ${className}`.trim()} role="status">
      <span className="tm-placeholder__icon" aria-hidden="true"><i className={`pi ${icon}`} /></span>
      <div className="tm-placeholder__copy">
        <strong>{title || "Nada para mostrar por aqui"}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState(props) {
  return <Placeholder {...props} />;
}

