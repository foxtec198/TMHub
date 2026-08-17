// React
import { useEffect, useMemo, useState } from 'react';
// PrimeReact
import { MultiSelect } from 'primereact/multiselect';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
// Utilitários
import connect from '../../utils/request';
// Contextos
import { useLoading } from '../../contexts/LoadingContext';
import { useToast } from '../../contexts/ToastContext';
// Componentes e estilos locais
import { buildProductBarcode } from './barcode';
import { AnimatedBarcodeIllustration } from './AnimatedBarcodeIllustration';
import { PageHeader } from '../../components/PageHeader';
import './barcode_generator.css';

const PRODUCTS_ENDPOINT = '/estoque/produtos';
const fileTypes = [
    { label: 'PDF para impressão', value: 'pdf' },
    { label: 'Imagem PNG', value: 'png' },
];

function truncate(value, max) {
    const text = String(value || '');
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Carrega a imagem auxiliar antes de desenhá-la no PDF.
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

// Remove margens transparentes para aproveitar melhor a etiqueta impressa.
function trimTransparentImage(image) {
    const source = document.createElement('canvas');
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const context = source.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    const { data } = context.getImageData(0, 0, source.width, source.height);
    let left = source.width;
    let top = source.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < source.height; y += 1) {
        for (let x = 0; x < source.width; x += 1) {
            if (data[(y * source.width + x) * 4 + 3] === 0) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }
    }

    if (right < left || bottom < top) return image;
    const trimmed = document.createElement('canvas');
    trimmed.width = right - left + 1;
    trimmed.height = bottom - top + 1;
    trimmed.getContext('2d').drawImage(
        source,
        left,
        top,
        trimmed.width,
        trimmed.height,
        0,
        0,
        trimmed.width,
        trimmed.height,
    );
    return trimmed;
}

// Desenha uma etiqueta completa com código, descrição e elementos visuais.
function drawLabel(page, product, x, y, width, height, bwipjs, assets) {
    const radius = height * .105;
    page.save();
    page.strokeStyle = '#111';
    page.lineWidth = Math.max(3, height * .008);
    page.beginPath();
    page.roundRect(x, y, width, height, radius);
    page.stroke();

    page.imageSmoothingEnabled = true;
    page.imageSmoothingQuality = 'high';
    page.drawImage(assets.fav, x + width * .045, y + height * .055, width * .09, height * .17);

    page.textAlign = 'right';
    page.fillStyle = '#111';
    page.font = `900 ${height * .095}px Arial`;
    const productName = truncate(product.nome, 24);
    const titleX = x + width * .94;
    const titleY = y + height * .145;
    page.fillText(productName, titleX, titleY);
    const titleWidth = page.measureText(productName).width;
    page.lineWidth = Math.max(2, height * .008);
    page.beginPath();
    page.moveTo(titleX - titleWidth, titleY + height * .012);
    page.lineTo(titleX, titleY + height * .012);
    page.stroke();

    page.font = `600 ${height * .072}px Arial`;
    page.fillStyle = '#6b6b6b';
    page.fillText(truncate(product.local_estoque || 'Sem localização', 25), titleX, y + height * .255);

    const barcode = document.createElement('canvas');
    bwipjs.toCanvas(barcode, {
        bcid: 'code128',
        text: buildProductBarcode(product),
        scale: 3,
        height: 20,
        includetext: false,
        // Margem técnica necessária para o localizador identificar o início e o fim do Code 128.
        paddingwidth: 12,
        paddingheight: 4,
    });
    page.imageSmoothingEnabled = false;
    const barcodeMaxWidth = width * .91;
    // IDs curtos geram poucas barras; ampliar até a largura útil melhora a leitura à distância.
    const barcodeWidth = barcodeMaxWidth;
    page.drawImage(
        barcode,
        x + (width - barcodeWidth) / 2,
        y + height * .36,
        barcodeWidth,
        height * .36,
    );

    const footerY = y + height * .81;
    page.imageSmoothingEnabled = true;
    page.drawImage(assets.terceirizeLogo, x + width * .21, footerY, width * .29, height * .1);

    page.strokeStyle = '#444';
    page.lineWidth = Math.max(2, height * .006);
    page.beginPath();
    page.moveTo(x + width * .515, footerY - height * .005);
    page.lineTo(x + width * .515, footerY + height * .11);
    page.stroke();

    page.filter = 'brightness(0)';
    page.imageSmoothingEnabled = true;
    page.drawImage(assets.tmhubLogo, x + width * .54, footerY + height * .005, width * .27, height * .085);
    page.filter = 'none';
    page.restore();
}

// Distribui as etiquetas em páginas A4 conforme a quantidade selecionada.
function renderSheet(items, bwipjs, assets) {
    const page = document.createElement('canvas');
    page.width = 3508;
    page.height = 2480;
    const context = page.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, page.width, page.height);

    const columns = 4;
    const rows = 5;
    const marginX = 154;
    const marginY = 80;
    const gapX = 56;
    const gapY = 34;
    const labelWidth = (page.width - marginX * 2 - gapX * (columns - 1)) / columns;
    const labelHeight = (page.height - marginY * 2 - gapY * (rows - 1)) / rows;

    items.slice(0, columns * rows).forEach((product, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        drawLabel(
            context,
            product,
            marginX + col * (labelWidth + gapX),
            marginY + row * (labelHeight + gapY),
            labelWidth,
            labelHeight,
            bwipjs,
            assets,
        );
    });
    return page;
}

