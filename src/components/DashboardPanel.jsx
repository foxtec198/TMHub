import { Placeholder } from "./Placeholder";

export function DashboardPanel({
    as: Component = "article",
    children,
    className = "",
    tone = "primary",
    loading = false,
    empty = false,
    placeholderVariant = "chart",
    emptyIcon,
    emptyTitle,
    emptyDescription,
    emptyAction,
    ...props
}) {
    return (
        <Component
            {...props}
            className={`tm-dashboard-panel is-${tone} ${className}`.trim()}
        >
            {loading ? (
                <Placeholder loading variant={placeholderVariant} />
            ) : empty ? (
                <Placeholder
                    variant={placeholderVariant}
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                />
            ) : children}
        </Component>
    );
}
