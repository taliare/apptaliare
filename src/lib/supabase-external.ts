/**
 * Cliente Supabase Externo
 * 
 * Este arquivo conecta o projeto a um Supabase externo compartilhado
 * entre múltiplos projetos Lovable.
 * 
 * Suporta inicialização via:
 * 1. Variáveis de ambiente (VITE_EXTERNAL_SUPABASE_URL, VITE_EXTERNAL_SUPABASE_ANON_KEY)
 * 2. Fallback runtime via edge function get-external-supabase-config
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase as internalSupabase } from '@/integrations/supabase/client';

// Variáveis de ambiente (build-time)
const VITE_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || '';
const VITE_ANON_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY || '';

// Cache do cliente
let cachedClient: SupabaseClient<Database> | null = null;
let initPromise: Promise<SupabaseClient<Database>> | null = null;

/**
 * Busca configuração do Supabase externo via edge function (runtime)
 */
async function fetchExternalConfig(): Promise<{ url: string; anonKey: string } | null> {
  try {
    const { data, error } = await internalSupabase.functions.invoke('get-external-supabase-config');
    
    if (error) {
      console.error('[supabase-external] Erro ao buscar config:', error.message);
      return null;
    }
    
    if (data?.configured && data?.url && data?.anonKey) {
      return { url: data.url, anonKey: data.anonKey };
    }
    
    console.error('[supabase-external] Config incompleta:', data?.error || 'Sem detalhes');
    return null;
  } catch (err) {
    console.error('[supabase-external] Falha na chamada:', err);
    return null;
  }
}

/**
 * Inicializa o cliente Supabase externo (lazy, com fallback runtime)
 */
async function initClient(): Promise<SupabaseClient<Database>> {
  // Tenta usar variáveis de ambiente primeiro
  if (VITE_URL && VITE_ANON_KEY) {
    console.log('[supabase-external] Usando config de env vars');
    return createClient<Database>(VITE_URL, VITE_ANON_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  // Fallback: buscar via edge function
  console.log('[supabase-external] Env vars vazias, buscando via edge function...');
  const config = await fetchExternalConfig();
  
  if (config) {
    console.log('[supabase-external] Config obtida via edge function');
    return createClient<Database>(config.url, config.anonKey, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  throw new Error(
    'Supabase externo não configurado. Configure EXTERNAL_SUPABASE_URL e EXTERNAL_SUPABASE_ANON_KEY nos secrets do projeto.'
  );
}

/**
 * Obtém o cliente Supabase externo (async, com cache)
 */
export async function getSupabaseExternalClient(): Promise<SupabaseClient<Database>> {
  if (cachedClient) {
    return cachedClient;
  }

  if (!initPromise) {
    initPromise = initClient().then((client) => {
      cachedClient = client;
      return client;
    }).catch((err) => {
      initPromise = null; // Permite retry
      throw err;
    });
  }

  return initPromise;
}

/**
 * Verifica se as variáveis de ambiente estão configuradas (build-time)
 */
export function isExternalConfiguredViaEnv(): boolean {
  return Boolean(VITE_URL && VITE_ANON_KEY);
}

// ============================================================================
// EXPORTS LEGADOS (para compatibilidade)
// ============================================================================

// Proxy que lança erro se usado antes de inicializar
function createUninitializedProxy(): SupabaseClient<Database> {
  const message = 'Supabase externo não inicializado. Use getSupabaseExternalClient() ao invés de supabaseExternal.';
  
  return new Proxy({} as SupabaseClient<Database>, {
    get(_, prop) {
      // Permite verificar se é proxy
      if (prop === '__isProxy') return true;
      throw new Error(message);
    },
  });
}

/**
 * @deprecated Use getSupabaseExternalClient() para inicialização lazy
 */
export const supabaseExternal: SupabaseClient<Database> = 
  (VITE_URL && VITE_ANON_KEY)
    ? createClient<Database>(VITE_URL, VITE_ANON_KEY, {
        auth: {
          storage: localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : createUninitializedProxy();

/**
 * @deprecated Use getSupabaseExternalClient()
 */
export const supabase = supabaseExternal;
