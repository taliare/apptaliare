
# Redesenhar CobrancaItem

## Resumo
Substituir o componente `CobrancaItem` (linhas 1464-1733) pelo layout redesenhado fornecido pelo usuário. Layout mais compacto: linha principal com nome+badges+valor+botão cobrar, menu de 3 pontos, e seções condicionais para pagamentos parciais, acréscimos e observações.

## Alteração em `src/pages/Cobranca.tsx`

### Bloco único (linhas 1464-1733)
Substituir o componente inteiro pela versão fornecida pelo usuário. Todas as props, handlers e lógica permanecem iguais. As mudanças são puramente visuais:

- **Header compacto**: nome + badges + valor + botão "Cobrar" + menu dropdown na mesma linha
- **Remove**: ícones decorativos (User, DollarSign, CalendarIcon, FileText, Package), card azul de pagamento parcial duplicado, botões inline (Editar, Cobrar como botões separados)
- **Adiciona**: layout flex horizontal compacto, seções condicionais com `border-t` para pagamentos parciais, acréscimos e observações
- **Dropdown simplificado**: textos mais curtos ("Joias adicionais" em vez de "Registrar joias adicionais")

Todos os imports necessários já existem no arquivo. Nenhuma outra parte do arquivo é alterada.
