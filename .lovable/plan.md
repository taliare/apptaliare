

# Tornar o botão de exportar PDF mais visível

## Problema
O botão de exportar PDF existe no código, mas está usando `size="icon-sm"` (apenas 28x28px) e `variant="outline"`, tornando-o difícil de encontrar visualmente no header do sheet.

## Solução
Substituir o pequeno botão de ícone por um botão mais visível e descritivo, posicionado abaixo do header ou como um botão completo com texto.

### Alteração em `src/components/leads/LeadDetailsSheet.tsx`
- Trocar o botão `icon-sm` por um botão com texto "Exportar PDF" e o ícone `FileDown`
- Usar `size="sm"` e `variant="outline"` para que fique claro e clicável
- Mover o botão para fora do `SheetTitle` (abaixo do header), para não competir com o nome do lead

O botão ficará assim:
```
[📄 Exportar PDF]
```
Posicionado logo após o header, antes dos links de contato.

