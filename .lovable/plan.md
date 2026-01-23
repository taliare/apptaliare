
## Plano: Inativar e Excluir Revendedoras do Sistema de Garantias

### Contexto
- A lista de revendedoras na aba "Revendedoras" da página de Garantias precisa de novas ações
- **Inativar**: Marcar revendedora como inativa (campo `ativo` no `profiles`)
- **Excluir**: Remover completamente o cadastro (somente se não tiver garantias registradas)
- Os dados estão no Supabase externo (mesmas secrets usadas pelas outras funções)

---

## Alterações Necessárias

### 1. Verificar/Adicionar campo `ativo` na tabela profiles do banco externo

O campo `ativo` pode já existir ou precisar ser adicionado via SQL diretamente no banco externo. A Edge Function tratará a ausência do campo graciosamente.

---

### 2. Nova Edge Function: `toggle-ativo-external`

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/toggle-ativo-external` | POST | Alterna o status ativo/inativo de uma revendedora |

```
Arquivo: supabase/functions/toggle-ativo-external/index.ts
```

**Comportamento:**
- Recebe `{ userId: string, ativo: boolean }`
- Atualiza `profiles.ativo` no banco externo
- Retorna o novo status

---

### 3. Nova Edge Function: `delete-revendedora-external`

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/delete-revendedora-external` | POST | Exclui revendedora se não tiver garantias |

```
Arquivo: supabase/functions/delete-revendedora-external/index.ts
```

**Comportamento:**
1. Recebe `{ userId: string }`
2. Verifica se existem garantias na tabela `garantias` com `revendedora_id = userId`
3. Se houver garantias: retorna erro `"Esta revendedora possui X garantia(s) registrada(s) e não pode ser excluída."`
4. Se não houver: exclui o usuário via `auth.admin.deleteUser(userId)`

---

### 4. Atualizar `get-revendedoras-external`

Incluir o campo `ativo` na query para exibir o status na tabela:

```typescript
.select('id, nome, email, ativo')
```

---

### 5. Atualizar Interface `src/pages/Garantias.tsx`

#### 5.1 Adicionar ícones de importação

```typescript
import { ..., Power, Trash2, AlertTriangle } from 'lucide-react';
```

#### 5.2 Atualizar interface Revendedora

```typescript
interface Revendedora {
  id: string;
  nome: string | null;
  email?: string | null;
  ativo?: boolean;  // Novo campo
}
```

#### 5.3 Novos estados para modais

```typescript
const [inativarRevendedora, setInativarRevendedora] = useState<Revendedora | null>(null);
const [excluirRevendedora, setExcluirRevendedora] = useState<Revendedora | null>(null);
```

#### 5.4 Novas mutations

```typescript
// Mutation para alternar ativo
const toggleAtivoMutation = useMutation({...});

// Mutation para excluir
const deleteRevendedoraMutation = useMutation({...});
```

#### 5.5 Novos botões na tabela

```
┌──────────────────┬─────────────────────┬────────┬─────────────────────────────┐
│ Nome             │ Email               │ Status │ Ações                       │
├──────────────────┼─────────────────────┼────────┼─────────────────────────────┤
│ Maria Silva      │ maria@email.com     │ Ativo  │ [✏️] [🔑] [⚡] [🗑️] [👁️]    │
│ João Santos      │ joao@email.com      │ Inativo│ [✏️] [🔑] [⚡] [🗑️] [👁️]    │
└──────────────────┴─────────────────────┴────────┴─────────────────────────────┘

Legenda: ✏️ Editar | 🔑 Senha | ⚡ Ativar/Inativar | 🗑️ Excluir | 👁️ Ver Clientes
```

#### 5.6 Nova coluna "Status" na tabela

- Badge verde "Ativo" ou Badge cinza "Inativo"

#### 5.7 Modal de Confirmação para Inativar/Ativar

- Título: "Inativar Revendedora" ou "Ativar Revendedora"
- Descrição: Explica a consequência da ação
- Botões: Cancelar | Confirmar

#### 5.8 Modal de Confirmação para Excluir

- Alerta de que a ação é irreversível
- Mensagem clara: "Esta ação não pode ser desfeita"
- Se a exclusão falhar por ter garantias, exibe mensagem de erro

---

### 6. Atualizar `supabase/config.toml`

Adicionar configuração para as novas funções:

```toml
[functions.toggle-ativo-external]
verify_jwt = false

[functions.delete-revendedora-external]
verify_jwt = false
```

---

## Fluxo Visual

### Inativar Revendedora
```
1. Admin clica em ⚡ (Inativar)
2. Modal de confirmação aparece
3. Admin confirma
4. Sistema atualiza profiles.ativo = false
5. Toast de sucesso
6. Lista atualizada com badge "Inativo"
```

### Excluir Revendedora
```
1. Admin clica em 🗑️ (Excluir)
2. Modal de confirmação aparece com alerta vermelho
3. Admin confirma
4. Sistema verifica garantias:
   ├─ Se tem garantias → Erro: "Possui X garantia(s), não pode excluir"
   └─ Se não tem → Exclui usuário do auth + profile
5. Toast de sucesso ou erro
6. Lista atualizada
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/toggle-ativo-external/index.ts` | **CRIAR** | Alternar ativo/inativo |
| `supabase/functions/delete-revendedora-external/index.ts` | **CRIAR** | Excluir com verificação |
| `supabase/functions/get-revendedoras-external/index.ts` | **MODIFICAR** | Incluir campo `ativo` |
| `supabase/config.toml` | **MODIFICAR** | Adicionar config das novas funções |
| `src/pages/Garantias.tsx` | **MODIFICAR** | Adicionar botões, modais e lógica |

---

## Detalhes Técnicos

### Verificação de Garantias (delete-revendedora-external)

```typescript
// Contar garantias da revendedora
const { count, error } = await supabaseAdmin
  .from('garantias')
  .select('*', { count: 'exact', head: true })
  .eq('revendedora_id', userId);

if (count && count > 0) {
  return Response(JSON.stringify({ 
    error: `Esta revendedora possui ${count} garantia(s) registrada(s) e não pode ser excluída.` 
  }), { status: 400 });
}

// Se não tem garantias, excluir
await supabaseAdmin.auth.admin.deleteUser(userId);
```

### Tratamento do campo `ativo` inexistente

A Edge Function `toggle-ativo-external` tratará o caso onde o campo `ativo` não existe ainda no banco externo, retornando um erro explicativo para o admin.
