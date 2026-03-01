
# Melhorias no Fechamento Diario - Autoridade Admin e Restricao Representante

## Resumo
Tres frentes de alteracao: (1) dar autoridade total ao admin no Fechamento Diario, (2) adicionar resumo de observacoes no filtro por periodo, (3) bloquear representantes de finalizar dias futuros.

---

## 1. Autoridade Total do Admin no Fechamento Diario (`FechamentoDiario.tsx`)

O admin ja pode reabrir e finalizar o dia. Faltam as seguintes acoes:

### 1.1 Adicionar/Editar Observacoes do Dia
- Adicionar campo de textarea para o admin inserir/editar observacoes quando o dia nao estiver finalizado
- Quando finalizado, permitir editar observacoes via botao "Editar Observacao"
- Mutation para salvar observacoes no campo `observacoes` da tabela `cobrancas_diarias`

### 1.2 Adicionar Notas do Dia pelo Representante
- Adicionar botao "Buscar Nota" no painel admin (similar ao existente em CobrancaDiaria)
- Admin busca uma nota da agenda do representante selecionado e registra a cobranca
- A nota e inserida em `notas_promissorias` com o `representante_id` do representante selecionado
- Necessita RLS policy para admin inserir em `notas_promissorias` (atualmente so representante pode inserir)

### 1.3 Permitir Alterar a Data da Cobranca
- Adicionar opcao no painel admin para alterar a data de uma nota existente (mover nota de um dia para outro)
- Util para correcoes de dias passados
- Mutation que atualiza o campo `data` em `notas_promissorias`

### 1.4 Adicionar Entrega de Kit pelo Representante
- Adicionar botao "Entregar Kit" no painel admin
- Admin seleciona um kit do estoque do representante selecionado, informa revendedora e data de vencimento
- Usa a mesma funcao RPC `entregar_kit_para_revendedora` passando o `representante_id` do selecionado
- Necessita que a funcao RPC aceite chamadas de admin (ja e SECURITY DEFINER, entao funciona)

---

## 2. Resumo de Observacoes no Filtro por Periodo (`FechamentoPeriodoView.tsx`)

- Adicionar novo Card "Observacoes do Periodo" abaixo da tabela de representantes
- Listar todas as `cobrancas_diarias` do periodo que possuem `observacoes` nao nulas
- Exibir: data, nome do representante, texto da observacao
- Ordenar por data (mais recente primeiro)
- Os dados ja estao sendo buscados na query existente (`cobrancasPeriodo`), basta filtrar e exibir

---

## 3. Bloquear Representante de Finalizar Dias Futuros (`CobrancaDiaria.tsx`)

- Adicionar validacao no botao "Confirmar Fechamento do Dia"
- Regra: representante so pode finalizar o dia atual (`today`) ou o dia anterior (`yesterday`)
- Se a data selecionada for posterior a hoje ou anterior a ontem, desabilitar o botao e mostrar mensagem
- A validacao e feita comparando `dateStr` com `getLocalDateString(new Date())` e o dia anterior

---

## Detalhes Tecnicos

### Migracoes de Banco Necessarias
1. **RLS para admin inserir em `notas_promissorias`**:
```sql
CREATE POLICY "Admin pode inserir notas" ON notas_promissorias
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

2. **RLS para admin atualizar notas** (alterar data):
```sql
CREATE POLICY "Admin pode atualizar notas" ON notas_promissorias
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
```

### Arquivos Modificados
- `src/pages/FechamentoDiario.tsx` - Adicionar acoes do admin (observacoes, buscar nota, alterar data, entregar kit)
- `src/components/fechamento/FechamentoPeriodoView.tsx` - Adicionar secao de observacoes do periodo
- `src/pages/CobrancaDiaria.tsx` - Adicionar restricao de data para finalizacao pelo representante

### Complexidade
- FechamentoDiario: alta (adicionar 4 funcionalidades novas com mutations e UI)
- FechamentoPeriodoView: baixa (filtrar dados ja existentes e exibir)
- CobrancaDiaria: baixa (uma condicao de validacao)
