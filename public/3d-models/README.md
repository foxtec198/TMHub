# Modelos 3D do TMHub

Esta pasta contém todos os modelos 3D (GLB) usados no TMHub.

## Estrutura

```
public/3d-models/
├── timo.glb           # Modelo padrão do Timo
├── timo-gold.glb      # Modelo Timo Gold Premium
├── cyber_timo.glb     # Modelo Timo Cyber ( Neon )
└── README_MODELOS.md  # Este arquivo
```

## Como adicionar um novo modelo

### Opção 1: Usando o script de importação
1. Execute `import-3d-model.bat`
2. Digite o nome do modelo (ex: `timo_cyber`)
3. Digite o caminho do arquivo fonte (.glb ou .blend)
4. O script vai copiar/convertar e salvar na pasta correta

### Opção 2: Copiar manualmente
1. Certifique-se que o arquivo está em formato `.glb`
2. Copie para esta pasta (`public/3d-models/`)
3. Renomeie para o nome do modelo (ex: `cyber_timo.glb`)

### Opção 3: Exportar do Blender
1. Abra o arquivo `.blend` no Blender
2. File → Export → glTF 2.0 (.glb)
3. Salve em `C:\Users\Guilherme\Documents\tmhub\public\3d-models\`

## Integração com o Frontend

Os modelos são referenciados no código:

```javascript
// Timo Assistant
skin === "timo_gold" ? "/3d-models/timo-gold.glb" : "/3d-models/timo.glb"

// Marketplace
// Usar o código do produto para encontrar o modelo
```

## Regras de nomenclatura

- Use `snake_case` para nomes compostos
- Não use caracteres especiais
- Mantenha consistência com a categoria (ex: `timo_cyber`, `timo_gold`)

## Deploy

1. Commit as mudanças
2. O Vite vai copiar automaticamente para `dist/`
3. Faça deploy normalmente
