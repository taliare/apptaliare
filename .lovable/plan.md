

# Corrigir Usabilidade do Dialog de Usuários

## Problema

O `DialogContent` tem altura fixa e o conteúdo (formulário + permissões de menu) ultrapassa a tela, impedindo o scroll até o botão "Salvar".

## Solução

Tornar o conteúdo do dialog scrollável, mantendo header e footer fixos.

## Alteração

### `src/pages/Usuarios.tsx`

1. Adicionar `max-h-[80vh]` e `flex flex-col` ao `DialogContent` (linha 735)
2. Envolver o conteúdo do formulário (div `space-y-4 py-4`, linha 748) com `overflow-y-auto` e limitar sua altura
3. Remover o `max-h-48` da grid de permissões (linha 880) — o scroll será gerenciado pelo container pai
4. Manter `DialogHeader` e `DialogFooter` fora da área scrollável

Resultado: o dialog ficará com scroll interno no corpo do formulário, e os botões "Cancelar" / "Salvar" sempre visíveis no rodapé.

