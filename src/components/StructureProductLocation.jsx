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

    // Filtrar produtos disponíveis (não selecionados)
    const availableProducts = products?.filter((product) =>
        !selectedProducts.some((selected) => selected.produto_id === product.id)
    ) || [];
    const selectedProduct = availableProducts.find((product) => product.id === selectedProductId);

    const handleAddProduct = () => {
        if (!selectedProduct) return;

        const newProduct = {
            produto_id: selectedProduct.id,
            produto: selectedProduct,
            quantidade_desejada: quantidade,
            metragem_disponivel: metragem,
            observacao,
        };

        onChange([...selectedProducts, newProduct]);
        
        // Resetar campos
        setSelectedProductId(null);
        setQuantidade(1);
        setMetragem(0);
        setObservacao("");
    };

    const handleRemoveProduct = (index) => {
        onChange(selectedProducts.filter((_, i) => i !== index));
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
                    ))}
                </div>
            )}

            {/* Formulário para adicionar produto */}
            <div className="structure-product-location__add">
                <div className="structure-product-location__add-header">
                    <span>Adicionar produto</span>
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
                        <Button
                            label="Adicionar"
                            icon="pi pi-plus"
                            onClick={handleAddProduct}
                            disabled={disabled || !selectedProduct}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
