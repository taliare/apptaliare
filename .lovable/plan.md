

# Integração Multi-Pedidos aos Ciclos

## Análise do Estado Atual

- `t2_ciclos` tem `pedido_id` (FK obrigatória, 1:1 com pedido)
- Ao criar ciclo, seleciona-se 1 pedido e o valor do kit vem dele
- Pedidos com `status = 'disponivel'` aparecem para seleção; após vincular, mudam para `em_ciclo`

## Alterações Necessárias

### 1. Banco de Dados (Migration)

Criar tabela junction `t2_ciclo_pedidos`:

```sql
CREATE TABLE public.t2_ciclo_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES t2_ciclos(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES t2_pedidos(id),
  criado_em timestamptz DEFAULT now(),
  UNIQUE(pedido_id) -- garante que pedido não é vinculado a mais de um ciclo
);

ALTER TABLE public.t2_ciclo_pedidos ENABLE ROW LEVEL SECURITY;

-- RLS: mesmas regras do ciclo (representante vê seus, admin vê todos)
CREATE POLICY "Representante pode ver seus t2_ciclo_pedidos" ON public.t2_ciclo_pedidos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM t2_ciclos WHERE t2_ciclos.id = t2_ciclo_pedidos.ciclo_id AND t2_ciclos.representante_id = auth.uid()));

CREATE POLICY "Representante pode criar t2_ciclo_pedidos" ON public.t2_ciclo_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM t2_ciclos WHERE t2_ciclos.id = t2_ciclo_pedidos.ciclo_id AND t2_ciclos.representante_id = auth.uid()));

CREATE POLICY "Admin full access t2_ciclo_pedidos" ON public.t2_ciclo_pedidos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

Tornar `pedido_id` no `t2_ciclos` nullable (manter por compatibilidade com ciclos existentes):

```sql
ALTER TABLE public.t2_ciclos ALTER COLUMN pedido_id DROP NOT NULL;
```

### 2. Frontend — T2Ciclos.tsx

**Seleção de pedidos**: Trocar o `Select` single por multi-select com checkboxes (lista de pedidos disponíveis com checkbox, mostrando código e valor).

**Cálculo automático do valor**: `valor_kit = SUM(pedidos selecionados)`. Exibir o total calculado no dialog.

**Criação do ciclo**: 
- Inserir ciclo com `pedido_id: null` e `valor_kit` = soma
- Inserir registros em `t2_ciclo_pedidos` para cada pedido selecionado
- Atualizar status de todos pedidos selecionados para `em_ciclo`

**Exibição nos cards**: Buscar pedidos vinculados via `t2_ciclo_pedidos` e mostrar os códigos no card do ciclo.

### 3. Query de pedidos disponíveis

Manter a query filtrando `status = 'disponivel'`. O UNIQUE constraint em `t2_ciclo_pedidos(pedido_id)` garante no banco que não haverá duplicação.

### Resumo

| Alteração | Local |
|-----------|-------|
| Criar tabela `t2_ciclo_pedidos` com RLS | Migration |
| Tornar `pedido_id` nullable em `t2_ciclos` | Migration |
| Multi-select de pedidos no dialog de criação | `T2Ciclos.tsx` |
| Valor do kit calculado automaticamente | `T2Ciclos.tsx` |
| Exibir códigos dos pedidos nos cards | `T2Ciclos.tsx` |

Nenhuma alteração em lógica financeira (apuração, pagamentos, adiantamentos).

