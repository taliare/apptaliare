

# Importação em Massa de WhatsApp via Planilha Excel

## Abordagem

A maneira mais rápida é adicionar um botão "Importar WhatsApp" na página Revendedoras que aceita um arquivo Excel (.xlsx) com duas colunas: **Nome** e **WhatsApp**. O sistema faz match pelo nome (normalizado com UPPER+TRIM) e atualiza o campo `whatsapp` das revendedoras já cadastradas.

O projeto já usa a biblioteca `xlsx` (instalada) e tem padrão de importação em massa no CRM (BulkImportLeadsDialog). Vamos seguir o mesmo padrão.

## Fluxo

1. Admin clica em "Importar WhatsApp" na página Revendedoras
2. Seleciona arquivo Excel com colunas Nome e WhatsApp
3. Sistema faz preview mostrando: nome do arquivo, quantas linhas encontradas, quantas correspondências com revendedoras existentes
4. Admin confirma → sistema atualiza o campo `whatsapp` das revendedoras correspondentes
5. Exibe resultado: X atualizadas, Y não encontradas (com lista dos nomes não encontrados)

## Implementação

### 1. Criar componente `ImportWhatsAppDialog.tsx`
- Dialog com input de arquivo `.xlsx`
- Usa `xlsx` para ler a planilha
- Normaliza nomes (UPPER + TRIM) para match com revendedoras existentes
- Preview com tabela de correspondências antes de confirmar
- Mutation que faz UPDATE em batch no campo `whatsapp` da tabela `revendedoras`

### 2. Atualizar `Revendedoras.tsx`
- Adicionar botão "Importar WhatsApp" no header ou nos filtros
- Importar e renderizar o novo dialog

### Modelo da planilha esperada
| Nome | WhatsApp |
|------|----------|
| Maria Silva | 11999998888 |

Sem necessidade de migração SQL — apenas código frontend com updates diretos na tabela `revendedoras`.

