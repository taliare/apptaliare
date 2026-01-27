

## Plano: Reorganização dos Menus e Criação do Menu Revendedoras

### Resumo das Mudanças

1. **Mover "Vendedoras" para dentro de "Venda Externa"** - O menu atual de vendedoras (externas) será consolidado como parte da Venda Externa
2. **Criar novo menu "Revendedoras"** - Listagem geral de todas as revendedoras de todos os representantes
3. **Criar tabela centralizada** - Nova tabela `revendedoras` no banco de dados
4. **Migrar dados existentes** - Consolidar dados de `cobrancas_agendadas` e `prestacoes_contas`

---

### Estrutura do Novo Menu Revendedoras

```text
┌─────────────────────────────────────────────────────────────┐
│ Revendedoras                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [Ativas ▼]  [Representante ▼]  [🔍 Buscar nome...        ] │
│                                                             │
│ Total: 513 revendedoras  │  Ativas: 89  │  Inativas: 424   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Nome              │ Rep.    │ WhatsApp     │ Status    ││
│ ├─────────────────────────────────────────────────────────┤│
│ │ MARIA SILVA       │ BLYNDSON│ (vazio)      │ 🟢 Ativa  ││
│ │ ANA COSTA         │ CELIA   │ 11999998888  │ 🟢 Ativa  ││
│ │ ROSA PEREIRA      │ JOSINALDO│ (vazio)     │ 🔴 Inativa││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│                     [◀ 1 2 3 4 5 ▶]                        │
└─────────────────────────────────────────────────────────────┘
```

---

### Reorganização do Menu Admin

**Antes:**
```text
OPERACIONAL
├── Usuários
├── Vendedoras       <-- Será removido daqui
├── Venda Externa
├── CRM
├── Distribuição de Kits
└── Garantias
```

**Depois:**
```text
OPERACIONAL
├── Usuários
├── Revendedoras     <-- NOVO
├── Venda Externa    <-- Incluirá gestão de vendedoras dentro
├── CRM
├── Distribuição de Kits
└── Garantias
```

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| **Banco de Dados** | CRIAR | Nova tabela `revendedoras` |
| **Banco de Dados** | MIGRAR | Popular com dados existentes |
| `src/pages/Revendedoras.tsx` | CRIAR | Nova página de listagem geral |
| `src/pages/VendaExterna.tsx` | EDITAR | Adicionar aba/seção para gerenciar vendedoras |
| `src/pages/Vendedoras.tsx` | MANTER | Será incorporado no VendaExterna ou removido |
| `src/components/AppSidebar.tsx` | EDITAR | Atualizar menus |
| `src/components/MobileDrawer.tsx` | EDITAR | Atualizar menus |
| `src/components/AnimatedRoutes.tsx` | EDITAR | Adicionar nova rota |
| `src/lib/menuPermissions.ts` | EDITAR | Atualizar lista de menus |

---

### Seção Técnica

#### 1. Nova Tabela: revendedoras

```sql
CREATE TABLE public.revendedoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  whatsapp text,
  representante_id uuid REFERENCES auth.users(id),
  ativo boolean NOT NULL DEFAULT true,
  ultima_atividade date,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  
  -- Índice para busca rápida
  UNIQUE (nome, representante_id)
);

-- Habilitar RLS
ALTER TABLE public.revendedoras ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Admin pode gerenciar revendedoras"
ON public.revendedoras FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Representante pode ver suas revendedoras"
ON public.revendedoras FOR SELECT
TO authenticated
USING (representante_id = auth.uid());
```

#### 2. Migração de Dados (consolidar revendedoras existentes)

```sql
-- Inserir revendedoras únicas de cobrancas_agendadas
INSERT INTO public.revendedoras (nome, representante_id, ativo, ultima_atividade)
SELECT DISTINCT ON (UPPER(TRIM(c.revendedora)), c.representante_id)
  UPPER(TRIM(c.revendedora)) as nome,
  c.representante_id,
  CASE 
    WHEN c.status IN ('pendente', 'parcial', 'reagendado') THEN true
    ELSE false
  END as ativo,
  MAX(c.data_agendada) OVER (PARTITION BY UPPER(TRIM(c.revendedora)), c.representante_id) as ultima_atividade
FROM cobrancas_agendadas c
WHERE c.revendedora IS NOT NULL AND TRIM(c.revendedora) != ''
ORDER BY UPPER(TRIM(c.revendedora)), c.representante_id, c.data_agendada DESC;

-- Atualizar status ativo com base em cobranças pendentes
UPDATE public.revendedoras r
SET ativo = true
WHERE EXISTS (
  SELECT 1 FROM cobrancas_agendadas c
  WHERE UPPER(TRIM(c.revendedora)) = r.nome
    AND c.representante_id = r.representante_id
    AND c.status IN ('pendente', 'parcial', 'reagendado')
);
```

