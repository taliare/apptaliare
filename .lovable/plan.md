
# Busca de Revendedoras no Banco de Dados ao Registrar Entrega

## Objetivo
Substituir o campo de texto livre por um componente de busca que consulta a tabela `revendedoras` no banco de dados, permitindo selecionar uma revendedora existente ou cadastrar uma nova caso nao exista.

## Fluxo do Usuario

1. Representante clica em "Registrar Entrega de Kit"
2. Ao digitar no campo "Revendedora", o sistema busca na tabela `revendedoras` por nome OU WhatsApp (filtrado pelo `representante_id` do usuario logado)
3. Se encontrar resultados, exibe lista para selecao
4. Se nao encontrar, exibe botao "Cadastrar Nova Revendedora"
5. Ao clicar em "Cadastrar", abre um mini-formulario inline com campos: Nome Completo e WhatsApp
6. Ao salvar, insere na tabela `revendedoras` e ja seleciona automaticamente
7. O nome salvo na `revendedoras` e usado na entrega (sem digitacao livre)

## Alteracoes

### 1. Novo componente: `src/components/RevendedoraSearchSelect.tsx`
Componente reutilizavel que:
- Recebe `representanteId` como prop
- Busca revendedoras da tabela `revendedoras` filtrando por `representante_id`
- Pesquisa por nome OU WhatsApp em tempo real (debounce de 300ms)
- Exibe resultados com nome e WhatsApp
- Tem botao "Cadastrar Nova Revendedora" quando nao encontra
- Formulario inline de cadastro (nome + WhatsApp) com validacao de duplicatas via `UPPER(TRIM(nome))`
- Retorna o nome da revendedora selecionada/cadastrada via `onSelect(nome: string)`

### 2. Atualizar `src/pages/Kits.tsx` (linhas 321-328)
- Substituir o `<Input>` de "Nome da Revendedora" pelo novo `<RevendedoraSearchSelect>`
- Passar `representanteId={user.id}` e `onSelect={(nome) => setRevendedoraKit(nome)}`

### 3. Atualizar `src/pages/CobrancaDiaria.tsx` (linhas 1568-1578)
- Substituir o `<RevendedoraAutocomplete>` pelo novo `<RevendedoraSearchSelect>`
- Mesma logica: passar representante_id e receber o nome selecionado

### 4. Manter `RevendedoraAutocomplete.tsx`
- Pode ser removido depois se nao for mais usado em nenhum lugar, mas por seguranca sera mantido nesta etapa

## Detalhes Tecnicos

- A busca usa `supabase.from('revendedoras').select('id, nome, whatsapp').eq('representante_id', userId).or(\`nome.ilike.%${term}%,whatsapp.ilike.%${term}%\`).limit(10)`
- Ao cadastrar nova revendedora, faz INSERT na tabela `revendedoras` com `representante_id`, `nome`, `whatsapp`, `ativo: true`
- Validacao pre-insert: verifica se ja existe registro com mesmo `UPPER(TRIM(nome))` e `representante_id` para evitar duplicatas
- A constraint UNIQUE(nome, representante_id) ja existente no banco protege contra duplicatas no nivel do banco
- RLS ja permite representante ver suas revendedoras (SELECT) e admin gerenciar todas; sera necessario adicionar policy para representante poder INSERT suas proprias revendedoras

### Migracao necessaria
Adicionar RLS policy para permitir representantes criarem revendedoras:
```sql
CREATE POLICY "Representante pode cadastrar suas revendedoras"
ON revendedoras FOR INSERT
WITH CHECK (representante_id = auth.uid());
```
