import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { AppIcon } from "../../components/icons/AppIcon";
import { PageHeader } from "../../components/PageHeader";
import { Placeholder } from "../../components/Placeholder";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../theme/useTheme";
import { THEME_OPTIONS } from "../../theme/themes";
import connect from "../../utils/request";
import { storeProfile } from "../../utils/profile";
import "./style.css";

const CATEGORY_LABELS = { todos: "Todos", tema: "Temas", adorno: "Adornos de foto", timo_skin: "Skins do Timo", timo_cenario: "Cenários do Timo" };
const PRODUCT_CATEGORY_LABELS = { tema: "Tema", adorno: "Adorno de foto", timo_skin: "Skin do Timo", timo_cenario: "Cenário do Timo" };
const TIMO_SCENE_ART = {
  timo_cenario_christmas: "/timo-scenes/christmas.webp",
  timo_cenario_halloween: "/timo-scenes/halloween.webp",
  timo_cenario_muertos: "/timo-scenes/muertos.webp",
};
const themeById = new Map(THEME_OPTIONS.map((theme) => [theme.id, theme]));

function errorMessage(error, fallback) {
  return error.response?.data?.message || error.response?.data || fallback;
}

function ProductArt({ product }) {
  if (product.categoria === "tema") {
    const theme = themeById.get(product.codigo.replace("tema_", ""));
    return <div className="marketplace-card__art marketplace-card__art--theme" style={{ "--market-colors": (theme?.preview || ["#0b3518", "#4bd66e", "#fff"]).join(",") }}>
      <span className="marketplace-theme-preview">{(theme?.preview || []).map((color) => <i key={color} style={{ background: color }} />)}</span>
      <AppIcon name={theme?.icon || "palette"} />
    </div>;
  }
  if (product.categoria === "timo_skin") {
    return <div className="marketplace-card__art marketplace-card__art--timo-gold">
      <img src="/timo-gold-poster.png" alt="Prévia do Timo Gold Premium" />
      <span>GOLD</span>
    </div>;
  }
  if (product.categoria === "timo_cenario") {
    return <div className="marketplace-card__art marketplace-card__art--timo-scene">
      <img src={TIMO_SCENE_ART[product.codigo]} alt={`Prévia do cenário ${product.nome}`} />
      <span><AppIcon name="photo" /> CENÁRIO</span>
    </div>;
  }
  return <div className={`marketplace-card__art marketplace-card__art--frame is-${product.codigo}`}>
    <span className="marketplace-frame-preview"><img src="/edinho.png" alt="Prévia do adorno" /></span>
    <AppIcon name="sparkles" />
  </div>;
}

