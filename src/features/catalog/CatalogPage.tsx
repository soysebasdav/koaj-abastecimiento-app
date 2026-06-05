import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Drawer } from '../../components/Drawer'
import { TableShell } from '../../components/TableShell'
import { createFit, createMaterial, listFabricCompositions, listFits, listMaterials, updateFit, updateMaterial } from './catalogService'
import type {
  FabricCompositionInput,
  FabricCompositionRecord,
  FitFormInput,
  FitRecord,
  MaterialFormInput,
  MaterialRecord,
  MaterialWithComposition,
} from './catalogTypes'

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

const emptyFitForm: FitFormInput = {
  code: '',
  name: '',
  silhouette: '',
  category: '',
  gender: '',
  portfolio: 'KOAJ',
  status: 'active',
}

const emptyMaterialForm: MaterialFormInput = {
  code: '',
  name: '',
  material_type: 'fabric',
  unit: 'meter',
  origin: 'national',
  supplier_name: '',
  lead_time_days: '',
  is_fabric: true,
  status: 'active',
}

type DrawerMode = 'fit-create' | 'fit-edit' | 'material-create' | 'material-edit' | null

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
      compositions: materialCompositions,
    }
  })
}

function fitToForm(fit: FitRecord): FitFormInput {
  return {
    code: fit.code,
    name: fit.name,
    silhouette: fit.silhouette,
    category: fit.category ?? '',
    gender: fit.gender ?? '',
    portfolio: fit.portfolio ?? '',
    status: fit.status,
  }
}

function materialToForm(material: MaterialWithComposition): MaterialFormInput {
  return {
    code: material.code,
    name: material.name,
    material_type: material.material_type,
    unit: material.unit,
    origin: material.origin ?? '',
    supplier_name: material.supplier_name ?? '',
    lead_time_days: material.lead_time_days?.toString() ?? '',
    is_fabric: material.is_fabric,
    status: material.status,
  }
}

function compositionToForm(material: MaterialWithComposition): FabricCompositionInput[] {
  if (!material.compositions.length) {
    return [{ component_name: '', percentage: '' }]
  }

  return material.compositions.map((composition) => ({
    component_name: composition.component_name,
    percentage: String(composition.percentage),
  }))
}

function getCompositionTotal(compositions: FabricCompositionInput[]) {
  return compositions.reduce((sum, composition) => {
    const percentage = Number(composition.percentage)
    return Number.isNaN(percentage) ? sum : sum + percentage
  }, 0)
}

