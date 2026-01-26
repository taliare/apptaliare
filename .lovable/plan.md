

## Plano: Importação em Massa de Leads para o CRM

### Resumo
Criar um componente para importação em massa de leads via arquivo Excel (.xlsx), seguindo o padrão já existente na página de Importar Cobranças.

---

### Funcionalidades

1. **Upload de arquivo Excel**: Aceitar apenas arquivos .xlsx
2. **Template para download**: Gerar modelo Excel com as colunas corretas
3. **Validação de dados**: Verificar campos obrigatórios (nome, whatsapp)
4. **Preview dos dados**: Exibir tabela com status de cada linha antes de confirmar
5. **Detecção de duplicados**: Verificar se o WhatsApp já existe na base
6. **Importação em lote**: Inserir todos os leads válidos de uma vez
7. **Feedback visual**: Mostrar progresso e resultado da importação

---

### Interface

```text
┌─────────────────────────────────────────────────────────────┐
│ Importar Leads em Massa                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [📥 Baixar Modelo Excel]    [📤 Selecionar Arquivo]       │
│                                                             │
│  Arquivo: leads_janeiro.xlsx                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Status │ Nome          │ WhatsApp      │ Cidade     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │   ✓    │ Maria Silva   │ 11999998888   │ São Paulo  │   │
│  │   ✓    │ João Santos   │ 21988887777   │ Rio        │   │
│  │   ⚠    │ Ana Costa     │ (vazio)       │ Curitiba   │   │
│  │   ⚠    │ Pedro Lima    │ 11999998888   │ SP         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ✓ 15 válidos   ⚠ 2 com erro   Total: 17 linhas           │
│                                                             │
│              [Cancelar]    [Importar 15 Leads]              │
└─────────────────────────────────────────────────────────────┘
```

---

### Colunas do Template Excel

| Coluna | Obrigatório | Descrição |
|--------|-------------|-----------|
| nome | Sim | Nome do lead |
| whatsapp | Sim | Número de WhatsApp |
| cidade | Não | Cidade do lead |
| instagram | Não | @ do Instagram |
| experiencia_vendas | Não | Experiência prévia |
| tempo_disponivel | Não | Tempo disponível |
| capital_inicial | Não | Capital para investir |
| motivacao | Não | Motivação para revender |

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/leads/BulkImportLeadsDialog.tsx` | CRIAR | Dialog com toda a lógica de importação |
| `src/pages/LeadsRevendedoras.tsx` | EDITAR | Adicionar botão e integrar dialog |

---

### Seção Técnica

#### Estrutura do Componente

```typescript
interface ImportedLeadRow {
  nome: string;
  whatsapp: string;
  cidade?: string;
  instagram?: string;
  experiencia_vendas?: string;
  tempo_disponivel?: string;
  capital_inicial?: string;
  motivacao?: string;
  status: 'pendente' | 'erro' | 'sucesso' | 'duplicado';
  erro?: string;
}
```

#### Lógica de Parsing

```typescript
const parseExcel = async (file: File): Promise<ImportedLeadRow[]> => {
  const reader = new FileReader();
  const workbook = XLSX.read(data, { type: 'binary' });
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  // Validar cada linha
  return jsonData.map((row, index) => {
    // Verificar campos obrigatórios
    if (!row.nome || !row.whatsapp) {
      return { ...row, status: 'erro', erro: 'Campos obrigatórios' };
    }
    return { ...row, status: 'pendente' };
  });
};
```

#### Detecção de Duplicados

```typescript
// Buscar WhatsApps existentes
const { data: existingLeads } = await supabase
  .from('leads_revendedoras')
  .select('whatsapp');

const existingWhatsapps = new Set(existingLeads?.map(l => 
  l.whatsapp.replace(/\D/g, '')
));

// Marcar duplicados
rows.forEach(row => {
  const cleanWhatsapp = row.whatsapp.replace(/\D/g, '');
  if (existingWhatsapps.has(cleanWhatsapp)) {
    row.status = 'duplicado';
    row.erro = 'WhatsApp já existe na base';
  }
});
```

#### Inserção em Lote

```typescript
const validRows = importedData.filter(r => r.status === 'pendente');

const { error } = await supabase
  .from('leads_revendedoras')
  .insert(validRows.map(row => ({
    nome: row.nome.trim(),
    whatsapp: row.whatsapp.trim(),
    cidade: row.cidade?.trim() || null,
    instagram: row.instagram?.trim() || null,
    experiencia_vendas: row.experiencia_vendas?.trim() || null,
    tempo_disponivel: row.tempo_disponivel?.trim() || null,
    capital_inicial: row.capital_inicial?.trim() || null,
    motivacao: row.motivacao?.trim() || null,
    status: 'leads_novos',
    origem: 'importacao',
  })));
```

#### Template para Download

```typescript
const downloadTemplate = () => {
  const template = [
    {
      nome: 'Maria Silva',
      whatsapp: '11999998888',
      cidade: 'São Paulo',
      instagram: '@mariasilva',
      experiencia_vendas: 'Sim, 2 anos',
      tempo_disponivel: 'Meio período',
      capital_inicial: 'R$ 500',
      motivacao: 'Renda extra'
    }
  ];
  
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, 'modelo_importacao_leads.xlsx');
};
```

#### Modificação na Página Principal

```tsx
// Novo estado
const [bulkImportOpen, setBulkImportOpen] = useState(false);

// Botão no header (dropdown com opções)
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Importar
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
      <UserPlus className="h-4 w-4 mr-2" />
      Importar Contato
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setBulkImportOpen(true)}>
      <FileSpreadsheet className="h-4 w-4 mr-2" />
      Importar em Massa (Excel)
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### Resultado Final

- Botão dropdown "Importar" com duas opções: Contato único e Em Massa
- Dialog de importação em massa com:
  - Download de template Excel
  - Upload e validação de arquivo
  - Preview com status de cada linha
  - Detecção automática de duplicados
  - Importação em lote dos leads válidos
- Todos os leads importados entram com status `leads_novos` e origem `importacao`

