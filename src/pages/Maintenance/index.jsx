import "./maintenance.css";
import timo from "../../../just_timo.svg";

export function Maintenance() {
    return (
        <main className="maintenance-page">
            <div className="maintenance-page__aurora maintenance-page__aurora--one" />
            <div className="maintenance-page__aurora maintenance-page__aurora--two" />

            <section className="maintenance-card" aria-labelledby="maintenance-title">
                <img
                    className="maintenance-card__logo"
                    src="/logo.png"
                    alt="TMHub"
                />

                <div className="maintenance-card__content">
                    <div className="maintenance-card__timo-wrap" aria-hidden="true">
                        <span className="maintenance-card__signal" />
                        <img className="maintenance-card__timo" src={timo} alt="" />
                    </div>

                    <span className="maintenance-card__eyebrow">
                        <i className="pi pi-wrench" /> Manutenção em andamento
                    </span>
                    <h1 id="maintenance-title">Estamos deixando tudo pronto.</h1>
                    <p>
                        O Timo está acompanhando uma atualização importante nos dados.
                        Voltaremos assim que a operação estiver validada.
                    </p>

                    <div className="maintenance-card__status">
                        <span className="maintenance-card__pulse" />
                        Atualização acompanhada pela equipe TMHub
                    </div>
                </div>

                <footer>TMHub · Painel Executivo</footer>
            </section>
        </main>
    );
}
