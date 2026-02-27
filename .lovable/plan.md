
# Adicionar Botao "Encaminhar ao Juridico" na Agenda do Admin

## Contexto
Atualmente, apenas o representante pode encaminhar notas ao juridico pela tela de Cobranca (`Cobranca.tsx`). O admin, na tela Gerenciar Agenda (`GerenciarAgenda.tsx`), so consegue alterar o status para "juridico" editando a cobranca manualmente pelo dialog de edicao. Vamos adicionar um botao direto na tabela para agilizar esse processo.

## Alteracoes

### Arquivo: `src/pages/GerenciarAgenda.tsx`

1. **Importar icone `Scale`** (ja usado em outras partes do projeto para representar "Juridico")

2. **Criar mutation `juridicoMutation`** que atualiza o status da cobranca para `'juridico'` e preenche `data_encaminhado_juridico` com a data/hora atual (mesmo comportamento da tela do representante)

3. **Adicionar botao na coluna de acoes da tabela** (ao lado do botao de editar existente):
   - Botao com icone `Scale` e tooltip "Encaminhar ao Juridico"
   - Visivel apenas para cobrancas com status `pendente`, `parcial` ou `reagendado`
   - Cor roxa para manter consistencia visual com o tema "juridico" do sistema

4. **Adicionar dialog de confirmacao** para evitar cliques acidentais:
   - Exibe nome da revendedora, codigo da nota e valor
   - Botoes "Cancelar" e "Confirmar Encaminhamento"

## Detalhes Tecnicos

- A mutation usa o mesmo padrao do `Cobranca.tsx`: `status: 'juridico'` + `data_encaminhado_juridico: new Date().toISOString()`
- Invalida a query `todas-cobrancas-admin` apos sucesso
- Nenhuma alteracao de banco de dados necessaria (o campo `data_encaminhado_juridico` e o status `juridico` ja existem)
- Nenhuma alteracao de layout ou outras paginas
