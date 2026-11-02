# Guia de Git para o GlobalScholar

Guia prático para trabalhar com o repositório, o GitHub e a automação (CI). Não precisa decorar: volte aqui quando precisar.

## 1. Primeira vez: colocar o projeto no GitHub

Pré-requisitos: [Git](https://git-scm.com/downloads) instalado e uma conta no GitHub.

1. No GitHub, clique em **New repository**. Nome sugerido: `globalscholar-frontend`. Deixe **privado** e **não** marque README, `.gitignore` ou licença (o projeto já tem).
2. No terminal, dentro da pasta do projeto (a que tem o `package.json`):

```bash
git init -b main
git add .
git commit -m "chore: versão inicial do frontend"
git remote add origin https://github.com/SEU-USUARIO/globalscholar-frontend.git
git push -u origin main
```

3. Abra a aba **Actions** no GitHub: o fluxo **CI** começa sozinho. Em ~5 minutos ele deve ficar verde.

> O `.gitignore` já impede o envio de `node_modules`, builds, relatórios de teste, dados da API local e arquivos `.env.local`.
> **Nunca** coloque senhas ou chaves em arquivos versionados.

## 2. Proteger o branch `main` (recomendado)

Em **Settings → Branches → Add branch ruleset** (ou *Branch protection rule*) para `main`:

- **Require a pull request before merging**
- **Require status checks to pass** → marque `Tipos, lint, testes e build` e `Ponta a ponta (Playwright)`
- **Block force pushes**

Assim nada entra no `main` sem passar pelos testes.

## 3. O fluxo do dia a dia

Uma tarefa = um branch = um pull request (PR).

```bash
git switch main
git pull
git switch -c feat/detalhe-candidatura
```

Trabalhe, rode os testes, e faça commits pequenos:

```bash
git status
git add src/features/applications
git commit -m "feat(candidaturas): checklist de documentos no detalhe"
```

Antes de enviar, rode a verificação completa (é o mesmo que o CI faz, menos o ponta a ponta):

```bash
npm run check
```

Envie e abra o PR:

```bash
git push -u origin feat/detalhe-candidatura
```

O GitHub mostra um botão **Compare & pull request**. Preencha o modelo (ele aparece sozinho), espere o CI ficar verde e faça o merge com **Squash and merge**. Depois:

```bash
git switch main
git pull
git branch -d feat/detalhe-candidatura
```

### Nomes de branch

| Prefixo | Uso | Exemplo |
|---|---|---|
| `feat/` | funcionalidade nova | `feat/upload-documentos` |
| `fix/` | correção | `fix/foco-formulario-perfil` |
| `docs/` | só documentação | `docs/contrato-auth` |
| `test/` | só testes | `test/e2e-assistente` |
| `chore/` | manutenção, dependências | `chore/atualiza-next` |

### Mensagens de commit

Formato curto: `tipo(área): o que mudou`, no imperativo ou descritivo, em português.

```
feat(busca): filtros sincronizados com a URL
fix(perfil): foco no primeiro campo com erro
docs(contrato): define erros 422 do perfil
test(api-local): cobre exclusão de candidatura
```

## 4. Quando o CI falha

Abra o PR → **Details** ao lado do check vermelho. Cada etapa tem um nome:

| Etapa que falhou | Rode na sua máquina |
|---|---|
| Tipos | `npm run typecheck` |
| Lint | `npm run lint` (muitos problemas se corrigem com `npx eslint . --fix`) |
| Testes | `npm test` (ou `npm run test:watch` enquanto corrige) |
| Build de produção | `npm run build` |
| Ponta a ponta | `npm run test:e2e` |

Se o ponta a ponta falhar só no CI, baixe o artefato **playwright-report** no final da página da execução,
descompacte e abra o `index.html`: há captura de tela e o *trace* (passo a passo) de cada falha.

## 5. Trabalhando com o seu sócio (backend)

- O contrato da API vive em [`docs/api-contract.md`](./api-contract.md). Toda mudança de contrato entra **por PR** e ele revisa.
- Quando ele mudar algo, atualize o servidor local (`mock-api/server.mjs`) e os testes dele no **mesmo PR**: assim o frontend continua testado contra o contrato vigente.
- Dê a ele acesso em **Settings → Collaborators**.

## 6. Situações comuns

**Mudei arquivos no `main` sem querer criar branch:**

```bash
git switch -c feat/minha-tarefa
```

(as mudanças vão junto para o novo branch.)

**Desfazer o último commit, mantendo as mudanças:**

```bash
git reset --soft HEAD~1
```

**Guardar mudanças para trocar de branch:**

```bash
git stash
```

```bash
git stash pop
```

**Conflito ao atualizar o branch com o `main`:**

```bash
git switch feat/minha-tarefa
git merge main
```

O Git marca os trechos com `<<<<<<<`, `=======` e `>>>>>>>`. Escolha o conteúdo certo, apague as marcas, depois:

```bash
git add .
git commit
```

**Commitei um segredo por engano:** troque a senha/chave **imediatamente** no serviço de origem. Apagar o arquivo em um novo commit não remove do histórico.

## 7. Atualizações de dependências

O Dependabot abre PRs semanais agrupados (`next-react`, `testes`, `outros`). Se o CI ficar verde, pode fazer o merge.
Se falhar, leia o erro antes; atualizações grandes do Next.js costumam exigir ajustes.
