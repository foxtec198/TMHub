// Widgets ----------------------------------------------
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Password } from "primereact/password";
import { FloatLabel } from "primereact/floatlabel";
import { Tag } from "primereact/tag";
import { Divider } from "primereact/divider";

// Utils ------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useLoading } from "../../contexts/LoadingContext";
import connect from "../../utils/request";
import { clearAccessToken, getAccessToken, setAccessToken } from "../../utils/authSession";
import { BarcodeScanner } from "./BarcodeScanner";
import { ThemeLogo } from "../../components/ThemeLogo";

// CSS
import "../Auth/main.css";
import "./mobile_movement.css";

const PRODUCTS_ENDPOINT = "/estoque/produtos";
const MOVEMENTS_ENDPOINT = "/estoque/movimentos";

const tipoOptions = [
    { label: "Entrada", value: "entrada" },
    { label: "Saída", value: "saida" },
];

export function MobileMovement() {
    // 'login' ou 'movimentacao'
    const [step, setStep] = useState(getAccessToken() ? "movimentacao" : "login");

    const [user, setUser] = useState("");
    const [pwd, setPwd] = useState("");
    const [displayName, setDisplayName] = useState(localStorage.getItem("display_name") || "");

    const [products, setProducts] = useState([]);
    const [productId, setProductId] = useState(null);
    const [tipo, setTipo] = useState("entrada");
    const [quantidade, setQuantidade] = useState(1);
    const [observacao, setObservacao] = useState("");
    const [scannerVisible, setScannerVisible] = useState(false);

    const setLoading = useLoading();
    const { showToast } = useToast();

    const loginFormRef = useRef(null);
    const movementFormRef = useRef(null);

    function submitOnEnter(formRef) {
        return (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            formRef.current?.requestSubmit();
        };
    }

    const [bloqueadoAte, setBloqueadoAte] = useState(() => {
        const salvo = localStorage.getItem("bloqueadoAte");
        return salvo ? parseInt(salvo, 10) : null;
    });

    const [tentativas, setTentativas] = useState(() => {
        const salvas = localStorage.getItem("tentativas");
        return salvas ? parseInt(salvas, 10) : 0;
    });

    const [tempoRestante, setTempoRestante] = useState(0);

    useEffect(() => {
        if (!bloqueadoAte) {
            // Estado derivado do bloqueio persistido; mantém o contador visual sincronizado.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            return setTempoRestante(0);
        }

        const atualizarCronometro = () => {
            const agora = Date.now();
            const restante = Math.max(0, Math.ceil((bloqueadoAte - agora) / 1000));

            setTempoRestante(restante);

            if (restante === 0) {
                setBloqueadoAte(null);
                setTentativas(0);
                localStorage.removeItem("bloqueadoAte");
                localStorage.removeItem("tentativas");
            }
        };

        atualizarCronometro();
        const interval = setInterval(atualizarCronometro, 1000);

        return () => clearInterval(interval);
    }, [bloqueadoAte]);

    const selectedProduct = products.find((p) => p.id === productId);

    async function getProducts() {
        try {
            const res = await connect.get(PRODUCTS_ENDPOINT);
            setProducts(res.data ?? []);
        } catch (err) {
            console.warn(err);
        }
    }

    useEffect(() => {
        // O carregamento é disparado somente ao entrar na etapa autenticada.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (step === "movimentacao") { getProducts(); }
    }, [step]);

    async function login(e) {
        e?.preventDefault();

        if (bloqueadoAte && Date.now() < bloqueadoAte) {
            showToast("info", "Bloqueio Temporario", "Voce esta temporariamente bloqueado. Tente novamente mais tarde!");
            return;
        }

        if (!user || !pwd) {
            showToast("warn", "Atenção!", "Preencha usuário e senha.");
            return;
        }

        setLoading(true);
        try {
            const res = await connect.post("/login", { username: user, password: pwd });
            setTentativas(0);
            localStorage.removeItem("tentativas");
            setAccessToken(res.data.access_token);
            localStorage.setItem("display_name", res.data.display_name);
            localStorage.setItem("role", res.data.role);
            const requirements = {
                primeiro_acesso: res.data.primeiro_acesso,
                cpf_pendente: res.data.cpf_pendente,
                foto_pendente: res.data.foto_pendente,
                troca_senha_obrigatoria: res.data.troca_senha_obrigatoria,
                senha_padrao: res.data.senha_padrao,
                pendencia_obrigatoria: res.data.pendencia_obrigatoria,
                interacao_pendente: res.data.interacao_pendente,
            };
            localStorage.setItem("auth_requirements", JSON.stringify(requirements));
            window.dispatchEvent(new CustomEvent("tmhub:auth-requirements", { detail: requirements }));
            setDisplayName(res.data.display_name);
            setPwd("");
            setStep("movimentacao");
        } catch (err) {
            const msg = err.response?.data ?? "Não foi possível autenticar.";
            const isPwdError = typeof msg === "string" && msg.toLowerCase().includes("senha");

            if (isPwdError) {
                const novasTentativas = tentativas + 1;
                setTentativas(novasTentativas);
                localStorage.setItem("tentativas", novasTentativas);

                if (novasTentativas >= 3) {
                    const umMinutoDepois = Date.now() + 60000;
                    setBloqueadoAte(umMinutoDepois);
                    localStorage.setItem("bloqueadoAte", umMinutoDepois);
                    showToast("info", "Bloqueio Temporario", "Voce esta temporariamente bloqueado. Tente novamente mais tarde!");
                } else {
                    showToast("error", "Senha Incorreta", `Senha incorreta! Tentativa ${novasTentativas} de 3.`);
                }
            } else {
                showToast("error", "Erro no Login", msg);
            }
        } finally {
            setLoading(false);
        }
    }

    function logout() {
        clearAccessToken();
        localStorage.removeItem("auth_requirements");
        localStorage.removeItem("display_name");
        localStorage.removeItem("role");
        setDisplayName("");
        setUser("");
        setPwd("");
        resetForm();
        setStep("login");
    }

    function resetForm() {
        setProductId(null);
        setTipo("entrada");
        setQuantidade(1);
        setObservacao("");
    }

    async function createMovement() {
        if (!productId || !tipo || !quantidade) {
            showToast("warn", "Atenção!", "Selecione o produto, o tipo e a quantidade.");
            return;
        }

        setLoading(true);
        try {
            await connect.post(MOVEMENTS_ENDPOINT, {
                item_id: productId,
                tipo,
                quantidade,
                observacao,
                origem: "celular",
            });
            showToast("success", "Sucesso!", "Movimentação registrada com sucesso.");
            resetForm();
            getProducts();
        } catch (err) {
            console.warn(err);
            if (err.response?.status === 401) {
                showToast("error", "Sessão expirada", "Faça login novamente.");
                logout();
            } else {
                showToast("error", "Erro ao registrar", err.response?.data ?? "Não foi possível registrar a movimentação.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex h-screen p-4 bg-primary justify-content-center align-items-center">
            {step === "login" && (
                <form
                    ref={loginFormRef}
                    className="flex justify-content-center align-items-center text-center bg-white border-round-xl flex-column gap-2 p-5"
                    style={{ width: "100%", maxWidth: "27rem", boxSizing: "border-box" }}
                    onSubmit={login}
                >
                    <ThemeLogo
                        className="p-5 mb-4"
                        alt="TM Hub"
                        style={{ maxHeight: "20dvh", maxWidth: "90%" }}
                    />

                    <span className="text-secondary text-center mb-2">
                        Entre com o mesmo usuário e senha do painel
                    </span>

                    <FloatLabel className="w-full">
                        <InputText
                            id="usuario"
                            className="w-full"
                            value={user}
                            onChange={(e) => setUser(e.target.value)}
                            autoComplete="username"
                            enterKeyHint="next"
                            required
                        />
                        <label htmlFor="usuario">Email ou CPF</label>
                    </FloatLabel>

                    <FloatLabel className="mt-3 w-full">
                        <Password
                            id="senha"
                            className="w-full"
                            inputClassName="w-full"
                            feedback={false}
                            value={pwd}
                            onChange={(e) => setPwd(e.target.value)}
                            onKeyDown={submitOnEnter(loginFormRef)}
                            toggleMask
                            autoComplete="current-password"
                            enterKeyHint="go"
                            required
                        />
                        <label htmlFor="senha">Senha</label>
                    </FloatLabel>

                    {bloqueadoAte && tempoRestante > 0 && (
                        <span className="text-orange-500 text-center mt-2">
                            Bloqueado. Tente novamente em {tempoRestante}s.
                        </span>
                    )}

                    <Button
                        type="submit"
                        label="Entrar"
                        icon="pi pi-sign-in"
                        iconPos="right"
                        className="w-full h-3rem mt-5"
                        disabled={!!(bloqueadoAte && tempoRestante > 0)}
                    />
                </form>
            )}

            {step === "movimentacao" && (
                <div
                    className="flex flex-column bg-white border-round-xl p-4 movimentacao-card"
                    style={{ width: "100%", maxWidth: "27rem", boxSizing: "border-box" }}
                >
                    <div className="flex flex-column align-items-center text-center mb-2">
                        <ThemeLogo
                            alt="TM Hub"
                            style={{ width: "min(220px, 60vw)" }}
                        />
                        <span className="font-bold text-lg text-secondary inter uppercase mt-2">
                            Movimentação de Estoque
                        </span>
                    </div>

                    <Divider className="my-3" />

                    <form
                        ref={movementFormRef}
                        className="flex flex-column gap-4"
                        onSubmit={(e) => { e.preventDefault(); createMovement(); }}
                    >
                        {displayName && (
                            <div className="flex justify-content-between align-items-center">
                                <span>Olá, <b>{displayName}</b></span>
                                <Button type="button" label="Sair" icon="pi pi-sign-out" iconPos="right" text size="small" onClick={logout} />
                            </div>
                        )}

                        {/* Tipo de movimentação: botões centralizados com espaço entre eles */}
                        <SelectButton
                            value={tipo}
                            onChange={(e) => e.value && setTipo(e.value)}
                            options={tipoOptions}
                            className="w-full estoque-tipo-select"
                            allowEmpty={false}
                        />

                        <Button
                            type="button"
                            label="Ler código de barras"
                            icon="pi pi-camera"
                            outlined
                            className="w-full"
                            onClick={() => setScannerVisible(true)}
                        />

                        <Dropdown
                            className="w-full"
                            value={productId}
                            onChange={(e) => setProductId(e.value)}
                            options={products}
                            optionLabel="nome"
                            optionValue="id"
                            placeholder="Qual produto?"
                            filter
                        />

                        <div className={`estoque-atual-wrapper ${selectedProduct ? "estoque-atual-open" : ""}`}>
                            {selectedProduct && (
                                <div className="flex justify-content-between align-items-center gap-3 estoque-atual-box">
                                    <div className="flex flex-column">
                                        <span className="text-secondary text-sm">Estoque atual</span>
                                        <span className="font-medium text-sm">{selectedProduct.nome}</span>
                                    </div>
                                    <Tag
                                        value={`${selectedProduct.quantidade} ${selectedProduct.unidade ?? ""}`}
                                        severity={selectedProduct.quantidade <= selectedProduct.quantidade_minima ? "warning" : "success"}
                                        rounded
                                        className="text-base px-3 py-2"
                                    />
                                </div>
                            )}
                        </div>

                        <FloatLabel className="w-full">
                            <InputNumber
                                id="quantidade"
                                className="w-full"
                                value={quantidade}
                                onValueChange={(e) => setQuantidade(e.value ?? 0)}
                                onKeyDown={submitOnEnter(movementFormRef)}
                                min={1}
                            />
                            <label htmlFor="quantidade">Quantidade</label>
                        </FloatLabel>

                        <FloatLabel className="w-full">
                            <InputTextarea
                                id="observacao"
                                className="w-full"
                                rows={3}
                                value={observacao}
                                onChange={(e) => setObservacao(e.target.value)}
                            />
                            <label htmlFor="observacao">Observação (opcional)</label>
                        </FloatLabel>

                        <Button
                            type="submit"
                            label="Registrar Movimentação"
                            icon="pi pi-send"
                            iconPos="right"
                            className="w-full h-3rem"
                        />
                    </form>
                </div>
            )}

            <BarcodeScanner
                visible={scannerVisible}
                products={products}
                onHide={() => setScannerVisible(false)}
                onProduct={(product) => {
                    setProductId(product.id);
                    setScannerVisible(false);
                    showToast("success", "Produto identificado", `${product.nome} selecionado.`);
                }}
            />
        </div>
    );
};
