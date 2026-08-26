import { useCallback, useEffect, useState } from "react";
import { socketio } from "../utils/socketio";
import connect from "../utils/request";
import "./edinhos.css";

function formatEdinhos(value) {
  const total = Math.max(0, Number(value) || 0);
  const unit = [[1_000_000_000, "B"], [1_000_000, "M"], [1_000, "K"]]
    .find(([threshold]) => total >= threshold);
  if (!unit) return total.toLocaleString("pt-BR");

  const [threshold, suffix] = unit;
  const compact = total / threshold;
  return `${compact.toLocaleString("pt-BR", { maximumFractionDigits: compact >= 100 ? 0 : 1 })}${suffix}`;
}

export function EdinhoCard() {
  const [total, setTotal] = useState(0);
  const refreshBalance = useCallback(async () => {
    try {
      const day = new Date().toLocaleDateString("en-CA");
      const { data } = await connect.get("/uso/meu-dia", { params: { dia: day } });
      setTotal(Number(data?.saldo_edinhos) || 0);
    } catch {
      // O saldo é complementar ao header; não interrompe a navegação se indisponível.
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(refreshBalance, 0);
    socketio.on("uso_tmhub_update", refreshBalance);
    return () => {
      window.clearTimeout(initialRefresh);
      socketio.off("uso_tmhub_update", refreshBalance);
    };
  }, [refreshBalance]);

  const title = `${total.toLocaleString("pt-BR")} Edinhos`;
  return <div className="edinho-balance" title={title} aria-label={title}>
    <span className="edinho-balance__coin" aria-hidden="true"><img src="/edinho.svg" alt="" /></span>
    <span className="edinho-balance__content"><strong>{formatEdinhos(total)}</strong><small>Edinhos</small></span>
  </div>;
}
