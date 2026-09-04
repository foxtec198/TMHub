# Cenários do Timo

Esta pasta contém todas as imagens de cenário usadas no Timo Assistant.

## Estrutura

```
public/scenes/
├── workshop.webp      # Oficina padrão
├── orbit.webp         # Observatório
├── garden.webp        # Jardim bioluminescente
├── christmas.webp     # Oficina de Natal
├── halloween.webp     # Noite de Halloween
├── muertos.webp       # Jardim de Cempasúchil
├── cyberpunk.webp     # Escritório futurista com hologramas
└── README.md          # Este arquivo
```

## Como adicionar um novo cenário

### Requisitos:
- Formato: WebP (`.webp`)
- Resolução recomendada: 768x768px ou superior
- Fundo transparente (alpha channel)

### Opção 1: Usar o script de exportação
1. Execute `export-scene.bat`
2. Digite o nome do cenário
3. O script vai criar uma renderização padrão

### Opção 2: Renderizar manualmente no Blender
1. Configure a cena no Blender
2. File → Render → Render Image
3. File → Save As → WebP
4. Salve nesta pasta com nome descritivo

### Opção 3: Importar imagem
1. Tenha sua imagem `.png` ou `.jpg`
2. Converta para WebP (use ferramentas como ImageMagick ou online converters)
3. Copie para esta pasta

## Integração com o Frontend

1. **Adicione ao TimoAssistant** (`src/pages/TimoAssistant/index.jsx`):
```javascript
const BASE_SCENARIOS = [
  // ...
  { id: "seu_cenario", label: "Seu Cenário", description: "Descrição", icon: "icon-name", image: "/scenes/seu_cenario.webp" },
];
```

2. **Adicione ao Marketplace** (`src/pages/Marketplace/index.jsx`):
```javascript
const TIMO_SCENE_ART = {
  // ...
  timo_cenario_seu_cenario: "/scenes/seu_cenario.webp",
};
```

3. **Adicione ao catálogo do backend** (`api_tmhub/services/marketplace.py`):
```python
{"codigo": "timo_cenario_seu_cenario", "nome": "Seu Cenário", "descricao": "Descrição detalhada", "categoria": "timo_cenario", "preco": 500, "destaque": False},
```

## Regras de nomenclatura

- Use `snake_case` para nomes
- Não use caracteres especiais
- Mantenha consistência com a descrição (ex: `cyberpunk`, `christmas`)

## Tamanho recomendado
- **Largura**: 768px mínimo
- **Altura**: 768px (quadrado)
- **Formato**: WebP com compressão medium

## Deploy
1. Commit as mudanças
2. O Vite vai copiar para `dist/` automaticamente
3. Faça deploy normalmente
