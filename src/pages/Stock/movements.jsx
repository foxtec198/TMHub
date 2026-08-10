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
import { MultiSelect } from 'primereact/multiselect';
import { SpeedDial } from 'primereact/speeddial';
import { Tooltip } from 'primereact/tooltip';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import connect from '../../utils/request';
import { useLoading } from '../../contexts/LoadingContext';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { BarcodeScanner } from './BarcodeScanner';
import { PageHeader } from '../../components/PageHeader';
import { isProductBarcode, productIdFromBarcode } from './barcode';
import { can } from '../../utils/permissions';

const MOVEMENTS_ENDPOINT = '/estoque/movimentos';
const ASSET_MOVEMENTS_ENDPOINT = '/estoque/movimentos/ativos';
const PRODUCTS_ENDPOINT = '/estoque/produtos';
const CATEGORIES_ENDPOINT = '/estoque/categorias';

const tipoOptions = [
    { label: 'Entrada', value: 'entrada' },
    { label: 'Saída', value: 'saida' },
];

const emptyForm = {
    id: null,
    item_id: null,
    tipo: 'entrada',
    quantidade: 1,
    observacao: '',
    destinatarios: [],
};

const emptyAssetMovementForm = {
    ativo_id: null,
    centro_custo_destino_id: null,
    local_destino_id: null,
    observacao: '',
};

const movementViewOptions = [
    { label: 'Produtos', value: 'estoque' },
    { label: 'Ativos', value: 'ativos' },
];

