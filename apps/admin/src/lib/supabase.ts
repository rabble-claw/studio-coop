import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
// Admin app uses service role key to bypass RLS — this app is only accessible
// to platform administrators and needs unrestricted access to all studio data.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseServiceKey)
