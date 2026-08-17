// React
import { useCallback, useEffect, useRef, useState } from "react";
// PrimeReact
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
// Utilitários
import tmOpsRequest from "../../utils/tmOpsRequest";
// Contextos
import { useToast } from "../../contexts/ToastContext";

const EVIDENCE_META = {
  camera: { label: "Câmera", icon: "pi pi-camera" },
  image: { label: "Galeria", icon: "pi pi-images" },
  barcode: { label: "Código de barras", icon: "pi pi-barcode" },
  qrcode: { label: "QR Code", icon: "pi pi-qrcode" },
  signature: { label: "Assinatura", icon: "pi pi-pencil" },
};

// Define formatos aceitos conforme o tipo de evidência solicitado.
function captureFormats(type) {
  return type === "qrcode"
    ? ["qr_code"]
    : [
        "code_128",
        "code_39",
        "code_93",
        "codabar",
        "ean_13",
        "ean_8",
        "itf",
        "upc_a",
        "upc_e",
      ];
}

// Encerra todos os tracks para liberar a câmera ao fechar o componente.
function stopStream(streamRef) {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}

// Coleta foto, QR Code ou assinatura e envia a evidência da tarefa.
export function TaskEvidenceCapture({ task, item, onSaved }) {
  const { showToast } = useToast();
  const galleryInput = useRef(null);
  const videoRef = useRef(null);
  const photoVideoRef = useRef(null);
  const scannerStreamRef = useRef(null);
  const photoStreamRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [scannerType, setScannerType] = useState(null);
  const [manualValue, setManualValue] = useState("");
  const [scannerStatus, setScannerStatus] = useState("");
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [signatureVisible, setSignatureVisible] = useState(false);

  const configurations =
    item.evidencias_configuradas ||
    (item.evidencias || []).map((tipo) => ({ tipo, obrigatoria: true }));
  const collected = item.resposta?.evidencias || [];

  const submit = useCallback(
    async ({ tipo, file, valor }) => {
      setSending(true);
      try {
        const form = new FormData();
        form.append("tipo", tipo);
        if (file) form.append("arquivo", file);
        if (valor) form.append("valor", valor);
        const { data } = await tmOpsRequest.post(
          `/tm-ops/tarefas/${task.id}/respostas/${item.id}/evidencias`,
          form,
        );
        onSaved(data.tarefa);
        setScannerType(null);
        setCameraVisible(false);
        setSignatureVisible(false);
        showToast("success", "Evidência", "Evidência registrada.");
      } catch (error) {
        showToast(
          "error",
          "Evidência",
          error.response?.data || "Não foi possível enviar a evidência.",
        );
      } finally {
        setSending(false);
      }
    },
    [item.id, onSaved, showToast, task.id],
  );

  // Converte o arquivo escolhido no estado usado pelo fluxo de envio.
  const submitFile = (type, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) submit({ tipo: type, file });
  };

  // Inicializa a leitura de QR Code apenas quando esse tipo de evidência é exigido.
  useEffect(() => {
    if (!scannerType || !scannerReady || !videoRef.current) return undefined;
    let stream;
    let frame;
    let active = true;
    const detector =
      "BarcodeDetector" in window
        ? new window.BarcodeDetector({ formats: captureFormats(scannerType) })
        : null;

    const scan = async () => {
      if (!active || !detector || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes[0]?.rawValue) {
          active = false;
          submit({ tipo: scannerType, valor: codes[0].rawValue });
          return;
        }
      } catch {
        // Tenta o próximo quadro da câmera enquanto o diálogo permanece aberto.
      }
      frame = requestAnimationFrame(scan);
    };

    const start = async () => {
      if (!detector) {
        setScannerStatus(
          "Este navegador não oferece leitura automática. Informe o código abaixo.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        scannerStreamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScannerStatus("Aponte a câmera para o código.");
        scan();
      } catch {
        setScannerStatus(
          "Não foi possível acessar a câmera. Confira a permissão ou informe o código.",
        );
      }
    };
    start();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (scannerStreamRef.current === stream) scannerStreamRef.current = null;
    };
  }, [scannerReady, scannerType, submit]);

  // Abre a câmera traseira para capturar fotos quando necessário.
  useEffect(() => {
    if (!cameraVisible || !cameraReady || !photoVideoRef.current) return undefined;
    let stream;
    let active = true;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        photoStreamRef.current = stream;
        if (!active || !photoVideoRef.current) return;
        photoVideoRef.current.srcObject = stream;
        await photoVideoRef.current.play();
        setCameraStatus("Posicione a câmera no ambiente e capture a foto.");
      } catch {
        setCameraStatus(
          "Não foi possível abrir a câmera. Confira a permissão do navegador.",
        );
      }
    };
    start();
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
      if (photoStreamRef.current === stream) photoStreamRef.current = null;
    };
  }, [cameraReady, cameraVisible]);

  // Limpa os fluxos de câmera quando o componente é desmontado.
  useEffect(
    () => () => {
      stopStream(scannerStreamRef);
      stopStream(photoStreamRef);
    },
    [],
  );

  // Transforma o quadro atual da câmera em arquivo para envio.
  const takePhoto = () => {
    const video = photoVideoRef.current;
    const canvas = photoCanvasRef.current;
    if (!video?.videoWidth || !canvas) {
      setCameraStatus(
        "A câmera ainda está sendo preparada. Tente novamente em instantes.",
      );
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          submit({
            tipo: "camera",
            file: new File([blob], `foto-tarefa-${task.id}.jpg`, {
              type: "image/jpeg",
            }),
          });
        }
      },
      "image/jpeg",
      0.9,
    );
  };

  // Dimensiona o canvas conforme a densidade de pixels da tela.
  const prepareSignature = () => {
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const box = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = box.width * ratio;
      canvas.height = box.height * ratio;
      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.strokeStyle = "#174b2a";
    });
  };

  const point = (event) => {
    const box = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  // Inicia o traço da assinatura a partir da posição relativa do ponteiro.
  const startDrawing = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const cursor = point(event);
    const context = canvasRef.current.getContext("2d");
    context.beginPath();
    context.moveTo(cursor.x, cursor.y);
  };
  // Desenha continuamente enquanto o usuário mantém o ponteiro pressionado.
  const draw = (event) => {
    if (!drawingRef.current) return;
    const cursor = point(event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(cursor.x, cursor.y);
    context.stroke();
  };
  // Serializa a assinatura do canvas como imagem antes de enviá-la.
  const saveSignature = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob)
        submit({
          tipo: "signature",
          file: new File([blob], "assinatura.png", { type: "image/png" }),
        });
    }, "image/png");
  };

  if (!configurations.length) return null;
  return (
    <div className="executor-evidence-capture">
      <div className="executor-evidence-heading">
        <strong>Evidências</strong>
        <small>Registre o que foi configurado para esta resposta.</small>
      </div>
      <input
        ref={galleryInput}
        className="executor-visually-hidden"
        type="file"
        accept="image/*"
        onChange={(event) => submitFile("image", event)}
      />
      <div className="executor-evidence-actions">
        {configurations.map((config) => {
          const type = config.tipo;
          const evidence = collected.find((entry) => entry.tipo === type);
          const meta = EVIDENCE_META[type];
          if (!meta) return null;
          return (
            <div
              className={`executor-evidence-action${
                evidence ? " is-recorded" : ""
              }`}
              key={type}
            >
              <Button
                type="button"
                icon={meta.icon}
                className="executor-evidence-icon"
                rounded
                outlined
                loading={sending}
                aria-label={
                  evidence
                    ? `${meta.label} registrada. Toque para substituir.`
                    : `Registrar ${meta.label}`
                }
                title={
                  evidence
                    ? `${meta.label} registrada. Toque para substituir.`
                    : `Registrar ${meta.label}`
                }
                onClick={() => {
                  if (type === "camera") {
                    setCameraStatus("");
                    setCameraReady(false);
                    setCameraVisible(true);
                  } else if (type === "image") galleryInput.current?.click();
                  else if (type === "signature") {
                    setSignatureVisible(true);
                  } else {
                    setManualValue("");
                    setScannerStatus("");
                    setScannerType(type);
                  }
                }}
              />
              {config.obrigatoria && (
                <span
                  className="executor-evidence-required-badge"
                  title="Evidência obrigatória"
                  aria-label="Evidência obrigatória"
                >
                  <i className="pi pi-exclamation" />
                </span>
              )}
              {evidence?.url && (
                <a
                  className="executor-evidence-open"
                  href={`${import.meta.env.VITE_SERVER || ""}${evidence.url}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir ${meta.label} registrada`}
                  title={`Abrir ${meta.label} registrada`}
                >
                  <i className="pi pi-external-link" />
                </a>
              )}
            </div>
          );
        })}
      </div>
      <Dialog
        header={
          scannerType === "qrcode" ? "Ler QR Code" : "Ler código de barras"
        }
        visible={Boolean(scannerType)}
        onShow={() => setScannerReady(true)}
        onHide={() => {
          setScannerReady(false);
          stopStream(scannerStreamRef);
          setScannerType(null);
        }}
        className="executor-capture-dialog"
        modal
      >
        <div className="executor-capture-content">
          <video
            ref={videoRef}
            className="executor-capture-video"
            muted
            playsInline
            autoPlay
          />
          <p>{scannerStatus}</p>
          <div className="executor-manual-code">
            <InputText
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="Digite o código se necessário"
            />
            <Button
              label="Registrar"
              disabled={!manualValue.trim() || sending}
              onClick={() =>
                submit({ tipo: scannerType, valor: manualValue.trim() })
              }
            />
          </div>
        </div>
      </Dialog>
      <Dialog
        header="Tirar foto"
        visible={cameraVisible}
        onShow={() => setCameraReady(true)}
        onHide={() => {
          setCameraReady(false);
          stopStream(photoStreamRef);
          setCameraVisible(false);
        }}
        className="executor-capture-dialog"
        modal
      >
        <div className="executor-capture-content">
          <video
            ref={photoVideoRef}
            className="executor-capture-video"
            muted
            playsInline
            autoPlay
          />
          <canvas ref={photoCanvasRef} className="executor-visually-hidden" />
          <p>{cameraStatus}</p>
          <Button
            label="Capturar foto"
            icon="pi pi-camera"
            loading={sending}
            onClick={takePhoto}
          />
        </div>
      </Dialog>
      <Dialog
        header="Assinatura"
        visible={signatureVisible}
        onHide={() => setSignatureVisible(false)}
        onShow={prepareSignature}
        className="executor-capture-dialog"
        modal
      >
        <div className="executor-signature-content">
          <p>Assine dentro da área abaixo com o dedo, mouse ou caneta.</p>
          <canvas
            ref={canvasRef}
            className="executor-signature-pad"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={() => {
              drawingRef.current = false;
            }}
            onPointerLeave={() => {
              drawingRef.current = false;
            }}
          />
          <div>
            <Button label="Limpar" outlined onClick={prepareSignature} />
            <Button
              label="Salvar assinatura"
              icon="pi pi-check"
              loading={sending}
              onClick={saveSignature}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
