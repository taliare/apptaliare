import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const allowedOrigins = [
  Deno.env.get('APP_URL') || '',
  'https://lovable.dev',
].filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isAllowed = allowedOrigins.some(allowed => origin === allowed) || 
                    origin.endsWith('.lovable.dev') || 
                    origin.endsWith('.lovableproject.com');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (allowedOrigins[0] || ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Use external Supabase credentials
const EXTERNAL_SUPABASE_URL = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
const EXTERNAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      EXTERNAL_SUPABASE_URL,
      EXTERNAL_SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header and verify user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (roleError || !roleData || roleData.role !== 'admin') {
      console.error('Authorization error - not admin:', roleError)
      return new Response(
        JSON.stringify({ error: 'Only admins can update user passwords' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { userId, newPassword } = await req.json()

    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'userId and newPassword are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password complexity (matching client-side requirements)
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter pelo menos 8 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!/[A-Z]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve conter pelo menos uma letra maiúscula' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!/[a-z]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve conter pelo menos uma letra minúscula' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!/[0-9]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'A senha deve conter pelo menos um número' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Updating password for user:', userId)

    // Update user password using admin client
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (error) {
      console.error('Error updating password:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Password updated successfully for user:', userId)

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
