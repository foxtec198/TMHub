export const BARCODE_PREFIX = 'TMH';
const PREVIOUS_BARCODE_PREFIX = 'TMHUB';
const LEGACY_BARCODE_PREFIX = 'TMHUB-PRODUTO';

export function buildProductBarcode(product) {
    return String(product.id);
}

export function isProductBarcode(value) {
    const text = String(value || '').trim();
    return /^\d+$/.test(text)
        || text.startsWith(`${BARCODE_PREFIX}|`)
        || text.startsWith(`${PREVIOUS_BARCODE_PREFIX}|`)
        || text.startsWith(`${LEGACY_BARCODE_PREFIX}?`);
}

export function productIdFromBarcode(value) {
    if (!value) return null;

    const text = String(value).trim();
    if (text.startsWith(`${BARCODE_PREFIX}|`)) {
        const [, id] = text.split('|');
        return id && !Number.isNaN(Number(id)) ? Number(id) : id;
    }

    if (text.startsWith(`${PREVIOUS_BARCODE_PREFIX}|`)) {
        const [, id] = text.split('|');
        return id && !Number.isNaN(Number(id)) ? Number(id) : id;
    }

    if (text.startsWith(`${LEGACY_BARCODE_PREFIX}?`)) {
        const params = new URLSearchParams(text.slice(text.indexOf('?') + 1));
        const id = params.get('id');
        return id && !Number.isNaN(Number(id)) ? Number(id) : id;
    }

    // Compatibilidade com leitores configurados para retornar apenas o ID.
    if (/^\d+$/.test(text)) return Number(text);
    return null;
}
