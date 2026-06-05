import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { TableShell } from '../../components/TableShell'
import { listFabricCompositions, listFits, listMaterials } from './catalogService'
import type { FabricCompositionRecord, FitRecord, MaterialRecord, MaterialWithComposition } from './catalogTypes'

const materialTypeLabels: Record<MaterialRecord['material_type'], string> = {
  fabric: 'Tela',
  button: 'Botón',
  pocket_fabric: 'Tela bolsillo',
  label: 'Marquilla / etiqueta',
  zipper: 'Cremallera',
  thread: 'Hilo',
  packaging: 'Empaque',
  other: 'Otro',
}

const unitLabels: Record<MaterialRecord['unit'], string> = {
  meter: 'metro',
  unit: 'unidad',
  kg: 'kg',
  roll: 'rollo',
  box: 'caja',
  package: 'paquete',
}

const originLabels: Record<NonNullable<MaterialRecord['origin']>, string> = {
  national: 'Nacional',
  international: 'Internacional',
}

function mapStatus(status: 'active' | 'inactive') {
  return status === 'active' ? 'Activo' : 'Inactivo'
}

function buildMaterialsWithComposition(
  materials: MaterialRecord[],
  compositions: FabricCompositionRecord[],
): MaterialWithComposition[] {
  return materials.map((material) => {
    const materialCompositions = compositions
      .filter((composition) => composition.material_id === material.id)
      .sort((a, b) => Number(b.percentage) - Number(a.percentage))

    const compositionLabel = materialCompositions.length
      ? materialCompositions
          .map((composition) => `${Number(composition.percentage).toLocaleString('es-CO')}% ${composition.component_name}`)
          .join(' · ')
      : material.is_fabric
        ? 'Composición pendiente'
        : 'No aplica'

    return {
      ...material,
      composition_label: compositionLabel,
    }
  })
}

export function CatalogPage() {
  const [fits, setFits] = useState<FitRecord[]>([])
  const [materials, setMaterials] = useState<MaterialWithComposition[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadCatalog() {
    setIsLoading(true)
    setError(null)

    try {
      const [fitsData, materialsData, compositionsData] = await Promise.all([
        listFits(),
        listMaterials(),
        listFabricCompositions(),
      ])

      setFits(fitsData)
      setMaterials(buildMaterialsWithComposition(materialsData, compositionsData))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No fue posible cargar el catálogo.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

  const filteredFits = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) return fits

    return fits.filter((fit) => {
      return [
        fit.code,
        fit.name,
        fit.silhouette,
        fit.category ?? '',
        fit.gender ?? '',
        fit.portfolio ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [fits, search])

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) return materials

    return materials.filter((material) => {
      return [
        material.code,
        material.name,
        materialTypeLabels[material.material_type],
        unitLabels[material.unit],
        material.origin ? originLabels[material.origin] : '',
        material.supplier_name ?? '',
        material.composition_label,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [materials, search])

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Catálogo real:</span>
        <button className="filter-chip active" type="button">
          Supabase conectado
        </button>
        <button className="filter-chip" type="button">
          {fits.length} FITs
        </button>
        <button className="filter-chip" type="button">
          {materials.length} materiales
        </button>
        <input
          className="search-input"
          placeholder="Buscar FIT, material o composición..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ marginLeft: 'auto' }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadCatalog()}>
          Recargar
        </button>
      </div>

      {error ? (
        <div className="auth-alert error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">Cargando catálogo</span>
            <span className="table-subtitle">Consultando fits, materiales y composiciones desde Supabase</span>
          </div>
        </div>
      ) : null}

      {!isLoading && filteredFits.length === 0 && filteredMaterials.length === 0 ? (
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">Sin resultados</span>
            <span className="table-subtitle">No hay registros que coincidan con la búsqueda actual</span>
          </div>
        </div>
      ) : null}

      {!isLoading && filteredFits.length > 0 ? (
        <div className="product-grid">
          {filteredFits.map((fit) => (
            <article className="product-card" key={fit.id}>
              <div className="product-card-status">
                <Badge>{mapStatus(fit.status)}</Badge>
              </div>
              <div className="product-card-name">{fit.name}</div>
              <div className="product-card-cat">
                {fit.category ?? 'Sin categoría'} · {fit.silhouette}
              </div>
              <div className="product-card-row">
                <span>Código</span>
                <strong>{fit.code}</strong>
              </div>
              <div className="product-card-row">
                <span>Género</span>
                <strong>{fit.gender ?? 'No definido'}</strong>
              </div>
              <div className="product-card-row">
                <span>Portafolio</span>
                <strong>{fit.portfolio ?? 'No definido'}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {!isLoading ? (
        <TableShell title="Materiales y telas" subtitle="Datos reales desde Supabase: materials + fabric_compositions">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Material</th>
                <th>Tipo</th>
                <th>Unidad</th>
                <th>Origen</th>
                <th>Proveedor</th>
                <th>Lead time</th>
                <th>Composición</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((material) => (
                <tr key={material.id}>
                  <td>{material.code}</td>
                  <td>{material.name}</td>
                  <td>{materialTypeLabels[material.material_type]}</td>
                  <td>{unitLabels[material.unit]}</td>
                  <td>{material.origin ? originLabels[material.origin] : 'No definido'}</td>
                  <td>{material.supplier_name ?? 'No definido'}</td>
                  <td>{material.lead_time_days ? `${material.lead_time_days} días` : 'No definido'}</td>
                  <td>{material.composition_label}</td>
                  <td><Badge>{mapStatus(material.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      ) : null}
    </>
  )
}
