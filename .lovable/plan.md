

# Refatorar ModalReceberCobranca: "Valor da Venda" → "Valor em Joias Devolvidas"

## Resumo
Trocar a lógica de entrada de "valor vendido" para "valor devolvido em joias", removendo edição manual de comissão.

## Alterações no arquivo `src/components/cobranca/ModalReceberCobranca.tsx`

### 1. Import (linha 9)
Remover `Edit2` do import de lucide-react.

### 2. States (linhas 82, 92-93)
- `valorVenda` → `valorDevolvido`
- Remover `comissaoManual` e `comissaoPercentualManual`

### 3. useEffect (linhas 110-133)
- Substituir referências `setValorVenda` → `setValorDevolvido`
- Remover `setComissaoManual(false)` e `setComissaoPercentualManual('')`

### 4. Função handler (linhas 156-170)
- Substituir `handleValorVendaChange` por `handleValorDevolvidoChange` com lógica invertida:
  - `valorVendido = cobranca.valor_previsto - valorDevolvido`
  - Comissão calculada sobre valorVendido

### 5. Remover `handleComissaoManualChange` (linhas 189-199)

### 6. `handleReceberPagamento` (linhas 299, 353)
- `valor_venda` passa a ser `Math.max(0, cobranca.valor_previsto - (parseFloat(valorDevolvido.replace(',', '.')) || 0))`

### 7. Remover log de comissão manual (linhas 368-377)

### 8. UI — Campo de entrada (linhas 440-458)
- Novo label "Valor em Joias Devolvidas" com banner de atenção amarelo
- Input usa `valorDevolvido` e `handleValorDevolvidoChange`
- Mostra cálculo "Valor do kit: X — Vendido: Y"

### 9. UI — Bloco de comissão (linhas 460-499)
- Simplificar: remover botão Edit2 e campo de edição manual
- Manter apenas exibição: `Comissão (X%): R$ Y`

### 10. Mensagem de ajuda (linhas 842-845)
- `valorVenda` → `valorDevolvido`, texto atualizado

