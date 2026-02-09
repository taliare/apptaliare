

# Remover aviso sonoro ao fazer login

## Problema
Ao fazer login, o som de notificacao/mensagem toca imediatamente. Isso acontece porque os hooks `useNotifications` e `useMessages` possuem uma protecao de "carga inicial" (`isInitialLoadRef`), mas a inscricao realtime dispara um `refetch()` logo apos o login, o que causa uma segunda atualizacao do contador de nao-lidas — e nesse momento o som toca, pois o sistema interpreta como "novas" notificacoes.

## Solucao
Aumentar a janela de protecao do "carga inicial" para ignorar mudancas nos primeiros segundos apos a montagem do componente. Isso garante que qualquer refetch disparado pelo realtime logo apos o login nao acione o som.

## Detalhes Tecnicos

### Arquivos alterados

**`src/hooks/useNotifications.ts`** (linhas 96-107)
- Substituir a flag booleana `isInitialLoadRef` por um timestamp de montagem
- No `useEffect` que toca o som, ignorar mudancas que ocorram nos primeiros 5 segundos apos a montagem do hook
- Apos os 5 segundos, o comportamento permanece identico ao atual (som toca para novas notificacoes)

**`src/hooks/useMessages.ts`** (linhas 171-182)
- Mesma alteracao: usar timestamp de montagem em vez de flag booleana
- Ignorar mudancas nos primeiros 5 segundos

### Logica antes (ambos os hooks)
```typescript
if (isInitialLoadRef.current) {
  previousCountRef.current = unreadCount;
  isInitialLoadRef.current = false;
  return;
}
```

### Logica depois (ambos os hooks)
```typescript
const mountedAtRef = useRef<number>(Date.now());

// No useEffect:
const elapsedSinceMount = Date.now() - mountedAtRef.current;
if (elapsedSinceMount < 5000) {
  previousCountRef.current = unreadCount;
  return;
}
```

## O que nao muda
- Sons continuam funcionando para notificacoes/mensagens que chegam apos o login
- Vibracao continua funcionando normalmente
- Nenhuma alteracao no banco de dados
- Nenhuma alteracao visual

