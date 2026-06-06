import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { KpiCard } from '../../components/KpiCard'
import { TableShell } from '../../components/TableShell'
import { formatDateMonth, formatNumber, formatPercent, formatQuantity } from '../../utils/format'
import { formatMaterialTypeLabel } from '../../utils/materialTypes'
import {
  listMaterialRequirementsDetail,
  listMaterialRequirementsMonthly,
  type MaterialRequirementDetail,
  type MaterialRequirementMonthly,
} from './supplyService'

type ViewMode = 'monthly' | 'detail'

export function SupplyPage() {
  const [monthlyRequirements, setMonthlyRequirements] = useState<MaterialRequirementMonthly[]>([])
  const [detailRequirements, setDetailRequirements] = useState<MaterialRequirementDetail[]>([])
  const [search, setSearch] = useState('')
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadRequirements() {
    setIsLoading(true)
    setError(null)

    try {
      const [monthly, detail] = await Promise.all([
        listMaterialRequirementsMonthly(),
        listMaterialRequirementsDetail(),
      ])
      setMonthlyRequirements(monthly)
      setDetailRequirements(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la necesidad de materiales.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadRequirements()
  }, [])

  const filteredMonthlyRequirements = useMemo(() => {
    const query = search.trim().toLowerCase()

    return monthlyRequirements.filter((row) => {
      const matchesQuery = !query || [
        row.collectionCode,
        row.periodMonth,
        row.materialCode,
        row.materialName,
        formatMaterialTypeLabel(row.materialType),
        row.unit,
      ].join(' ').toLowerCase().includes(query)

      const matchesType = materialTypeFilter === 'all' || row.materialType === materialTypeFilter

      return matchesQuery && matchesType
    })
  }, [monthlyRequirements, materialTypeFilter, search])

  const filteredDetailRequirements = useMemo(() => {
    const query = search.trim().toLowerCase()

    return detailRequirements.filter((row) => {
      const matchesQuery = !query || [
        row.collectionCode,
        row.periodMonth,
        row.fitCode,
        row.fitName,
        row.versionCode,
        row.pieceName,
        row.materialCode,
        row.materialName,
        formatMaterialTypeLabel(row.materialType),
        row.unit,
      ].join(' ').toLowerCase().includes(query)

      const matchesType = materialTypeFilter === 'all' || row.materialType === materialTypeFilter

      return matchesQuery && matchesType
    })
  }, [detailRequirements, materialTypeFilter, search])

  const materialTypeOptions = useMemo(() => {
    return Array.from(new Set(monthlyRequirements.map((row) => row.materialType))).sort()
  }, [monthlyRequirements])

  const visibleMonthly = filteredMonthlyRequirements
  const visibleDetail = filteredDetailRequirements
  const totalRequired = visibleMonthly.reduce((sum, row) => sum + row.requiredQuantity, 0)
  const totalFabricRequired = visibleMonthly
    .filter((row) => row.materialType === 'fabric' || row.materialType === 'pocket_fabric')
    .reduce((sum, row) => sum + row.requiredQuantity, 0)
  const uniqueMaterials = new Set(visibleMonthly.map((row) => row.materialId)).size
  const uniqueFits = new Set(visibleDetail.map((row) => row.fitId)).size
  const uniqueMonths = new Set(visibleMonthly.map((row) => row.periodMonth)).size

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Necesidad real:</span>
        <button className="filter-chip active" type="button">Vista SQL conectada</button>
        <button className="filter-chip" type="button">{visibleMonthly.length} agregados</button>
        <button className="filter-chip" type="button">{visibleDetail.length} detalles</button>
        <button
          className={`filter-chip ${viewMode === 'monthly' ? 'active' : ''}`}
          type="button"
          onClick={() => setViewMode('monthly')}
        >
          Agrupado por material
        </button>
        <button
          className={`filter-chip ${viewMode === 'detail' ? 'active' : ''}`}
          type="button"
          onClick={() => setViewMode('detail')}
        >
          Detalle FIT → versión → pieza
        </button>
        <select className="search-input" value={materialTypeFilter} onChange={(event) => setMaterialTypeFilter(event.target.value)}>
          <option value="all">Todos los materiales</option>
          {materialTypeOptions.map((type) => (
            <option key={type} value={type}>{formatMaterialTypeLabel(type)}</option>
          ))}
        </select>
        <input
          className="search-input"
          placeholder="Buscar material, FIT, pieza, mes o colección..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadRequirements()}>
          Recargar
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="kpi-row compact">
        <KpiCard label="Necesidad total" value={formatNumber(totalRequired, 2)} sub="materiales filtrados" />
        <KpiCard label="Telas" value={formatNumber(totalFabricRequired, 2)} sub="fabric + pocket_fabric" />
        <KpiCard label="Materiales" value={String(uniqueMaterials)} sub="referencias con necesidad" />
        <KpiCard label="FITs" value={String(uniqueFits)} sub={`en ${uniqueMonths} meses`} />
      </div>

      {viewMode === 'monthly' ? (
        <TableShell title="Abastecimiento agrupado por material" subtitle="Suma de todas las necesidades de versiones, FITs y piezas que usan cada material">
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
              ) : visibleMonthly.length === 0 ? (
                <tr><td colSpan={8}>No hay necesidades calculadas. Revisa colección, versiones, mix, BOM y proyecciones.</td></tr>
              ) : visibleMonthly.map((row) => (
                <tr key={`${row.collectionId}-${row.periodMonth}-${row.materialId}`}>
                  <td>{row.collectionCode}</td>
                  <td>{formatDateMonth(row.periodMonth)}</td>
                  <td>{row.materialCode}</td>
                  <td>{row.materialName}</td>
                  <td>{formatMaterialTypeLabel(row.materialType)}</td>
                  <td>{row.unit}</td>
                  <td>{formatQuantity(row.requiredQuantity, row.unit)}</td>
                  <td><Badge>Calculado</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      ) : (
        <TableShell title="Detalle de cálculo por FIT, versión y pieza" subtitle="Unidades FIT × % versión vigente × piezas/u × consumo × desperdicio">
          <table>
            <thead>
              <tr>
                <th>Colección</th>
                <th>Mes</th>
                <th>FIT</th>
                <th>Versión</th>
                <th>Pieza</th>
                <th>Material</th>
                <th>Unidades FIT</th>
                <th>% versión</th>
                <th>Unidades versión</th>
                <th>Consumo efectivo/u</th>
                <th>Necesidad</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11}>Cargando detalle de cálculo...</td></tr>
              ) : visibleDetail.length === 0 ? (
                <tr><td colSpan={11}>No hay detalle calculado. Verifica que exista la vista v_material_requirements_detail.</td></tr>
              ) : visibleDetail.map((row) => (
                <tr key={`${row.collectionId}-${row.periodMonth}-${row.fitVersionId}-${row.pieceName}-${row.materialId}`}>
                  <td>{row.collectionCode}</td>
                  <td>{formatDateMonth(row.periodMonth)}</td>
                  <td>{row.fitCode} · {row.fitName}</td>
                  <td>{row.versionCode}</td>
                  <td>{row.pieceName}</td>
                  <td>{row.materialCode} · {row.materialName}</td>
                  <td>{formatNumber(row.projectedUnits, 0)}</td>
                  <td>{formatPercent(row.sharePercentage)}</td>
                  <td>{formatNumber(row.versionUnits, 2)}</td>
                  <td>{formatQuantity(row.effectiveConsumptionPerUnit, row.unit)}</td>
                  <td>{formatQuantity(row.requiredQuantity, row.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </>
  )
}