export function BarcodeGenerator() {
    const [products, setProducts] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [fileType, setFileType] = useState('pdf');
    const [copies, setCopies] = useState(1);
    const setLoading = useLoading();
    const { showToast } = useToast();

  // Carrega o catálogo de produtos disponível para geração de etiquetas.
    useEffect(() => {
        setLoading(true);
        connect.get(PRODUCTS_ENDPOINT)
            .then(({ data }) => setProducts(data ?? []))
            .catch(() => showToast('error', 'Erro!', 'Não foi possível carregar os produtos.'))
            .finally(() => setLoading(false));
    }, [setLoading, showToast]);

    const selectedProducts = useMemo(
        () => selectedIds.map((id) => products.find((product) => product.id === id)).filter(Boolean),
        [products, selectedIds],
    );

    const labels = useMemo(
        () => selectedProducts.flatMap((product) => Array.from({ length: copies }, () => product)),
        [selectedProducts, copies],
    );

  // Gera o PDF somente com produtos e quantidades válidas.
    const generate = async () => {
        if (!labels.length) {
            showToast('warn', 'Atenção!', 'Selecione ao menos um produto.');
            return;
        }

        setLoading(true);
        try {
            const [{ default: bwipjs }, { jsPDF }] = await Promise.all([
                import('bwip-js'),
                import('jspdf'),
            ]);
            const [fav, terceirizeLogo, tmhubLogo] = await Promise.all([
                loadImage('/brands/black_fav.png'),
                loadImage('/logo.png').then(trimTransparentImage),
                loadImage('/brands/no_slogan_brand.svg'),
            ]);
            const assets = { fav, terceirizeLogo, tmhubLogo };
            const pages = [];
            for (let index = 0; index < labels.length; index += 20) {
                pages.push(renderSheet(labels.slice(index, index + 20), bwipjs, assets));
            }

            if (fileType === 'png') {
                pages.forEach((page, index) => {
                    const link = document.createElement('a');
                    link.download = `etiquetas-tmhub${pages.length > 1 ? `-${index + 1}` : ''}.png`;
                    link.href = page.toDataURL('image/png');
                    link.click();
                });
            } else {
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                pages.forEach((page, index) => {
                    if (index) pdf.addPage('a4', 'landscape');
                    pdf.addImage(page.toDataURL('image/png'), 'PNG', 0, 0, 297, 210, undefined, 'FAST');
                });
                pdf.save('etiquetas-tmhub.pdf');
            }
            showToast('success', 'Arquivo gerado!', `${labels.length} etiqueta(s) pronta(s) para uso.`);
        } catch (error) {
            console.warn(error);
            showToast('error', 'Erro!', 'Não foi possível gerar as etiquetas.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="barcode-generator-page">
            <PageHeader section="Estoque" title="Gerador de Código de Barras" description="Selecione os produtos conforme a necessidade de geração." />

            <section className="barcode-generator-body">
                <div className="barcode-illustration-area">
                    <div className="barcode-illustration-stage">
                        <span className="barcode-illustration-glow" aria-hidden="true" />
                        <AnimatedBarcodeIllustration />
                    </div>
                    {/* <a className="barcode-illustration-credit" href="https://storyset.com/illustration/barcode/bro" target="_blank" rel="noreferrer">Ilustração por Storyset</a> */}
                </div>

                <div className="barcode-generator-form">
                    <label htmlFor="barcode-products">Produtos</label>
                    <MultiSelect
                        id="barcode-products"
                        value={selectedIds}
                        onChange={(event) => setSelectedIds(event.value)}
                        options={products}
                        optionLabel="nome"
                        optionValue="id"
                        filter
                        display="chip"
                        maxSelectedLabels={3}
                        selectedItemsLabel="{0} produtos selecionados"
                        placeholder="Selecione ao menos um produto"
                        className="w-full"
                    />

                    <div className="barcode-form-row">
                        <div>
                            <label htmlFor="barcode-file-type">Tipo de arquivo</label>
                            <Dropdown id="barcode-file-type" value={fileType} onChange={(event) => setFileType(event.value)} options={fileTypes} className="w-full" />
                        </div>
                        <div>
                            <label htmlFor="barcode-copies">Etiquetas por produto</label>
                            <InputNumber id="barcode-copies" value={copies} onValueChange={(event) => setCopies(event.value ?? 1)} min={1} max={100} showButtons className="w-full" />
                        </div>
                    </div>

                    <div className="barcode-selection-summary">
                        <i className="pi pi-info-circle" />
                        <span>{labels.length ? `${labels.length} etiqueta(s) em ${Math.ceil(labels.length / 20)} página(s)` : 'Cada código inclui nome, ID e localização do produto.'}</span>
                    </div>

                    <Button label="Gerar Código de Barras" icon="pi pi-download" onClick={generate} className="barcode-generate-button" />
                </div>
            </section>
        </main>
    );
}