export function MarketPlace() {
  const { showToast } = useToast();
  const { setTheme } = useTheme();
  const [catalog, setCatalog] = useState({ saldo_edinhos: 0, produtos: [] });
  const [purchases, setPurchases] = useState([]);
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: catalogData }, { data: purchaseData }] = await Promise.all([
        connect.get("/marketplace"), connect.get("/marketplace/compras"),
      ]);
      setCatalog(catalogData || { saldo_edinhos: 0, produtos: [] });
      setPurchases(purchaseData?.compras || []);
      setCart((current) => current.filter((id) => !(catalogData?.produtos || []).some((item) => item.id === id && item.adquirido)));
    } catch (error) {
      showToast("error", "Marketplace", errorMessage(error, "Não foi possível carregar o marketplace."));
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => {
    const initialLoad = window.setTimeout(load, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const products = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return catalog.produtos.filter((product) => (
      (category === "todos" || product.categoria === category)
      && (!term || `${product.nome} ${product.descricao}`.toLocaleLowerCase("pt-BR").includes(term))
    ));
  }, [catalog.produtos, category, search]);
  const cartProducts = useMemo(() => cart.map((id) => catalog.produtos.find((item) => item.id === id)).filter(Boolean), [cart, catalog.produtos]);
  const cartTotal = cartProducts.reduce((total, item) => total + Number(item.preco_edinhos || 0), 0);

  const toggleCart = (product) => {
    if (product.adquirido) return;
    setCart((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id]);
  };

  const refreshProfile = async () => {
    const { data } = await connect.get("/usuarios/perfil");
    storeProfile(data);
    return data;
  };

  const checkout = async () => {
    if (!cart.length) return;
    try {
      setProcessing(true);
      const { data } = await connect.post("/marketplace/checkout", { produto_ids: cart });
      setCart([]);
      showToast("success", "Compra concluída", `${data.compras.length} item(ns) adicionado(s) à sua coleção.`);
      await load();
    } catch (error) {
      showToast("warn", "Compra não realizada", errorMessage(error, "Não foi possível concluir a compra."));
    } finally { setProcessing(false); }
  };

  const equip = async (product) => {
    try {
      setProcessing(true);
      await connect.patch("/marketplace/equipar", { categoria: product.categoria, produto_id: product.id });
      const profile = await refreshProfile();
      if (product.categoria === "tema") setTheme(profile.tema);
      showToast("success", "Personalização aplicada", `${product.nome} está em uso.`);
      await load();
    } catch (error) {
      showToast("error", "Não foi possível aplicar", errorMessage(error, "Tente novamente."));
    } finally { setProcessing(false); }
  };

  const removeFrame = async () => {
    try {
      setProcessing(true);
      await connect.patch("/marketplace/equipar", { categoria: "adorno", produto_id: null });
      await refreshProfile();
      showToast("success", "Adorno removido", "Sua foto voltou ao formato padrão.");
      await load();
    } catch (error) {
      showToast("error", "Não foi possível remover", errorMessage(error, "Tente novamente."));
    } finally { setProcessing(false); }
  };

  const removeTimoSkin = async () => {
    try {
      setProcessing(true);
      await connect.patch("/marketplace/equipar", { categoria: "timo_skin", produto_id: null });
      await refreshProfile();
      showToast("success", "Timo restaurado", "O acabamento branco padrão voltou a ser usado.");
      await load();
    } catch (error) {
      showToast("error", "Não foi possível restaurar", errorMessage(error, "Tente novamente."));
    } finally { setProcessing(false); }
  };

  const removeTimoScenario = async () => {
    try {
      setProcessing(true);
      await connect.patch("/marketplace/equipar", { categoria: "timo_cenario", produto_id: null });
      await refreshProfile();
      showToast("success", "Cenário restaurado", "O Timo voltou para sua Oficina padrão.");
      await load();
    } catch (error) {
      showToast("error", "Não foi possível restaurar", errorMessage(error, "Tente novamente."));
    } finally { setProcessing(false); }
  };

  const refund = async () => {
    if (!refundTarget) return;
    try {
      setProcessing(true);
      await connect.post(`/marketplace/compras/${refundTarget.id}/reembolso`);
      const profile = await refreshProfile();
      setTheme(profile.tema);
      showToast("success", "Reembolso concluído", `${refundTarget.preco_edinhos} Edinhos voltaram para seu saldo.`);
      setRefundTarget(null);
      await load();
    } catch (error) {
      showToast("error", "Reembolso não realizado", errorMessage(error, "Tente novamente."));
    } finally { setProcessing(false); }
  };

  return <main className="marketplace-page">
    <PageHeader section="TMHub" title="Marketplace" description="Personalize sua experiência com itens comprados usando Edinhos." actions={<div className="marketplace-balance"><AppIcon name="wallet" /><div><strong>{catalog.saldo_edinhos.toLocaleString("pt-BR")}</strong><span>Edinhos disponíveis</span></div></div>} />
    {loading ? <Placeholder loading variant="dashboard" /> : <>
      <section className="marketplace-toolbar" aria-label="Ferramentas do catálogo">
        <div className="marketplace-categories">{Object.entries(CATEGORY_LABELS).map(([value, label]) => <Button key={value} label={label} outlined={category !== value} onClick={() => setCategory(value)} />)}</div>
        <span className="marketplace-search"><AppIcon name="search" /><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar personalização" /></span>
      </section>
      <div className="marketplace-layout">
        <section className="marketplace-catalog">
          <header><div><span>CATÁLOGO</span><h2>{CATEGORY_LABELS[category]}</h2></div><small>{products.length} item(ns)</small></header>
          <div className="marketplace-grid">{products.map((product) => {
            const inCart = cart.includes(product.id);
            return <article className={`marketplace-card${product.destaque ? " is-featured" : ""}${product.equipado ? " is-equipped" : ""}`} key={product.id}>
              <ProductArt product={product} />
              <div className="marketplace-card__body">
                <div className="marketplace-card__tags"><Tag value={PRODUCT_CATEGORY_LABELS[product.categoria]?.toUpperCase() || product.categoria.toUpperCase()} severity="info" />{product.destaque && <Tag value="DESTAQUE" severity="warning" />}{product.equipado && <Tag value="EM USO" severity="success" />}</div>
                <h3>{product.nome}</h3><p>{product.descricao}</p>
                <footer><strong><AppIcon name="star-filled" /> {product.preco_edinhos ? product.preco_edinhos.toLocaleString("pt-BR") : "Grátis"}</strong>
                  {product.adquirido ? <Button label={product.equipado ? "Equipado" : "Usar"} icon={<AppIcon name="check" />} outlined={!product.equipado} disabled={product.equipado || processing} onClick={() => equip(product)} /> : <Button label={inCart ? "No carrinho" : "Adicionar"} icon={<AppIcon name={inCart ? "check" : "shopping-cart"} />} severity={inCart ? "success" : undefined} outlined={inCart} onClick={() => toggleCart(product)} />}
                </footer>
              </div>
            </article>;
          })}{!products.length && <Placeholder variant="content" title="Nenhum item encontrado" description="Ajuste a busca ou escolha outra categoria." />}</div>
        </section>
        <aside className="marketplace-cart">
          <header><div><span><AppIcon name="shopping-cart" /> Carrinho</span><strong>{cartProducts.length} item(ns)</strong></div>{cart.length > 0 && <Button label="Limpar" text onClick={() => setCart([])} />}</header>
          <div className="marketplace-cart__items">{cartProducts.map((product) => <article key={product.id}><div><strong>{product.nome}</strong><small>{PRODUCT_CATEGORY_LABELS[product.categoria] || product.categoria}</small></div><span>{product.preco_edinhos.toLocaleString("pt-BR")} <AppIcon name="star-filled" /></span><Button icon={<AppIcon name="x" />} text rounded aria-label={`Remover ${product.nome}`} onClick={() => toggleCart(product)} /></article>)}{!cartProducts.length && <div className="marketplace-cart__empty"><AppIcon name="shopping-cart" /><strong>Seu carrinho está vazio</strong><span>Escolha itens no catálogo para comprar tudo de uma vez.</span></div>}</div>
          <footer><div><span>Total</span><strong>{cartTotal.toLocaleString("pt-BR")} Edinhos</strong></div><Button label="Finalizar compra" icon={<AppIcon name="check" />} disabled={!cart.length || cartTotal > catalog.saldo_edinhos} loading={processing} onClick={checkout} />{cartTotal > catalog.saldo_edinhos && <small>Saldo insuficiente para este carrinho.</small>}</footer>
        </aside>
      </div>
      <section className="marketplace-collection">
        <header><div><span>MINHA COLEÇÃO</span><h2>Compras e reembolsos</h2></div><div className="marketplace-collection__actions">{catalog.equipados?.adorno && <Button label="Remover adorno atual" icon={<AppIcon name="x" />} text onClick={removeFrame} disabled={processing} />}{catalog.equipados?.timo_skin && catalog.equipados.timo_skin !== "default" && <Button label="Usar Timo padrão" icon={<AppIcon name="arrow-back-up" />} text onClick={removeTimoSkin} disabled={processing} />}{catalog.equipados?.timo_cenario && catalog.equipados.timo_cenario !== "workshop" && <Button label="Usar cenário padrão" icon={<AppIcon name="arrow-back-up" />} text onClick={removeTimoScenario} disabled={processing} />}</div></header>
        <div>{purchases.map((purchase) => <article key={purchase.id}><span className={`marketplace-purchase-icon is-${purchase.produto.categoria}`}><AppIcon name={purchase.produto.categoria === "tema" ? "palette" : purchase.produto.categoria === "timo_skin" ? "sparkles" : "photo"} /></span><div><strong>{purchase.produto.nome}</strong><small>{new Date(purchase.created_at).toLocaleString("pt-BR")} · {purchase.preco_edinhos.toLocaleString("pt-BR")} Edinhos</small></div><Tag value={purchase.status === "concluida" ? "ADQUIRIDO" : purchase.status.replaceAll("_", " ").toUpperCase()} severity={purchase.status === "concluida" ? "success" : "secondary"} />{purchase.pode_reembolsar && <Button label="Reembolsar" icon={<AppIcon name="arrow-back-up" />} text onClick={() => setRefundTarget(purchase)} />}</article>)}{!purchases.length && <Placeholder variant="content" title="Nenhuma compra ainda" description="Sua coleção aparecerá aqui." />}</div>
      </section>
    </>}
    <Dialog visible={Boolean(refundTarget)} modal header="Confirmar reembolso" className="marketplace-refund-dialog" onHide={() => !processing && setRefundTarget(null)} footer={<><Button label="Cancelar" text onClick={() => setRefundTarget(null)} disabled={processing} /><Button label="Reembolsar" severity="warning" icon={<AppIcon name="arrow-back-up" />} onClick={refund} loading={processing} /></>}><p>O item <strong>{refundTarget?.produto.nome}</strong> será removido da sua coleção e <strong>{refundTarget?.preco_edinhos} Edinhos</strong> voltarão ao saldo.</p><small>Se ele estiver em uso, a personalização será removida automaticamente.</small></Dialog>
  </main>;
}
