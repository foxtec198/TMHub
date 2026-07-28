import { Button } from "primereact/button"
import { Divider } from "primereact/divider"
import { PageHeader } from "../../components/PageHeader"

export function Init() {
    return (
        <div className="panel_frame flex flex-column justify-content-center align-items-center text-center">
            <div className="flex flex-column">
                <PageHeader
                    section="TM Hub"
                    title="Início"
                    description="Bem-vindo ao painel executivo."
                    className="app-page-header--centered"
                />
                <h3 className="px-8">
                    Este app está em desenvolvimento e por estar nesta fase,
                    somente nossa filial utiliza por enquanto. espero que aproveite e desfrute de nossas soluções!
                    duvidas? Entre em contato conosco!
                </h3>
            </div>
            <div className="flex gap-2 ms-auto mb-5 mt-3">
                <Button
                    label="Bryan Gabriel"
                    icon="pi pi-whatsapp"
                    className="border-round-lg"
                />
                <Button
                    label="Guilherme Breve"
                    icon="pi pi-whatsapp"
                    className="border-round-lg"
                />
            </div>
            <Divider />
            <div className="flex align-items-center font-italic mt-5">
                <span>Uma parceria entre</span> <img src="/logo.png" width={300} /> <span>e sua equipe.</span>
            </div>
        </div>
    )
}
