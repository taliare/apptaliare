Identifiquei a causa: ao abrir o perfil por um nome abreviado da cobrança, como “Francinete M. Costa Sampaio”, o sistema às vezes não encontra o cadastro real porque compara nome quase exato e não trata ponto/abreviação. Aí o botão Editar abre o formulário em modo “novo cadastro”, salva com sucesso, mas cria outro registro quase vazio em vez de atualizar o cadastro certo.

Plano de correção:

1. Corrigir a identificação da revendedora no perfil
- Ajustar a normalização de nomes para remover pontuação e tratar abreviações como “M.” = “Marinho”.
- Reaproveitar essa comparação tanto no perfil quanto nas listas, para que nomes vindos de cobranças/prestações encontrem o cadastro real.

2. Impedir edição sem ID válido
- No perfil, o botão Editar só abrirá quando houver `revendedoraInfo.id` carregado.
- Se o cadastro não for localizado, mostrar aviso claro em vez de abrir o formulário como novo cadastro.
- Isso impede o caso atual: clicar em Editar e inserir um novo registro vazio sem perceber.

3. Melhorar o salvamento
- Garantir que a edição sempre use `UPDATE` pelo ID existente, nunca `INSERT` quando veio do perfil.
- Após salvar, invalidar/recarregar as consultas certas para o perfil e listas refletirem os campos atualizados imediatamente.

4. Travar novas duplicações acidentais
- Ajustar a validação para não permitir novo cadastro com o mesmo CPF ou WhatsApp no mesmo representante, mantendo a edição do próprio registro liberada.
- Isso evita novos clones como os que apareceram no teste.

Arquivos previstos:
- `src/components/revendedoras/PerfilRevendedoraDialog.tsx`
- `src/pages/RevendedorasInativas.tsx`
- `src/pages/Revendedoras.tsx` se necessário para padronizar o match
- `src/components/revendedoras/RevendedoraFormDialog.tsx`
- Uma migration pequena para reforçar a regra anti-duplicidade por CPF/WhatsApp no banco