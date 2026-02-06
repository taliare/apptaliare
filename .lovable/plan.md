
# Plano: Paginacao na lista de encomendas (10 por pagina)

## Problema

A lista de encomendas mostra todos os registros de uma vez, ficando extensa e poluindo a visualizacao.

## Solucao

Adicionar paginacao client-side com 10 itens por pagina e controles de navegacao (anterior/proximo) no rodape da tabela.

## Alteracoes

### Arquivo: `src/pages/EncomendaProducao.tsx`

1. **Novo estado** para controlar a pagina atual:
   - `const [paginaAtual, setPaginaAtual] = useState(1);`
   - Resetar para pagina 1 quando o filtro de status mudar

2. **Calcular a fatia visivel** das encomendas filtradas:
   - `ITENS_POR_PAGINA = 10`
   - `totalPaginas = Math.ceil(encomendasFiltradas.length / ITENS_POR_PAGINA)`
   - `encomendasPaginadas = encomendasFiltradas.slice((paginaAtual - 1) * 10, paginaAtual * 10)`

3. **Substituir** `encomendasFiltradas.map(...)` por `encomendasPaginadas.map(...)` na tabela

4. **Adicionar controles de paginacao** abaixo da tabela:
   - Texto informativo: "Mostrando X-Y de Z encomendas"
   - Botao "Anterior" (desabilitado na primeira pagina)
   - Indicador de pagina atual / total
   - Botao "Proximo" (desabilitado na ultima pagina)
   - Usar os componentes `Button` ja existentes com icones `ChevronLeft` e `ChevronRight` do lucide-react

5. **Resetar pagina** ao trocar de aba de status (dentro do `onValueChange` do Tabs)

## Resumo

| Arquivo | Alteracao |
|---|---|
| `src/pages/EncomendaProducao.tsx` | Estado de paginacao, fatia de dados, controles de navegacao, reset ao trocar filtro |

## O que NAO muda

- Nenhuma query ou busca de dados (todos os dados continuam sendo carregados)
- Nenhuma funcionalidade existente (acoes, modal, notificacoes)
- Nenhum outro componente ou pagina
- Layout geral da tela
