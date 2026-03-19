

# Destaque visual de kits parados — Meus Kits

## Resumo

Adicionar indicadores visuais nos cards de kits disponíveis para alertar o representante sobre kits parados há mais de 7 ou 15 dias, usando `data_criacao` como referência.

## Regras de destaque

- **Até 7 dias**: visual normal (sem alteração)
- **8–15 dias**: borda amarela/âmbar + badge "Atenção" + texto "X dias parado"
- **Mais de 15 dias**: borda vermelha + badge "Crítico" + texto "X dias parado"

## Alteração em `src/pages/T2MeusKits.tsx`

1. Importar `differenceInDays` de `date-fns` e `AlertTriangle` de `lucide-react`

2. Criar função helper para calcular o nível de alerta:
```typescript
function getKitAlertLevel(dataCriacao: string) {
  const dias = differenceInDays(new Date(), new Date(dataCriacao));
  if (dias > 15) return { level: 'critico', dias, label: 'Crítico' };
  if (dias > 7) return { level: 'atencao', dias, label: 'Atenção' };
  return { level: 'normal', dias, label: null };
}
```

3. No card de cada kit disponível, aplicar:
   - Classes condicionais na `<Card>` para borda colorida (`border-yellow-500` / `border-red-500`)
   - Badge de alerta ao lado do badge "Disponível"
   - Texto "X dias parado" abaixo da data de recebimento

4. Apenas kits no filtro "Disponíveis" recebem destaque (entregues não precisam)

