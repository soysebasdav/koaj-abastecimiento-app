import { supabase } from '../../lib/supabase'

export type AuditLogRecord = {
  id: string
  user_id: string | null
  module_name: string
  table_name: string
  record_id: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  change_type: string
  affected_from_month: string | null
  affected_to_month: string | null
  reason: string | null
  created_at: string
}

export async function listAuditLogs(): Promise<AuditLogRecord[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      id,
      user_id,
      module_name,
      table_name,
      record_id,
      field_name,
      old_value,
      new_value,
      change_type,
      affected_from_month,
      affected_to_month,
      reason,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return data ?? []
}
