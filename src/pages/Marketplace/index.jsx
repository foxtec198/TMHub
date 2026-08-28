import { useCallback, useEffect, useState } from "react";
import { Button } from "primereact/button";
import { TabPanel, TabView } from "primereact/tabview";
import { Tag } from "primereact/tag";
import { AppIcon } from "../../components/icons/AppIcon";
import { PageHeader } from "../../components/PageHeader";
import { Placeholder } from "../../components/Placeholder";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import "./style.css";

export function MarketPlace() {
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState({ saldo_edinhos: 0, produtos: [] });
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const load = useCallback(async () => {
    try { setLoading(true); const [{ data: catalogData }, { data: purchaseData }] = await Promise.all([connect.get("/marketplace"), connect.get("/marketplace/compras")]); setCatalog(catalogData || { saldo_edinhos: 0, produtos: [] }); setPurchases(purchaseData?.compras || []); }
    catch (error) { showToast("error", "Marketplace", error.response?.data || "Não foi possível carregar o marketplace."); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);
  const buy = async (product) => {
    try { setBuying(product.id); const { data } = await connect.post("/marketplace/compras", { produto_id: product.id }); setCatalog((current) => ({ ...current, saldo_edinhos: data.saldo_edinhos })); showToast("success", "Compra concluída", `${product.nome} adquirido por ${product.preco_edinhos} Edinhos.`); await load(); }
    catch (error) { showToast("warn", "Compra não realizada", error.response?.data?.message || error.response?.data || "Não foi possível concluir a compra."); }
    finally { setBuying(null); }
  };
  return <main className="marketplace-page"><PageHeader section="TMHub" title="Marketplace" description="Use seus Edinhos para desbloquear temas e personalizações do TMHub." actions={<div className="marketplace-balance"><AppIcon name="star-filled" /><strong>{catalog.saldo_edinhos}</strong><span>Edinhos disponíveis</span></div>} />
    {loading ? <Placeholder loading variant="dashboard" /> : <TabView className="marketplace-tabs"><TabPanel header="Catálogo"><section className="marketplace-grid">{catalog.produtos.map((product) => <article className="marketplace-card" key={product.id}><div className={`marketplace-card__art is-${product.categoria}`}><AppIcon name={product.categoria === "skin" ? "sparkles" : "palette"} /></div><div className="marketplace-card__body"><Tag value={product.categoria.toUpperCase()} severity="info" /><h2>{product.nome}</h2><p>{product.descricao}</p><footer><strong><AppIcon name="star-filled" /> {product.preco_edinhos}</strong><Button label="Comprar" icon={<AppIcon name="shopping-cart" />} disabled={buying !== null} loading={buying === product.id} onClick={() => buy(product)} /></footer></div></article>)}{!catalog.produtos.length && <Placeholder variant="content" title="Catálogo vazio" description="Cadastre produtos para iniciar os testes." />}</section></TabPanel><TabPanel header={`Minhas compras${purchases.length ? ` (${purchases.length})` : ""}`}><section className="marketplace-purchases">{purchases.map((purchase) => <article key={purchase.id}><div><Tag value={purchase.status.toUpperCase()} severity="success" /><strong>{purchase.produto.nome}</strong><small>{new Date(purchase.created_at).toLocaleString("pt-BR")}</small></div><b>{purchase.preco_edinhos} Edinhos</b></article>)}{!purchases.length && <Placeholder variant="content" title="Nenhuma compra ainda" description="Escolha um item no catálogo para testar a compra." />}</section></TabPanel></TabView>}
  </main>;
}
