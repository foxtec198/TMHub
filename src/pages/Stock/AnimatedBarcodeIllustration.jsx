// Recursos
import barcodeIllustration from '../../assets/barcode-bro.svg?raw';

// Injeta o SVG como marcação para preservar a ilustração original.
export function AnimatedBarcodeIllustration() {
    return (
        <div
            className="barcode-illustration-svg"
            dangerouslySetInnerHTML={{ __html: barcodeIllustration }}
        />
    );
}
