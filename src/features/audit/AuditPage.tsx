import { Badge } from '../../components/Badge'
import { auditRows } from '../../app/mockData'

export function AuditPage() {
  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Auditoría:</span>
        <select className="filter-select"><option>Todos los módulos</option><option>BOM</option><option>Mix versiones</option></select>
        <select className="filter-select"><option>Todos los tipos</option><option>future_change</option><option>month_forward_change</option></select>
        <input className="search-input" placeholder="Buscar motivo, usuario o campo..." style={{ marginLeft: 'auto' }} />
      </div>

      <div>
        {auditRows.map((row) => (
          <article className="audit-row" key={`${row.date}-${row.field}`}>
            <div>
              <div className="audit-date">{row.date}</div>
              <div className="audit-type">{row.module}</div>
            </div>
            <div>
              <div className="audit-user">{row.user}</div>
              <Badge>{row.type}</Badge>
            </div>
            <div>
              <div className="audit-field">{row.field}</div>
              <div className="audit-before">{row.before}</div>
            </div>
            <div>
              <div className="audit-field">Nuevo valor</div>
              <div className="audit-after">{row.after}</div>
            </div>
            <div>
              <div className="audit-field">Motivo</div>
              <div>{row.reason}</div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
