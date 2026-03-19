

# Exportar Cadastro de Lead em PDF

## Resumo

Adicionar um botao "Exportar Cadastro" no `LeadDetailsSheet` que gera um PDF branded da Taliare contendo todos os dados do formulario, status atual, responsavel e todas as observacoes registradas. O representante usa esse PDF para ativar o cadastro da revendedora com todas as anotacoes dos setores.

## Implementacao

### 1. Instalar dependencia

- Adicionar `jspdf` ao projeto (biblioteca leve para gerar PDFs no browser)

### 2. Criar utilitario `src/lib/generateLeadPdf.ts`

Funcao que recebe o lead + observacoes e gera o PDF:

- **Cabecalho**: Logo Taliare (usar `taliare-logo-horizontal.png` convertido para base64), titulo "Ficha de Cadastro — Revendedora", data de geracao
- **Secao 1 — Dados Pessoais**: Nome, WhatsApp, Instagram, Data de Nascimento, CPF, Estado Civil, E-mail, Telefone Alternativo, Profissao, Endereco
- **Secao 2 — Perfil Comercial**: Experiencia em Vendas, Capital Inicial, Motivacao, Restricao Serasa
- **Secao 3 — Status CRM**: Status atual, Responsavel pelo atendimento, Data de cadastro, Tentativas, Ultimo Envio, Origem
- **Secao 4 — Observacoes**: Lista cronologica com autor, data/hora e conteudo de cada observacao
- **Rodape**: "Documento gerado pelo sistema Taliare" + data/hora

### 3. Alterar `LeadDetailsSheet.tsx`

- Adicionar botao `<FileDown />` "Exportar Cadastro" no topo do sheet (ao lado do nome/badge)
- Ao clicar, buscar observacoes do lead via query e chamar `generateLeadPdf(lead, observacoes)`
- O PDF abre em nova aba ou faz download automatico

### Detalhes tecnicos

- `jspdf` gera o PDF inteiramente no client-side, sem necessidade de backend
- Logo sera importada como asset e convertida para base64 via canvas no momento da geracao
- Campos nulos exibem "Nao informado" no PDF (mesmo comportamento da UI)
- Observacoes ordenadas da mais antiga para a mais recente (ordem de leitura natural para o representante)

