

# Plano: Renomear "Dashboard" para "Painel Geral"

## Contexto

O termo "Dashboard" e um anglicismo que pode nao ser intuitivo para todos os usuarios. A proposta e renomear todos os textos visiveis de "Dashboard" para **"Painel Geral"** (representante/producao) e **"Painel Admin"** (administrador), mantendo as rotas e nomes internos de variaveis/tabelas inalterados para evitar quebras.

## O que sera alterado (apenas textos de exibicao)

### 1. Menu lateral desktop - `src/components/AppSidebar.tsx`

| Antes | Depois |
|---|---|
| `title: "Dashboard"` (representante) | `title: "Painel Geral"` |
| `title: "Dashboard"` (producao) | `title: "Painel Geral"` |
| `title: "Dashboard Admin"` (admin) | `title: "Painel Admin"` |

### 2. Menu mobile - `src/components/MobileDrawer.tsx`

| Antes | Depois |
|---|---|
| `title: 'Dashboard'` (representante) | `title: 'Painel Geral'` |
| `title: 'Dashboard'` (producao) | `title: 'Painel Geral'` |
| `title: 'Dashboard Admin'` (admin) | `title: 'Painel Admin'` |

### 3. Tela de usuarios (admin) - `src/pages/Usuarios.tsx`

| Antes | Depois |
|---|---|
| `Habilitar Dashboard` (label do switch) | `Habilitar Painel Geral` |

### 4. Rotas e nomes internos

As URLs (`/dashboard`, `/dashboard-admin`), nomes de componentes (`Dashboard`, `DashboardAdmin`), variaveis internas (`habilitarDashboard`, `habilitar_dashboard`) e colunas do banco **NAO serao alterados**. Isso garante que nada quebra -- apenas os textos que o usuario ve na tela mudam.

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/components/AppSidebar.tsx` | 3 textos de menu renomeados |
| `src/components/MobileDrawer.tsx` | 3 textos de menu renomeados |
| `src/pages/Usuarios.tsx` | 1 label de switch renomeada |

## O que NAO sera alterado

- URLs/rotas (continuam `/dashboard` e `/dashboard-admin`)
- Nomes de componentes e funcoes
- Variaveis internas e colunas do banco de dados
- Nenhuma logica de negocio
- Nenhuma funcionalidade existente

