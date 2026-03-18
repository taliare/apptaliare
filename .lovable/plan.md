

# Endereço completo + WhatsApp no T2

## O que será feito

1. Adicionar campos de endereço à tabela `t2_revendedoras` (rua, número, complemento, bairro, cep, estado)
2. Atualizar o formulário de cadastro em `T2Revendedoras.tsx` com os novos campos
3. Atualizar o perfil/sheet da revendedora para mostrar endereço completo
4. No `T2Ciclos.tsx`, tornar o nome da revendedora clicável — ao clicar, exibir um Popover/Dialog com dados de endereço e botão de WhatsApp

## Alterações

### 1. Migração SQL — Novos campos na `t2_revendedoras`

Adicionar colunas:
- `endereco_rua` text
- `endereco_numero` text
- `endereco_complemento` text
- `endereco_bairro` text
- `endereco_cep` text
- `endereco_estado` text

(A coluna `cidade` já existe)

### 2. `src/pages/T2Revendedoras.tsx`

- Adicionar campos de endereço no formulário de cadastro (rua, número, complemento, bairro, CEP, estado)
- Exibir endereço completo na sheet de detalhes da revendedora
- Adicionar botão WhatsApp na sheet

### 3. `src/pages/T2Ciclos.tsx`

- Alterar o select de `t2_revendedoras` para incluir os novos campos de endereço + telefone
- Tornar o nome da revendedora no card clicável
- Ao clicar, abrir um Dialog com:
  - Endereço completo
  - Telefone
  - Botão "WhatsApp" que abre `https://wa.me/55{telefone}`

| Arquivo | Mudança |
|---|---|
| Migração SQL | 6 colunas de endereço em `t2_revendedoras` |
| `src/pages/T2Revendedoras.tsx` | Formulário + sheet com endereço e WhatsApp |
| `src/pages/T2Ciclos.tsx` | Nome clicável → dialog com endereço + WhatsApp |

