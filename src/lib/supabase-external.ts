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
// CONFIGURE AQUI AS CREDENCIAIS DO SEU SUPABASE EXTERNO
// ====================================================================

// URL do projeto Supabase externo (ex: https://abc123.supabase.co)
const EXTERNAL_SUPABASE_URL = 'https://SEU_PROJETO_EXTERNO.supabase.co';

// Chave anon (pública) do projeto Supabase externo
const EXTERNAL_SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';

// ====================================================================

// Cliente tipado para uso em toda a aplicação
export const supabaseExternal = createClient<Database>(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Alias para facilitar a migração - use este export para substituir
// import { supabase } from "@/integrations/supabase/client"
// por
// import { supabase } from "@/lib/supabase-external"
export const supabase = supabaseExternal;
