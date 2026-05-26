
## Objetivo

Fazer com que a logo já cadastrada em **Configuração PDF** (campo `pdf_config.logo_url`, hospedada no Supabase Storage) apareça no cabeçalho dos PDFs gerados pelo módulo **Montar Kit** (detalhado e resumido).

Sem alterações na tela de Configuração — ela já faz upload corretamente. Sem `localStorage`.

## Mudanças

### 1. `src/lib/montarKitPdf.ts`

- Adicionar função `carregarLogoBase64(url)` que baixa a imagem pública do Storage via `fetch` e converte para data URL base64 (necessário porque `jsPDF.addImage` precisa de base64, não de URL remota).
- Adicionar cache em memória (`Map<url, base64>`) para não rebaixar a imagem a cada PDF.
- Tornar `gerarPdfDetalhado` e `gerarPdfResumido` **async** e aceitar um parâmetro opcional `logoUrl?: string | null`. Pré-carregar a logo antes de chamar `drawHeader`.
- `drawHeader` recebe o base64 já pronto e desenha no canto superior direito (~ `x=150, y=6, w=46, h=24`) com `try/catch` silencioso em caso de falha. O texto "TALIARE" e demais elementos permanecem iguais.
- Manter assinatura compatível: se `logoUrl` for omitido/null, comportamento atual preservado.

### 2. `src/pages/MontarKit.tsx`

- Buscar `pdf_config.logo_url` via React Query (uma vez) ou em conjunto com a query existente.
- Passar `logoUrl` para `gerarPdfDetalhado` / `gerarPdfResumido` e usar `await`.

## Detalhes técnicos

- O bucket `avatars` já é público → `fetch` direto funciona sem auth.
- Conversão para base64 via `FileReader.readAsDataURL(blob)`.
- Cache: `const logoCache = new Map<string, string>()` no módulo.
- Sem alterações em schema, RLS, edge functions ou na página de Configuração.

## Fora de escopo

- `src/lib/generateLeadPdf.ts` (PDF de leads) — usa logo local importada via `assets`, não tocar.
- Outros geradores de PDF do projeto.
