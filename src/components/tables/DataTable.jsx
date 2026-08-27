import { DataTable as PrimeDataTable } from "primereact/datatable";

import { Placeholder } from "../Placeholder";

/**
 * Adaptador do DataTable PrimeReact com estado vazio padronizado.
 *
 * Preserve a API do PrimeReact. Quando `emptyMessage` for texto, ele é
 * apresentado no placeholder visual do TMHub em vez de uma célula sem estilo.
 */
export function DataTable({
  emptyMessage,
  emptyTitle,
  emptyDescription,
  emptyIcon = "search",
  emptyAction,
  ...props
}) {
  const resolvedEmptyMessage = typeof emptyMessage === "string"
    ? (
      <Placeholder
        variant="table"
        icon={emptyIcon}
        title={emptyMessage}
        description={emptyDescription}
        action={emptyAction}
      />
    )
    : emptyMessage || (
      <Placeholder
        variant="table"
        icon={emptyIcon}
        title={emptyTitle || "Nenhum resultado encontrado"}
        description={emptyDescription || "Ajuste a busca ou os filtros para encontrar o que precisa."}
        action={emptyAction}
      />
    );

  return <PrimeDataTable {...props} emptyMessage={resolvedEmptyMessage} />;
}
