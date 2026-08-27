import { AppIcon } from "../../components/icons/AppIcon";
import { TabPanel, TabView } from "primereact/tabview";
import { ThemeLogo } from "../../components/ThemeLogo";
import './style.css'

export function MarketPlace() {
    return <main className="p-4">
        {/* Hero */}
        <section className="init-support-hero">
            <div className="init-support-hero-content">
                <span className="init-support-eyebrow">marketplace</span>
                <h1>Bem vindo a sua lojinha!</h1>
                <p>
                    Aproveite seus edinhos ganhos, e adiquira temas, skins do Timo, e muito mais dentro do marketplace.
                </p>
                <div className="init-support-hero-tags">
                    <span><AppIcon name="pencil"  /> Temas</span>
                    <span><AppIcon name="sparkles"  /> Skins Timo</span>
                    <span><AppIcon name="desktop"  /> Telas Personalizadas</span>
                </div>
            </div>
            <div className="init-support-hero-mark" aria-hidden="true">
                <ThemeLogo variant="inverse" alt="" />
                <AppIcon name="shopping-cart"  />
            </div>
        </section>

        <TabView className="p-2 mt-5 border-round">
            <TabPanel header="Principal">
                AQUI
            </TabPanel>
            <TabPanel header="Minhas compras">
                AQUI 2
            </TabPanel>
        </TabView>
    </main>
}