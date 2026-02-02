

## Plano: Integração do Formulário do Site com o CRM

### Resumo

A tabela `leads_revendedoras` já está pronta para receber dados do formulário do site. Ela possui uma política RLS de **inserção pública** (`INSERT` com `true`), permitindo que usuários não autenticados insiram leads diretamente.

O CRM já exibe todos os campos necessários quando você clica no card do lead:
- Nome e botão WhatsApp
- Cidade e Instagram
- Data e hora do cadastro
- Experiência em vendas, tempo disponível, capital inicial, motivação
- UTMs de rastreamento

---

### O Que Precisa Ser Feito

Basicamente, no site da Taliare, o formulário de cadastro precisa fazer uma chamada para inserir os dados na tabela `leads_revendedoras` do Supabase.

---

### Campos do Formulário

| Campo | Obrigatório | Coluna no Banco |
|-------|-------------|-----------------|
| Nome completo | Sim | `nome` |
| WhatsApp | Sim | `whatsapp` |
| Cidade | Não | `cidade` |
| Instagram | Não | `instagram` |
| Experiência em vendas | Não | `experiencia_vendas` |
| Tempo disponível | Não | `tempo_disponivel` |
| Capital inicial | Não | `capital_inicial` |
| Motivação | Não | `motivacao` |

Campos automáticos:
- `status` = "leads_novos" (default)
- `origem` = "site"
- `created_at` = data/hora atual
- UTMs da URL (opcional)

---

### Seção Técnica

#### Código para o Site da Taliare

O site precisa usar o cliente Supabase para inserir os dados. Aqui está um exemplo de como fazer:

```javascript
// Importar o cliente Supabase (usar as mesmas credenciais do projeto)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://iqluvckcmbcndjjkfznw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxbHV2Y2tjbWJjbmRqamtmem53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NDM3ODAsImV4cCI6MjA3OTExOTc4MH0.nh2LY9UqioO-2VweFbLPFDdIpy0NY_TjmG24vEw2wIQ'
)

// Função para enviar o formulário
async function enviarCadastro(dados) {
  // Capturar UTMs da URL (opcional)
  const urlParams = new URLSearchParams(window.location.search)
  
  const { error } = await supabase
    .from('leads_revendedoras')
    .insert({
      nome: dados.nome,
      whatsapp: dados.whatsapp,
      cidade: dados.cidade || null,
      instagram: dados.instagram || null,
      experiencia_vendas: dados.experiencia_vendas || null,
      tempo_disponivel: dados.tempo_disponivel || null,
      capital_inicial: dados.capital_inicial || null,
      motivacao: dados.motivacao || null,
      origem: 'site',
      status: 'leads_novos',
      utm_source: urlParams.get('utm_source') || null,
      utm_medium: urlParams.get('utm_medium') || null,
      utm_campaign: urlParams.get('utm_campaign') || null,
    })

  if (error) {
    console.error('Erro ao cadastrar:', error)
    throw error
  }
  
  return { success: true }
}
```

#### Exemplo de Uso no Formulário

```javascript
// No submit do formulário
form.addEventListener('submit', async (e) => {
  e.preventDefault()
  
  try {
    await enviarCadastro({
      nome: document.getElementById('nome').value,
      whatsapp: document.getElementById('whatsapp').value,
      cidade: document.getElementById('cidade').value,
      instagram: document.getElementById('instagram').value,
      experiencia_vendas: document.getElementById('experiencia').value,
      tempo_disponivel: document.getElementById('tempo').value,
      capital_inicial: document.getElementById('capital').value,
      motivacao: document.getElementById('motivacao').value,
    })
    
    alert('Cadastro realizado com sucesso!')
    // Redirecionar ou mostrar mensagem de sucesso
    
  } catch (error) {
    alert('Erro ao realizar cadastro. Tente novamente.')
  }
})
```

---

### Fluxo Completo

```text
┌─────────────────────────────────────────────────────────────┐
│                      SITE TALIARE                           │
│                                                             │
│   Formulário de Cadastro                                    │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Nome: [Maria Silva                    ]             │  │
│   │ WhatsApp: [11999998888                ]             │  │
│   │ Cidade: [São Paulo                    ]             │  │
│   │ Instagram: [@mariasilva               ]             │  │
│   │ ...mais campos...                                   │  │
│   │                       [ENVIAR CADASTRO]             │  │
│   └─────────────────────────────────────────────────────┘  │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼ INSERT via Supabase
                            
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                               │
│                                                             │
│   Tabela: leads_revendedoras                                │
│   - id: gerado automaticamente                              │
│   - created_at: timestamp automático                        │
│   - status: 'leads_novos' (default)                         │
│   - origem: 'site'                                          │
│   - dados do formulário...                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ Aparece automaticamente
                            
┌─────────────────────────────────────────────────────────────┐
│                   SISTEMA INTERNO (CRM)                     │
│                                                             │
│   Kanban - Leads Novos                                      │
│   ┌─────────────────────┐                                   │
│   │ Maria Silva         │                                   │
│   │ [WhatsApp]          │  ← Clicando aqui abre detalhes   │
│   │ São Paulo           │                                   │
│   │ site                │                                   │
│   │ 02/02/26 14:30      │                                   │
│   └─────────────────────┘                                   │
│                                                             │
│   Ao clicar no card:                                        │
│   - Nome, WhatsApp, Instagram                               │
│   - Cidade                                                  │
│   - Data e hora do cadastro                                 │
│   - Experiência em vendas                                   │
│   - Tempo disponível                                        │
│   - Capital inicial                                         │
│   - Motivação                                               │
│   - UTMs (se houver)                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### O Que Já Está Pronto

1. A tabela `leads_revendedoras` já existe com todos os campos
2. A política RLS já permite inserção pública (`INSERT` com `true`)
3. O CRM já exibe todos os campos quando você clica no card
4. O Realtime já está configurado para atualizar automaticamente

---

### O Que Você Precisa Fazer no Site

1. Instalar o pacote `@supabase/supabase-js` (se ainda não tiver)
2. Configurar o cliente Supabase com as credenciais acima
3. No submit do formulário, chamar a função de inserção
4. Os leads aparecerão automaticamente no CRM em tempo real

---

### Notificação de Novo Lead (Opcional)

Se quiser receber uma notificação quando um novo lead chegar, posso implementar um trigger no banco de dados que cria uma notificação para os admins automaticamente. Isso faria com que você veja um badge no sino de notificações sempre que um novo lead se cadastrar.

---

### Próximos Passos

Como o sistema interno já está pronto para receber os leads, a implementação é **no site da Taliare**. Você precisará:

1. Verificar qual tecnologia o site usa (React, Next.js, WordPress, etc.)
2. Adicionar o código de integração com Supabase
3. Testar o envio de um cadastro

Se preferir, posso criar uma **Edge Function** como alternativa, que funcionaria como uma API REST tradicional. Assim o site poderia fazer um POST para uma URL e não precisaria do SDK do Supabase.

