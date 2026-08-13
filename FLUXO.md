# Fluxo de desenvolvimento e entrega

Este documento vale para o frontend **TM Hub** e para a **API TM Hub**.

## Papéis e branches

| Papel | Responsabilidade |
| --- | --- |
| Colaborador | Trabalha em branch própria e abre Pull Request para `dev`. |
| Responsável técnico | Revisa, aprova ou reprova PRs destinados a `dev`. |
| Dono do projeto | Trabalha e integra em `dev`; promove `dev` para `main` após validar a release. |

| Branch | Uso |
| --- | --- |
| `main` | Produção. Push dispara o deploy automático. |
| `dev` | Integração e homologação. |
| `feat/*`, `fix/*`, `update/*`, `chore/*`, `hotfix/*` | Atividades isoladas. |

> Colaboradores não enviam alterações diretamente para `dev` ou `main`. Isso
> preserva a revisão obrigatória por Pull Request.

## 1. Iniciar uma atividade

O script exige uma árvore limpa, sincroniza a base com `origin/dev` usando
`pull --ff-only` e cria uma branch padronizada.

### Frontend

```powershell
npm.cmd run work:new -- -Type feat -Name "melhora central de chamados"
```

### Backend

```powershell
.\scripts\new-work.ps1 -Type fix -Name "corrige regra de filial"
```

Tipos aceitos: `feat`, `fix`, `update`, `chore` e `hotfix`.

## 2. Desenvolver e validar

- Não altere `.env`, credenciais, tokens ou arquivos de produção.
- Preserve mudanças de outros colaboradores que já estejam no repositório.
- Para telas autenticadas, valide permissão, filial e comportamento em modo claro/escuro.
- Para mudanças de dados, valide a transação e o evento WebSocket correspondente.

### Validações mínimas

```powershell
# Frontend
npm.cmd run build

# Backend
.\venv\Scripts\python.exe -m compileall -q app.py routes services models
```

## 3. Enviar para revisão

O script adiciona os arquivos, cria o commit pendente, atualiza a branch por
rebase em `origin/dev`, faz push com `--force-with-lease` e abre o PR para
`dev`. Se o PR já existir, ele só é atualizado.

### Frontend

```powershell
npm.cmd run deploy:pr -- -Message "feat: melhora central de chamados"
```

### Backend

```powershell
.\scripts\deploy-pr.ps1 -Message "fix: corrige regra de filial"
```

Para abrir como rascunho, acrescente `-Draft`.

> Esses comandos **não fazem deploy em produção**. Eles apenas publicam a
> branch e criam/atualizam o PR para `dev`.

## 4. Revisão e promoção

1. O responsável revisa o PR para `dev`.
2. Após aprovação, integra em `dev` e testa a homologação.
3. O dono do projeto promove `dev` para `main` quando a release estiver validada.
4. O push em `main` dispara o GitHub Actions de deploy do respectivo repositório.

## Conflitos

Se o script de envio parar por conflito no rebase:

```powershell
# Resolva os arquivos indicados e então:
git add <arquivos-resolvidos>
git rebase --continue

# Reexecute o script de envio depois da conclusão
```

Para abandonar o rebase e voltar ao estado anterior:

```powershell
git rebase --abort
```

## Primeiro uso na máquina

O GitHub CLI precisa estar autenticado para abrir PRs automaticamente:

```powershell
gh auth login
gh auth status
```
