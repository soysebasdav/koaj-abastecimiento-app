import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { TableShell } from '../../components/TableShell'
import { formatDate, formatDateMonth, formatQuantity } from '../../utils/format'
import { listKardexInputs, type KardexInputView } from './kardexService'

export function KardexPage() {
  const [rows, setRows] = useState<KardexInputView[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadKardex() {
    setIsLoading(true)
    setError(null)

    try {
      setRows(await listKardexInputs())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el Kardex.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadKardex()
  }, [])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows

    return rows.filter((row) =>
      [
        row.materialCode,
        row.materialName,
        row.periodMonth,
        row.controlDate,
        row.notes ?? '',
      ].join(' ').toLowerCase().includes(query),
    )
  }, [rows, search])

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Kardex real:</span>
        <button className="filter-chip active" type="button">Supabase conectado</button>
        <button className="filter-chip" type="button">{filteredRows.length} controles</button>
        <input
          className="search-input"
          placeholder="Buscar material o fecha..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ marginLeft: 'auto' }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadKardex()}>
          Recargar
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <TableShell title="Kardex semanal por material" subtitle="Las fechas de control pueden variar por material">
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Fecha control</th>
              <th>Secuencia</th>
              <th>Material</th>
              <th>Total bodega</th>
              <th>Pedido</th>
              <th>Tránsito</th>
              <th>Stock seguridad</th>
              <th>Industrialización</th>
              <th>Notas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11}>Cargando Kardex...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={11}>No hay registros de Kardex. Cuando se carguen fechas de control e inputs semanales, aparecerán aquí.</td></tr>
            ) : filteredRows.map((row) => (
              <tr key={row.id}>
                <td>{formatDateMonth(row.periodMonth)}</td>
                <td>{formatDate(row.controlDate)}</td>
                <td>{row.sequenceNumber}</td>
                <td>{row.materialName}</td>
                <td>{formatQuantity(row.totalBodega, row.unit)}</td>
                <td>{formatQuantity(row.pedido, row.unit)}</td>
                <td>{formatQuantity(row.transito, row.unit)}</td>
                <td>{formatQuantity(row.stockSeguridad, row.unit)}</td>
                <td>{formatQuantity(row.industrializacion, row.unit)}</td>
                <td>{row.notes ?? 'Sin notas'}</td>
                <td><Badge>Calculado</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
