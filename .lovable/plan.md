
# Plano: Botao de Desistencia (Devolucao Total do Kit)

## Resumo

Adicionar um botao "Desistencia" na agenda de cobrancas do representante que permite registrar a devolucao total de um kit pela revendedora, cancelando a nota e devolvendo o kit ao estoque do representante.

## Alteracoes Necessarias

### 1. Migracao de Banco de Dados

Adicionar o valor `cancelado` ao enum `status_cobranca`, pois atualmente so existem: pendente, pago, parcial, reagendado, juridico.

```text
ALTER TYPE status_cobranca ADD VALUE 'cancelado';
```

### 2. Cobranca.tsx - Botao "Desistencia" no CobrancaItem

Adicionar no dropdown "Mais opcoes" do componente `CobrancaItem` uma nova opcao "Desistencia" com as seguintes condicoes de visibilidade:

- `kit_entregue_id` preenchido (nota vinculada a um kit)
- `tipo` igual a "kit" (nao e repasse)
- `valor_pago_acumulado` igual a 0 (sem pagamentos registrados)
- `valor_adiantado` igual a 0 (sem adiantamentos)
- `status` diferente de "pago" e "cancelado"

Se qualquer condicao nao for atendida, o botao nao aparece.

### 3. Cobranca.tsx - Modal de Confirmacao

Criar um AlertDialog de confirmacao com a mensagem:

"TEM CERTEZA QUE DESEJA REGISTRAR A DESISTENCIA? Esta acao ira cancelar a nota e devolver o kit para seus kits atribuidos."

Botoes: [Confirmar desistencia] [Cancelar]

### 4. Cobranca.tsx - Mutation de Desistencia

Ao confirmar, executar em sequencia:

1. **Atualizar cobranca**: status = 'cancelado', data_quitacao = data atual (como data_cancelamento)
2. **Reverter kit_estoque**: buscar o kit pelo `kit_entregue_id` -> `kits_entregues.kit_estoque_id`, alterar status de `com_revendedora` para `com_representante`
3. **Registrar observacao**: adicionar na propria cobranca um campo observacoes com "Desistencia registrada em dd/mm/aaaa por [nome do representante]"
4. Invalidar queries relacionadas

### 5. StatusConfig - Novo Status

Adicionar ao objeto `statusConfig` o novo status:

```text
cancelado: { label: 'Cancelado', color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400' }
```

### 6. Filtro da Agenda

A query de cobrancas ja filtra por status `['pendente', 'parcial', 'reagendado']`, entao cobrancas canceladas nao aparecerao na agenda apos a desistencia - comportamento correto.

### 7. GerenciarAgenda.tsx (Admin)

Adicionar o status "cancelado" ao statusConfig do admin para que cobrancas canceladas sejam visiveis com o badge correto na visao administrativa.

## Fluxo Completo

```text
Representante ve cobranca do tipo kit sem pagamentos
  -> Clica em "Mais opcoes" -> "Desistencia"
  -> Modal de confirmacao aparece
  -> Clica em "Confirmar desistencia"
  -> Sistema:
     1. Marca cobranca como cancelada
     2. Reverte kit_estoque para com_representante
     3. Registra historico nas observacoes
  -> Kit volta para tela "Meus Kits" do representante
  -> Cobranca sai da agenda
```

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Adicionar 'cancelado' ao enum status_cobranca |
| src/pages/Cobranca.tsx | Botao desistencia, modal de confirmacao, mutation, statusConfig |
| src/pages/GerenciarAgenda.tsx | Adicionar 'cancelado' ao statusConfig |

## O que NAO muda

- Dados historicos
- Tabelas notas_promissorias, prestacoes_contas
- Fluxo de pagamento completo ou parcial
- DRE
- Kits entregues (registro mantido para historico)
- RLS policies existentes