export function CatalogPage() {
  const [fits, setFits] = useState<FitRecord[]>([])
  const [materials, setMaterials] = useState<MaterialWithComposition[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [selectedFit, setSelectedFit] = useState<FitRecord | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialWithComposition | null>(null)
  const [fitForm, setFitForm] = useState<FitFormInput>(emptyFitForm)
  const [materialForm, setMaterialForm] = useState<MaterialFormInput>(emptyMaterialForm)
  const [compositionForm, setCompositionForm] = useState<FabricCompositionInput[]>([{ component_name: '', percentage: '' }])
  const [reason, setReason] = useState('')

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

  function openCreateFit() {
    setDrawerMode('fit-create')
    setSelectedFit(null)
    setFitForm(emptyFitForm)
    setReason('Creación de FIT desde catálogo')
    setError(null)
    setFeedback(null)
  }

  function openEditFit(fit: FitRecord) {
    setDrawerMode('fit-edit')
    setSelectedFit(fit)
    setFitForm(fitToForm(fit))
    setReason('Actualización de FIT desde catálogo')
    setError(null)
    setFeedback(null)
  }

  function openCreateMaterial() {
    setDrawerMode('material-create')
    setSelectedMaterial(null)
    setMaterialForm(emptyMaterialForm)
    setCompositionForm([{ component_name: '', percentage: '' }])
    setReason('Creación de material desde catálogo')
    setError(null)
    setFeedback(null)
  }

  function openEditMaterial(material: MaterialWithComposition) {
    setDrawerMode('material-edit')
    setSelectedMaterial(material)
    setMaterialForm(materialToForm(material))
    setCompositionForm(compositionToForm(material))
    setReason('Actualización de material desde catálogo')
    setError(null)
    setFeedback(null)
  }

  function closeDrawer() {
    setDrawerMode(null)
    setSelectedFit(null)
    setSelectedMaterial(null)
    setError(null)
    setFeedback(null)
  }

  async function handleFitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFeedback(null)

    try {
      if (!fitForm.code.trim() || !fitForm.name.trim() || !fitForm.silhouette.trim()) {
        throw new Error('Código, nombre y silueta son obligatorios.')
      }

      if (!reason.trim()) {
        throw new Error('El motivo es obligatorio para auditoría.')
      }

      if (drawerMode === 'fit-edit' && selectedFit) {
        await updateFit(selectedFit.id, selectedFit, fitForm, reason)
        setFeedback('FIT actualizado correctamente.')
      } else {
        await createFit(fitForm, reason)
        setFeedback('FIT creado correctamente.')
      }

      await loadCatalog()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar el FIT.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleMaterialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFeedback(null)

    try {
      if (!materialForm.code.trim() || !materialForm.name.trim()) {
        throw new Error('Código y nombre del material son obligatorios.')
      }

      if (!reason.trim()) {
        throw new Error('El motivo es obligatorio para auditoría.')
      }

      const cleanCompositions = materialForm.is_fabric
        ? compositionForm.filter((composition) => composition.component_name.trim() || composition.percentage.trim())
        : []

      if (materialForm.is_fabric) {
        if (cleanCompositions.length === 0) {
          throw new Error('Una tela debe tener composición. Agrega al menos un componente.')
        }

        const total = getCompositionTotal(cleanCompositions)

        if (Math.round(total * 100) / 100 !== 100) {
          throw new Error(`La composición de una tela debe sumar 100%. Actualmente suma ${total.toLocaleString('es-CO')}%.`)
        }
      }

      if (drawerMode === 'material-edit' && selectedMaterial) {
        await updateMaterial(selectedMaterial.id, selectedMaterial, materialForm, cleanCompositions, reason)
        setFeedback('Material actualizado correctamente.')
      } else {
        await createMaterial(materialForm, cleanCompositions, reason)
        setFeedback('Material creado correctamente.')
      }

      await loadCatalog()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar el material.')
    } finally {
      setIsSaving(false)
    }
  }

  function updateComposition(index: number, field: keyof FabricCompositionInput, value: string) {
    setCompositionForm((current) => {
      const next = [...current]
      next[index] = {
        ...next[index],
        [field]: value,
      }
      return next
    })
  }

  function addCompositionRow() {
    setCompositionForm((current) => [...current, { component_name: '', percentage: '' }])
  }

  function removeCompositionRow(index: number) {
    setCompositionForm((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const compositionTotal = getCompositionTotal(compositionForm)

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
        <button className="btn btn-primary" type="button" onClick={openCreateFit}>
          + Nuevo FIT
        </button>
        <button className="btn btn-primary" type="button" onClick={openCreateMaterial}>
          + Nuevo material
        </button>
      </div>

      {error ? (
        <div className="auth-alert error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div className="auth-alert success" style={{ marginBottom: 16 }}>
          {feedback}
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
              <div style={{ marginTop: 12 }}>
                <button className="action-btn" type="button" onClick={() => openEditFit(fit)}>
                  Editar FIT
                </button>
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
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={10}>No hay materiales que coincidan con la búsqueda.</td>
                </tr>
              ) : filteredMaterials.map((material) => (
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
                  <td>
                    <button className="action-btn" type="button" onClick={() => openEditMaterial(material)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      ) : null}

      <Drawer
        isOpen={drawerMode === 'fit-create' || drawerMode === 'fit-edit'}
        title={drawerMode === 'fit-edit' ? 'Editar FIT / Silueta' : 'Nuevo FIT / Silueta'}
        subtitle="Unidad base de planeación mensual"
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" form="fit-form" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar FIT'}
            </button>
          </>
        }
      >
        <form id="fit-form" className="drawer-form" onSubmit={handleFitSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Código FIT</label>
              <input className="form-control" value={fitForm.code} onChange={(event) => setFitForm({ ...fitForm, code: event.target.value })} placeholder="FIT-JEAN-001" />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select className="form-control" value={fitForm.status} onChange={(event) => setFitForm({ ...fitForm, status: event.target.value as FitFormInput['status'] })}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Nombre FIT</label>
            <input className="form-control" value={fitForm.name} onChange={(event) => setFitForm({ ...fitForm, name: event.target.value })} placeholder="Jean skinny mujer" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Silueta</label>
              <input className="form-control" value={fitForm.silhouette} onChange={(event) => setFitForm({ ...fitForm, silhouette: event.target.value })} placeholder="Pantalón jean" />
            </div>
            <div className="form-group">
              <label>Categoría</label>
              <input className="form-control" value={fitForm.category} onChange={(event) => setFitForm({ ...fitForm, category: event.target.value })} placeholder="Jean" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Género</label>
              <input className="form-control" value={fitForm.gender} onChange={(event) => setFitForm({ ...fitForm, gender: event.target.value })} placeholder="Femenino / Masculino / Unisex" />
            </div>
            <div className="form-group">
              <label>Portafolio</label>
              <input className="form-control" value={fitForm.portfolio} onChange={(event) => setFitForm({ ...fitForm, portfolio: event.target.value })} placeholder="KOAJ" />
            </div>
          </div>

          <div className="form-group">
            <label>Motivo de auditoría</label>
            <textarea className="form-control textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se crea o modifica este FIT." />
          </div>
        </form>
      </Drawer>

      <Drawer
        isOpen={drawerMode === 'material-create' || drawerMode === 'material-edit'}
        title={drawerMode === 'material-edit' ? 'Editar material' : 'Nuevo material'}
        subtitle="Tela, insumo o accesorio usado por el BOM"
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" form="material-form" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar material'}
            </button>
          </>
        }
      >
        <form id="material-form" className="drawer-form" onSubmit={handleMaterialSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Código material</label>
              <input className="form-control" value={materialForm.code} onChange={(event) => setMaterialForm({ ...materialForm, code: event.target.value })} placeholder="MAT-TEL-001" />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select className="form-control" value={materialForm.status} onChange={(event) => setMaterialForm({ ...materialForm, status: event.target.value as MaterialFormInput['status'] })}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Nombre material</label>
            <input className="form-control" value={materialForm.name} onChange={(event) => setMaterialForm({ ...materialForm, name: event.target.value })} placeholder="Denim azul 12 oz" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tipo</label>
              <select
                className="form-control"
                value={materialForm.material_type}
                onChange={(event) => {
                  const nextType = event.target.value as MaterialFormInput['material_type']
                  const isFabric = nextType === 'fabric' || nextType === 'pocket_fabric'
                  setMaterialForm({
                    ...materialForm,
                    material_type: nextType,
                    is_fabric: isFabric,
                    unit: isFabric ? 'meter' : materialForm.unit,
                  })
                }}
              >
                {Object.entries(materialTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Unidad</label>
              <select className="form-control" value={materialForm.unit} onChange={(event) => setMaterialForm({ ...materialForm, unit: event.target.value as MaterialFormInput['unit'] })}>
                {Object.entries(unitLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Origen</label>
              <select className="form-control" value={materialForm.origin} onChange={(event) => setMaterialForm({ ...materialForm, origin: event.target.value as MaterialFormInput['origin'] })}>
                <option value="">No definido</option>
                <option value="national">Nacional</option>
                <option value="international">Internacional</option>
              </select>
            </div>
            <div className="form-group">
              <label>Lead time días</label>
              <input className="form-control" type="number" min="0" value={materialForm.lead_time_days} onChange={(event) => setMaterialForm({ ...materialForm, lead_time_days: event.target.value })} placeholder="45" />
            </div>
          </div>

          <div className="form-group">
            <label>Proveedor sugerido</label>
            <input className="form-control" value={materialForm.supplier_name} onChange={(event) => setMaterialForm({ ...materialForm, supplier_name: event.target.value })} placeholder="Proveedor principal" />
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={materialForm.is_fabric}
              onChange={(event) => setMaterialForm({ ...materialForm, is_fabric: event.target.checked })}
            />
            <span>Este material es tela o material textil y requiere composición</span>
          </label>

          {materialForm.is_fabric ? (
            <div className="composition-box">
              <div className="composition-head">
                <div>
                  <strong>Composición de tela</strong>
                  <span>La suma debe ser exactamente 100%.</span>
                </div>
                <button className="action-btn" type="button" onClick={addCompositionRow}>+ Componente</button>
              </div>

              {compositionForm.map((composition, index) => (
                <div className="composition-row" key={index}>
                  <input
                    className="form-control"
                    value={composition.component_name}
                    onChange={(event) => updateComposition(index, 'component_name', event.target.value)}
                    placeholder="Algodón, elastano, poliéster..."
                  />
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={composition.percentage}
                    onChange={(event) => updateComposition(index, 'percentage', event.target.value)}
                    placeholder="%"
                  />
                  <button className="action-btn" type="button" onClick={() => removeCompositionRow(index)} disabled={compositionForm.length === 1}>
                    Quitar
                  </button>
                </div>
              ))}

              <div className={`composition-total ${Math.round(compositionTotal * 100) / 100 === 100 ? 'ok' : 'warn'}`}>
                Total composición: {compositionTotal.toLocaleString('es-CO')}%
              </div>
            </div>
          ) : null}

          <div className="form-group">
            <label>Motivo de auditoría</label>
            <textarea className="form-control textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se crea o modifica este material." />
          </div>
        </form>
      </Drawer>
    </>
  )
}
