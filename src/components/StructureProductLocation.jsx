import { useState } from "react";
import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";

/**
 * Componente para selecionar produtos em um local.
 * Permite selecionar múltiplos produtos com quantidade e metragem.
 */
export function StructureProductLocation({ 
    products, 
    selectedProducts = [], 
    onChange,
    disabled = false
}) {
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [quantidade, setQuantidade] = useState(1);
    const [metragem, setMetragem] = useState(0);
    const [observacao, setObservacao] = useState("");
    const [editingIndex, setEditingIndex] = useState(null);

    // Filtrar produtos disponíveis (não selecionados)
    const availableProducts = products?.filter((product) =>
        !selectedProducts.some((selected, index) => (
            index !== editingIndex && selected.produto_id === product.id
        ))
    ) || [];
    const selectedProduct = products?.find((product) => product.id === selectedProductId);

    const resetEditor = () => {
        setSelectedProductId(null);
        setQuantidade(1);
        setMetragem(0);
        setObservacao("");
        setEditingIndex(null);
    };

    const handleAddProduct = () => {
        if (!selectedProduct) return;

        const newProduct = {
            ...(editingIndex !== null ? selectedProducts[editingIndex] : {}),
            produto_id: selectedProduct.id,
            produto: selectedProduct,
            quantidade_desejada: quantidade,
            metragem_disponivel: metragem,
            observacao,
        };

        onChange(editingIndex === null
            ? [...selectedProducts, newProduct]
            : selectedProducts.map((item, index) => index === editingIndex ? newProduct : item));
        resetEditor();
    };

    const handleRemoveProduct = (index) => {
        onChange(selectedProducts.filter((_, i) => i !== index));
        if (editingIndex === index) resetEditor();
        else if (editingIndex !== null && index < editingIndex) setEditingIndex((current) => current - 1);
    };

    const handleEditProduct = (index) => {
        const item = selectedProducts[index];
        setEditingIndex(index);
        setSelectedProductId(item.produto_id);
        setQuantidade(item.quantidade_desejada ?? 1);
        setMetragem(item.metragem_disponivel ?? 0);
        setObservacao(item.observacao || "");
    };

    return (
        <div className="structure-product-location">
            <div className="structure-product-location__header">
                <h3>Produtos no Local</h3>
                <span className="structure-product-location__count">{selectedProducts.length} produto(s) selecionado(s)</span>
            </div>

            {/* Lista de produtos selecionados */}
            {selectedProducts.length > 0 && (
                <div className="structure-product-location__selected">
                    {selectedProducts.map((item, index) => (
                        <div key={index} className="structure-product-location__item">
                            <div className="structure-product-location__item-info">
                                <strong>{item.produto?.nome || "Produto"}</strong>
                                <small>
                                    Qtd: {item.quantidade_desejada} | 
                                    Metragem: {item.metragem_disponivel || 0}m²
                                    {item.observacao && ` | ${item.observacao}`}
                                </small>
                            </div>
                            <div className="structure-product-location__item-actions">
                                <Button
                                    icon="pi pi-pencil"
                                    text
                                    rounded
                                    onClick={() => handleEditProduct(index)}
                                    disabled={disabled}
                                    aria-label={`Editar ${item.produto?.nome}`}
                                />
                                <Button
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    rounded
                                    onClick={() => handleRemoveProduct(index)}
                                    disabled={disabled}
                                    aria-label={`Remover ${item.produto?.nome}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Formulário para adicionar produto */}
            <div className="structure-product-location__add">
                <div className="structure-product-location__add-header">
                    <span>{editingIndex === null ? "Adicionar produto" : "Editar produto"}</span>
                </div>
                
                <div className="structure-product-location__add-form">
                    <div className="structure-product-location__add-input structure-product-location__add-input--product">
                        <label>Produto</label>
                        <Dropdown
                            value={selectedProductId}
                            options={availableProducts}
                            optionLabel="nome"
                            optionValue="id"
                            filter
                            filterBy="nome"
                            placeholder="Selecione um produto"
                            emptyMessage="Nenhum produto disponível"
                            onChange={(event) => setSelectedProductId(event.value || null)}
                            disabled={disabled || availableProducts.length === 0}
                        />
                    </div>

                    <div className="structure-product-location__add-input">
                        <label>Quantidade desejada</label>
                        <InputNumber
                            value={quantidade}
                            onValueChange={(e) => setQuantidade(e.value)}
                            min={1}
                            placeholder="1"
                            disabled={disabled || !selectedProduct}
                        />
                    </div>

                    <div className="structure-product-location__add-input">
                        <label>Metragem disponível (m²)</label>
                        <InputNumber
                            value={metragem}
                            onValueChange={(e) => setMetragem(e.value)}
                            min={0}
                            step={0.1}
                            placeholder="0"
                            disabled={disabled || !selectedProduct}
                        />
                    </div>

                    <div className="structure-product-location__add-input structure-product-location__add-input--observation">
                        <label>Observação</label>
                        <InputText
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Observações sobre este produto"
                            disabled={disabled || !selectedProduct}
                        />
                    </div>

                    <div className="structure-product-location__add-actions">
                        {editingIndex !== null && <Button
                            label="Cancelar edição"
                            text
                            severity="secondary"
                            onClick={resetEditor}
                            disabled={disabled}
                        />}
                        <Button
                            label={editingIndex === null ? "Adicionar" : "Salvar produto"}
                            icon={editingIndex === null ? "pi pi-plus" : "pi pi-check"}
                            onClick={handleAddProduct}
                            disabled={disabled || !selectedProduct}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
