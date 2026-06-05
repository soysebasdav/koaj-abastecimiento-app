import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { TableShell } from '../../components/TableShell'
import { formatDateMonth, formatNumber } from '../../utils/format'
import { listForecasts, type ForecastView } from './forecastsService'

function mapForecastStatus(status: ForecastView['status']) {
  const labels: Record<ForecastView['status'], string> = {
    draft: 'Borrador',
    active: 'Activo',
    replaced: 'Reemplazada',
  }

  return labels[status]
}

export function ForecastsPage() {
  const [forecasts, setForecasts] = useState<ForecastView[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadForecasts() {
    setIsLoading(true)
    setError(null)

    try {
      setForecasts(await listForecasts())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las proyecciones.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadForecasts()
  }, [])

  const filteredForecasts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return forecasts

    return forecasts.filter((forecast) =>
      [
        forecast.collectionCode,
        forecast.fitCode,
        forecast.fitName,
        forecast.fitCategory ?? '',
        forecast.periodMonth,
        forecast.source,
        forecast.changeReason ?? '',
      ].join(' ').toLowerCase().includes(query),
    )
  }, [forecasts, search])

  const totalProjectedUnits = filteredForecasts.reduce((sum, forecast) => sum + forecast.projectedUnits, 0)

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Proyección real:</span>
        <button className="filter-chip active" type="button">Supabase conectado</button>
        <button className="filter-chip" type="button">{filteredForecasts.length} registros</button>
        <button className="filter-chip" type="button">{formatNumber(totalProjectedUnits)} unidades</button>
        <input
          className="search-input"
          placeholder="Buscar FIT, colección o mes..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ marginLeft: 'auto' }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadForecasts()}>
          Recargar
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <TableShell title="Proyección mensual por FIT" subtitle="La proyección se define por FIT; las versiones se calculan por mix">
        <table>
          <thead>
            <tr>
              <th>Colección</th>
              <th>FIT</th>
              <th>Categoría</th>
              <th>Mes</th>
              <th>Unidades proyectadas</th>
              <th>Versión dato</th>
              <th>Fuente</th>
              <th>Motivo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9}>Cargando proyecciones...</td></tr>
            ) : filteredForecasts.length === 0 ? (
              <tr><td colSpan={9}>No hay proyecciones registradas.</td></tr>
            ) : filteredForecasts.map((forecast) => (
              <tr key={forecast.id}>
                <td>{forecast.collectionCode}</td>
                <td>{forecast.fitName}</td>
                <td>{forecast.fitCategory ?? 'Sin categoría'}</td>
                <td>{formatDateMonth(forecast.periodMonth)}</td>
                <td>{formatNumber(forecast.projectedUnits)}</td>
                <td>{forecast.versionLabel}</td>
                <td>{forecast.source}</td>
                <td>{forecast.changeReason ?? 'Sin motivo registrado'}</td>
                <td><Badge>{mapForecastStatus(forecast.status)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
