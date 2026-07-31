import barcodeIllustration from '../../assets/barcode-bro.svg?raw';

export function AnimatedBarcodeIllustration() {
    return (
        <div
            className="barcode-illustration-svg"
            dangerouslySetInnerHTML={{ __html: barcodeIllustration }}
        />
    );
}
