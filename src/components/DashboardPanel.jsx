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