#### 3. Estrutura da Nova Página Revendedoras.tsx

```typescript
interface Revendedora {
  id: string;
  nome: string;
  whatsapp: string | null;
  representante_id: string;
  representante_nome?: string;
  ativo: boolean;
  ultima_atividade: string | null;
}

// Estados de filtro
const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativas' | 'inativas'>('todos');
const [representanteFiltro, setRepresentanteFiltro] = useState('todos');
const [searchTerm, setSearchTerm] = useState('');

// Query para buscar revendedoras
const { data: revendedoras = [] } = useQuery({
  queryKey: ['revendedoras-admin', statusFiltro, representanteFiltro],
  queryFn: async () => {
    let query = supabase
      .from('revendedoras')
      .select('*, profiles!revendedoras_representante_id_fkey(nome)')
      .order('nome');
    
    if (statusFiltro !== 'todos') {
      query = query.eq('ativo', statusFiltro === 'ativas');
    }
    if (representanteFiltro !== 'todos') {
      query = query.eq('representante_id', representanteFiltro);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});

// Função para editar WhatsApp
const atualizarWhatsApp = async (id: string, whatsapp: string) => {
  await supabase
    .from('revendedoras')
    .update({ whatsapp, atualizado_em: new Date().toISOString() })
    .eq('id', id);
};
```

#### 4. Atualização do VendaExterna com Tabs

```typescript
// Adicionar Tabs para separar Entregas e Vendedoras
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs defaultValue="entregas" className="space-y-4">
  <TabsList>
    <TabsTrigger value="entregas">Entregas por Vendedora</TabsTrigger>
    <TabsTrigger value="vendedoras">Gerenciar Vendedoras</TabsTrigger>
  </TabsList>
  
  <TabsContent value="entregas">
    {/* Conteúdo atual da página VendaExterna */}
  </TabsContent>
  
  <TabsContent value="vendedoras">
    {/* Conteúdo atual da página Vendedoras */}
  </TabsContent>
</Tabs>
```

#### 5. Atualização dos Menus

```typescript
// AppSidebar.tsx e MobileDrawer.tsx
const adminCategories: MenuCategory[] = [
  {
    label: "OPERACIONAL",
    items: [
      { title: 'Usuários', url: '/usuarios', icon: Users },
      { title: 'Revendedoras', url: '/revendedoras', icon: Users }, // NOVO
      { title: 'Venda Externa', url: '/venda-externa', icon: Users }, // Inclui vendedoras
      { title: 'CRM', url: '/leads-revendedoras', icon: UserPlus },
      // ... resto
    ],
  },
];

// Remover 'Vendedoras' como menu separado
```

#### 6. Atualização do menuPermissions.ts

```typescript
export const ASSIGNABLE_MENUS = [
  // Remover: { key: 'vendedoras', label: 'Vendedoras', route: '/vendedoras' },
  { key: 'revendedoras', label: 'Revendedoras', route: '/revendedoras' }, // NOVO
  { key: 'venda_externa', label: 'Venda Externa', route: '/venda-externa' },
  // ... resto
] as const;
```

---

### Dados a Migrar

Com base na análise do banco:

| Representante | Total Revendedoras |
|---------------|-------------------|
| BLYNDSON SANTOS | 256 |
| CELIA ARAGÃO | 106 |
| JOSINALDO OLIVEIRA | 151 |
| **Total** | **~513** |

A migração irá:
1. Normalizar nomes (UPPER + TRIM)
2. Identificar duplicados
3. Marcar como ativas aquelas com cobranças pendentes
4. Marcar como inativas aquelas sem pendências

---

### Resultado Final

- Menu "Vendedoras" movido para dentro de "Venda Externa" como aba
- Novo menu "Revendedoras" com listagem geral consolidada
- Filtros por status (ativo/inativo) e por representante
- Campo WhatsApp editável (para futura integração com CRM)
- Dados migrados e normalizados do banco atual

