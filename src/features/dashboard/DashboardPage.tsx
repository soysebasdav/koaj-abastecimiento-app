import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { KpiCard } from '../../components/KpiCard'
import { TableShell } from '../../components/TableShell'
import { formatDateMonth, formatNumber, formatQuantity } from '../../utils/format'
import type { AppSection } from '../../app/navigation'
import { loadDashboardData, type DashboardData } from './dashboardService'

type DashboardPageProps = {
  onNavigate: (section: AppSection) => void
}

const materialTypeLabels: Record<string, string> = {
  fabric: 'Tela',
  button: 'Botón',
  pocket_fabric: 'Tela bolsillo',
  label: 'Marquilla',
  zipper: 'Cremallera',
  thread: 'Hilo',
  packaging: 'Empaque',
  other: 'Otro',
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    setError(null)

    try {
      setData(await loadDashboardData())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el dashboard.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const topRequirements = useMemo(() => {
    return [...(data?.requirements ?? [])]
      .sort((a, b) => b.requiredQuantity - a.requiredQuantity)
      .slice(0, 6)
  }, [data])

  const totalsByType = useMemo(() => {
    const totals = new Map<string, number>()

    for (const row of data?.requirements ?? []) {
      totals.set(row.materialType, (totals.get(row.materialType) ?? 0) + row.requiredQuantity)
    }

    const max = Math.max(...Array.from(totals.values()), 0)

    return Array.from(totals.entries())
      .map(([type, total]) => ({
        type,
        label: materialTypeLabels[type] ?? type,
        total,
        percentage: max > 0 ? Math.round((total / max) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [data])

  const totalRequired = (data?.requirements ?? []).reduce((sum, row) => sum + row.requiredQuantity, 0)

  return (
    <>
      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="kpi-row">
        <KpiCard label="FITs activos" value={isLoading ? '...' : String(data?.fitCount ?? 0)} sub="tabla fits" tone="ok" />
        <KpiCard label="Materiales" value={isLoading ? '...' : String(data?.materialCount ?? 0)} sub="tabla materials" />
        <KpiCard label="Colecciones" value={isLoading ? '...' : String(data?.collectionCount ?? 0)} sub="tabla collections" />
        <KpiCard label="Proyecciones" value={isLoading ? '...' : String(data?.forecastCount ?? 0)} sub="mensuales por FIT" />
        <KpiCard label="Necesidad total" value={isLoading ? '...' : formatNumber(totalRequired, 2)} sub="vista SQL calculada" />
        <KpiCard label="Cambios auditados" value={isLoading ? '...' : String(data?.auditCount ?? 0)} sub="audit_logs" />
      </div>

      <div className="dashboard-grid">
        <TableShell title="Materiales con mayor necesidad" subtitle="Datos reales desde v_material_requirements_monthly">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Mes</th>
                <th>Tipo</th>
                <th>Necesidad</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6}>Cargando dashboard...</td></tr>
              ) : topRequirements.length === 0 ? (
                <tr><td colSpan={6}>No hay necesidad calculada. Carga colección, BOM y proyecciones.</td></tr>
              ) : topRequirements.map((row) => (
                <tr key={`${row.collectionId}-${row.periodMonth}-${row.materialId}`}>
                  <td>{row.materialName}</td>
                  <td>{formatDateMonth(row.periodMonth)}</td>
                  <td>{materialTypeLabels[row.materialType] ?? row.materialType}</td>
                  <td>{formatQuantity(row.requiredQuantity, row.unit)}</td>
                  <td><Badge>Calculado</Badge></td>
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
          <div className="table-title" style={{ marginBottom: 14 }}>Necesidad por tipo de material</div>
          {isLoading ? (
            <div className="table-subtitle">Cargando datos...</div>
          ) : totalsByType.length === 0 ? (
            <div className="table-subtitle">Sin datos calculados.</div>
          ) : (
            <div className="chart-bar-wrap">
              {totalsByType.map((item) => (
                <div className="chart-bar-row" key={item.type}>
                  <span className="chart-bar-label">{item.label}</span>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill" style={{ width: `${item.percentage}%` }}>
                      <span>{formatNumber(item.total, 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <TableShell title="Flujo BOM operativo" subtitle="Estado real de módulos principales">
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
            <tr><td>1</td><td>FIT / Silueta</td><td>Unidad base de planeación mensual</td><td><Badge>{(data?.fitCount ?? 0) > 0 ? 'Activo' : 'Atención'}</Badge></td></tr>
            <tr><td>2</td><td>Versiones</td><td>Color, tela principal y porcentaje de participación</td><td><Badge>Calculado</Badge></td></tr>
            <tr><td>3</td><td>Piezas BOM</td><td>Base, bolsillo, botón, marquilla, cremallera, empaque</td><td><Badge>Calculado</Badge></td></tr>
            <tr><td>4</td><td>Necesidad material</td><td>Proyección × mix × consumo efectivo</td><td><Badge>{(data?.requirements.length ?? 0) > 0 ? 'Calculado' : 'Atención'}</Badge></td></tr>
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
