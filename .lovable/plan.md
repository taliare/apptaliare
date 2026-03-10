

# Filtros de Status na Página Ciclos

## Alteração

### T2Ciclos.tsx

1. **Adicionar estado `statusFilter`** com valor padrão `'todos'`
2. **Remover filtro `.in('status', ['ativo', 'apurado'])` da query** — buscar todos os ciclos do banco
3. **Filtrar no frontend** antes de renderizar: se `statusFilter !== 'todos'`, filtrar `ciclos` pelo status selecionado
4. **Adicionar botões de filtro** (usando `Button` com variant `outline`/`default`) no header, ao lado do botão "Novo Ciclo":
   - Todos | Ativos | Apurados | Encerrados
5. **Atualizar queryKey** para não depender do filtro (dados sempre completos, filtro é visual)

| Alteração | Arquivo |
|-----------|---------|
| Estado de filtro, botões de status, filtro visual no frontend | `T2Ciclos.tsx` |

Nenhuma alteração de banco de dados ou lógica financeira.

