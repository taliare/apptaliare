

# Remover campo de comissão da entrega de kit

## Alteração em `src/pages/T2MeusKits.tsx`

1. **Remover state** `comissao` (linha 28)
2. **No `entregarMutation`** (linhas 74-76): remover cálculo de `comissaoPerc` e `valorEmpresa`. Setar `comissao_percentual: 0` e `valor_empresa: valorKit` no insert do ciclo (valores neutros, a comissão real será definida no final do ciclo)
3. **Remover o campo de input** "Comissão (%)" do modal de entrega (~linha 260)
4. **Remover do `resetEntregaForm`** o reset de `comissao`

