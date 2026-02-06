

# Plano: Adicionar Filtro por Periodo ao Fechamento Diario

## Contexto

A tela de Fechamento Diario atualmente permite visualizar um unico dia por vez, selecionando representante + data. O objetivo e adicionar um modo "Periodo" que consolida os dados de varios dias em uma visao resumida, sem alterar o fechamento diario existente.

## Como vai funcionar

### Dois modos de visualizacao

O admin podera alternar entre:

1. **Dia unico** (modo atual, padrao) -- nada muda
2. **Periodo** (novo) -- exibe totais consolidados de um intervalo de datas

### Comportamento da interface

- Um toggle/botao "Selecionar periodo" aparece ao lado do filtro de data existente
- Ao ativar o modo periodo, o calendario de dia unico e substituido por dois campos de data (inicial e final)
- Ao desativar, volta ao modo diario original
- O filtro de representante continua funcionando normalmente: se nenhum for selecionado, mostra todos; se um for selecionado, filtra apenas ele

### Dados exibidos no modo periodo

Para cada representante (ou o selecionado):

- Nome do representante
- Total cobrado no periodo (soma de `total_cobrado` de `cobrancas_diarias`)
- Total por forma de pagamento (PIX, Dinheiro, Cartao)
- Despesas totais
- Saldo liquido (cobrado - despesas)
- Quantidade de dias com fechamento no periodo
- Media diaria (total / dias)

### Visao consolidada geral

Cards no topo mostrando os totais gerais (todos os representantes ou o selecionado):
- Total PIX, Dinheiro, Cartao, Total Cobrado
- Total Despesas, Saldo Liquido

Abaixo, uma tabela com o resumo por representante.

## Alteracoes tecnicas

### Arquivo: `src/pages/FechamentoDiario.tsx`

#### 1. Novos estados

```text
const [modoPeriodo, setModoPeriodo] = useState(false);
const [periodoInicio, setPeriodoInicio] = useState(''); // YYYY-MM-DD
const [periodoFim, setPeriodoFim] = useState('');       // YYYY-MM-DD
```

#### 2. Nova query para dados do periodo

Busca em `cobrancas_diarias` todos os registros no intervalo de datas. Se um representante estiver selecionado, filtra por ele; senao, traz todos.

```text
queryKey: ['fechamento-periodo', periodoInicio, periodoFim, selectedRepresentante]
queryFn: busca cobrancas_diarias onde data >= periodoInicio AND data <= periodoFim
  (e opcionalmente representante_id = selectedRepresentante)
```

#### 3. Processamento dos dados

Agrupar por `representante_id`:
- Somar `total_cobrado`, `total_pix`, `total_dinheiro`, `total_cartao`, `despesa_cobranca`
- Contar quantidade de dias
- Calcular media diaria

Cruzar com a lista de `representantes` ja carregada para obter os nomes.

#### 4. Interface condicional

- Se `modoPeriodo === false`: renderiza exatamente o que existe hoje (nenhuma mudanca)
- Se `modoPeriodo === true`: renderiza a nova visao consolidada:
  - Cards de totais gerais no topo
  - Tabela com colunas: Representante, Dias, Total Cobrado, PIX, Dinheiro, Cartao, Despesas, Saldo, Media/Dia
  - Linha de totais no rodape da tabela

#### 5. Botao de toggle no header

Ao lado dos filtros existentes, um botao para alternar:

```text
[Dia unico]  [Selecionar periodo]
```

Quando "Selecionar periodo" esta ativo:
- O calendario de dia unico fica oculto
- Aparecem dois inputs de data (inicio e fim)
- O botao muda de estilo para indicar o modo ativo

#### 6. Secoes que NAO aparecem no modo periodo

- Status do dia (finalizado/aberto)
- Tabela de notas individuais
- Tabela de kits entregues
- Acoes do administrador (finalizar/reabrir)

Essas secoes so fazem sentido no contexto de um dia especifico.

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/FechamentoDiario.tsx` | Adicionar toggle de modo, query de periodo, visao consolidada |

## O que NAO sera alterado

- Nenhuma tabela no banco de dados
- Nenhuma logica de fechamento existente
- Nenhuma funcionalidade atual (tudo continua funcionando como antes)
- DRE, KPIs e demais telas
- Nenhuma regra de negocio -- apenas leitura e exibicao de dados existentes

