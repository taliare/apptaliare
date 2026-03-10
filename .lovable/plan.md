

# Classificação Automática de Revendedoras — Alinhamento de Nomes

## Análise

O sistema **já implementa** toda a lógica solicitada:

- `getComissaoFaixa()` em `constants.ts` já aplica as faixas corretas (20%/30%/40%/50%) com os mesmos thresholds
- O trigger `t2_atualizar_categoria_revendedora` já atualiza `t2_revendedoras.categoria_atual` automaticamente ao inserir apuração
- `ApuracaoDialog.tsx` já usa `getComissaoFaixa()` para calcular comissão e exibir a categoria
- As telas de revendedoras, ranking e radar já exibem `categoria_atual` com badges coloridos

## Única Alteração Necessária

Os nomes das categorias em `getComissaoFaixa()` estão desalinhados com o padrão `CATEGORIA_LABELS`:

| Atual | Esperado |
|-------|----------|
| Bronze | Inicial |
| Prata | Ativa |
| Ouro | Destaque |
| Diamante | Elite |

### constants.ts

Atualizar `getComissaoFaixa()` para retornar os nomes corretos:

```typescript
export function getComissaoFaixa(valorVendido: number) {
  if (valorVendido >= 2000) return { percentual: 50, categoria: 'Elite' };
  if (valorVendido >= 1000) return { percentual: 40, categoria: 'Destaque' };
  if (valorVendido >= 300) return { percentual: 30, categoria: 'Ativa' };
  return { percentual: 20, categoria: 'Inicial' };
}
```

Nenhuma alteração de banco de dados, lógica financeira ou outros arquivos necessária. A categorização, cálculo de comissão e exibição na tela da revendedora já funcionam corretamente.

