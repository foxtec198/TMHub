import { Tag } from "primereact/tag";

export function DashCard({
    title,
    icon,
    className = "",
    style = {},
    value,
    cont=0,
    contStyle={},
    contSeverity,
    contClassName="",
    valueClassName="text-3xl",
    detail,
    tone = "primary",
    accentColor,
}) {
    // Legacy callers used a solid background as the card identity. Keep that
    // color as an accent while the shared card system owns the surface itself.
    const layoutStyle = { ...style };
    const resolvedAccent = accentColor || layoutStyle.backgroundColor || layoutStyle.background;
    delete layoutStyle.background;
    delete layoutStyle.backgroundColor;
    delete layoutStyle.color;
    const cardStyle = resolvedAccent
        ? { ...layoutStyle, "--card-accent": resolvedAccent }
        : layoutStyle;

    return (
        <article className={`tm-card tm-metric-card is-${tone} ${className}`.trim()} style={cardStyle}>
            {icon ? (
                <span className="tm-metric-card__icon" aria-hidden="true">
                    <i className={icon}></i>
                </span>
            ) : null}

            <span className="tm-metric-card__content">
                <small>{title}</small>
                <span className="tm-metric-card__value-row">
                    <strong className={valueClassName}>{value}</strong>
                    {cont ?
                    <Tag
                        value={cont}
                        severity={contSeverity}
                        rounded
                        className={contClassName}
                        style={{
                            fontSize: "0.9rem",
                            transform: "translateY(-0.2rem)",
                            ...contStyle,
                        }}
                    />
                    : null}
                </span>
                {detail ? <em>{detail}</em> : null}
            </span>
        </article>
    )
}
