/**
 * Cliente Supabase Externo
 * 
 * Este arquivo conecta o projeto a um Supabase externo compartilhado
 * entre múltiplos projetos Lovable.
 * 
 * INSTRUÇÕES:
 * 1. Substitua EXTERNAL_SUPABASE_URL pela URL do seu projeto Supabase externo
 * 2. Substitua EXTERNAL_SUPABASE_ANON_KEY pela chave anon do seu projeto
 * 3. Execute o SQL de docs/SUPABASE_EXPORT.sql no Supabase externo
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// ====================================================================
// CREDENCIAIS DO SUPABASE EXTERNO (via variáveis de ambiente)
// ====================================================================

// URL do projeto Supabase externo
const EXTERNAL_SUPABASE_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || '';

// Chave anon (pública) do projeto Supabase externo
const EXTERNAL_SUPABASE_ANON_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY || '';

// ====================================================================

function createMissingExternalClient() {
  const message =
    'Supabase externo não configurado: defina VITE_EXTERNAL_SUPABASE_URL e VITE_EXTERNAL_SUPABASE_ANON_KEY.';

  // Proxy para evitar crash no import (createClient exige URL) e falhar apenas quando usado.
  return new Proxy(
    {},
    {
      get() {
        throw new Error(message);
      },
    }
  ) as any;
}

// Cliente tipado para uso em toda a aplicação
export const supabaseExternal =
  EXTERNAL_SUPABASE_URL && EXTERNAL_SUPABASE_ANON_KEY
    ? createClient<Database>(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
        auth: {
          storage: localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : (createMissingExternalClient() as ReturnType<typeof createClient<Database>>);

// Alias para facilitar a migração - use este export para substituir
// import { supabase } from "@/integrations/supabase/client"
// por
// import { supabase } from "@/lib/supabase-external"
export const supabase = supabaseExternal;
