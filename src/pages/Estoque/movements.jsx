import './movements.css';

import { Table } from '../../components/tables/Table';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { FloatLabel } from 'primereact/floatlabel';
import { Tag } from 'primereact/tag';
import { SelectButton } from 'primereact/selectbutton';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import connect from '../../utils/request';
import { useLoading } from '../../contexts/LoadingContext';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { BarcodeScanner } from './BarcodeScanner';
import { isProductBarcode, productIdFromBarcode } from './barcode';

const MOVEMENTS_ENDPOINT = '/estoque/movimentos';
const PRODUCTS_ENDPOINT = '/estoque/produtos';

const tipoOptions = [
    { label: 'Entrada', value: 'entrada' },
    { label: 'Saída', value: 'saida' },
];

const emptyForm = {
    item_id: null,
    tipo: 'entrada',
    quantidade: 1,
    observacao: '',
};

export function Movements() {
    const [movements, setMovements] = useState([]);
    const [products, setProducts] = useState([]);
    const [refresh, setRefresh] = useState(false);

    const [dialogVisible, setDialogVisible] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [scannerVisible, setScannerVisible] = useState(false);
    const scanBufferRef = useRef('');
    const lastScanKeyRef = useRef(0);

    const setLoading = useLoading();
    const { showToast } = useToast();

    const role = localStorage.getItem('role');
    const isAdmin = role === 'ADMIN';

    const handleDeleteMovement = async (movement) => {
        setLoading(true);
        try {
            await connect.delete(`${MOVEMENTS_ENDPOINT}/${movement.id}`);
            showToast('success', 'Sucesso!', 'Movimentação excluída com sucesso.');
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', 'Não foi possível excluir a movimentação.');
        } finally {
            setLoading(false);
        }
    };

    const confirmDeleteMovement = (movement) => {
        confirmDialog({
            message: `Deseja realmente excluir esta movimentação?`,
            header: 'Confirmar exclusão',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            acceptLabel: 'Excluir',
            rejectLabel: 'Cancelar',
            accept: () => handleDeleteMovement(movement),
        });
    };

    useEffect(() => {
        async function getMovements() {
            setLoading(true);
            try {
                const res = await connect.get(MOVEMENTS_ENDPOINT);
                setMovements(res.data ?? []);
            } catch (err) {
                console.warn(err);
                showToast('error', 'Erro!', 'Não foi possível carregar as movimentações.');
            } finally {
                setLoading(false);
            }
        }
        getMovements();
    }, [refresh]);

    useEffect(() => {
        async function getProducts() {
            try {
                const res = await connect.get(PRODUCTS_ENDPOINT);
                setProducts(res.data ?? []);
            } catch (err) {
                console.warn(err);
            }
        }
        getProducts();
    }, [refresh]);

    const productName = (id) => products.find((p) => p.id === id)?.nome ?? `#${id}`;

    const table_itens = useMemo(() => ([
        {
            field: 'data_hora',
            header: 'Data',
            class: 'text-truncate',
            body: (row) => new Date(row.data_hora).toLocaleString('pt-br', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        },
        {
            field: 'produto',
            header: 'Produto',
            class: 'text-truncate',
            // produto é gravado no momento da movimentação; movimentos antigos (antes dessa
            // coluna existir) ou de produtos já excluídos caem no lookup pela lista atual
            body: (row) => row.produto ?? productName(row.item_id),
        },
        {
            header: 'Tipo',
            body: (row) => <Tag value={row.tipo === 'entrada' ? 'Entrada' : 'Saída'} severity={row.tipo === 'entrada' ? 'success' : 'danger'} rounded />,
        },
        { field: 'quantidade', header: 'Quantidade' },
        { field: 'observacao', header: 'Observação', class: 'text-truncate' },
        { field: 'origem', header: 'Origem' },
        ...(isAdmin ? [{
            header: 'Ações',
            body: (row) => (
                <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => confirmDeleteMovement(row)} tooltip="Excluir" />
            ),
        }] : []),
    ]), [products, isAdmin]);

    const openCreate = () => {
        setForm(emptyForm);
        setDialogVisible(true);
    };

    const openQuickScanner = () => {
        setForm({ ...emptyForm, tipo: null });
        setScannerVisible(true);
    };

    const handleScannedProduct = useCallback((product) => {
        setForm((current) => ({
            ...current,
            item_id: product.id,
            tipo: dialogVisible ? current.tipo : null,
        }));
        setScannerVisible(false);
        setDialogVisible(true);
        showToast('success', 'Produto identificado', `${product.nome} selecionado.`);
    }, [dialogVisible, showToast]);

    const handleBarcodeValue = useCallback((value) => {
        if (!isProductBarcode(value)) return false;
        const id = productIdFromBarcode(value);
        if (id === null) return false;

        const product = products.find((item) => String(item.id) === String(id));
        if (!product) {
            showToast('warn', 'Código não reconhecido', 'O produto deste código não foi encontrado.');
            return false;
        }

        handleScannedProduct(product);
        return true;
    }, [handleScannedProduct, products, showToast]);

    useEffect(() => {
        if (scannerVisible) return undefined;

        const handleKeyDown = (event) => {
            if (event.ctrlKey || event.altKey || event.metaKey) return;

            const now = performance.now();
            if (event.key === 'Enter' || event.key === 'Tab') {
                const value = scanBufferRef.current;
                scanBufferRef.current = '';
                lastScanKeyRef.current = 0;
                if (value && handleBarcodeValue(value)) event.preventDefault();
                return;
            }

            if (event.key.length !== 1) return;
            if (now - lastScanKeyRef.current > 80) scanBufferRef.current = '';
            scanBufferRef.current += event.key;
            lastScanKeyRef.current = now;
        };

        const handlePaste = (event) => {
            const value = event.clipboardData?.getData('text')?.trim();
            if (value && handleBarcodeValue(value)) event.preventDefault();
        };

        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('paste', handlePaste, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('paste', handlePaste, true);
        };
    }, [handleBarcodeValue, scannerVisible]);

    const handleSave = async () => {
        if (!form.item_id || !form.tipo || !form.quantidade) {
            showToast('warn', 'Atenção!', 'Selecione o produto, o tipo e a quantidade.');
            return;
        }

        setLoading(true);
        try {
            await connect.post(MOVEMENTS_ENDPOINT, { ...form, origem: 'painel' });
            showToast('success', 'Sucesso!', 'Movimentação registrada com sucesso.');
            setDialogVisible(false);
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', err.response?.data ?? 'Não foi possível registrar a movimentação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex flex-column gap-3 movements-page">
            <ConfirmDialog />
            <div className="flex flex-column">
                <Table data={movements} tableClassName="w-full h-full" style={{ width: '100%', height: '100dvh' }} columns={table_itens} />
            </div>

            <Button
                icon="pi pi-plus"
                size="large"
                className="movement-add-fab"
                rounded
                onClick={openCreate}
                aria-label="Nova movimentação"
                tooltip="Nova movimentação"
            />

            <Button
                icon="pi pi-barcode"
                label="Ler código"
                size="large"
                className="movement-scan-fab"
                rounded
                onClick={openQuickScanner}
                aria-label="Ler código e lançar movimentação"
                tooltip="Ler código e lançar movimentação"
            />

            <Dialog header="Nova Movimentação" visible={dialogVisible} style={{ width: '28rem' }} onHide={() => setDialogVisible(false)}>
                <form className="flex flex-column gap-4 pt-3" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <SelectButton value={form.tipo} onChange={(e) => e.value && setForm({ ...form, tipo: e.value })} options={tipoOptions} className="tipo-select-button w-full" />
                    {!form.tipo && <small className="movement-type-hint">Agora escolha se o produto está entrando ou saindo do estoque.</small>}
                    <Button
                        type="button"
                        label="Ler código de barras"
                        icon="pi pi-camera"
                        outlined
                        onClick={() => setScannerVisible(true)}
                    />
                    <FloatLabel>
                        <Dropdown
                            id="produto"
                            className="w-full"
                            value={form.item_id}
                            onChange={(e) => setForm({ ...form, item_id: e.value })}
                            options={products}
                            optionLabel="nome"
                            optionValue="id"
                            filter
                        />
                        <label htmlFor="produto">Produto</label>
                    </FloatLabel>

                    <FloatLabel>
                        <InputNumber id="quantidade" className="w-full" value={form.quantidade} onValueChange={(e) => setForm({ ...form, quantidade: e.value ?? 0 })} min={1} />
                        <label htmlFor="quantidade">Quantidade</label>
                    </FloatLabel>

                    <FloatLabel>
                        <InputTextarea id="observacao" className="w-full" rows={3} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
                        <label htmlFor="observacao">Observação (opcional)</label>
                    </FloatLabel>

                    <Button type="submit" label="Registrar movimentação" icon="pi pi-check" />
                </form>
            </Dialog>

            <BarcodeScanner
                visible={scannerVisible}
                products={products}
                onHide={() => setScannerVisible(false)}
                onProduct={handleScannedProduct}
            />
        </main>
    );
}
