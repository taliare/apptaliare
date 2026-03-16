

# Reformular Exibição de Respostas dos Leads no CRM

## Problema Identificado

Analisei os dados reais dos leads sincronizados e encontrei dois problemas:

1. **Labels não correspondem às respostas** — Por exemplo, o campo `capital_inicial` mostra "3 ou mais" (resposta sobre kits), `profissao` mostra "Nao" (resposta sim/não sobre trabalho), `restricao_serasa` mostra "true" (booleano bruto).
2. **Campos `possui_veiculo` e `expectativa_venda` estão sempre vazios** — provavelmente o formulário externo não usa essas colunas ou mudou os nomes.

## Solução

Reformular o LeadDetailsSheet para exibir **todas as respostas do formulário** em formato de lista completa "Pergunta → Resposta", organizado em seções claras. Mostrar TODOS os campos que têm valor, sem esconder nada.

### Alterações no arquivo `src/components/leads/LeadDetailsSheet.tsx`:

**Seção "Respostas do Formulário"** — Nova seção que lista todos os campos de dados em formato tabular simples (label + valor), mostrando tudo que foi preenchido:

- Nome, WhatsApp, Instagram, Cidade
- Data de Nascimento, CPF, Estado Civil, E-mail
- Telefone Alternativo, Endereço, Bairro, CEP
- Profissão, Experiência em Vendas, Capital Inicial
- Tempo Disponível, Motivação
- Expectativa de Venda, Restrição Serasa, Possui Veículo
- Idade, Último Envio, Tentativas
- UTMs (source, medium, campaign)

Cada campo será exibido com label claro e valor formatado (ex: `restricao_serasa: "true"` → exibir "Sim"). Campos null serão mostrados como "Não informado" em cinza, para que o SDR saiba que o lead não respondeu aquela pergunta.

### Estrutura visual

```text
┌─────────────────────────────┐
│ Nome do Lead    [Status]    │
├─────────────────────────────┤
│ WhatsApp: (link)            │
│ Instagram: (link)           │
│ Cadastrado em: dd/mm/yyyy   │
│ Origem: site                │
├─────────────────────────────┤
│ Responsável: [Select]       │
├─────────────────────────────┤
│ TODAS AS RESPOSTAS          │
│ ┌─────────┬───────────────┐ │
│ │ Campo   │ Resposta      │ │
│ │ CPF     │ 123.456.789   │ │
│ │ Email   │ x@y.com       │ │
│ │ ...     │ ...           │ │
│ │ Veículo │ Não informado │ │
│ └─────────┴───────────────┘ │
├─────────────────────────────┤
│ Observação: [textarea]      │
│ Histórico de Status         │
│ [Excluir Lead]              │
└─────────────────────────────┘
```

### Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/components/leads/LeadDetailsSheet.tsx` | Substituir seções Dados Pessoais/Endereço/Perfil Comercial por lista completa de todos os campos com todos os valores visíveis |

