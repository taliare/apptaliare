import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const ALLOWED_USER_ID = 1087901146;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const categorias = [
  {
    id: '925cfd6b-137c-4d36-8b71-84ed3319f483',
    nome: 'FOLHA DE PAGAMENTOS',
    palavras: ['salario', 'salário', 'funcionario', 'funcionário', 'clt', 'folha', 'pagamento funcionario', 'empregado'],
  },
  {
    id: '6aa0d834-8afc-44fb-9be9-60c602755969',
    nome: 'PRO LABORE',
    palavras: ['pro labore', 'pró labore', 'prolabore', 'retirada socio', 'retirada sócio', 'retirada do socio'],
  },
  {
    id: '7e676f99-352a-4fd5-9838-68b06fb5836b',
    nome: 'VALES',
    palavras: ['vale', 'vt', 'vale transporte', 'vale refeicao', 'vale refeição', 'adiantamento', 'vale funcionario'],
  },
  {
    id: '3271f4ef-2239-4a72-bbe9-ee6167307f3a',
    nome: 'IMPOSTOS',
    palavras: ['imposto', 'das', 'mei', 'taxa', 'tributo', 'simples', 'inss', 'fgts', 'irpf', 'irpj', 'nota fiscal'],
  },
  {
    id: '5f9496b3-8da3-45d9-a22b-c49521b5f98e',
    nome: 'DESPESAS BANCÁRIAS',
    palavras: ['tarifa', 'banco', 'bancaria', 'bancária', 'iof', 'ted', 'doc', 'transferencia bancaria', 'taxa bancaria', 'juros'],
  },
  {
    id: '1121b299-d521-476f-9f0d-e37e87a100bb',
    nome: 'COMISSÕES',
    palavras: ['comissao', 'comissão', 'bonificacao', 'bonificação', 'bonus', 'bônus', 'comissao de venda'],
  },
  {
    id: '28ee17dd-309e-4eb3-8b19-e789542ce8ed',
    nome: 'FORNECEDORES',
    palavras: ['fornecedor', 'compra', 'mercadoria', 'produto', 'joia', 'joias', 'semijoia', 'semijoias', 'estoque', 'materia prima', 'matéria prima'],
  },
  {
    id: '36f93739-a18f-4cfe-9e8d-59d67fbcac2f',
    nome: 'INSUMOS DA EMPRESA (VARIÁVEIS)',
    palavras: ['embalagem', 'sacola', 'etiqueta', 'insumo', 'material', 'caixa', 'fita', 'papel', 'impressao', 'impressão', 'cartao de visita'],
  },
  {
    id: '626e8e4a-c68d-49c0-ad8c-ac158bf784ee',
    nome: 'DESPESAS DA EMPRESA',
    palavras: ['aluguel', 'luz', 'agua', 'água', 'internet', 'telefone', 'celular', 'energia', 'conta', 'despesa', 'gasto', 'mensalidade', 'assinatura', 'limpeza', 'manutencao', 'manutenção'],
  },
];

function extrairValor(texto: string): number | null {
  const padroes = [
    /R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/,
    /R?\$?\s*(\d+(?:,\d{2})?)/,
    /(\d+(?:\.\d{2})?)/,
  ];

  for (const padrao of padroes) {
    const match = texto.match(padrao);
    if (match) {
      let valorStr = match[1].replace(/\./g, '').replace(',', '.');
      const valor = parseFloat(valorStr);
      if (valor > 0) return valor;
    }
  }
  return null;
}

function categorizarDespesa(texto: string): typeof categorias[0] {
  const textoLower = texto.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const cat of categorias) {
    for (const palavra of cat.palavras) {
      const palavraNorm = palavra.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (textoLower.includes(palavraNorm)) {
        return cat;
      }
    }
  }

  return categorias[8];
}

async function sendTelegram(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
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

    if (userId !== ALLOWED_USER_ID) {
      await sendTelegram(chatId, '❌ Acesso não autorizado.');
      return new Response('OK', { status: 200 });
    }

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

    if (text?.startsWith('/')) return new Response('OK', { status: 200 });
    if (!text) return new Response('OK', { status: 200 });

    const valor = extrairValor(text);

    if (!valor) {
      await sendTelegram(chatId,
        '❓ Não consegui identificar o valor.\n\n' +
        'Tente assim: <i>valor descrição</i>\n' +
        'Exemplo: <i>250 material de escritório</i>'
      );
      return new Response('OK', { status: 200 });
    }

    const categoria = categorizarDespesa(text);

    const descricao = text
      .replace(/R?\$?\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g, '')
      .replace(/R?\$?\s*\d+(?:,\d{2})?/g, '')
      .trim()
      .replace(/\s+/g, ' ') || 'Despesa registrada via Telegram';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const hoje = new Date().toISOString().split('T')[0];
    const anoMes = hoje.substring(0, 7);

    const { error } = await supabase.from('dre_despesas').insert({
      categoria_id: categoria.id,
      ano_mes: anoMes,
      valor,
      observacao: descricao,
      data_despesa: hoje,
    });

    if (error) {
      console.error('Erro ao inserir:', error);
      await sendTelegram(chatId, '❌ Erro ao registrar. Tente novamente.');
      return new Response('OK', { status: 200 });
    }

    const valorFormatado = valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    await sendTelegram(chatId,
      `✅ <b>Despesa registrada!</b>\n\n` +
      `💰 <b>Valor:</b> ${valorFormatado}\n` +
      `📂 <b>Categoria:</b> ${categoria.nome}\n` +
      `📝 <b>Descrição:</b> ${descricao}\n` +
      `📅 <b>Data:</b> ${new Date().toLocaleDateString('pt-BR')}`
    );

  } catch (err) {
    console.error('Erro geral:', err);
  }

  return new Response('OK', { status: 200 });
});
