

## Plano: Melhorias no CRM de Leads

### Resumo
Adicionar botão de importação manual de contatos, melhorar acesso ao WhatsApp nos cards e remover a coluna "Cadastro Pendente" do Kanban.

---

### 1. Botão Importar Contato

Adicionar no header da página um botão "Importar Contato" que abre um dialog simples para inserir:
- Nome (obrigatório)
- WhatsApp (obrigatório)

O contato será salvo automaticamente com:
- Status: `leads_novos`
- Origem: `manual`
- Data de criação: agora

---

### 2. Botão WhatsApp Destacado no Card

Substituir o link de texto por um botão verde com ícone do WhatsApp, mais visível e fácil de clicar:

```text
┌─────────────────────────┐
│ Maria Silva             │
│                         │
│ [📱 WhatsApp]  ← Botão  │
│ 📍 São Paulo            │
│ 📅 26/01/26             │
└─────────────────────────┘
```

---

### 3. Remover Coluna "Cadastro Pendente"

Atualizar o array `KANBAN_COLUMNS` removendo a entrada `cadastro_pendente`.

**Colunas finais (7):**
1. Leads Novos
2. Contato Realizado
3. Follow-up
4. Interessada
5. Aguardando Kit
6. Ativada
7. Perdida

---

### Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/leads/types.ts` | EDITAR | Remover "cadastro_pendente" do KANBAN_COLUMNS |
| `src/components/leads/LeadCard.tsx` | EDITAR | Adicionar botão verde de WhatsApp destacado |
| `src/pages/LeadsRevendedoras.tsx` | EDITAR | Adicionar botão e dialog de importação |
| `src/components/leads/ImportLeadDialog.tsx` | CRIAR | Modal para importar contato manualmente |

---

### Seção Técnica

#### Dialog de Importação

```typescript
// ImportLeadDialog.tsx
interface ImportLeadDialogProps {
  open: boolean;
  onClose: () => void;
}

// Campos:
// - nome: string (required)
// - whatsapp: string (required, com máscara)

// Ao salvar:
await supabase.from('leads_revendedoras').insert({
  nome,
  whatsapp,
  status: 'leads_novos',
  origem: 'manual'
});
```

#### Novo Botão WhatsApp no Card

```tsx
<Button
  size="sm"
  variant="outline"
  className="w-full bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20"
  onClick={(e) => {
    e.stopPropagation();
    window.open(`https://wa.me/${formatarWhatsapp(lead.whatsapp)}`, '_blank');
  }}
>
  <MessageCircle className="h-3 w-3 mr-1" />
  WhatsApp
</Button>
```

#### KANBAN_COLUMNS Atualizado

```typescript
export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  { id: 'leads_novos', label: 'Leads Novos', color: 'blue' },
  { id: 'contato_realizado', label: 'Contato Realizado', color: 'yellow' },
  { id: 'follow_up', label: 'Follow-up', color: 'orange' },
  { id: 'interessada', label: 'Interessada', color: 'purple' },
  // Removido: cadastro_pendente
  { id: 'aguardando_kit', label: 'Aguardando Kit', color: 'indigo' },
  { id: 'ativada', label: 'Ativada', color: 'green', final: true },
  { id: 'perdida', label: 'Perdida', color: 'red', final: true },
];
```

---

### Resultado Final

- Botão "Importar Contato" no header para adicionar leads manualmente
- Botão verde de WhatsApp destacado em cada card
- Kanban com 7 colunas (sem "Cadastro Pendente")

