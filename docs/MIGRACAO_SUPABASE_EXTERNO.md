# Guia de Migração para Supabase Externo

Este guia explica como conectar dois projetos Lovable ao mesmo banco de dados Supabase externo.

## Passo 1: Criar Projeto no Supabase Externo

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Clique em "New Project"
3. Preencha os dados:
   - **Organization**: Sua organização
   - **Name**: Nome do projeto (ex: taliare-shared)
   - **Database Password**: Uma senha forte
   - **Region**: Escolha a mais próxima (South America)
4. Aguarde a criação (~2 minutos)
5. Anote as credenciais em **Settings > API**:
   - **Project URL**: `https://xxxxxx.supabase.co`
   - **anon public key**: Chave pública
   - **service_role key**: Chave privada (para Edge Functions)

## Passo 2: Importar Estrutura do Banco

1. No Supabase, vá em **SQL Editor**
2. Copie todo o conteúdo do arquivo `docs/SUPABASE_EXPORT.sql`
3. Cole e execute no SQL Editor
4. Verifique se todas as tabelas foram criadas em **Table Editor**

## Passo 3: Configurar Secrets no Supabase Externo

No Supabase externo, vá em **Settings > Secrets** e adicione:

| Nome | Descrição |
|------|-----------|
| `VAPID_PUBLIC_KEY` | Chave pública VAPID para push notifications |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID |

## Passo 4: Atualizar Cliente no Lovable

1. Abra o arquivo `src/lib/supabase-external.ts`
2. Substitua as credenciais:

```typescript
const EXTERNAL_SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

## Passo 5: Migrar Importações

Em todos os arquivos que usam o Supabase, altere de:

```typescript
// ANTES
import { supabase } from "@/integrations/supabase/client";

// DEPOIS
import { supabase } from "@/lib/supabase-external";
```

### Lista de Arquivos a Atualizar

#### Contextos
- `src/contexts/AuthContext.tsx`

#### Páginas
- `src/pages/Cobranca.tsx`
- `src/pages/CobrancaDiaria.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/DashboardAdmin.tsx`
- `src/pages/DistribuicaoKits.tsx`
- `src/pages/EncomendaProducao.tsx`
- `src/pages/EncomendaRepresentante.tsx`
- `src/pages/GerenciarAgenda.tsx`
- `src/pages/ImportarCobrancas.tsx`
- `src/pages/Juridico.tsx`
- `src/pages/Kits.tsx`
- `src/pages/KitsEntregues.tsx`
- `src/pages/LeadsRevendedoras.tsx`
- `src/pages/Metas.tsx`
- `src/pages/Perfil.tsx`
- `src/pages/Producao.tsx`
- `src/pages/ProducaoDiaria.tsx`
- `src/pages/Relatorios.tsx`
- `src/pages/RevendedorasInativas.tsx`
- `src/pages/Usuarios.tsx`
- `src/pages/VendaExterna.tsx`
- `src/pages/Vendedoras.tsx`

#### Componentes
- `src/components/AppSidebar.tsx`
- `src/components/PushNotificationToggle.tsx`
- `src/components/RevendedoraAutocomplete.tsx`
- `src/components/admin/SendNotificationDialog.tsx`
- `src/components/cobranca/ModalReceberCobranca.tsx`
- `src/components/cobranca/ModalSenhaAdmin.tsx`
- `src/components/messages/MessagesDialog.tsx`
- `src/components/profile/ChangePasswordSection.tsx`
- `src/components/profile/PreferencesSection.tsx`
- `src/components/profile/ProfileSettings.tsx`

#### Hooks
- `src/hooks/useMessages.ts`
- `src/hooks/useMetaNotifications.ts`
- `src/hooks/useNotifications.ts`
- `src/hooks/usePushNotifications.ts`

## Passo 6: Configurar Edge Functions

As Edge Functions precisam apontar para o Supabase externo.

### Opção A: Manter Edge Functions no Lovable Cloud

1. Adicione os secrets no Lovable Cloud:
   - `EXTERNAL_SUPABASE_URL`
   - `EXTERNAL_SUPABASE_ANON_KEY`
   - `EXTERNAL_SERVICE_ROLE_KEY`

2. Atualize as Edge Functions para usar:
```typescript
const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
const supabaseKey = Deno.env.get('EXTERNAL_SERVICE_ROLE_KEY');
```

### Opção B: Migrar Edge Functions para Supabase Externo

1. Copie o conteúdo de cada Edge Function
2. Crie as mesmas funções no Supabase externo
3. Configure os secrets lá

## Passo 7: Migrar Dados (Opcional)

Se você já tem dados no banco atual:

1. Exporte os dados via SQL ou dashboard
2. Importe no Supabase externo
3. Verifique a integridade

## Passo 8: Configurar Segundo Projeto Lovable

1. Copie `src/lib/supabase-external.ts` para o segundo projeto
2. Use as mesmas credenciais
3. Atualize as importações

## Verificação Final

- [ ] Tabelas criadas no Supabase externo
- [ ] RLS policies ativas
- [ ] Secrets configurados
- [ ] Cliente atualizado com credenciais corretas
- [ ] Importações migradas
- [ ] Login funcionando
- [ ] CRUD funcionando
- [ ] Push notifications funcionando

## Troubleshooting

### Erro de autenticação
- Verifique se as chaves estão corretas
- Confirme que o usuário existe no Supabase externo

### Erro de RLS
- Verifique se as policies foram criadas
- Confirme que a função `has_role` existe

### Edge Functions não funcionam
- Verifique os secrets
- Confirme as URLs
