

# Plano: Corrigir acrescimo por kit individual e restaurar exclusao de entrega

## Problemas Identificados

### Problema 1: Acrescimo aparece "no geral", nao por kit individual

Na tela de Fechamento do Dia, a secao "Entregas de Kits" lista os kits entregues no dia. Porem, cada kit individual na lista **nao tem** um botao para adicionar joias adicionais. A opcao de acrescimo so existe dentro do dialog de **nova entrega** (como secao geral), mas nao aparece como acao individual por kit ja entregue.

**Solucao**: Adicionar um botao "+" (joias adicionais) em cada kit listado na secao "Entregas de Kits", ao lado do botao de excluir. Ao clicar, abre o `ModalRegistrarAcrescimo` para aquele kit especifico.

### Problema 2: Excluir entrega de kit nao funciona

A funcao RPC `reverter_entrega_kit_atomico` tenta deletar registros nesta ordem:
1. Deleta `cobrancas_agendadas` vinculadas ao kit
2. Deleta `kits_entregues`

Porem, com a criacao da tabela `acrescimos_pedido`, existem duas Foreign Keys que bloqueiam a exclusao:

```text
acrescimos_pedido.kit_entregue_id --> kits_entregues.id (sem CASCADE)
acrescimos_pedido.cobranca_id --> cobrancas_agendadas.id (sem CASCADE)
```

Ao tentar excluir, o banco retorna erro de violacao de FK porque existem acrescimos vinculados que precisam ser deletados primeiro.

**Solucao**: Atualizar a funcao RPC `reverter_entrega_kit_atomico` para deletar acrescimos ANTES de deletar cobrancas e o kit.

---

## Alteracoes

### 1. Atualizar funcao RPC `reverter_entrega_kit_atomico` (Migracao SQL)

Adicionar etapa de exclusao dos acrescimos vinculados ao kit, na ordem correta:

```text
Ordem de exclusao:
1. DELETE FROM acrescimos_pedido WHERE kit_entregue_id = p_kit_entregue_id
2. DELETE FROM cobrancas_agendadas WHERE kit_entregue_id = p_kit_entregue_id (ja existe)
3. DELETE FROM kits_entregues WHERE id = p_kit_entregue_id (ja existe)
```

### 2. Adicionar botao de acrescimo por kit na lista de entregas (`CobrancaDiaria.tsx`)

Na secao "Entregas de Kits" (linhas ~1342-1378), cada kit listado atualmente mostra apenas codigo, revendedora e botao de excluir. Alterar para:

- Adicionar um botao `Plus` (cor amber) ao lado do botao de excluir em cada kit
- Ao clicar, buscar o `kit_entregue_id` do kit (ja disponivel no `entrega.id` que vem de `kits_entregues`)
- Abrir o `ModalRegistrarAcrescimo` com os dados daquele kit especifico (id, revendedora, codigo)

---

## Resumo de Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Recriar `reverter_entrega_kit_atomico` com etapa de exclusao de acrescimos |
| `src/pages/CobrancaDiaria.tsx` | Adicionar botao de acrescimo individual por kit na lista de entregas |

---

## Detalhes Tecnicos

### Migracao SQL - reverter_entrega_kit_atomico atualizada

A funcao precisa ser recriada com `CREATE OR REPLACE` adicionando antes da exclusao de cobrancas:

```text
-- NOVO: Deletar acrescimos vinculados ao kit (e suas cobrancas)
DELETE FROM acrescimos_pedido WHERE kit_entregue_id = p_kit_entregue_id;

-- Depois, deletar cobrancas (incluindo tipo 'acrescimo')
DELETE FROM cobrancas_agendadas WHERE kit_entregue_id = p_kit_entregue_id OR (...fallback...);

-- Por fim, deletar o kit_entregue
DELETE FROM kits_entregues WHERE id = p_kit_entregue_id;
```

### CobrancaDiaria.tsx - Botao por kit individual

No mapeamento de `entregasDoDia` (linha ~1343), cada item do kit tera:

```text
[codigo]  [revendedora]  [+ acrescimo] [x excluir]
```

O botao `+` chama:
1. `setCobrancaParaAcrescimo` com dados do kit (id como kit_entregue_id, revendedora, codigo_nota)
2. `setModalAcrescimoOpen(true)`

O `ModalRegistrarAcrescimo` ja esta importado e renderizado no final do JSX, bastando conectar os estados.

