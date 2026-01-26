

## Plano: Filtro por Responsável no CRM de Leads

### Resumo
Adicionar um filtro por responsável na seção de filtros da página de Leads, permitindo que cada vendedor veja apenas os leads atribuídos a ele ou a qualquer outro responsável específico.

---

### Funcionalidades

1. **Select de Responsável**: Novo campo de filtro no painel de filtros
2. **Opções disponíveis**:
   - Todos (exibe todos os leads)
   - Sem responsável (leads ainda não atribuídos)
   - [Lista de responsáveis] (filtrar por pessoa específica)
3. **Filtro local**: Aplicado no array de leads já carregado (sem nova query)

---

### Interface do Filtro

```text
┌─────────────────────────────────────────────────────┐
│ Filtros                                         ▼   │
├─────────────────────────────────────────────────────┤
│ Status        │ Origem   │ Responsável │ Busca     │
│ [Todos     ▼] │ [Todos▼] │ [Todos   ▼] │ [🔍_____ ]│
└─────────────────────────────────────────────────────┘
```

---

### Arquivo a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/LeadsRevendedoras.tsx` | EDITAR | Adicionar filtro de responsável |

---

### Seção Tecnica

#### Alteracoes no Componente

1. **Novo estado para o filtro**:
```typescript
const [responsavelFiltro, setResponsavelFiltro] = useState("todos");
```

2. **Query para buscar profiles** (reutilizar pattern existente):
```typescript
const { data: responsaveis = [] } = useQuery({
  queryKey: ["responsaveis-leads"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome")
      .order("nome");
    if (error) throw error;
    return data;
  },
});
```

3. **Logica de filtro adicional**:
```typescript
// Filtro de responsável
if (responsavelFiltro !== "todos") {
  if (responsavelFiltro === "sem_responsavel") {
    if (lead.responsavel_id !== null) return false;
  } else {
    if (lead.responsavel_id !== responsavelFiltro) return false;
  }
}
```

4. **Componente Select no painel de filtros**:
```tsx
<div>
  <Label className="text-xs">Responsável</Label>
  <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
    <SelectTrigger className="mt-1">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="todos">Todos</SelectItem>
      <SelectItem value="sem_responsavel">Sem responsável</SelectItem>
      {responsaveis.map((r) => (
        <SelectItem key={r.id} value={r.id}>
          {r.nome}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

5. **Atualizar grid de filtros** de 3 para 4 colunas:
```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
```

---

### Resultado Final

- Novo filtro "Responsável" no painel de filtros
- Opcoes: Todos, Sem responsável, ou nome de cada responsável
- Vendedores podem rapidamente ver apenas seus leads atribuídos
- Layout adaptado para 4 colunas em desktop

