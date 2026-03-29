

# Substituir PWAUpdateNotification por versão bloqueante

## Resumo
Substituir o componente de notificação PWA por um overlay fullscreen que bloqueia o uso do sistema até o usuário clicar "Atualizar agora". Remove o botão de fechar/dismiss.

## Alteração em `src/components/PWAUpdateNotification.tsx`

Substituir o arquivo inteiro por:
- Overlay fixo fullscreen com `z-[9999]`, backdrop blur e fundo escuro
- Card centralizado com ícone animado (rotate), título, descrição e botão "Atualizar agora"
- Mensagem de segurança ("Seus dados estão salvos")
- Remove import de `X` e uso de `dismissUpdate` — o usuário é obrigado a atualizar
- Mantém `usePWAUpdate` hook sem alterações

### Arquivo afetado
- `src/components/PWAUpdateNotification.tsx` — substituição completa (1 arquivo)

