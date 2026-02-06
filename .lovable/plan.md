

# Plano: Exibir codigo do pedido + nome da revendedora nas Cobrancas de Hoje

## Problema identificado

Quando uma nota e cobrada pela agenda, o sistema gera um `codigo_nota` no formato `NOME DA REVENDEDORA-06022026112222` (nome + timestamp de 14 digitos). Esse codigo longo e confuso e exibido na tela "Cobrancas de Hoje".

Porem, cada nota na agenda de cobranca tem um **codigo do pedido real** (ex: `5271`, `5309`, `5420`), que e o codigo util para o representante.

**Dados reais do banco confirmam o problema:**

| notas_promissorias.codigo_nota (exibido) | cobrancas_agendadas.codigo_nota (real) | Revendedora |
|---|---|---|
| CAMILA CANDIDO DE CARVALHO-06022026112222 | 5271 | CAMILA CANDIDO DE CARVALHO |
| VALDERLANDE LIMA DOS SANTOS-05022026123746 | 5421 | VALDERLANDE LIMA DOS SANTOS |
| GRACIELE MANGABEIRA-05022026105007 | 5376 | GRACIELE MANGABEIRA |

## Solucao

Usar o campo `cobranca_id` da `notas_promissorias` (que referencia `cobrancas_agendadas.id`) para buscar o **codigo do pedido real** e a **revendedora** diretamente da agenda. Exibir apenas essas duas informacoes, sem o codigo gerado longo.

## Alteracoes

### Arquivo 1: `src/pages/CobrancaDiaria.tsx` (visao do representante)

#### 1.1 Expandir a query de lookup existente

A query `cobrancas-agendadas-lookup` (linha 284) ja busca `codigo_nota, revendedora`. Sera adicionado o campo `id` para permitir o lookup reverso via `cobranca_id`.

```text
.select('id, codigo_nota, revendedora')
```

#### 1.2 Criar mapa de cobranca_id -> dados

Novo mapa alem do `revendedoraMap` existente:

```text
cobrancaIdMap: Record<string, { codigo_nota: string, revendedora: string }>
// Chave: id da cobranca_agendada
// Valor: codigo do pedido real + nome da revendedora
```

#### 1.3 Atualizar exibicao em "Cobrancas de Hoje" (linhas 1177-1243)

Logica para determinar o que exibir:

1. Se `nota.cobranca_id` existe e esta no `cobrancaIdMap`: usar o codigo e revendedora do mapa
2. Se `nota.codigo_nota` esta no `revendedoraMap` (codigo curto): usar como esta
3. Se `nota.codigo_nota` tem formato gerado (`NOME-14digitos`): extrair so o nome, sem codigo

Exibicao:

```text
Antes:
  CAMILA CANDIDO DE CARVALHO
  CAMILA CANDIDO DE CARVALHO-06022026112222    (codigo confuso)

Depois:
  CAMILA CANDIDO DE CARVALHO
  Nota 5271                                    (codigo do pedido real)
```

Para notas com codigo curto (ja funcionam bem):

```text
Antes:
  DANIELLE FERREIRA NEVES
  5309

Depois:
  DANIELLE FERREIRA NEVES
  Nota 5309                                    (prefixo "Nota" para clareza)
```

### Arquivo 2: `src/pages/FechamentoDiario.tsx` (visao do admin)

#### 2.1 Mesma expansao da query de lookup (linha 141)

Adicionar `id` ao select da query `cobrancas-agendadas-lookup-fechamento`.

#### 2.2 Criar `cobrancaIdMap`

Mesmo mapa que no CobrancaDiaria.

#### 2.3 Atualizar tabela "Notas do Dia" (linhas 677-710)

A coluna "Codigo" mostrara o codigo do pedido real (ex: `5271`) em vez do codigo gerado longo. A coluna "Revendedora" continuara mostrando o nome corretamente.

Mesma logica: se tem `cobranca_id` no mapa, usa o codigo real. Senao, usa o codigo curto existente ou mostra "-" se for gerado.

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/CobrancaDiaria.tsx` | Expandir query de lookup com `id`, criar cobrancaIdMap, atualizar exibicao das notas |
| `src/pages/FechamentoDiario.tsx` | Mesmas alteracoes para a visao do admin |

## O que NAO sera alterado

- Nenhuma regra de negocio
- Nenhuma tabela no banco de dados
- Nenhum fluxo de cobranca existente
- Apenas a **exibicao** das notas na tela de Fechamento do Dia

