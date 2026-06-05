import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { KpiCard } from '../../components/KpiCard'
import { TableShell } from '../../components/TableShell'
import { formatDateMonth, formatNumber, formatQuantity } from '../../utils/format'
import { listMaterialRequirementsMonthly, type MaterialRequirementMonthly } from './supplyService'

const materialTypeLabels: Record<string, string> = {
  fabric: 'Tela',
  button: 'Botón',
  pocket_fabric: 'Tela bolsillo',
  label: 'Marquilla / etiqueta',
  zipper: 'Cremallera',
  thread: 'Hilo',
  packaging: 'Empaque',
  other: 'Otro',
}

export function SupplyPage() {
  const [requirements, setRequirements] = useState<MaterialRequirementMonthly[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadRequirements() {
    setIsLoading(true)
    setError(null)

    try {
      setRequirements(await listMaterialRequirementsMonthly())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la necesidad de materiales.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadRequirements()
  }, [])

  const filteredRequirements = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return requirements

    return requirements.filter((row) =>
      [
        row.collectionCode,
        row.periodMonth,
        row.materialCode,
        row.materialName,
        materialTypeLabels[row.materialType] ?? row.materialType,
        row.unit,
      ].join(' ').toLowerCase().includes(query),
    )
  }, [requirements, search])

  const totalRequired = filteredRequirements.reduce((sum, row) => sum + row.requiredQuantity, 0)
  const uniqueMaterials = new Set(filteredRequirements.map((row) => row.materialId)).size
  const uniqueMonths = new Set(filteredRequirements.map((row) => row.periodMonth)).size
  const uniqueCollections = new Set(filteredRequirements.map((row) => row.collectionId)).size

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Necesidad real:</span>
        <button className="filter-chip active" type="button">Vista SQL conectada</button>
        <button className="filter-chip" type="button">{filteredRequirements.length} registros</button>
        <input
          className="search-input"
          placeholder="Buscar material, mes o colección..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ marginLeft: 'auto' }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadRequirements()}>
          Recargar
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="kpi-row compact">
        <KpiCard label="Necesidad total" value={formatNumber(totalRequired, 2)} sub="cantidad agregada" />
        <KpiCard label="Materiales" value={String(uniqueMaterials)} sub="con necesidad calculada" />
        <KpiCard label="Meses" value={String(uniqueMonths)} sub="periodos proyectados" />
        <KpiCard label="Colecciones" value={String(uniqueCollections)} sub="con cálculo" />
      </div>

      <TableShell title="Necesidad de materiales" subtitle="Resultado real de proyección FIT × mix versión × consumo BOM">
        <table>
          <thead>
            <tr>
              <th>Colección</th>
              <th>Mes</th>
              <th>Código material</th>
              <th>Material</th>
              <th>Tipo</th>
              <th>Unidad</th>
              <th>Necesidad calculada</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8}>Cargando necesidad de materiales...</td></tr>
            ) : filteredRequirements.length === 0 ? (
              <tr><td colSpan={8}>No hay necesidades calculadas. Revisa colección, versiones, mix, BOM y proyecciones.</td></tr>
            ) : filteredRequirements.map((row) => (
              <tr key={`${row.collectionId}-${row.periodMonth}-${row.materialId}`}>
                <td>{row.collectionCode}</td>
                <td>{formatDateMonth(row.periodMonth)}</td>
                <td>{row.materialCode}</td>
                <td>{row.materialName}</td>
                <td>{materialTypeLabels[row.materialType] ?? row.materialType}</td>
                <td>{row.unit}</td>
                <td>{formatQuantity(row.requiredQuantity, row.unit)}</td>
                <td><Badge>Calculado</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
