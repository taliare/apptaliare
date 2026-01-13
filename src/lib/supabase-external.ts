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
