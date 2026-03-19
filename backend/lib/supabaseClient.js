const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || ''

function getSupabaseKey() {
  return serviceRoleKey || publishableKey
}

function hasServiceRoleKey() {
  return Boolean(serviceRoleKey)
}

function isSupabaseConfigured() {
  return Boolean(supabaseUrl && getSupabaseKey())
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null
  }

  return createClient(supabaseUrl, getSupabaseKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function getSupabaseStatus() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return {
      configured: false,
      reachable: false,
      message: 'SUPABASE_URL e uma chave (SERVICE_ROLE ou PUBLISHABLE) sao obrigatorios',
      projectUrl: supabaseUrl || null,
      keyType: null,
    }
  }

  const client = getSupabaseClient()

  try {
    const { error } = await client.storage.listBuckets()

    if (error) {
      return {
        configured: true,
        reachable: false,
        message: error.message,
        projectUrl: supabaseUrl,
        keyType: hasServiceRoleKey() ? 'service_role' : 'publishable',
        canAdminSync: hasServiceRoleKey(),
      }
    }

    return {
      configured: true,
      reachable: true,
      message: 'Conexao com Supabase ativa',
      projectUrl: supabaseUrl,
      keyType: hasServiceRoleKey() ? 'service_role' : 'publishable',
      canAdminSync: hasServiceRoleKey(),
    }
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      message: error.message,
      projectUrl: supabaseUrl,
      keyType: hasServiceRoleKey() ? 'service_role' : 'publishable',
      canAdminSync: hasServiceRoleKey(),
    }
  }
}

module.exports = {
  getSupabaseClient,
  getSupabaseStatus,
  hasServiceRoleKey,
  isSupabaseConfigured,
}
