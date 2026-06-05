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

export type AuditInput = {
  moduleName: string
  tableName: string
  recordId?: string | null
  fieldName?: string | null
  oldValue?: unknown
  newValue?: unknown
  changeType: 'create' | 'update' | 'delete' | 'future_change' | 'retroactive_change' | 'month_forward_change'
  affectedFromMonth?: string | null
  affectedToMonth?: string | null
  reason?: string | null
}

function stringifyAuditValue(value: unknown) {
  if (value === undefined || value === null || value === '') return null

  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export async function createAuditLog(input: AuditInput) {
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('audit_logs').insert({
    user_id: userData.user?.id ?? null,
    module_name: input.moduleName,
    table_name: input.tableName,
    record_id: input.recordId ?? null,
    field_name: input.fieldName ?? null,
    old_value: stringifyAuditValue(input.oldValue),
    new_value: stringifyAuditValue(input.newValue),
    change_type: input.changeType,
    affected_from_month: input.affectedFromMonth ?? null,
    affected_to_month: input.affectedToMonth ?? null,
    reason: input.reason ?? null,
  })

  if (error) throw new Error(error.message)
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
