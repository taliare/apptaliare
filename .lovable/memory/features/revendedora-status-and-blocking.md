---
name: revendedora-status-and-blocking
description: Dynamic status badge for revendedoras (Ativa/Pagando/Em Atraso/Inadimplente/Jurídico/Quite/Sem Kit) and blocking new charges
type: feature
---

Status calculado em `src/lib/revendedoraStatus.ts` via `calcularStatusRevendedora(rev, cobrancas)`. Prioridade: jurídico aprovado → jurídico solicitado → inadimplente (≥30d) → em atraso (1-29d) → pagando (parcial) → ativa (pendente futura) → quite (todas pagas) → sem kit.

Bloqueio: `statusInfo.blocked = true` para inadimplente, juridico_solicitado, juridico_aprovado. Use `fetchStatusRevendedoraPorNome(nome)` antes de inserir cobrança — já implementado em `Kits.tsx` (entregaKitMutation). Replicar nos demais pontos que criam `cobrancas_agendadas` para revendedoras.

Foto: bucket privado `revendedoras-fotos`, acessar via `useFotoUrl(path)` (signed URL 1h). Upload via `uploadRevendedoraFoto(blob, id)`.

Form completo em `RevendedoraFormDialog.tsx` — usa ViaCEP, captura de câmera, refs dinâmicas. Solicitação/aprovação jurídica em `PerfilRevendedoraDialog.tsx`.
