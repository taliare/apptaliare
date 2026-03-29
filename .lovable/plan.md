

# Correção do saldo em aberto na aba Ativas

## Resumo
Só exibir saldo em aberto quando a cobrança já tiver prestação de contas registrada. Antes da apuração, mostrar "Pendente apuração".

## Alterações em `src/pages/RevendedorasInativas.tsx`

### 1. Interface `RevendedoraAtiva` (linha 28-34)
Adicionar campo `temApuracao: boolean`.

### 2. Query `minhas-revendedoras-ativas` (linhas 86-124)
Após buscar cadastros e antes do agrupamento, adicionar busca de prestações:
```typescript
const { data: prestacoes } = await supabase
  .from('prestacoes_contas')
  .select('cobranca_id, valor_devido_empresa, valor_pago, saldo_devedor')
  .eq('representante_id', user!.id);
const prestacaoMap = new Map(prestacoes?.map(p => [p.cobranca_id, p]) || []);
```

No `forEach` de agrupamento (linhas 106-122):
- Verificar `jaApurada = prestacaoMap.has(c.id)` antes de calcular saldo
- Saldo = 0 se não apurada
- Adicionar `temApuracao: false` ao criar entrada e setar `true` se qualquer cobrança estiver apurada

### 3. Card de métricas (linhas 473-476)
Substituir exibição fixa do saldo por condicional:
- Se `temApuracao`: mostrar valor formatado em vermelho
- Se não: mostrar "Pendente apuração" em texto muted

### Arquivo afetado
- `src/pages/RevendedorasInativas.tsx` — 4 blocos alterados

