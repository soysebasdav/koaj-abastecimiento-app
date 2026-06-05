import { supabase } from '../../lib/supabase'

export type CollectionRecord = {
  id: string
  code: string
  name: string
  description: string | null
  start_month: string
  end_month: string
  status: 'draft' | 'active' | 'closed' | 'archived'
  created_at: string
  updated_at: string
}

export async function listCollections(): Promise<CollectionRecord[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('id, code, name, description, start_month, end_month, status, created_at, updated_at')
    .order('start_month', { ascending: false })

  if (error) throw new Error(error.message)

  return data ?? []
}
