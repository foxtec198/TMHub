import { AppIcon } from "../../components/icons/AppIcon";
import { useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";

function taskIdFromQr(value) {
  const match = String(value || "").match(
    /(?:task|tarefa)?\s*[:#/-]?\s*(\d+)/i,
  );
  return match ? Number(match[1]) : null;
}

export function TaskQrScanner({ visible, onHide, onTaskId }) {
  const videoRef = useRef(null);
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState(
    "Aponte a câmera para o QR Code da tarefa.",
  );

  useEffect(() => {
    if (!visible || !videoRef.current) return undefined;
    let stream;
    let animationFrame;
    let active = true;
    const detector =
      "BarcodeDetector" in window
        ? new window.BarcodeDetector({ formats: ["qr_code"] })
        : null;

    const scan = async () => {
      if (!active || !detector || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        const taskId = taskIdFromQr(codes[0]?.rawValue);
        if (taskId) {
          active = false;
          onTaskId(taskId);
          return;
        }
      } catch {
        /* waits for the next camera frame */
      }
      animationFrame = requestAnimationFrame(scan);
    };

    const start = async () => {
      if (!detector) {
        setStatus(
          "Leitura automática de QR não é suportada neste navegador. Informe o código abaixo.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scan();
      } catch {
        setStatus(
          "Não foi possível usar a câmera. Libere a permissão ou informe o código abaixo.",
        );
      }
    };
    start();
    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [visible, onTaskId]);

  const resolveManual = () => {
    const taskId = taskIdFromQr(manualCode);
    if (taskId) onTaskId(taskId);
    else setStatus("Informe um QR válido ou o número da tarefa.");
  };

  return (
    <Dialog
      header="Ler QR Code da tarefa"
      visible={visible}
      onHide={onHide}
      className="executor-qr-dialog"
    >
      <div className="executor-qr-content">
        <video ref={videoRef} muted playsInline className="executor-qr-video" />
        <p>{status}</p>
        <div>
          <InputText
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && resolveManual()}
            placeholder="Número ou código da tarefa"
          />
          <Button
            label="Abrir"
            icon={<AppIcon name="arrow-right" />}
            onClick={resolveManual}
          />
        </div>
      </div>
    </Dialog>
  );
}
