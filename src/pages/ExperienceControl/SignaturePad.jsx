import { AppIcon } from "../../components/icons/AppIcon";
// Assinatura manuscrita
import { useRef, useState } from "react";

import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import "./signature.css";


export function SignaturePad({ label, signed = false, disabled = false, loading = false, onSave }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [visible, setVisible] = useState(false);

  const prepareSignature = () => {
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const box = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(box.width * ratio));
      canvas.height = Math.max(1, Math.floor(box.height * ratio));
      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#174b2a";
    });
  };

  const point = (event) => {
    const box = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const startDrawing = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    const cursor = point(event);
    const context = canvasRef.current.getContext("2d");
    context.beginPath();
    context.moveTo(cursor.x, cursor.y);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const cursor = point(event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(cursor.x, cursor.y);
    context.stroke();
  };

  const saveSignature = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      onSave(new File([blob], "assinatura.png", { type: "image/png" }));
      setVisible(false);
    }, "image/png");
  };

  return <>
    <div className="experience-signature-action">
      <div><strong>{label}</strong><span>{signed ? "Assinatura registrada." : "Assine antes de concluir esta etapa."}</span></div>
      <Button label={signed ? "Substituir assinatura" : "Assinar"} icon={<AppIcon name="pencil" />} outlined disabled={disabled} loading={loading} onClick={() => setVisible(true)} />
    </div>
    <Dialog header="Assinatura" visible={visible} onShow={prepareSignature} onHide={() => setVisible(false)} className="experience-signature-dialog" modal>
      <div className="experience-signature-content">
        <p>Assine dentro da área abaixo com o dedo, mouse ou caneta.</p>
        <canvas ref={canvasRef} className="experience-signature-pad" onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={() => { drawingRef.current = false; }} onPointerLeave={() => { drawingRef.current = false; }} />
        <div>
          <Button label="Limpar" outlined onClick={prepareSignature} />
          <Button label="Salvar assinatura" icon={<AppIcon name="check" />} loading={loading} onClick={saveSignature} />
        </div>
      </div>
    </Dialog>
  </>;
}
