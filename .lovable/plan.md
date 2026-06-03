# Reformulação do Cadastro de Revendedoras

## Estado atual (descoberto)

✅ Tabela `revendedoras` **já tem todas as colunas necessárias**: `foto_url`, `cpf`, `rg`, `data_nascimento`, `genero`, `estado_civil`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `email`, `telefone_alternativo`, `status_juridico` (com check `solicitado|aprovado|negado`), `data_solicitacao_juridico`, `motivo_juridico`, `data_aprovacao_juridico`, `aprovado_por`.
✅ Tabela `revendedoras_referencias` já existe com RLS por representante.
✅ RLS de `revendedoras` já isola por representante e libera admin.

→ **Não preciso de migração de schema.** Só criar o bucket de storage.

## Entregáveis

### 1. Storage
- Criar bucket público `revendedoras-fotos` (via `storage_create_bucket`).
- RLS em `storage.objects`:
  - SELECT público (bucket público).
  - INSERT/UPDATE/DELETE para `authenticated` (pasta `{revendedora_id}/...`).

### 2. Componente novo: `RevendedoraFormDialog`
Arquivo: `src/components/revendedoras/RevendedoraFormDialog.tsx`.
Dialog scrollável (`max-h-[85vh] flex-col overflow-y-auto`) com 4 seções em abas ou stacked:

**Dados Pessoais**
- Foto: avatar com botão "Upload" + botão "Câmera" (usa `navigator.mediaDevices.getUserMedia` → captura para `<canvas>` → blob → upload). Preview circular.
- Nome* (obrigatório), CPF* (com máscara `000.000.000-00`), RG, Data nascimento (date input), Gênero (Select: Feminino/Masculino/Outro), Estado civil (Select).

**Endereço**
- CEP com debounce 600ms → fetch `https://viacep.com.br/ws/{cep}/json/` → preenche logradouro/bairro/cidade/estado (campos em modo readonly se vieram do ViaCEP, mas editáveis).
- Número, Complemento manuais.

**Contato**
- WhatsApp* (máscara), Telefone alternativo, Email (validação zod).

**Referências**
- Lista dinâmica `useFieldArray`-style: cada item com Nome, Telefone, Vínculo + botão remover. Botão "Adicionar referência".
- No submit: faz `upsert` na revendedora, depois deleta refs antigas e insere as novas (ou diff).

Validação com **zod**: nome non-empty (≤120), cpf 11 dígitos, whatsapp non-empty. Demais opcionais.

### 3. Hook: `useRevendedoraStatus`
Arquivo: `src/hooks/useRevendedoraStatus.ts`.

Calcula status para uma ou várias revendedoras a partir de:
- `revendedoras.status_juridico`
- cobranças associadas (join via `revendedora` text norm ou `revendedora_id` se existir — verificar; nas memórias está em uppercase trim).

Prioridade do status (primeiro match vence):
1. `status_juridico = 'aprovado'` → **⛔ Jurídico** (vermelho escuro).
2. `status_juridico = 'solicitado'` → **⚖️ Sol. Jurídico** (roxo).
3. Existe cobrança `pendente` com `data_agendada` ≥ 30 dias atrás → **🔴 Inadimplente**.
4. Existe cobrança `pendente` com `data_agendada` entre 1 e 29 dias atrás → **⚠️ Em Atraso**.
5. Existe cobrança `parcial` → **🔵 Pagando**.
6. Existe cobrança `pendente` (futura/hoje) → **🟢 Ativa**.
7. Tem cobranças, todas `pago` → **✅ Quite**.
8. Nenhuma cobrança ativa → **⚪ Sem Kit**.

Exporta `{ status, label, color, blocked }`. `blocked = true` para Inadimplente, Sol. Jurídico, Jurídico.

Função utilitária `getRevendedoraStatusBadge(status)` retorna classes Tailwind/cor.

### 4. Listagem `src/pages/Revendedoras.tsx`
- Substituir o badge atual "Ativa/Inativa" pelo badge de status dinâmico.
- Substituir o ícone "Edit2" (que só edita WhatsApp) por botão "Editar" que abre `RevendedoraFormDialog`.
- Adicionar botão "Nova Revendedora" no topo (representante e admin).
- Filtro de status passa a aceitar os novos valores.
- Card de resumo mostra contagem por status.

### 5. Solicitação de Jurídico
- Botão "Solicitar Jurídico" no perfil/dialog (representante): abre prompt de motivo, atualiza `status_juridico='solicitado'`, `data_solicitacao_juridico=now()`, `motivo_juridico`.
- Botão "Aprovar Jurídico" / "Negar" / "Remover Status" (admin only): seta `aprovado` / `negado` / `null`, grava `aprovado_por`, `data_aprovacao_juridico`.

### 6. Bloqueio de nova cobrança
Em `MontarKit.tsx` / `CobrancaDiaria.tsx` / qualquer fluxo que cria `cobrancas_agendadas` para uma revendedora:
- Antes de inserir, calcular status via `useRevendedoraStatus` (ou função utilitária pura).
- Se `blocked`, abortar com `toast.error` explicando: "Revendedora bloqueada (status: X). Motivo: ..."
- **Locais a tocar**: `MontarKit.tsx` (entrega de kit), `CobrancaDiaria.tsx` se criar nota nova ali, e `RevendedoraAutocomplete`/`RevendedoraSearchSelect` mostrarem badge visualmente.

### 7. Perfil
`PerfilRevendedoraDialog.tsx` — adicionar header com foto, badge de status, botões de jurídico e link "Editar dados".

## Detalhes técnicos

- ViaCEP: `fetch('https://viacep.com.br/ws/' + cep.replace(/\D/g,'') + '/json/')`. Tratar `{erro: true}`.
- Câmera: stream do `getUserMedia({video:{facingMode:'environment'}})`, renderiza em `<video>`, snapshot via `<canvas>`, converte para Blob webp, upload no bucket com path `{revendedora_id || 'novo-' + uuid}/foto.webp`. Após upload, pega `publicUrl`.
- Máscaras: implementação inline simples (sem nova dep). CPF/WhatsApp formatadores em `src/lib/utils.ts`.
- Mobile-first, glassmorphism, paleta burgundy `#8B1538` (segue Core memory).

## Fora de escopo
- Migração de dados antigos (campos novos ficam null nos registros existentes — formulário aceita isso).
- Histórico de mudanças do status_juridico além dos campos já existentes.
- Tela admin dedicada de "Aprovação Jurídica" (faremos só os botões no dialog).