import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { AppIcon } from "../../components/icons/AppIcon";
import { ThemeLogo } from "../../components/ThemeLogo";
import "./notfound.css";

const TIMO_MODEL = "/3d-models/timo.glb?v=current-1";
const SEARCH_INTERVAL_MIN = 22000;
const SEARCH_INTERVAL_RANGE = 9000;

function clearTimers(timers) {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.length = 0;
}

export function NotFound() {
  const navigate = useNavigate();
  const viewerRef = useRef(null);
  const timersRef = useRef([]);
  const [viewerReady, setViewerReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [motion, setMotion] = useState("");

  useEffect(() => {
    let mounted = true;
    import("@google/model-viewer")
      .then(({ ModelViewerElement }) => {
        ModelViewerElement.minimumRenderScale = 1;
        if (mounted) setViewerReady(true);
      })
      .catch(() => {
        if (mounted) setModelFailed(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!viewerReady || !viewerRef.current) return undefined;

    const viewer = viewerRef.current;
    const handleLoad = () => {
      setModelLoaded(true);
      setModelFailed(false);
    };
    const handleError = () => {
      setModelLoaded(false);
      setModelFailed(true);
    };

    setModelLoaded(false);
    setModelFailed(false);
    viewer.addEventListener("load", handleLoad);
    viewer.addEventListener("error", handleError);
    viewer.setAttribute("src", TIMO_MODEL);

    return () => {
      viewer.removeEventListener("load", handleLoad);
      viewer.removeEventListener("error", handleError);
    };
  }, [viewerReady]);

  useEffect(() => {
    if (!modelLoaded || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const sequenceTimers = timersRef.current;
    const schedule = (callback, delay) => {
      const timer = window.setTimeout(callback, delay);
      sequenceTimers.push(timer);
    };

    const finishMotion = () => {
      viewerRef.current?.pause();
      setMotion("");
    };

    const playClip = (name) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      viewer.animationName = name;
      viewer.currentTime = 0;
      viewer.play({ repetitions: 1 });
    };

    const runSearch = () => {
      // A sequência é pontual: cada etapa termina antes da próxima começar.
      setMotion("is-spinning");
      playClip("playful_spin");
      schedule(() => {
        viewerRef.current?.pause();
        setMotion("is-paused");
      }, 1650);
      schedule(() => {
        setMotion("is-looking-left");
        playClip("listening");
      }, 2500);
      schedule(() => {
        setMotion("is-looking-right");
        playClip("listening");
      }, 3900);
      schedule(() => {
        setMotion("is-no");
        playClip("thinking");
      }, 5350);
      schedule(finishMotion, 7050);
    };

    const repeat = () => {
      runSearch();
      schedule(repeat, SEARCH_INTERVAL_MIN + Math.round(Math.random() * SEARCH_INTERVAL_RANGE));
    };

    schedule(repeat, 900);
    return () => clearTimers(sequenceTimers);
  }, [modelLoaded]);

  return (
    <main className="notfound-page">
      <header className="notfound-brand">
        <ThemeLogo />
      </header>

      <section className="notfound-hero" aria-labelledby="notfound-title">
        <span className="notfound-number" aria-hidden="true">4</span>
        <div className={`notfound-timo ${motion}`}>
          <div className={`notfound-timo__model${modelLoaded ? " is-ready" : ""}`}>
            {!modelLoaded && <img className="notfound-timo__poster" src="/timo-poster.png" alt="" aria-hidden="true" />}
            {viewerReady && !modelFailed && (
              <model-viewer
                ref={viewerRef}
                className="notfound-timo__viewer"
                alt="Timo procurando a página solicitada"
                interaction-prompt="none"
                shadow-intensity="1.15"
                shadow-softness=".85"
                exposure="1.05"
                camera-orbit="0deg 80deg 105%"
              />
            )}
          </div>
        </div>
        <span className="notfound-number" aria-hidden="true">4</span>
      </section>

      <section className="notfound-message" aria-live="polite">
        <p className="notfound-kicker">ERRO 404</p>
        <h1 id="notfound-title">Essa página se perdeu no caminho.</h1>
        <p>O Timo procurou por aqui, mas não encontrou a rota que você acessou.</p>
        <Button label="Voltar para o início" icon={<AppIcon name="arrow-left" />} onClick={() => navigate("/")} className="notfound-home-button" />
      </section>
    </main>
  );
}
