import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { productIdFromBarcode } from './barcode';
import './barcode-scanner.css';

function cameraErrorMessage(error) {
    if (!window.isSecureContext) return 'A câmera exige uma conexão segura (HTTPS ou localhost).';
    if (!navigator.mediaDevices?.getUserMedia) return 'Este navegador não oferece acesso à câmera.';
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
        return 'O acesso à câmera foi bloqueado. Libere a permissão do site e tente novamente.';
    }
    if (error?.name === 'NotReadableError' || error?.name === 'AbortError') {
        return 'A câmera está ocupada por outro aplicativo. Feche-o e tente novamente.';
    }
    if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        return 'Nenhuma câmera disponível foi encontrada neste dispositivo.';
    }
    return `Não foi possível iniciar o leitor${error?.name ? ` (${error.name})` : ''}.`;
}

export function BarcodeScanner({ visible, products, onHide, onProduct }) {
    const scannerTargetRef = useRef(null);
    const handledRef = useRef(false);
    const productsRef = useRef(products);
    const onProductRef = useRef(onProduct);
    const [manualCode, setManualCode] = useState('');
    const [status, setStatus] = useState('Preparando a câmera…');
    const [cameraMounted, setCameraMounted] = useState(false);
    const [cameraLive, setCameraLive] = useState(false);

    useEffect(() => {
        productsRef.current = products;
        onProductRef.current = onProduct;
    }, [onProduct, products]);

    const resolveProduct = useCallback((decodedText) => {
        if (handledRef.current) return;
        const id = productIdFromBarcode(decodedText);
        const product = productsRef.current.find((item) => String(item.id) === String(id));

        if (!product) {
            setStatus('Código reconhecido, mas o produto não foi encontrado.');
            return;
        }

        handledRef.current = true;
        setManualCode('');
        setCameraLive(false);
        setCameraMounted(false);
        onProductRef.current(product);
    }, []);

    useEffect(() => {
        if (!visible || !cameraMounted || !scannerTargetRef.current) return undefined;

        const scannerTarget = scannerTargetRef.current;
        let cancelled = false;
        let quagga;
        handledRef.current = false;
        setStatus('Preparando a câmera…');

        const handleDetected = (result) => {
            const code = result?.codeResult?.code;
            if (code) resolveProduct(code);
        };

        import('@ericblade/quagga2').then(async (module) => {
            quagga = module.default;
            await quagga.init({
                inputStream: {
                    type: 'LiveStream',
                    target: scannerTarget,
                    willReadFrequently: true,
                    constraints: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    area: {
                        top: '18%',
                        right: '5%',
                        bottom: '18%',
                        left: '5%',
                    },
                },
                // O código contém apenas um ID curto e já é alinhado pela faixa da interface.
                // A leitura direta é mais confiável que o localizador para Code 128 pequeno.
                locate: false,
                frequency: 12,
                numOfWorkers: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)),
                decoder: {
                    readers: ['code_128_reader'],
                    multiple: false,
                },
                locator: {
                    halfSample: false,
                    patchSize: 'medium',
                },
                canvas: { createOverlay: false },
            });

            if (cancelled) {
                await quagga.stop();
                return;
            }

            quagga.onDetected(handleDetected);
            quagga.start();
            setCameraLive(true);
            setStatus('Leitor Code 128 ativo. Centralize as barras na faixa verde.');
        }).catch((error) => {
            if (!cancelled) {
                setStatus(`${cameraErrorMessage(error)} Você também pode digitar ou usar um leitor USB abaixo.`);
            }
        });

        return () => {
            cancelled = true;
            setCameraLive(false);
            if (quagga) {
                quagga.offDetected(handleDetected);
                Promise.resolve(quagga.stop()).catch(() => undefined);
            }
            scannerTarget.replaceChildren();
        };
    }, [cameraMounted, resolveProduct, visible]);

    const hideScanner = () => {
        setCameraLive(false);
        setCameraMounted(false);
        onHide();
    };

    return (
        <Dialog
            header="Ler código de barras"
            visible={visible}
            onShow={() => {
                setCameraLive(false);
                setCameraMounted(true);
            }}
            onHide={hideScanner}
            style={{ width: 'min(34rem, 94vw)' }}
            className="barcode-scanner-dialog"
        >
            <div className="barcode-scanner-content">
                <div className={`barcode-camera${cameraLive ? ' is-live' : ''}`}>
                    <div ref={scannerTargetRef} className="barcode-camera-target" />
                    {cameraLive && <span className="barcode-camera-guide" aria-hidden="true" />}
                </div>
                <p className="barcode-scanner-status" role="status">{status}</p>
                <div className="barcode-manual-row">
                    <InputText
                        value={manualCode}
                        onChange={(event) => setManualCode(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && resolveProduct(manualCode)}
                        placeholder="Cole o código ou use o leitor USB"
                        aria-label="Código de barras"
                        autoFocus
                    />
                    <Button type="button" icon="pi pi-arrow-right" label="Usar" onClick={() => resolveProduct(manualCode)} />
                </div>
            </div>
        </Dialog>
    );
}
