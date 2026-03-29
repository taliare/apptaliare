import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const ALLOWED_USER_ID = 1087901146;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const categorias = [
  { id: '925cfd6b-137c-4d36-8b71-84ed3319f483', nome: 'FOLHA DE PAGAMENTOS' },
  { id: '626e8e4a-c68d-49c0-ad8c-ac158bf784ee', nome: 'DESPESAS DA EMPRESA' },
  { id: '3271f4ef-2239-4a72-bbe9-ee6167307f3a', nome: 'IMPOSTOS' },
  { id: '5f9496b3-8da3-45d9-a22b-c49521b5f98e', nome: 'DESPESAS BANCÁRIAS' },
  { id: '6aa0d834-8afc-44fb-9be9-60c602755969', nome: 'PRO LABORE' },
  { id: '7e676f99-352a-4fd5-9838-68b06fb5836b', nome: 'VALES' },
  { id: '28ee17dd-309e-4eb3-8b19-e789542ce8ed', nome: 'FORNECEDORES' },
  { id: '1121b299-d521-476f-9f0d-e37e87a100bb', nome: 'COMISSÕES' },
  { id: '36f93739-a18f-4cfe-9e8d-59d67fbcac2f', nome: 'INSUMOS DA EMPRESA (VARIÁVEIS)' },
];

async function sendTelegram(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

async function interpretarDespesa(mensagem: string): Promise<{ valor: number; categoria_id: string; categoria_nome: string; descricao: string } | null> {
  const prompt = `Você é um assistente financeiro. Analise a mensagem abaixo e extraia as informações de despesa.

Mensagem: "${mensagem}"

Categorias disponíveis:
${categorias.map(c => `- ${c.nome} (id: ${c.id})`).join('\n')}

Regras de categorização:
- FOLHA DE PAGAMENTOS: salários, pagamento de funcionários, CLT
- PRO LABORE: retirada do sócio, pró-labore
- DESPESAS DA EMPRESA: aluguel, água, luz, internet, telefone, material de escritório, gastos gerais
- FORNECEDORES: compra de produtos, matéria-prima, mercadoria para revenda de joias
- IMPOSTOS: DAS, MEI, imposto, taxa, tributo
- VALES: vale transporte, vale refeição, adiantamento para funcionário
- DESPESAS BANCÁRIAS: tarifa bancária, IOF, transferência, TED, DOC
- COMISSÕES: comissão de vendas, bonificação
- INSUMOS DA EMPRESA (VARIÁVEIS): embalagens, sacolas, etiquetas, material de expediente variável

Responda APENAS com JSON válido no formato:
{
  "valor": <número decimal>,
  "categoria_id": "<id da categoria>",
  "categoria_nome": "<nome da categoria>",
  "descricao": "<descrição curta e clara da despesa>"
}

Se não conseguir identificar um valor monetário, responda: {"erro": "sem_valor"}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const parsed = JSON.parse(text);
    if (parsed.erro) return null;
    return parsed;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.erro) return null;
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = message.chat?.id;
    const userId = message.from?.id;
    const text = message.text?.trim();

    // Verificar se é o usuário autorizado
    if (userId !== ALLOWED_USER_ID) {
      await sendTelegram(chatId, '❌ Acesso não autorizado.');
      return new Response('OK', { status: 200 });
    }

    // Comando /start
    if (text === '/start') {
      await sendTelegram(chatId,
        '👋 <b>Bot de Despesas Taliare</b>\n\n' +
        'Me mande uma mensagem com a despesa e eu registro automaticamente.\n\n' +
        '<b>Exemplos:</b>\n' +
        '• <i>500 aluguel escritório</i>\n' +
        '• <i>120 vale transporte Maria</i>\n' +
        '• <i>1500 fornecedor embalagens</i>\n' +
        '• <i>89,90 conta de luz</i>\n\n' +
        '✅ Eu categorizo automaticamente!'
      );
      return new Response('OK', { status: 200 });
    }

    // Ignorar outros comandos
    if (text?.startsWith('/')) {
      return new Response('OK', { status: 200 });
    }

    if (!text) return new Response('OK', { status: 200 });

    // Interpretar despesa
    await sendTelegram(chatId, '⏳ Processando...');

    const resultado = await interpretarDespesa(text);

    if (!resultado) {
      await sendTelegram(chatId,
        '❓ Não consegui identificar o valor da despesa.\n\n' +
        'Tente assim: <i>valor descrição</i>\n' +
        'Exemplo: <i>250 material de escritório</i>'
      );
      return new Response('OK', { status: 200 });
    }

    // Registrar no banco
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const hoje = new Date().toISOString().split('T')[0];
    const anoMes = hoje.substring(0, 7);

    const { error } = await supabase.from('dre_despesas').insert({
      categoria_id: resultado.categoria_id,
      ano_mes: anoMes,
      valor: resultado.valor,
      observacao: resultado.descricao,
      data_despesa: hoje,
    });

    if (error) {
      console.error('Erro ao inserir:', error);
      await sendTelegram(chatId, '❌ Erro ao registrar a despesa. Tente novamente.');
      return new Response('OK', { status: 200 });
    }

    const valorFormatado = resultado.valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    await sendTelegram(chatId,
      `✅ <b>Despesa registrada!</b>\n\n` +
      `💰 <b>Valor:</b> ${valorFormatado}\n` +
      `📂 <b>Categoria:</b> ${resultado.categoria_nome}\n` +
      `📝 <b>Descrição:</b> ${resultado.descricao}\n` +
      `📅 <b>Data:</b> ${new Date().toLocaleDateString('pt-BR')}`
    );

  } catch (err) {
    console.error('Erro geral:', err);
  }

  return new Response('OK', { status: 200 });
});
