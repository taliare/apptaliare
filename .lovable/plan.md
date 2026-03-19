

# Desistência de Kit — Botão para Admin no menu Ciclos

## O que será feito

Adicionar um botão "Desistência" visível apenas para admins nos cards de ciclos **ativos** (sem apuração). Ao confirmar, o sistema reverte a entrega: exclui o ciclo, adiantamentos e registros da junction table, e devolve os pedidos ao status `disponivel` para que voltem ao menu "Meus Kits" do representante.

## Alterações

### 1. Migração SQL — Função atômica `t2_reverter_ciclo_desistencia`

Criar uma função `SECURITY DEFINER` que, dado um `ciclo_id`:
1. Valida que o ciclo está `ativo` e não possui apuração
2. Busca os `pedido_id`s vinculados em `t2_ciclo_pedidos`
3. Deleta adiantamentos (`t2_adiantamentos`) do ciclo
4. Deleta interações (`t2_interacoes`) do ciclo
5. Deleta registros de `t2_ciclo_pedidos`
6. Deleta o ciclo de `t2_ciclos`
7. Atualiza cada pedido em `t2_pedidos` de volta para `status = 'disponivel'`
8. Retorna JSON de sucesso/erro

### 2. Frontend — `src/pages/T2Ciclos.tsx`

- Adicionar mutation `desistenciaMutation` que chama `supabase.rpc('t2_reverter_ciclo_desistencia', { p_ciclo_id })`
- Adicionar botão "Desistência" no grid de ações de cada card, visível apenas para admin e ciclos ativos sem apuração
- Envolver em `AlertDialog` para confirmação antes de executar
- Registrar log operacional via `registrarLog` com tipo `DESISTENCIA_KIT`
- Invalidar queries relevantes (`t2-ciclos`, `t2-pedidos-disponiveis`, `t2-meus-kits`, `t2-ciclo-pedidos`, `t2-adiantamentos-all`)

