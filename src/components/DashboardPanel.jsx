// Permite variar a tag sem perder o estilo e o tom do painel.
export function DashboardPanel({
    as: Component = "article",
    children,
    className = "",
    tone = "primary",
    ...props
}) {
    return (
        <Component
            {...props}
            className={`tm-dashboard-panel is-${tone} ${className}`.trim()}
        >
            {children}
        </Component>
    );
}
