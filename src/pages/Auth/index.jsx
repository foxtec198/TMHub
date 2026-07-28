// Widgets
import { Button } from "primereact/button";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";

// Utils
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";

// CSS
import './main.css'

export function Auth() {
    const [user, setUser] = useState("");
    const [pwd, setPwd] = useState("");

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

    // useEffect para rodar o cronômetro do bloqueio
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

        // Executa imediatamente e depois a cada 1 segundo
        atualizarCronometro();
        const interval = setInterval(atualizarCronometro, 1000);

        return () => clearInterval(interval);
    }, [bloqueadoAte]);

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
            const theme = res.data.tema === "dark" ? "dark" : "light";
            localStorage.setItem("theme", theme);
            document.documentElement.dataset.theme = theme;
            sessionStorage.setItem("token", res.data.access_token);
            localStorage.setItem("current_id", res.data.id);
            navigate("/init")
        } catch (error) {
            console.log(error)
            const msg = error.response.data
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

    return (
        <div className="flex h-screen p-4 bg-primary justify-content-center align-items-center">
            <form
                style={{ minWidth: '20dvw' }}
                className="flex justify-content-center align-items-center text-center bg-white border-round-xl flex-column gap-2 p-5"
                onSubmit={(e) => setAuth(e)}
            >
                <img
                    className="p-5 mb-4"
                    src="/brands/main_brand.svg"
                    alt="Logo"
                    style={{
                        maxHeight: "20dvh",
                        maxWidth: "65%"
                    }}
                />
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
                    Ainda não tem conta? <a href="">Fale com um Responsavel.</a>
                </span>

                <Button
                    label="Realizar Login"
                    icon='pi pi-angle-double-up'
                    className="w-full h-3rem"
                />

                <a href="" className="text-accent text-center">Esqueci a senha.</a>
            </form>
        </div>
    );
};
