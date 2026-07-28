import './products.css';

import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { FloatLabel } from 'primereact/floatlabel';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Table } from '../../components/tables/Table';
import { DashCard } from '../../components/DashCard';

import { useEffect, useMemo, useState } from 'react';
import connect from '../../utils/request';
import { useLoading } from '../../contexts/LoadingContext';
import { useToast } from '../../contexts/ToastContext';

const PRODUCTS_ENDPOINT = '/estoque/produtos';
const CATEGORIES_ENDPOINT = '/estoque/categorias';

const statusMap = {
    normal: { label: 'Normal', severity: 'success' },
    baixo: { label: 'Baixo Estoque', severity: 'warning' },
    esgotado: { label: 'Esgotado', severity: 'danger' },
};

function statusOf(product) {
    if (!product.quantidade) return 'esgotado';
    if (product.quantidade <= product.quantidade_minima) return 'baixo';
    return 'normal';
}

const emptyForm = {
    id: null,
    nome: '',
    categoria_id: null,
    unidade: '',
    quantidade: 0,
    quantidade_minima: 0,
    local_estoque: '',
};

const unityOptions = [
    { label: 'UN', value: 'UN' },
];

export function Products() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [refresh, setRefresh] = useState(false);

    const [dialogVisible, setDialogVisible] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const isEditing = !!form.id;

    const [catDialogVisible, setCatDialogVisible] = useState(false);
    const [newCategory, setNewCategory] = useState({ nome: '', descricao: '' });

    const setLoading = useLoading();
    const { showToast } = useToast();

    useEffect(() => {
        async function getProducts() {
            setLoading(true);
            try {
                const res = await connect.get(PRODUCTS_ENDPOINT);
                setProducts(res.data ?? []);
            } catch (err) {
                console.warn(err);
                showToast('error', 'Erro!', 'Não foi possível carregar os produtos.');
            } finally {
                setLoading(false);
            }
        }
        getProducts();
    }, [refresh]);

    useEffect(() => {
        async function getCategories() {
            try {
                const res = await connect.get(CATEGORIES_ENDPOINT);
                setCategories(res.data ?? []);
            } catch (err) {
                console.warn(err);
            }
        }
        getCategories();
    }, [refresh]);

    const categoryName = (id) => categories.find((c) => c.id === id)?.nome ?? '-';

    const totals = useMemo(() => ({
        total: products.length,
        baixo: products.filter((p) => statusOf(p) === 'baixo').length,
        esgotado: products.filter((p) => statusOf(p) === 'esgotado').length,
    }), [products]);

    const openCreate = () => {
        setForm(emptyForm);
        setDialogVisible(true);
    };

    const openEdit = (product) => {
        setForm({ ...product });
        setDialogVisible(true);
    };

    const handleSave = async () => {
        if (!form.nome || !form.categoria_id || !form.unidade) {
            showToast('warn', 'Atenção!', 'Preencha nome, categoria e unidade.');
            return;
        }

        setLoading(true);
        try {
            if (isEditing) {
                await connect.patch(PRODUCTS_ENDPOINT, form);
                showToast('success', 'Sucesso!', 'Produto atualizado com sucesso.');
            } else {
                const payload = { ...form };
                delete payload.id;
                await connect.post(PRODUCTS_ENDPOINT, payload);
                showToast('success', 'Sucesso!', 'Produto criado com sucesso.');
            }
            setDialogVisible(false);
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', err.response?.data ?? 'Não foi possível salvar o produto.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = async (product) => {
        setLoading(true);
        try {
            await connect.delete(PRODUCTS_ENDPOINT, { params: { id: product.id } });
            showToast('success', 'Sucesso!', 'Produto excluído com sucesso.');
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', 'Não foi possível excluir o produto.');
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (product) => {
        confirmDialog({
            message: `Deseja realmente excluir "${product.nome}"?`,
            header: 'Confirmar exclusão',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            acceptLabel: 'Excluir',
            rejectLabel: 'Cancelar',
            accept: () => handleDeleteProduct(product),
        });
    };

    const handleAddCategory = async () => {
        if (!newCategory.nome) {
            showToast('warn', 'Atenção!', 'Informe o nome da categoria.');
            return;
        }

        setLoading(true);
        try {
            await connect.post(CATEGORIES_ENDPOINT, newCategory);
            showToast('success', 'Sucesso!', 'Categoria criada com sucesso.');
            setNewCategory({ nome: '', descricao: '' });
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', 'Não foi possível criar a categoria.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCategory = async (category) => {
        setLoading(true);
        try {
            await connect.delete(CATEGORIES_ENDPOINT, { params: { id: category.id } });
            showToast('success', 'Sucesso!', 'Categoria removida com sucesso.');
            setRefresh((prev) => !prev);
        } catch (err) {
            console.warn(err);
            showToast('error', 'Erro!', 'Não foi possível remover a categoria.');
        } finally {
            setLoading(false);
        }
    };

    const table_itens = useMemo(() => ([
        { field: 'nome', header: 'Produto', class: 'text-truncate' },
        {
            header: 'Categoria',
            body: (row) => categoryName(row.categoria_id),
        },
        { field: 'local_estoque', header: 'Local', class: 'text-truncate' },
        { field: 'quantidade', header: 'Estoque' },
        {
            header: 'Status',
            body: (row) => {
                const status = statusMap[statusOf(row)];
                return <Tag value={status.label} severity={status.severity} rounded />;
            },
        },
        {
            header: 'Ações',
            body: (row) => (
                <div className="flex gap-2">
                    <Button icon="pi pi-pencil" rounded text onClick={() => openEdit(row)} tooltip="Editar" />
                    <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => confirmDelete(row)} tooltip="Excluir" />
                </div>
            ),
        },
    ]), [categories]);

    return (
        <main className="flex flex-column gap-3 products-page">
            <ConfirmDialog />

            <div className="products-summary flex flex-wrap gap-2 align-items-center">
                <DashCard
                    title="Total"
                    className="flex-grow-1 border-round-lg p-1 spaceg flex-grow-1"
                    style={{ background: 'var(--primary-color)', color: '#fff', flexBasis: "200px" }}
                    value={totals.total}
                />
                <DashCard
                    title="Estoque Baixo"
                    className="flex-grow-1 border-round-lg p-1 spaceg flex-grow-1"
                    style={{ background: 'var(--yellow-700)', color: '#fff', flexBasis: "200px" }}
                    value={totals.baixo}
                />
                <DashCard
                    title="Esgotados"
                    className="flex-grow-1 border-round-lg p-1 spaceg flex-grow-1"
                    style={{ background: 'var(--red-600)', color: '#fff', flexBasis: "200px" }}
                    value={totals.esgotado}
                />
            </div>
                <div className="products-category-actions flex justify-content-end">
                    <Button icon="pi pi-tags" label="Categorias" outlined onClick={() => setCatDialogVisible(true)} />
                </div>

            <div className="products-table-section flex flex-column overflow-auto">
                <Table
                    data={products}
                    tableClassName="products-table w-full"
                    style={{ width: '100%' }}
                    columns={table_itens}
                    search
                   
                />
            </div>

            <Button
                icon="pi pi-plus"
                size="large"
                className="p-4"
                rounded
                onClick={openCreate}
                style={{ position: 'absolute', right: '20px', bottom: '20px' }}
            />

            <Dialog header={isEditing ? 'Editar Produto' : 'Novo Produto'} visible={dialogVisible} style={{ width: '30rem' }} onHide={() => setDialogVisible(false)}>
                <form className="flex flex-column gap-4 pt-3" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <FloatLabel>
                        <InputText id="nome" className="w-full" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                        <label htmlFor="nome">Nome do produto</label>
                    </FloatLabel>

                    <FloatLabel>
                        <Dropdown
                            id="categoria"
                            className="w-full"
                            value={form.categoria_id}
                            onChange={(e) => setForm({ ...form, categoria_id: e.value })}
                            options={categories}
                            optionLabel="nome"
                            optionValue="id"
                        />
                        <label htmlFor="categoria">Categoria</label>
                    </FloatLabel>

                    <FloatLabel>
                        <Dropdown
                            id="unidade"
                            className="w-full"
                            value={form.unidade}
                            onChange={(e) => setForm({ ...form, unidade: e.value })}
                            options={unityOptions}
                            optionLabel="label"
                            optionValue="value"
                        />
                        <label htmlFor="unidade">Unidade</label>
                    </FloatLabel>

                    <div className="flex gap-3">
                        <div className="w-full">
                            <FloatLabel>
                                <InputNumber id="quantidade" className="w-full" value={form.quantidade} onValueChange={(e) => setForm({ ...form, quantidade: e.value ?? 0 })} min={0} />
                                <label htmlFor="quantidade">Quantidade</label>
                            </FloatLabel>
                        </div>

                        <div className="w-full">
                            <FloatLabel>
                                <InputNumber id="minima" className="w-full" value={form.quantidade_minima} onValueChange={(e) => setForm({ ...form, quantidade_minima: e.value ?? 0 })} min={0} />
                                <label htmlFor="minima">Estoque mínimo</label>
                            </FloatLabel>
                        </div>
                    </div>

                    <FloatLabel>
                        <InputText id="local" className="w-full" value={form.local_estoque} onChange={(e) => setForm({ ...form, local_estoque: e.target.value })} />
                        <label htmlFor="local">Local do estoque</label>
                    </FloatLabel>

                    <Button type="submit" label={isEditing ? 'Salvar alterações' : 'Cadastrar produto'} icon="pi pi-check" />
                </form>
            </Dialog>

            <Dialog header="Categorias" visible={catDialogVisible} style={{ width: '28rem' }} onHide={() => setCatDialogVisible(false)}>
                <div className="flex flex-column gap-3">
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); handleAddCategory(); }}>
                        <InputText className="w-full" placeholder="Nome da categoria" value={newCategory.nome} onChange={(e) => setNewCategory({ ...newCategory, nome: e.target.value })} />
                        <Button type="submit" icon="pi pi-plus" />
                    </form>

                    <ul className="category-list">
                        {categories.map((category) => (
                            <li key={category.id} className="category-item">
                                <span>{category.nome}</span>
                                <Button icon="pi pi-trash" text rounded severity="danger" onClick={() => handleDeleteCategory(category)} />
                            </li>
                        ))}
                    </ul>
                </div>
            </Dialog>
        </main>
    );
}