export function Movements() {
    const [movements, setMovements] = useState([]);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [employeeOptions, setEmployeeOptions] = useState([]);
    const [assetMovements, setAssetMovements] = useState([]);
    const [assetOptions, setAssetOptions] = useState([]);
    const [costCenterOptions, setCostCenterOptions] = useState([]);
    const [structureLocations, setStructureLocations] = useState([]);
    const [refresh, setRefresh] = useState(false);
    const [movementView, setMovementView] = useState('estoque');

    const [dialogVisible, setDialogVisible] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [movementDetail, setMovementDetail] = useState(null);
    const [assetMovementDialogVisible, setAssetMovementDialogVisible] = useState(false);
    const [assetMovementForm, setAssetMovementForm] = useState(emptyAssetMovementForm);
    const scanBufferRef = useRef('');
    const lastScanKeyRef = useRef(0);
    const employeeSearchTimer = useRef(null);

    const setLoading = useLoading();
    const { showToast } = useToast();

    const role = localStorage.getItem('role');
    const isAdmin = role === 'ADMIN';
    const canCreate = can('estoque_movimentos', 'create');
    const canEdit = can('estoque_movimentos', 'edit');
    const selectedProduct = products.find((product) => product.id === form.item_id);
    const isEpi = categories.find((category) => category.id === selectedProduct?.categoria_id)
        ?.nome?.trim()?.toUpperCase() === 'EPI';
    const selectedAsset = assetOptions.find((asset) => asset.id === assetMovementForm.ativo_id);
    const destinationLocations = structureLocations.filter(
        (location) => location.centro_custo_id === assetMovementForm.centro_custo_destino_id,
    );

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
                const [productsResponse, categoriesResponse] = await Promise.all([
                    connect.get(PRODUCTS_ENDPOINT),
                    connect.get(CATEGORIES_ENDPOINT),
                ]);
                setProducts(productsResponse.data ?? []);
                setCategories(categoriesResponse.data ?? []);
            } catch (err) {
                console.warn(err);
            }
        }
        getProducts();
    }, [refresh]);

    useEffect(() => {
        async function getAssetMovements() {
            try {
                const { data } = await connect.get(ASSET_MOVEMENTS_ENDPOINT);
                setAssetMovements(data?.movimentacoes ?? []);
                setAssetOptions(data?.ativos ?? []);
                setCostCenterOptions(data?.centros_custo ?? []);
                setStructureLocations(data?.locais ?? []);
            } catch (err) {
                console.warn(err);
                showToast(
                    'error',
                    'Movimentações de ativos',
                    err.response?.data ?? 'Não foi possível carregar as movimentações de ativos.',
                );
            }
        }
        getAssetMovements();
    }, [refresh, showToast]);

    const productName = (id) => products.find((p) => p.id === id)?.nome ?? `#${id}`;

    const mergeEmployeeOptions = useCallback((items) => {
        setEmployeeOptions((current) => {
            const merged = new Map(current.map((item) => [item.id, item]));
            items.forEach((item) => merged.set(item.id, item));
            return [...merged.values()];
        });
    }, []);

    const searchEmployees = useCallback((query = '') => {
        window.clearTimeout(employeeSearchTimer.current);
        employeeSearchTimer.current = window.setTimeout(async () => {
            try {
                const { data } = await connect.get('/funcionarios', {
                    params: {
                        situacao: 1,
                        com_local: 1,
                        search: query || undefined,
                        limit: 50,
                    },
                });
                mergeEmployeeOptions((data || []).map((employee) => ({
                    ...employee,
                    label: `${employee.matricula} - ${employee.nome}`,
                })));
            } catch (error) {
                showToast('error', 'Colaboradores', error.response?.data || 'Não foi possível pesquisar colaboradores.');
            }
        }, query ? 300 : 0);
    }, [mergeEmployeeOptions, showToast]);

    useEffect(() => () => window.clearTimeout(employeeSearchTimer.current), []);

    const distributeRecipients = (ids, total) => {
        if (!ids.length) return [];
        const parsedTotal = Number(total || 0);
        if (parsedTotal < ids.length) return null;
        const base = Math.floor(parsedTotal / ids.length);
        let remainder = parsedTotal % ids.length;
        return ids.map((id) => ({
            colaborador_id: id,
            quantidade: base + (remainder-- > 0 ? 1 : 0),
        }));
    };

    const selectRecipients = (ids) => {
        const distributed = distributeRecipients(ids, form.quantidade);
        if (distributed === null) {
            showToast('warn', 'Quantidade insuficiente', 'A quantidade total deve ser ao menos igual ao número de colaboradores.');
            return;
        }
        setForm((current) => ({ ...current, destinatarios: distributed }));
    };

    const changeTotalQuantity = (quantity) => {
        const ids = form.destinatarios.map((item) => item.colaborador_id);
        const distributed = distributeRecipients(ids, quantity);
        setForm((current) => ({
            ...current,
            quantidade: quantity,
            destinatarios: distributed === null ? current.destinatarios : distributed,
        }));
    };

    const changeRecipientQuantity = (employeeId, quantity) => {
        setForm((current) => ({
            ...current,
            destinatarios: current.destinatarios.map((item) => (
                item.colaborador_id === employeeId ? { ...item, quantidade: quantity || 0 } : item
            )),
        }));
    };

    const recipientOption = (employeeId) => employeeOptions.find((item) => item.id === employeeId);
    const recipientTotal = form.destinatarios.reduce((total, item) => total + Number(item.quantidade || 0), 0);

    function openEdit(movement) {
        const options = (movement.destinatarios || []).map((recipient) => ({
            id: recipient.colaborador_id,
            centro_id: recipient.centro_custo_id,
            centro_local: recipient.local,
            label: recipient.colaborador,
        }));
        mergeEmployeeOptions(options);
        setForm({
            id: movement.id,
            item_id: movement.item_id,
            tipo: movement.tipo,
            quantidade: movement.quantidade,
            observacao: movement.observacao || '',
            destinatarios: (movement.destinatarios || []).map((recipient) => ({
                colaborador_id: recipient.colaborador_id,
                quantidade: recipient.quantidade,
            })),
        });
        setDialogVisible(true);
    }

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
        {
            header: 'Destinatários',
            body: (row) => row.destinatarios?.length
                ? <Button label={`${row.destinatarios.length} colaborador(es)`} icon="pi pi-users" text onClick={() => setMovementDetail(row)} />
                : <span className="text-color-secondary">—</span>,
        },
        { field: 'observacao', header: 'Observação', class: 'text-truncate' },
        { field: 'origem', header: 'Origem' },
        ...((canEdit || isAdmin) ? [{
            header: 'Ações',
            body: (row) => (
                <div className="flex gap-1">
                    {canEdit && <Button icon="pi pi-pencil" rounded text onClick={() => openEdit(row)} tooltip="Editar" />}
                    {isAdmin && <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => confirmDeleteMovement(row)} tooltip="Excluir" />}
                </div>
            ),
        }] : []),
    ]), [products, isAdmin, canEdit]);

    const assetTableItems = useMemo(() => ([
        {
            field: 'data_hora',
            header: 'Data',
            class: 'text-truncate',
            body: (row) => new Date(row.data_hora).toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }),
        },
        {
            field: 'ativo',
            header: 'Ativo',
            body: (row) => (
                <div className="asset-movement-item">
                    <strong>{row.ativo}</strong>
                    <span>{row.patrimonio} · {row.categoria}</span>
                </div>
            ),
        },
        {
            field: 'tipo',
            header: 'Movimento',
            body: (row) => (
                <Tag
                    value={row.tipo === 'carga_inicial' ? 'Carga inicial' : 'Transferência'}
                    severity={row.tipo === 'carga_inicial' ? 'info' : 'success'}
                    rounded
                />
            ),
        },
        {
            field: 'origem',
            header: 'Origem',
            body: (row) => (
                <div className="asset-movement-place">
                    <strong>{row.origem || 'Carga inicial'}</strong>
                    {row.local_origem && <span>{row.local_origem}</span>}
                </div>
            ),
        },
        {
            field: 'destino',
            header: 'Destino',
            body: (row) => (
                <div className="asset-movement-place">
                    <strong>{row.destino}</strong>
                    {row.local_destino && <span>{row.local_destino}</span>}
                </div>
            ),
        },
        { field: 'responsavel', header: 'Responsável', class: 'text-truncate' },
        { field: 'observacao', header: 'Observação', class: 'text-truncate' },
    ]), []);

    const openCreate = () => {
        setForm(emptyForm);
        setEmployeeOptions([]);
        setDialogVisible(true);
    };

    const openAssetMovement = () => {
        setAssetMovementForm(emptyAssetMovementForm);
        setAssetMovementDialogVisible(true);
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
        if (form.tipo === 'saida' && isEpi && !form.destinatarios.length) {
            showToast('warn', 'Destinatários obrigatórios', 'Selecione quem recebeu o EPI.');
            return;
        }
        if (form.destinatarios.length && recipientTotal !== form.quantidade) {
            showToast('warn', 'Distribuição inválida', 'A soma das quantidades por colaborador deve ser igual à quantidade total.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                item_id: form.item_id,
                tipo: form.tipo,
                quantidade_total: form.quantidade,
                observacao: form.observacao,
                origem: 'painel',
                destinatarios: form.tipo === 'saida' ? form.destinatarios : [],
            };
            if (form.id) {
                await connect.patch(`${MOVEMENTS_ENDPOINT}/${form.id}`, payload);
            } else {
                await connect.post(MOVEMENTS_ENDPOINT, payload);
            }
            showToast('success', 'Sucesso!', form.id ? 'Movimentação atualizada com sucesso.' : 'Movimentação registrada com sucesso.');
            setDialogVisible(false);
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', err.response?.data ?? 'Não foi possível registrar a movimentação.');
        } finally {
            setLoading(false);
        }
    };

    const handleAssetMovementSave = async () => {
        if (!assetMovementForm.ativo_id || !assetMovementForm.centro_custo_destino_id) {
            showToast('warn', 'Atenção!', 'Selecione o ativo e o contrato de destino.');
            return;
        }

        setLoading(true);
        try {
            const { data } = await connect.post(
                ASSET_MOVEMENTS_ENDPOINT,
                assetMovementForm,
            );
            showToast('success', 'Movimentação de ativo', data.message);
            setAssetMovementDialogVisible(false);
            setMovementView('ativos');
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast(
                'error',
                'Movimentação de ativo',
                err.response?.data ?? 'Não foi possível movimentar o ativo.',
            );
        } finally {
            setLoading(false);
        }
    };

    const speedDialItems = [
        {
            label: 'Movimentar ativo',
            icon: 'pi pi-building',
            command: openAssetMovement,
        },
        {
            label: 'Ler código',
            icon: 'pi pi-barcode',
            command: openQuickScanner,
        },
        {
            label: 'Movimentar estoque',
            icon: 'pi pi-box',
            command: openCreate,
        },
    ];

    return (
        <main className="flex flex-column gap-3 movements-page">
            <ConfirmDialog />
            <PageHeader section="Estoque" title="Movimentações" description="Acompanhe entradas, saídas e transferências de ativos entre contratos." />
            <div className="flex justify-content-end">
                <SelectButton
                    value={movementView}
                    options={movementViewOptions}
                    optionLabel="label"
                    optionValue="value"
                    allowEmpty={false}
                    onChange={(event) => setMovementView(event.value)}
                    aria-label="Alternar entre movimentações de produtos e ativos"
                />
            </div>
            <div className="flex flex-column movement-table-area">
                <Table
                    data={movementView === 'estoque' ? movements : assetMovements}
                    tableClassName="w-full h-full"
                    style={{ width: '100%', height: 'calc(100dvh - 250px)' }}
                    columns={movementView === 'estoque' ? table_itens : assetTableItems}
                />
            </div>

            {canCreate && (
                <div className="movement-speed-dial">
                    <Tooltip target=".movement-speed-dial .p-speeddial-action" position="left" showDelay={150} />
                    <SpeedDial
                        model={speedDialItems}
                        type="quarter-circle"
                        direction="up-left"
                        radius={132}
                        showIcon="pi pi-plus"
                        hideIcon="pi pi-times"
                        aria-label="Ações de movimentação"
                    />
                </div>
            )}

            <Dialog header={form.id ? 'Editar Movimentação' : 'Nova Movimentação'} visible={dialogVisible} className="movement-dialog" onHide={() => setDialogVisible(false)}>
                <form className="flex flex-column gap-4 pt-3" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <SelectButton
                        value={form.tipo}
                        onChange={(e) => e.value && setForm({
                            ...form,
                            tipo: e.value,
                            destinatarios: e.value === 'entrada' ? [] : form.destinatarios,
                        })}
                        options={tipoOptions}
                        className="tipo-select-button w-full"
                    />
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
                            onChange={(e) => setForm({ ...form, item_id: e.value, destinatarios: [] })}
                            options={products}
                            optionLabel="nome"
                            optionValue="id"
                            filter
                        />
                        <label htmlFor="produto">Produto</label>
                    </FloatLabel>

                    <FloatLabel>
                        <InputNumber id="quantidade" className="w-full" value={form.quantidade} onValueChange={(e) => changeTotalQuantity(e.value ?? 0)} min={1} />
                        <label htmlFor="quantidade">Quantidade</label>
                    </FloatLabel>

                    {form.tipo === 'saida' && (
                        <section className="movement-recipients">
                            <div className="movement-recipients-heading">
                                <div>
                                    <strong>Destinatários da saída</strong>
                                    <span>O local é obtido automaticamente do cadastro atual.</span>
                                </div>
                                <Tag
                                    value={`${recipientTotal}/${form.quantidade}`}
                                    severity={recipientTotal === form.quantidade ? 'success' : 'warning'}
                                />
                            </div>
                            <MultiSelect
                                value={form.destinatarios.map((item) => item.colaborador_id)}
                                options={employeeOptions}
                                optionLabel="label"
                                optionValue="id"
                                filter
                                filterBy="label"
                                onFilter={(event) => searchEmployees(event.filter)}
                                onShow={() => searchEmployees('')}
                                onChange={(event) => selectRecipients(event.value || [])}
                                placeholder="Pesquise por nome ou matrícula"
                                selectedItemsLabel="{0} colaboradores selecionados"
                                emptyFilterMessage="Nenhum colaborador ativo encontrado"
                                display="chip"
                                className="w-full"
                            />
                            <div className="movement-recipient-list">
                                {form.destinatarios.map((recipient) => {
                                    const employee = recipientOption(recipient.colaborador_id);
                                    return (
                                        <article key={recipient.colaborador_id}>
                                            <div>
                                                <strong>{employee?.label || `#${recipient.colaborador_id}`}</strong>
                                                <span><i className="pi pi-map-marker" /> {employee?.centro_local || employee?.local || 'Local vinculado no cadastro'}</span>
                                            </div>
                                            <InputNumber
                                                value={recipient.quantidade}
                                                onValueChange={(event) => changeRecipientQuantity(recipient.colaborador_id, event.value)}
                                                min={1}
                                                showButtons
                                                buttonLayout="horizontal"
                                                decrementButtonIcon="pi pi-minus"
                                                incrementButtonIcon="pi pi-plus"
                                            />
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    <FloatLabel>
                        <InputTextarea id="observacao" className="w-full" rows={3} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
                        <label htmlFor="observacao">Observação (opcional)</label>
                    </FloatLabel>

                    <Button type="submit" label={form.id ? 'Salvar alterações' : 'Registrar movimentação'} icon="pi pi-check" />
                </form>
            </Dialog>

            <Dialog
                header="Movimentar ativo"
                visible={assetMovementDialogVisible}
                className="movement-dialog asset-movement-dialog"
                onHide={() => setAssetMovementDialogVisible(false)}
            >
                <form
                    className="asset-movement-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        handleAssetMovementSave();
                    }}
                >
                    <FloatLabel>
                        <Dropdown
                            id="asset-movement-asset"
                            value={assetMovementForm.ativo_id}
                            options={assetOptions}
                            optionLabel="label"
                            optionValue="id"
                            filter
                            filterBy="label,categoria,origem"
                            className="w-full"
                            onChange={(event) => setAssetMovementForm({
                                ...emptyAssetMovementForm,
                                ativo_id: event.value,
                            })}
                            emptyFilterMessage="Nenhum ativo encontrado no escopo selecionado"
                        />
                        <label htmlFor="asset-movement-asset">Ativo</label>
                    </FloatLabel>

                    {selectedAsset && (
                        <div className="asset-current-location">
                            <span><small>Patrimônio</small><strong>{selectedAsset.patrimonio}</strong></span>
                            <span><small>Origem atual</small><strong>{selectedAsset.origem}</strong></span>
                            <span><small>Local atual</small><strong>{selectedAsset.local || 'Sem local definido'}</strong></span>
                        </div>
                    )}

                    <FloatLabel>
                        <Dropdown
                            id="asset-movement-destination"
                            value={assetMovementForm.centro_custo_destino_id}
                            options={costCenterOptions}
                            optionLabel="label"
                            optionValue="id"
                            filter
                            className="w-full"
                            onChange={(event) => setAssetMovementForm((current) => ({
                                ...current,
                                centro_custo_destino_id: event.value,
                                local_destino_id: null,
                            }))}
                        />
                        <label htmlFor="asset-movement-destination">Contrato de destino</label>
                    </FloatLabel>

                    <FloatLabel>
                        <Dropdown
                            id="asset-movement-location"
                            value={assetMovementForm.local_destino_id}
                            options={destinationLocations}
                            optionLabel="nome"
                            optionValue="id"
                            showClear
                            disabled={!assetMovementForm.centro_custo_destino_id}
                            className="w-full"
                            placeholder="Sem local definido"
                            onChange={(event) => setAssetMovementForm((current) => ({
                                ...current,
                                local_destino_id: event.value,
                            }))}
                        />
                        <label htmlFor="asset-movement-location">Local de destino</label>
                    </FloatLabel>

                    <FloatLabel>
                        <InputTextarea
                            id="asset-movement-observation"
                            value={assetMovementForm.observacao}
                            rows={3}
                            className="w-full"
                            onChange={(event) => setAssetMovementForm((current) => ({
                                ...current,
                                observacao: event.target.value,
                            }))}
                        />
                        <label htmlFor="asset-movement-observation">Observação (opcional)</label>
                    </FloatLabel>

                    <Button
                        type="submit"
                        label="Confirmar movimentação"
                        icon="pi pi-arrow-right-arrow-left"
                    />
                </form>
            </Dialog>

            <Dialog
                header="Detalhes da movimentação"
                visible={Boolean(movementDetail)}
                className="movement-detail-dialog"
                onHide={() => setMovementDetail(null)}
            >
                {movementDetail && (
                    <div className="movement-detail">
                        <div className="movement-detail-summary">
                            <span><small>Produto</small><strong>{movementDetail.produto}</strong></span>
                            <span><small>Tipo</small><Tag value={movementDetail.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'} severity={movementDetail.tipo === 'entrada' ? 'success' : 'danger'} /></span>
                            <span><small>Quantidade total</small><strong>{movementDetail.quantidade}</strong></span>
                            <span><small>Data</small><strong>{new Date(movementDetail.data_hora).toLocaleString('pt-BR')}</strong></span>
                            <span><small>Responsável</small><strong>{movementDetail.responsavel}</strong></span>
                        </div>
                        <div className="movement-detail-recipients">
                            <h3>Colaboradores destinatários</h3>
                            {(movementDetail.destinatarios || []).map((recipient) => (
                                <article key={recipient.id}>
                                    <div><strong>{recipient.colaborador}</strong><span>{recipient.local}</span></div>
                                    <Tag value={`${recipient.quantidade} unidade(s)`} severity="info" />
                                </article>
                            ))}
                        </div>
                    </div>
                )}
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
