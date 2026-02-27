

# Varredura de Seguranca - Correcoes Necessarias

## 1. Aviso "Site Nao Seguro" no Navegador

Este aviso aparece quando o certificado SSL do dominio personalizado nao esta configurado corretamente. Isso NAO e um problema no codigo -- e uma configuracao de infraestrutura.

**Acao necessaria (do usuario):** Ir em Settings > Custom Domain no Lovable e verificar se o SSL esta ativo para `taliare.com.br`. Se necessario, remover e re-adicionar o dominio para forcar a renovacao do certificado.

## 2. Meta Tags Apontando para Lovable (CORRIGIR)

O `index.html` ainda possui meta tags Open Graph e Twitter apontando para o Lovable:

```text
<meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@Lovable" />
<meta name="twitter:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
```

**Correcao:** Substituir as imagens OG por uma imagem da TALIARE e remover referencia ao @Lovable:
- Usar `/icons/icon-512x512.png` como imagem OG (ou criar uma imagem propria)
- Alterar `twitter:site` para a conta da TALIARE ou remover
- Atualizar og:image e twitter:image para apontar para `https://taliare.com.br/icons/icon-512x512.png`

## 3. Leaked Password Protection Desabilitada (CORRIGIR)

O sistema nao verifica se as senhas dos usuarios foram vazadas em breaches conhecidos. Isso e uma configuracao do backend de autenticacao.

**Correcao:** Nao e possivel alterar essa configuracao via codigo -- e uma opcao do painel do backend. Sera documentado como recomendacao.

## 4. Security Definer View - profiles_limited (JA TRATADO)

A view `profiles_limited` usa SECURITY DEFINER propositalmente para expor apenas campos nao sensiveis (nome, avatar). Isso ja foi analisado e esta correto conforme a arquitetura do projeto.

## 5. Politicas RLS - Analise (JA CORRETAS)

Todas as tabelas usam politicas **RESTRICTIVE** (negam por padrao). O scanner reporta falsos positivos porque nao detecta que politicas RESTRICTIVE ja bloqueiam acesso anonimo. As tabelas criticas estao protegidas:
- `profiles`: Apenas admin ou proprio usuario
- `cobrancas_agendadas`: Apenas admin ou representante dono
- `leads_revendedoras`: Apenas admin
- `messages`: Apenas remetente/destinatario
- Todas as demais: Devidamente protegidas

## Resumo das Acoes

| Item | Severidade | Acao |
|------|-----------|------|
| Meta tags OG/Twitter com Lovable | Media | Corrigir no index.html |
| Aviso SSL "nao seguro" | Alta | Usuario verificar configuracao do dominio |
| Leaked password protection | Baixa | Recomendacao (configuracao do backend) |
| RLS policies | OK | Ja estao corretas |
| SECURITY DEFINER functions | OK | Ja revisadas e seguras |

## Arquivos a Modificar

- **`index.html`**: Atualizar meta tags og:image, twitter:image e twitter:site para usar assets da TALIARE em vez do Lovable

