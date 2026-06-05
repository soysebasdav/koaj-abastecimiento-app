import { Badge } from '../../components/Badge'
import { KpiCard } from '../../components/KpiCard'
import { TableShell } from '../../components/TableShell'
import { materialRequirements } from '../../app/mockData'

export function SupplyPage() {
  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Filtros:</span>
        <select className="filter-select"><option>Todos los meses</option><option>Dic 2026</option></select>
        <select className="filter-select"><option>Todos los materiales</option><option>Telas</option><option>Insumos</option></select>
        <button className="filter-chip active" type="button">Todos</button>
        <button className="filter-chip" type="button">Crítico</button>
        <button className="filter-chip" type="button">Atención</button>
        <input className="search-input" placeholder="Buscar material..." style={{ marginLeft: 'auto' }} />
      </div>

      <div className="kpi-row compact">
        <KpiCard label="Necesidad total" value="124.800" sub="unidades material" />
        <KpiCard label="Faltantes" value="3" sub="materiales" tone="alert" />
        <KpiCard label="Cobertura" value="71%" sub="promedio" tone="warn" />
        <KpiCard label="Riesgo diciembre" value="4" sub="FITs críticos" tone="alert" />
      </div>

      <TableShell title="Necesidad de materiales" subtitle="Resultado de proyección FIT × mix versión × consumo BOM">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Mes</th>
              <th>Necesidad</th>
              <th>Disponible</th>
              <th>Pendiente por pedir</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {materialRequirements.map((row) => (
              <tr key={`${row.material}-${row.month}`}>
                <td>{row.material}</td>
                <td>{row.month}</td>
                <td>{row.required}</td>
                <td>{row.available}</td>
                <td>{row.pending}</td>
                <td><Badge>{row.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
