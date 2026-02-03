

## Plano: Corrigir Exclusão de Leads - Adicionar Políticas RLS de DELETE

### Problema Identificado

A exclusão de leads não funciona porque **não existem políticas RLS para DELETE** nas tabelas:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `leads_revendedoras` | ✅ Admin | ✅ Público | ✅ Admin | ❌ **Faltando** |
| `leads_status_historico` | ✅ Admin | ✅ Admin | - | ❌ **Faltando** |

Quando RLS está habilitado e não existe política para uma operação, ela é **bloqueada por padrão**.

---

### Solução

Criar duas novas políticas RLS para permitir que administradores excluam leads e seus históricos:

1. **Policy DELETE para `leads_revendedoras`** - permite admin excluir leads
2. **Policy DELETE para `leads_status_historico`** - permite admin excluir histórico

---

### SQL a Executar

```sql
-- Política para Admin deletar leads
CREATE POLICY "Admin pode deletar leads"
ON public.leads_revendedoras
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Política para Admin deletar histórico de status
CREATE POLICY "Admin pode deletar histórico"
ON public.leads_status_historico
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
```

---

### Resultado Esperado

Após aplicar a migração:
- Administradores poderão excluir leads pelo botão "Excluir Lead" no painel de detalhes
- O histórico de status será removido automaticamente antes do lead
- Usuários não-admin continuam sem permissão de exclusão

---

### Arquivos a Modificar

| Componente | Ação | Descrição |
|------------|------|-----------|
| Migração SQL | CRIAR | Adicionar 2 políticas RLS de DELETE |

Nenhuma alteração de código é necessária - o código atual em `LeadDetailsSheet.tsx` já está correto, apenas faltavam as permissões no banco.

