
## Objetivo
Corrigir 2 problemas críticos no CRM de Leads:
1) Movimentação/drag dos cards no Kanban está “horrível” / difícil ou impossível de mover entre etapas.  
2) Exclusão às vezes não exclui e ainda “mata” a rolagem lateral do Kanban (só volta após reload).

Vou atacar os dois com mudanças que eliminam efeitos colaterais de modais (scroll-lock) e tornam o DnD previsível.

---

## Diagnóstico rápido (com base no código atual)
### 1) Drag “impossível” / ruim
- O Kanban usa `DndContext` + `useDraggable` nos cards e `useDroppable` nas colunas.
- A detecção de colisão está em `pointerWithin`, que costuma ser “exigente” e pode falhar em layouts com `ScrollArea` (viewport interno/overflow), principalmente quando o ponteiro está em cima de elementos dentro do container (cards) e a área droppable “real” não é detectada como esperado.
- As colunas não garantem altura total e o droppable fica “curto”/instável dependendo do layout, o que piora a experiência.
- Não existe `autoScroll` explícito e não há “snap”/estratégia de colisão mais tolerante (ex: `closestCorners`), que costuma ser melhor para Kanban.

### 2) Exclusão falhando + travando rolagem lateral
- O `Sheet` (detalhes do lead) é um modal que aplica scroll-lock em background.
- Já tivemos conflitos com confirmação via modal aninhado. Mesmo com `Dialog modal={false}`, ainda pode sobrar estado de scroll-lock ou prender a interação se algum fechamento ocorrer em ordem ruim, ou se algo ficar aberto/pendente após erro.
- Hoje o `deleteLead` faz 2 deleções sequenciais (histórico -> lead). Se a primeira falhar (RLS/permissão/erro de rede), o lead não apaga e o UI pode ficar num estado ruim (sheet aberto + scroll interno/externo estranho).

---

## Solução proposta (mudanças objetivas e “à prova de travamento”)

### Parte A — Exclusão sem travar (remover modal de confirmação)
Para acabar com o travamento de rolagem e com qualquer chance de scroll-lock ficar “sujo”, vou remover a confirmação em modal (`Dialog`/`AlertDialog`) dentro do `Sheet` e trocar por confirmação inline dentro do próprio `Sheet` (sem portal, sem overlay).

Como fica a UX:
- Botão “Excluir Lead”
- Ao clicar, abre um bloco inline: “Tem certeza?” com botões **Cancelar** e **Confirmar exclusão**
- Durante exclusão: botão fica desabilitado e mostra “Excluindo…”
- Em sucesso: fecha o Sheet, atualiza lista.
- Em erro: mostra toast e mantém o Sheet funcionando (sem travar rolagem lateral).

Isso elimina 100% da classe de bugs “modal/scroll-lock/portal” e também reduz a chance de você “perder créditos” com regressões desse tipo.

**Arquivo:** `src/components/leads/LeadDetailsSheet.tsx`  
**Mudanças:**
- Remover o `Dialog` de confirmação.
- Adicionar estado simples `confirmDeleteOpen` (ou reutilizar `showDeleteConfirm`) para renderizar o bloco inline.
- Garantir que, em `onError`, a UI volte ao normal (reabilitar botões, manter scroll ok).
- Opcional (bem útil): adicionar um `finally`/`onSettled` para sempre “limpar” estado local.

**Robustez extra (sem depender de UI):**
- No `mutationFn`, após o delete do lead, validar se realmente apagou (ex: checar retorno de `.delete().select('id')` ou usar `throw` se não vier nada). Assim não fica “silencioso”.

---

### Parte B — Deleção atômica e mais confiável (1 chamada no backend)
Hoje são duas deleções no client:
1) `leads_status_historico` (por lead_id)
2) `leads_revendedoras` (por id)

Isso é frágil: se a 1ª falhar, nada acontece; se a 2ª falhar, fica “meio caminho”.

Vou criar uma função no backend (banco) para deletar tudo de forma transacional:
- `delete_lead_and_history(lead_id uuid)`
- Dentro: `DELETE FROM leads_status_historico WHERE lead_id = ...; DELETE FROM leads_revendedoras WHERE id = ...;`
- Rodar em transação (o próprio Postgres garante atomicidade dentro da função).

**Vantagens:**
- 1 chamada no client (mais rápido, menos chance de travar UI).
- Se der erro, não deixa dados pela metade.
- Logs/erros mais claros.

**Necessita:** uma migration SQL e ajustar permissões/RLS para permitir execução por admin.  
(Como estamos em Lovable Cloud, eu faço isso via migration e regras adequadas.)

---

### Parte C — Melhorar o Drag do Kanban (movimentação fluida e fácil)
**Arquivo:** `src/components/leads/LeadsKanban.tsx` (+ ajustes pequenos em `KanbanColumn.tsx`)

Mudanças planejadas:
1) Trocar `collisionDetection` de `pointerWithin` para uma estratégia mais “amigável” em Kanban:
   - `closestCorners` (ou `rectIntersection` como alternativa)
   Isso normalmente resolve “não consigo soltar em outra coluna”.

2) Garantir que as colunas sejam droppables com área consistente:
   - Ajustar layout para que cada coluna ocupe a altura disponível (`h-full`), e o container de colunas também (ex: `items-stretch`).
   - No `KanbanColumn`, garantir `min-h` e `h-full` no wrapper, e manter um “drop zone” sempre presente mesmo com poucos cards.

3) Melhorar feedback de drop:
   - Manter o ring (já existe `isOver`) e garantir que ele funcione mesmo com scroll interno.

4) Ajuste opcional (se necessário) para UX:
   - Permitir arrastar clicando no card inteiro no desktop e manter “handle” para mobile, ou manter handle mas aumentar a área clicável do handle (p/ ficar mais fácil).

---

## Sequência de implementação (para reduzir risco de regressão)
1) Ajustar exclusão: remover confirmação modal e implementar confirmação inline no `Sheet`.
2) (Recomendado) Criar função transacional no backend para exclusão completa e trocar a mutação do client para chamar essa função.
3) Ajustar DnD do Kanban: collision detection + layout de colunas + drop-zone consistente.
4) Adicionar logs mínimos (temporários) apenas se ainda ocorrer falha (ex: log de `over.id` e status destino).

---

## Critérios de aceite (o que deve ficar perfeito)
1) Excluir lead:
   - Exclui sempre (sem “às vezes”).
   - Não trava rolagem lateral do Kanban depois.
   - Não precisa recarregar página.

2) Drag and drop:
   - Conseguir arrastar e soltar em qualquer coluna com facilidade.
   - Funcionar no desktop e no mobile (com handle).

---

## Testes manuais (passo a passo)
1) Abrir /leads-revendedoras, tentar mover um lead de “Leads Novos” para “Contato Realizado”.
2) Repetir movendo para uma coluna mais distante (até “Perdida”).
3) Abrir um lead, excluir:
   - Confirmar inline
   - Ver toast de sucesso
   - Ver lead sumir
   - Confirmar que a rolagem horizontal continua funcionando.
4) Forçar um erro (temporariamente, por exemplo sem permissão em teste) e confirmar:
   - Toast de erro aparece
   - UI não trava e rolagem horizontal continua.

---

## Arquivos que serão alterados
- `src/components/leads/LeadDetailsSheet.tsx` (principal: confirmação inline + mutação mais robusta)
- `src/components/leads/LeadsKanban.tsx` (collision detection e ajustes de DnD)
- `src/components/leads/KanbanColumn.tsx` (ajustes de layout/altura/drop zone)
- Migration SQL no backend (criar função transacional de exclusão e permissões)

