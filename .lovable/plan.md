## Diagnóstico

O salvamento no banco está funcionando para o Representante 1: encontrei registros atualizados e trilha de auditoria às 15:50. O problema que faz parecer que “não salvou” é de vínculo por nome:

- A listagem e o modal procuram o cadastro usando o texto da cobrança/prestação (`revendedora`).
- Quando o representante edita o cadastro e o nome é normalizado/alterado para maiúsculas ou nome completo, o cadastro atualizado deixa de bater exatamente com o nome antigo da cobrança/prestação.
- Resultado: o banco salva, mas a tela abre/mostra outro registro antigo ou um cadastro “limpo”.
- Também há cadastros duplicados por variação de nome, exemplo: `Ana Rafaela Sabino de Souza` e `ANA RAFAELA SABINO DE SOUZA`.
- O trigger de auditoria foi criado na migration, mas não está ativo no banco; vou recriá-lo de forma idempotente.

## Plano de correção

1. **Banco de dados**
   - Criar/atualizar uma função segura para normalizar nomes de revendedoras.
   - Criar uma função RPC para buscar o cadastro correto da revendedora por:
     - `representante_id`
     - `nome` exato ou nome normalizado
     - fallback por similaridade quando houver variação simples de maiúsculas/acentos
     - preferindo o cadastro mais recentemente atualizado e com dados preenchidos.
   - Recriar os triggers de auditoria de `revendedoras` para garantir histórico e `atualizado_em`.
   - Opcionalmente consolidar duplicados óbvios do Representante 1 quando o nome normalizado for igual, mantendo o registro mais completo/recente.

2. **Tela `RevendedorasInativas`**
   - Trocar os joins por nome exato para usar chave normalizada.
   - Quando abrir “Ver Perfil”, passar também o `revendedora_id` quando já existir, evitando depender só do nome.
   - Atualizar os invalidates após salvar para recarregar listagem, perfil e histórico.

3. **Modal `PerfilRevendedoraDialog`**
   - Aceitar `revendedoraId` opcional.
   - Buscar o cadastro pelo ID quando disponível.
   - Quando só houver nome, usar a nova função de busca robusta, em vez de `.eq('nome')`/`.ilike()` frágil.
   - Após editar e salvar, manter o modal apontado para o cadastro salvo.

4. **Formulário `RevendedoraFormDialog`**
   - Manter a checagem `.select('id')` no update.
   - Depois de salvar, invalidar todas as queries relacionadas à revendedora/listagem.
   - Se o nome foi alterado, garantir que o modal continue usando o ID correto.

5. **Correção paralela do erro do Maps**
   - Remover o fallback proibido `window.top.location.href` que gera `SecurityError` no preview.
   - Usar apenas abertura segura em nova aba/janela e mostrar aviso se o navegador bloquear.

## Validação

- Confirmar no banco que o cadastro alterado pelo Representante 1 aparece como atualizado.
- Confirmar que o modal “Ver Perfil” mostra o cadastro preenchido mesmo quando a cobrança/prestação tem o nome antigo.
- Confirmar que o histórico de edição aparece após nova alteração.
- Confirmar que clicar em “Ver localização” não gera mais erro de navegação bloqueada.