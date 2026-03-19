

# Ações Rápidas na Lista de Ciclos T2

## Contexto

Atualmente os cards de ciclo têm botões "Prestação" e "Adiantamento". O pedido é adicionar "Registrar Pagamento" e "Registrar Interação" diretamente nos cards.

## Banco de Dados

### Nova tabela: `t2_interacoes`

Não existe tabela de interações. Criar:

```sql
CREATE TABLE public.t2_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES t2_ciclos(id) ON DELETE CASCADE,
  observacao text NOT NULL,
  registrado_por uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.t2_interacoes ENABLE ROW LEVEL SECURITY;

-- RLS: usuário autenticado pode inserir e ler suas interações
-- Admin vê tudo, representante vê apenas do seu ciclo
CREATE POLICY "Users can insert interacoes"
  ON public.t2_interacoes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view interacoes"
  ON public.t2_interacoes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.t2_ciclos c
      WHERE c.id = ciclo_id
      AND (c.representante_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
      )
  );
```

## Alterações no Frontend

### 1. Novo componente: `src/components/t2/InteracaoDialog.tsx`

Dialog simples com:
- Campo de texto (Textarea) para observação
- Botão "Registrar"
- Insert em `t2_interacoes` com `ciclo_id`, `observacao`, `registrado_por`

### 2. Novo componente: `src/components/t2/QuickPagamentoDialog.tsx`

Dialog simplificado (diferente do PagamentoDialog existente que precisa de `apuracao`):
- Campos: valor, forma de pagamento
- Busca a apuração do ciclo automaticamente
- Se o ciclo não tiver apuração, mostra mensagem e desabilita
- Reutiliza `FORMAS_PAGAMENTO` e a mesma lógica de insert em `t2_pagamentos`

### 3. `src/pages/T2Ciclos.tsx`

Adicionar dois novos botões em cada card de ciclo (na seção de ações, linhas 413-431):
- **"Pagamento"** — abre `QuickPagamentoDialog` (só habilitado se ciclo tem apuração)
- **"Interação"** — abre `InteracaoDialog`

Adicionar states: `pagamentoCiclo` e `interacaoCiclo` para controlar qual ciclo está selecionado.

### Layout dos botões no card

Os 4 botões (Prestação, Adiantamento, Pagamento, Interação) serão dispostos em grid 2x2 para caber no card sem poluir.

