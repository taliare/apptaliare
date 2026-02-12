

# Correcao: Kit nao volta para posse do representante na desistencia

## Problema Identificado

O kit de codigo 5708 (kit_estoque_id: `8d63f297-a293-4847-bbe3-31a5ea0c6147`) continua com status `com_revendedora` mesmo apos a desistencia ter sido registrada com sucesso na cobranca.

A causa raiz e que o `UPDATE` no `kits_estoque` pode falhar silenciosamente (0 rows affected) sem gerar erro, e o codigo atual nao valida se a atualizacao realmente ocorreu.

## Correcoes

### 1. Correcao imediata dos dados (Migracao SQL)

Atualizar o kit 5708 para `com_representante` diretamente:

```
UPDATE kits_estoque 
SET status = 'com_representante' 
WHERE id = '8d63f297-a293-4847-bbe3-31a5ea0c6147';
```

### 2. Melhorar a mutation de desistencia (Cobranca.tsx)

Tornar a reversao do kit mais robusta:

- Usar `.select()` apos o `.update()` para verificar se a atualizacao realmente ocorreu
- Se a atualizacao via client falhar (0 rows), usar a funcao `reverter_entrega_kit` que ja existe no banco como SECURITY DEFINER (ignora RLS)
- Adicionar fallback usando o `codigo_nota` da cobranca caso `kit_estoque_id` nao seja encontrado
- Lancar erro explicito se o kit nao puder ser revertido

Logica melhorada:

```
// 2. Reverter kit_estoque para com_representante
if (cobranca.kit_entregue_id) {
  // Buscar kit_estoque_id
  const { data: kitEntregue } = await supabase
    .from('kits_entregues')
    .select('kit_estoque_id, codigo_mostruario')
    .eq('id', cobranca.kit_entregue_id)
    .single();

  if (kitEntregue?.kit_estoque_id) {
    const { data: updated, error: kitError } = await supabase
      .from('kits_estoque')
      .update({ status: 'com_representante' })
      .eq('id', kitEntregue.kit_estoque_id)
      .select('id');
    
    if (kitError) throw kitError;
    
    // Se update direto nao afetou nenhuma linha, usar funcao SECURITY DEFINER
    if (!updated || updated.length === 0) {
      const { data: resultado } = await supabase.rpc('reverter_entrega_kit', {
        p_codigo_kit: kitEntregue.codigo_mostruario,
        p_user_id: user?.id,
      });
      if (!resultado) throw new Error('Nao foi possivel reverter o kit');
    }
  }
}
```

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Corrigir kit 5708 para com_representante |
| src/pages/Cobranca.tsx | Melhorar mutation com verificacao + fallback via RPC |

## O que nao muda

- Status da cobranca (ja esta cancelado corretamente)
- Observacoes da cobranca (ja registrado)
- Demais dados historicos
