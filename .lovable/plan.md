

## Botao de Ocultar/Exibir Dados no Dashboard

### Objetivo
Adicionar um botao com icone de olho para alternar entre exibir e ocultar os valores numericos (financeiros e quantitativos) do Dashboard, permitindo manter sigilo quando necessario.

---

### Comportamento

| Estado | Icone | Valores exibidos |
|--------|-------|------------------|
| Visivel (padrao) | `Eye` | Valores reais (ex: R$ 5.432,00) |
| Oculto | `EyeOff` | Asteriscos (ex: R$ *****) |

- O estado sera persistido no `localStorage` para manter a preferencia do usuario entre sessoes
- Ao ocultar, todos os valores monetarios e numericos serao substituidos por `*****`
- A barra de progresso da meta tambem sera ocultada quando os dados estiverem ocultos

---

### Posicionamento do Botao

O botao ficara ao lado do filtro de periodo no hero section, criando um agrupamento de acoes no canto superior direito:

```
[Saudacao e data]                    [Olho] [Filtro Periodo]
```

---

### Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Dashboard.tsx` | Adicionar estado, botao e logica de mascaramento |

---

### Implementacao

1. **Novo estado com localStorage:**
```typescript
const [showValues, setShowValues] = useState(() => {
  const saved = localStorage.getItem('dashboard-show-values');
  return saved !== 'false'; // padrao: true (visivel)
});

useEffect(() => {
  localStorage.setItem('dashboard-show-values', String(showValues));
}, [showValues]);
```

2. **Funcao helper para mascarar valores:**
```typescript
const mascarar = (valor: string) => showValues ? valor : '*****';
const mascarValor = (valor: number) => showValues ? formatarValor(valor) : 'R$ *****';
const mascarNumero = (valor: number) => showValues ? formatarNumero(valor) : '*****';
```

3. **Botao no header (ao lado do DateRangeFilterPopover):**
```typescript
<Button
  variant="ghost"
  size="icon"
  onClick={() => setShowValues(!showValues)}
  className="shrink-0"
  title={showValues ? 'Ocultar valores' : 'Exibir valores'}
>
  {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
</Button>
```

4. **Aplicar mascaramento em todos os valores:**
- Quick Stats (Hoje e Periodo)
- Cards: Total Cobrado, Notas Cobradas, Ticket Medio, Despesas, Kits Entregues, Meta
- Graficos: tooltips e eixos Y
- Textos secundarios com valores (ex: "Liquido: R$ X")

---

### Locais que serao mascarados

| Local | Antes | Depois (oculto) |
|-------|-------|-----------------|
| Quick Stats - Hoje | R$ 1.500,00 | R$ ***** |
| Quick Stats - Periodo | R$ 15.000,00 | R$ ***** |
| Total Cobrado | R$ 15.000,00 | R$ ***** |
| Notas Cobradas | 42 | ***** |
| Ticket Medio | R$ 357,14 | R$ ***** |
| Despesas | R$ 2.000,00 | R$ ***** |
| Liquido | R$ 13.000,00 | R$ ***** |
| Kits Entregues | 15 | ***** |
| Meta (percentual) | 75% | ***% |
| Meta (valor) | R$ 20.000,00 | R$ ***** |
| Graficos (tooltip) | R$ 500,00 | R$ ***** |

---

### Imports a adicionar

```typescript
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
```

