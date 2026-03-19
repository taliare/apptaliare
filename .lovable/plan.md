

# Remover campo "Nome de Exibição" do cadastro T2

## Alteração

### `src/pages/T2Revendedoras.tsx`

1. Remover `nome_exibicao` do `EMPTY_FORM`
2. Remover o campo de input "Nome de Exibição" do formulário (linha 228)
3. No insert, setar `nome_exibicao: form.nome_completo.trim()` (copiar o nome completo automaticamente)
4. Na tabela e na sheet de detalhes, substituir `r.nome_exibicao || r.nome_completo` por apenas `r.nome_completo`

