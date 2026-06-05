import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { formatDate, formatDateMonth } from '../../utils/format'
import { listAuditLogs, type AuditLogRecord } from './auditService'

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadLogs() {
    setIsLoading(true)
    setError(null)

    try {
      setLogs(await listAuditLogs())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la auditoría.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadLogs()
  }, [])

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return logs

    return logs.filter((log) =>
      [
        log.module_name,
        log.table_name,
        log.field_name ?? '',
        log.old_value ?? '',
        log.new_value ?? '',
        log.change_type,
        log.reason ?? '',
      ].join(' ').toLowerCase().includes(query),
    )
  }, [logs, search])

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Auditoría real:</span>
        <button className="filter-chip active" type="button">Supabase conectado</button>
        <button className="filter-chip" type="button">{filteredLogs.length} registros</button>
        <input
          className="search-input"
          placeholder="Buscar motivo, módulo, tabla o campo..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ marginLeft: 'auto' }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadLogs()}>
          Recargar
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}

      {isLoading ? (
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">Cargando auditoría</span>
            <span className="table-subtitle">Consultando audit_logs</span>
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">Sin registros de auditoría</span>
            <span className="table-subtitle">Cuando la app registre cambios, aparecerán aquí.</span>
          </div>
        </div>
      ) : (
        <div>
          {filteredLogs.map((log) => (
            <article className="audit-row" key={log.id}>
              <div>
                <div className="audit-date">{formatDate(log.created_at)}</div>
                <div className="audit-type">{log.module_name}</div>
              </div>
              <div>
                <div className="audit-user">{log.table_name}</div>
                <Badge>{log.change_type}</Badge>
              </div>
              <div>
                <div className="audit-field">{log.field_name ?? 'Registro'}</div>
                <div className="audit-before">{log.old_value ?? '-'}</div>
              </div>
              <div>
                <div className="audit-field">Nuevo valor</div>
                <div className="audit-after">{log.new_value ?? '-'}</div>
              </div>
              <div>
                <div className="audit-field">Motivo / vigencia</div>
                <div>{log.reason ?? 'Sin motivo registrado'}</div>
                <div className="audit-date">
                  Desde {formatDateMonth(log.affected_from_month)} hasta {formatDateMonth(log.affected_to_month)}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
