import { Badge } from '../../components/Badge'
import { KpiCard } from '../../components/KpiCard'
import { TableShell } from '../../components/TableShell'
import { alerts, kpis } from '../../app/mockData'
import type { AppSection } from '../../app/navigation'

type DashboardPageProps = {
  onNavigate: (section: AppSection) => void
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  return (
    <>
      <div className="kpi-row">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="dashboard-grid">
        <TableShell title="Alertas operativas" subtitle="Requieren atención inmediata">
          <table>
            <thead>
              <tr>
                <th>FIT</th>
                <th>Alerta</th>
                <th>Mes</th>
                <th>Severidad</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((item) => (
                <tr key={`${item.fit}-${item.alert}`}>
                  <td>{item.fit}</td>
                  <td>{item.alert}</td>
                  <td>{item.month}</td>
                  <td><Badge>{item.severity}</Badge></td>
                  <td>
                    <button className="action-btn" type="button" onClick={() => onNavigate('supply')}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>

        <section className="chart-svg-wrap">
          <div className="table-title" style={{ marginBottom: 14 }}>Riesgo por categoría</div>
          <div className="chart-bar-wrap">
            {[
              ['Jean', 78, 'warn'],
              ['Accesorios', 91, 'crit'],
              ['Chaqueta', 65, 'warn'],
              ['Punto', 42, 'ok'],
            ].map(([label, value, tone]) => (
              <div className="chart-bar-row" key={label}>
                <span className="chart-bar-label">{label}</span>
                <div className="chart-bar-track">
                  <div className={`chart-bar-fill ${tone}`} style={{ width: `${value}%` }}>
                    <span>{value}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <TableShell title="Flujo BOM operativo" subtitle="FIT → versiones → piezas → materiales → necesidad">
        <table>
          <thead>
            <tr>
              <th>Paso</th>
              <th>Entidad</th>
              <th>Propósito</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>FIT / Silueta</td><td>Unidad base de planeación mensual</td><td><Badge>Activo</Badge></td></tr>
            <tr><td>2</td><td>Versiones</td><td>Color, tela principal y porcentaje de participación</td><td><Badge>Activo</Badge></td></tr>
            <tr><td>3</td><td>Piezas BOM</td><td>Base, bolsillo, botón, marquilla, cremallera, empaque</td><td><Badge>Activo</Badge></td></tr>
            <tr><td>4</td><td>Necesidad material</td><td>Proyección × mix × consumo efectivo</td><td><Badge>Atención</Badge></td></tr>
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
