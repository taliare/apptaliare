

## Botao de Ocultar/Exibir Dados no Dashboard Admin

### Objetivo
Replicar o mesmo botao de privacidade (olho) que ja existe no Dashboard do representante, agora no Dashboard Admin, permitindo ocultar todos os valores financeiros e numericos.

---

### Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/DashboardAdmin.tsx` | Adicionar estado, botao, helpers de mascaramento e aplicar em todos os valores |

---

### Implementacao

1. **Imports a adicionar** (linha 8-12): `Eye, EyeOff` do lucide-react e `useEffect` do react

2. **Estado com localStorage** (apos linha 104, junto com os outros estados):
```typescript
const [showValues, setShowValues] = useState(() => {
  const saved = localStorage.getItem('dashboard-admin-show-values');
  return saved !== 'false';
});

useEffect(() => {
  localStorage.setItem('dashboard-admin-show-values', String(showValues));
}, [showValues]);
```
Nota: usa chave `dashboard-admin-show-values` separada do Dashboard do representante para independencia.

3. **Helpers de mascaramento** (junto com os calculos):
```typescript
const mv = (valor: number) => showValues ? formatarValor(valor) : 'R$ *****';
const mn = (valor: number) => showValues ? formatarNumero(valor) : '*****';
```

4. **Botao no hero section** (ao lado do DateRangeFilterPopover, linha ~441-449):
```typescript
<div className="flex items-center gap-2 shrink-0">
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setShowValues(!showValues)}
    className="shrink-0"
    title={showValues ? 'Ocultar valores' : 'Exibir valores'}
  >
    {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
  </Button>
  <DateRangeFilterPopover ... />
</div>
```

---

### Locais que serao mascarados

| Local | Componente/Linha | Antes | Depois (oculto) |
|-------|-----------------|-------|-----------------|
| Card Hoje | linha ~477 | `formatarValor(totalHoje)` | `mv(totalHoje)` |
| Card Total do Periodo | linha ~494 | `formatarValor(totalPeriodo)` | `mv(totalPeriodo)` |
| Despesas no card | linha ~496 | `formatarValor(totalDespesas)` | `mv(totalDespesas)` |
| Resultado no card | linha ~498 | `formatarValor(resultadoPeriodo)` | `mv(resultadoPeriodo)` |
| Card Kits Entregues | linha ~516 | `formatarNumero(totalKits)` | `mn(totalKits)` |
| Card Meta Geral (%) | linha ~534 | `percentualMetaGeral.toFixed(0)%` | `***%` |
| Card Meta Geral (barra) | linha ~536 | `<Progress value=...>` | Ocultar ou zerar |
| Grafico Top 5 (tooltip) | linha ~570 | `formatarValor(value)` | `R$ *****` |
| Grafico Top 5 (eixo X) | linha ~559 | `tickFormatter` | `*****` |
| Estoque total | linha ~648 | `formatarNumero(totalEstoque)` | `mn(totalEstoque)` |
| Producao - Hoje | linha ~685 | `formatarNumero(totalProducaoHoje)` | `mn(...)` |
| Producao - Periodo | linha ~690 | `formatarNumero(producaoPeriodo.length)` | `mn(...)` |
| Producao - Estoque | linha ~695 | `formatarNumero(totalEstoque)` | `mn(...)` |
| Producao - Hoje (collapsible header) | linha ~667 | `formatarNumero(totalProducaoHoje)` | `mn(...)` |
| Meta producao (valores) | linhas ~712-715 | valores e percentual | `*****` e `***%` |
| Meta producao (barra) | linha ~718-721 | `<Progress>` | Ocultar ou zerar |
| Tabela representantes - Meta | linha ~809 | `formatarValor(rep.meta)` | `mv(...)` |
| Tabela representantes - Realizado | linha ~812 | `formatarValor(rep.realizado)` | `mv(...)` |
| Tabela representantes - Liquido | linha ~815 | `formatarValor(rep.realizado - rep.despesas)` | `mv(...)` |
| Tabela representantes - Notas | linha ~818 | `formatarNumero(rep.qtdNotas)` | `mn(...)` |
| Tabela representantes - Ticket | linha ~821 | `formatarValor(rep.ticketMedio)` | `mv(...)` |
| Tabela representantes - Progresso (%) | linha ~828 | `rep.percentual.toFixed(0)%` | `***%` |
| Tabela representantes - Barra | linha ~831 | `<Progress>` | Ocultar ou zerar |
| Dialog Estoque - valores | linhas ~862-881 | `formatarNumero(...)` | `mn(...)` |
| Dialog Cobrancas Hoje - valores | linhas ~920-939 | `formatarValor(...)` | `mv(...)` |

---

### Resumo
Mesma logica e UX do Dashboard do representante, adaptada para o Dashboard Admin com localStorage independente e cobrindo todos os pontos de exibicao de valores: cards, graficos, tabelas, dialogs e barras de progresso.

