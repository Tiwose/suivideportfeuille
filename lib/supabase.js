import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth helpers ──

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  })
  return { data, error }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── Portfolio helpers ──

export async function getPositions(userId) {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return { data: data || [], error }
}

export async function addPosition(userId, position) {
  const { data, error } = await supabase
    .from('positions')
    .insert({
      user_id: userId,
      symbol: position.symbol,
      name: position.name,
      quantity: position.quantity,
      buy_price: position.buyPrice,
      buy_date: position.buyDate || new Date().toISOString().split('T')[0]
    })
    .select()
  return { data, error }
}

export async function deletePosition(positionId) {
  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('id', positionId)
  return { error }
}

export async function updatePosition(positionId, updates) {
  const { data, error } = await supabase
    .from('positions')
    .update(updates)
    .eq('id', positionId)
    .select()
  return { data, error }
}
