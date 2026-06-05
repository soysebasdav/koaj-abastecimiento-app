import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { TableShell } from '../../components/TableShell'
import { formatDateMonth, formatNumber, formatPercent, mapUnit } from '../../utils/format'
import { listBomLines, listVersionMix, type BomLineView, type VersionMixView } from './bomService'

function mapStatus(status: 'active' | 'inactive') {
  return status === 'active' ? 'Activo' : 'Inactivo'
}

export function BomPage() {
  const [bomLines, setBomLines] = useState<BomLineView[]>([])
  const [versionMix, setVersionMix] = useState<VersionMixView[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadBom() {
    setIsLoading(true)
    setError(null)

    try {
      const [lines, mix] = await Promise.all([listBomLines(), listVersionMix()])
      setBomLines(lines)
      setVersionMix(mix)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el BOM.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadBom()
  }, [])

  const filteredLines = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return bomLines

    return bomLines.filter((line) =>
      [
        line.collectionCode,
        line.fitCode,
        line.fitName,
        line.versionCode,
        line.pieceName,
        line.materialCode,
        line.materialName,
      ].join(' ').toLowerCase().includes(query),
    )
  }, [bomLines, search])

  const filteredMix = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return versionMix

    return versionMix.filter((mix) =>
      [
        mix.collectionCode,
        mix.fitCode,
        mix.fitName,
        mix.versionCode,
        mix.colorRange,
        mix.mainMaterialName,
      ].join(' ').toLowerCase().includes(query),
    )
  }, [versionMix, search])

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">BOM real:</span>
        <button className="filter-chip active" type="button">Supabase conectado</button>
        <button className="filter-chip" type="button">{versionMix.length} mixes</button>
        <button className="filter-chip" type="button">{bomLines.length} piezas</button>
        <input
          className="search-input"
          placeholder="Buscar FIT, versión, pieza o material..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ marginLeft: 'auto' }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadBom()}>
          Recargar
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <TableShell title="Piezas BOM por versión" subtitle="El consumo depende de la versión, no solo del FIT">
        <table>
          <thead>
            <tr>
              <th>Colección</th>
              <th>FIT</th>
              <th>Versión</th>
              <th>Pieza</th>
              <th>Material</th>
              <th>Piezas/u</th>
              <th>Consumo pieza</th>
              <th>Desperdicio</th>
              <th>Consumo efectivo/u</th>
              <th>Vigente desde</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11}>Cargando BOM...</td></tr>
            ) : filteredLines.length === 0 ? (
              <tr><td colSpan={11}>No hay líneas BOM registradas.</td></tr>
            ) : filteredLines.map((line) => (
              <tr key={line.id}>
                <td>{line.collectionCode}</td>
                <td>{line.fitName}</td>
                <td>{line.versionCode}</td>
                <td>{line.pieceName}</td>
                <td>{line.materialName}</td>
                <td>{formatNumber(line.piecesPerUnit, 2)}</td>
                <td>{formatNumber(line.consumptionPerPiece, 4)} {mapUnit(line.materialUnit)}</td>
                <td>{formatPercent(line.wastePercentage, 2)}</td>
                <td>{formatNumber(line.effectiveConsumptionPerUnit, 4)} {mapUnit(line.materialUnit)}</td>
                <td>{formatDateMonth(line.validFromMonth)}</td>
                <td><Badge>{mapStatus(line.status)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableShell title="Mix porcentual por versión" subtitle="La suma activa por FIT y mes debe ser 100%">
        <table>
          <thead>
            <tr>
              <th>Colección</th>
              <th>FIT</th>
              <th>Versión</th>
              <th>Rango color</th>
              <th>Tela principal</th>
              <th>Participación</th>
              <th>Vigente desde</th>
              <th>Motivo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9}>Cargando mix de versiones...</td></tr>
            ) : filteredMix.length === 0 ? (
              <tr><td colSpan={9}>No hay mix porcentual registrado.</td></tr>
            ) : filteredMix.map((mix) => (
              <tr key={mix.id}>
                <td>{mix.collectionCode}</td>
                <td>{mix.fitName}</td>
                <td>{mix.versionCode}</td>
                <td>{mix.colorRange}</td>
                <td>{mix.mainMaterialName}</td>
                <td>{formatPercent(mix.sharePercentage, 2)}</td>
                <td>{formatDateMonth(mix.validFromMonth)}</td>
                <td>{mix.changeReason ?? 'Sin motivo registrado'}</td>
                <td><Badge>{mapStatus(mix.status)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
