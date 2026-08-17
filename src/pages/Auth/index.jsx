// Componentes
import { Button } from "primereact/button";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { Carousel } from "primereact/carousel";

// Utilitários
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import { setAccessToken } from "../../utils/authSession";
import { applyProfileAppearance } from "../../theme/theme";
import { LOGIN_INFORMATIVES } from "./informativos";
import { ThemeLogo } from "../../components/ThemeLogo";

// Estilos
import './main.css'

export function Auth() {
    const [user, setUser] = useState("");
    const [pwd, setPwd] = useState("");
    const [githubCommits, setGithubCommits] = useState([]);
    const [configuredNews, setConfiguredNews] = useState([]);

    const { showToast } = useToast();
    const navigate = useNavigate();
    const setLoading = useLoading();

    // Inicializa o estado lendo direto do LocalStorage para evitar atrasos na renderização
    const [bloqueadoAte, setBloqueadoAte] = useState(() => {
        const salvo = localStorage.getItem("bloqueadoAte");
        return salvo ? parseInt(salvo, 10) : null;
    });

    const [tentativas, setTentativas] = useState(() => {
        const salvas = localStorage.getItem("tentativas");
        return salvas ? parseInt(salvas, 10) : 0;
    });

// Atualiza o cronômetro enquanto o bloqueio estiver ativo.
    useEffect(() => {
        if (!bloqueadoAte) return undefined;

        const atualizarCronometro = () => {
            const agora = Date.now();
            const restante = Math.max(0, Math.ceil((bloqueadoAte - agora) / 1000));

            if (restante === 0) {
                setBloqueadoAte(null);
                setTentativas(0);
                localStorage.removeItem("bloqueadoAte");
                localStorage.removeItem("tentativas");
            }
        };

// Executa imediatamente e depois em intervalos de um segundo.
        atualizarCronometro();
        const interval = setInterval(atualizarCronometro, 1000);

        return () => clearInterval(interval);
    }, [bloqueadoAte]);

    useEffect(() => {
        let active = true;
        let retryTimer;

        const loadGithubUpdates = async (retry = false) => {
            try {
                const { data } = await connect.get("/updates/github", { skipAuth: true });
                if (active) setGithubCommits(Array.isArray(data?.commits) ? data.commits : []);
            } catch {
                // A API responde rápido com o último cache quando o GitHub oscila.
                // Uma tentativa adicional cobre inicialização fria em produção.
                if (!retry && active) retryTimer = window.setTimeout(() => loadGithubUpdates(true), 3500);
            }
        };

        const loadNews = async () => {
            try {
                const { data } = await connect.get("/updates/noticias", { skipAuth: true });
                if (active) setConfiguredNews(Array.isArray(data) ? data : []);
            } catch {
                if (active) setConfiguredNews([]);
            }
        };

        loadGithubUpdates();
        loadNews();
        return () => {
            active = false;
            window.clearTimeout(retryTimer);
        };
    }, []);

    async function setAuth(e) {
        e.preventDefault();
        setLoading(true)

        try {
            if (bloqueadoAte && Date.now() < bloqueadoAte) {
                return showToast("info", "Bloqueio Temporario", "Voce esta temporariamente bloqueado. Tente novamente mais tarde!");
            };

            const res = await connect.post("/login", { username: user, password: pwd });
            setTentativas(0);
            localStorage.removeItem("tentativas");
            localStorage.setItem("display_name", res.data.display_name);
            localStorage.setItem("role", res.data.role);
            localStorage.setItem("gerencia_faltas", res.data.gerencia_faltas ? "true" : "false");
            localStorage.setItem("permissions", JSON.stringify(res.data.permissions || []));
            if (res.data.email) localStorage.setItem("email", res.data.email);
            if (res.data.foto_perfil) localStorage.setItem("profile_photo", res.data.foto_perfil);
            else localStorage.removeItem("profile_photo");
            applyProfileAppearance(res.data);
            setAccessToken(res.data.access_token);
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
            localStorage.setItem("current_id", res.data.id);
            navigate("/init")
        } catch (error) {
            const msg = error.response?.data || "Não foi possível autenticar."
            const isPwdError = msg.toLowerCase().includes("senha")

            if (isPwdError) {
                const novasTentativas = tentativas + 1;
                setTentativas(novasTentativas);
                localStorage.setItem("tentativas", novasTentativas);

                if (novasTentativas >= 3 && isPwdError) {
                    const umMinutoDepois = Date.now() + 60000;
                    setBloqueadoAte(umMinutoDepois);
                    localStorage.setItem("bloqueadoAte", umMinutoDepois);
                    return showToast("info", "Bloqueio Temporario", "Voce esta temporariamente bloqueado. Tente novamente mais tarde!");
                } else {
                    showToast("error", "Senha Incorreta", `Senha incorreta! Tentativa ${novasTentativas} de 3.`);
                }
            } else {
                showToast("error", "Erro no Login", msg);
            }
        }
        finally { setLoading(false) };
    };

    const informativeTemplate = (item) => item.type === "github" ? (
        <article className="auth-informative-slide auth-commits-slide">
            <div className="auth-commits-header">
                <div>
                    <span><i className="pi pi-github" /> Novidades do TM Hub</span>
                    <h2>Últimas atualizações</h2>
                    <p>Alterações publicadas recentemente no frontend e na API.</p>
                </div>
                <span className="auth-live-badge"><i className="pi pi-circle-fill" /> GitHub</span>
            </div>
            <div className="auth-commits-list">
                {item.commits.map((commit) => (
                    <a href={commit.url} target="_blank" rel="noreferrer" key={`${commit.repository}-${commit.sha}`}>
                        <span className={`auth-repo-badge ${commit.repository_label === "API" ? "is-api" : ""}`}>
                            {commit.repository_label}
                        </span>
                        <div>
                            <strong>{commit.message}</strong>
                            <small>{commit.author} · {new Date(commit.date).toLocaleDateString("pt-BR")}</small>
                        </div>
                        <code>{commit.sha}</code>
                    </a>
                ))}
            </div>
        </article>
    ) : (
        <article className="auth-informative-slide" style={{ "--slide-accent": item.accent }}>
            {item.image ? (
                <div className="auth-informative-art-frame">
                    <img className="auth-informative-art" src={item.image} alt={item.title} />
                </div>
            ) : (
                <div className="auth-informative-visual" aria-hidden="true">
                    <ThemeLogo variant="inverse" alt="" />
                    <span><i className={item.icon} /></span>
                </div>
            )}
            <div className="auth-informative-copy">
                <span>{item.eyebrow}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                {item.link && <a className="auth-news-link" href={item.link} target="_blank" rel="noreferrer">Saiba mais <i className="pi pi-arrow-up-right" /></a>}
            </div>
        </article>
    );

    const informativeItems = configuredNews.length ? configuredNews : LOGIN_INFORMATIVES;
    const carouselItems = githubCommits.length
        ? [...informativeItems, { type: "github", commits: githubCommits }]
        : informativeItems;

    return (
        <main className="auth-page">
            <section className="auth-showcase" aria-label="Informativos do TM Hub">
                <Carousel
                    value={carouselItems}
                    itemTemplate={informativeTemplate}
                    numVisible={1}
                    numScroll={1}
                    circular
                    autoplayInterval={6500}
                    className="auth-carousel"
                />
                <span className="auth-showcase-note"><i className="pi pi-megaphone" /> Espaço de comunicados e informativos</span>
            </section>

            <section className="auth-login-panel">
              <form className="auth-login-card" onSubmit={(e) => setAuth(e)}>
                <div className="auth-login-brand">
                    <ThemeLogo />
                    <span>Acesso ao painel executivo</span>
                    <h1>Bem-vindo de volta</h1>
                    <p>Entre com suas credenciais para continuar.</p>
                </div>
                <FloatLabel className="w-full">
                    <InputText
                        className="w-full"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        autoComplete="username"
                        required
                    />
                    <label>Email ou CPF</label>
                </FloatLabel>

                <FloatLabel className="mt-5 w-full">
                    <Password
                        className="w-full"
                        inputClassName="w-full"
                        feedback={false}
                        value={pwd}
                        onChange={(e) => setPwd(e.target.value)}
                        toggleMask
                        autoComplete="current-password"
                        required
                    />
                    <label>Senha</label>
                </FloatLabel>

                <span className="text-accent text-center mt-5">
                    Ainda não tem conta? <strong>Fale com um responsável.</strong>
                </span>

                <Button
                    label="Realizar Login"
                    icon='pi pi-angle-double-up'
                    className="w-full h-3rem"
                />

                <span className="auth-password-help">Esqueceu a senha? Procure um administrador.</span>
              </form>
            </section>
        </main>
    );
};
