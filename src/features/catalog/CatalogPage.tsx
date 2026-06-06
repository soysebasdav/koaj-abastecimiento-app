import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Drawer } from '../../components/Drawer'
import {
  findMaterialTypeProfile,
  formatMaterialTypeLabel,
  getCompositionLabel,
  getCompositionPlaceholder,
  mergeMaterialTypeProfiles,
  normalizeMaterialTypeKey,
  unitLabels,
  type MaterialTypeProfile,
} from '../../utils/materialTypes'
import {
  createFit,
  createMaterial,
  listFabricCompositions,
  listFits,
  listMaterials,
  listMaterialTypeProfiles,
  updateFit,
  updateMaterial,
} from './catalogService'
import type {
  FabricCompositionInput,
  FabricCompositionRecord,
  FitFormInput,
  FitRecord,
  MaterialFormInput,
  MaterialRecord,
  MaterialWithComposition,
} from './catalogTypes'

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
  image_url: '',
  status: 'active',
}

const emptyMaterialForm: MaterialFormInput = {
  code: '',
  name: '',
  material_type: 'fabric',
  material_type_label: 'Tela',
  unit: 'meter',
  origin: 'national',
  supplier_name: '',
  lead_time_days: '',
  image_url: '',
  is_fabric: true,
  status: 'active',
}

type DrawerMode = 'fit-create' | 'fit-edit' | 'material-create' | 'material-edit' | null
type CatalogView = 'all' | 'fits' | 'materials'

function uniqueCompact(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
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
    image_url: fit.image_url ?? '',
    status: fit.status,
  }
}

function materialToForm(material: MaterialWithComposition, profiles: MaterialTypeProfile[]): MaterialFormInput {
  return {
    code: material.code,
    name: material.name,
    material_type: material.material_type,
    material_type_label: formatMaterialTypeLabel(material.material_type, profiles),
    unit: material.unit,
    origin: material.origin ?? '',
    supplier_name: material.supplier_name ?? '',
    lead_time_days: material.lead_time_days?.toString() ?? '',
    image_url: material.image_url ?? '',
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

function typeLabelFromForm(form: MaterialFormInput) {
  return form.material_type_label.trim() || formatMaterialTypeLabel(form.material_type)
}

export function CatalogPage() {
  const [fits, setFits] = useState<FitRecord[]>([])
  const [materials, setMaterials] = useState<MaterialWithComposition[]>([])
  const [materialTypeProfiles, setMaterialTypeProfiles] = useState<MaterialTypeProfile[]>([])
  const [search, setSearch] = useState('')
  const [catalogView, setCatalogView] = useState<CatalogView>('all')
  const [fitFilters, setFitFilters] = useState({ status: '', category: '', silhouette: '', gender: '', portfolio: '' })
  const [materialFilters, setMaterialFilters] = useState({ status: '', materialType: '', unit: '', origin: '', composition: '' })
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
  const [showExistingTypes, setShowExistingTypes] = useState(false)

  async function loadCatalog() {
    setIsLoading(true)
    setError(null)

    try {
      const [fitsData, materialsData, compositionsData, typeProfilesData] = await Promise.all([
        listFits(),
        listMaterials(),
        listFabricCompositions(),
        listMaterialTypeProfiles(),
      ])

      setFits(fitsData)
      setMaterials(buildMaterialsWithComposition(materialsData, compositionsData))
      setMaterialTypeProfiles(mergeMaterialTypeProfiles(typeProfilesData))
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

  const fitFilterOptions = useMemo(() => ({
    categories: uniqueCompact(fits.map((fit) => fit.category)),
    silhouettes: uniqueCompact(fits.map((fit) => fit.silhouette)),
    genders: uniqueCompact(fits.map((fit) => fit.gender)),
    portfolios: uniqueCompact(fits.map((fit) => fit.portfolio)),
  }), [fits])

  const materialFilterOptions = useMemo(() => ({
    types: uniqueCompact(materials.map((material) => formatMaterialTypeLabel(material.material_type, materialTypeProfiles))),
    units: uniqueCompact(materials.map((material) => unitLabels[material.unit])),
    origins: uniqueCompact(materials.map((material) => (material.origin ? originLabels[material.origin] : 'No definido'))),
    compositions: ['Con composición', 'Sin composición'],
  }), [materialTypeProfiles, materials])

  const filteredFits = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return fits.filter((fit) => {
      const matchesSearch = !normalizedSearch || [
        fit.code,
        fit.name,
        fit.silhouette,
        fit.category ?? '',
        fit.gender ?? '',
        fit.portfolio ?? '',
        fit.image_url ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)

      return matchesSearch
        && (!fitFilters.status || fit.status === fitFilters.status)
        && (!fitFilters.category || fit.category === fitFilters.category)
        && (!fitFilters.silhouette || fit.silhouette === fitFilters.silhouette)
        && (!fitFilters.gender || fit.gender === fitFilters.gender)
        && (!fitFilters.portfolio || fit.portfolio === fitFilters.portfolio)
    })
  }, [fits, fitFilters, search])

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return materials.filter((material) => {
      const materialTypeLabel = formatMaterialTypeLabel(material.material_type, materialTypeProfiles)
      const unitLabel = unitLabels[material.unit]
      const originLabel = material.origin ? originLabels[material.origin] : 'No definido'
      const compositionFilter = materialFilters.composition === 'Con composición'
        ? material.is_fabric
        : materialFilters.composition === 'Sin composición'
          ? !material.is_fabric
          : true

      const matchesSearch = !normalizedSearch || [
        material.code,
        material.name,
        materialTypeLabel,
        unitLabel,
        originLabel,
        material.supplier_name ?? '',
        material.composition_label,
        material.image_url ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)

      return matchesSearch
        && (!materialFilters.status || material.status === materialFilters.status)
        && (!materialFilters.materialType || materialTypeLabel === materialFilters.materialType)
        && (!materialFilters.unit || unitLabel === materialFilters.unit)
        && (!materialFilters.origin || originLabel === materialFilters.origin)
        && compositionFilter
    })
  }, [materialFilters, materialTypeProfiles, materials, search])

  const showFits = catalogView === 'all' || catalogView === 'fits'
  const showMaterials = catalogView === 'all' || catalogView === 'materials'
  const hasFitFilters = Boolean(fitFilters.status || fitFilters.category || fitFilters.silhouette || fitFilters.gender || fitFilters.portfolio)
  const hasMaterialFilters = Boolean(
    materialFilters.status || materialFilters.materialType || materialFilters.unit || materialFilters.origin || materialFilters.composition,
  )
  const hasAnySmartFilter = Boolean(search.trim() || catalogView !== 'all' || hasFitFilters || hasMaterialFilters)

  function setView(nextView: CatalogView) {
    setCatalogView(nextView)
    if (nextView === 'fits') {
      setMaterialFilters({ status: '', materialType: '', unit: '', origin: '', composition: '' })
    }
    if (nextView === 'materials') {
      setFitFilters({ status: '', category: '', silhouette: '', gender: '', portfolio: '' })
    }
  }

  function resetSmartFilters() {
    setSearch('')
    setCatalogView('all')
    setFitFilters({ status: '', category: '', silhouette: '', gender: '', portfolio: '' })
    setMaterialFilters({ status: '', materialType: '', unit: '', origin: '', composition: '' })
  }

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
    setShowExistingTypes(false)
    setError(null)
    setFeedback(null)
  }

  function openEditMaterial(material: MaterialWithComposition) {
    setDrawerMode('material-edit')
    setSelectedMaterial(material)
    setMaterialForm(materialToForm(material, materialTypeProfiles))
    setCompositionForm(compositionToForm(material))
    setReason('Actualización de material desde catálogo')
    setShowExistingTypes(false)
    setError(null)
    setFeedback(null)
  }

  function closeDrawer() {
    setDrawerMode(null)
    setSelectedFit(null)
    setSelectedMaterial(null)
    setError(null)
    setShowExistingTypes(false)
  }

  function selectMaterialTypeProfile(profile: MaterialTypeProfile) {
    setMaterialForm((current) => ({
      ...current,
      material_type: profile.type_key,
      material_type_label: profile.type_label,
      unit: profile.default_unit,
      is_fabric: profile.requires_composition,
    }))

    if (profile.requires_composition && compositionForm.length === 0) {
      setCompositionForm([{ component_name: '', percentage: '' }])
    }

    setShowExistingTypes(false)
  }

  function updateMaterialTypeLabel(value: string) {
    const typeKey = normalizeMaterialTypeKey(value)
    const existingProfile = findMaterialTypeProfile(typeKey, materialTypeProfiles)

    setMaterialForm((current) => ({
      ...current,
      material_type: typeKey,
      material_type_label: value,
      unit: existingProfile?.default_unit ?? current.unit,
      is_fabric: existingProfile?.requires_composition ?? current.is_fabric,
    }))
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

      if (!materialForm.material_type_label.trim()) {
        throw new Error('El tipo de material es obligatorio. Puedes escribir uno nuevo o seleccionar un tipo existente.')
      }

      if (!reason.trim()) {
        throw new Error('El motivo es obligatorio para auditoría.')
      }

      const leadTime = Number(materialForm.lead_time_days || 0)
      if (materialForm.lead_time_days.trim() && (Number.isNaN(leadTime) || leadTime < 0)) {
        throw new Error('El lead time debe ser un número mayor o igual a 0.')
      }

      const profileForSave = findMaterialTypeProfile(materialForm.material_type_label, materialTypeProfiles)
      const materialFormForSave: MaterialFormInput = {
        ...materialForm,
        material_type: profileForSave?.type_key ?? normalizeMaterialTypeKey(materialForm.material_type_label),
      }

      const cleanCompositions = materialFormForSave.is_fabric
        ? compositionForm.filter((composition) => composition.component_name.trim() || composition.percentage.trim())
        : []

      if (materialFormForSave.is_fabric) {
        if (cleanCompositions.length === 0) {
          throw new Error(`El tipo ${materialFormForSave.material_type_label} requiere composición. Agrega al menos un componente.`)
        }

        const total = getCompositionTotal(cleanCompositions)

        if (Math.round(total * 100) / 100 !== 100) {
          throw new Error(`La composición debe sumar 100%. Actualmente suma ${total.toLocaleString('es-CO')}%.`)
        }
      }

      if (drawerMode === 'material-edit' && selectedMaterial) {
        await updateMaterial(selectedMaterial.id, selectedMaterial, materialFormForSave, cleanCompositions, reason)
        setFeedback('Material actualizado correctamente.')
      } else {
        await createMaterial(materialFormForSave, cleanCompositions, reason)
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
  const selectedTypeProfile = findMaterialTypeProfile(materialForm.material_type, materialTypeProfiles)
  const currentTypeLabel = typeLabelFromForm(materialForm)
  const currentCompositionLabel = getCompositionLabel(currentTypeLabel, selectedTypeProfile)
  const currentCompositionPlaceholder = getCompositionPlaceholder(currentTypeLabel)

  return (
    <>
      <div className="smart-catalog-panel">
        <div className="smart-catalog-head">
          <div>
            <span className="filter-label">Catálogo real</span>
            <h2>Explorador visual</h2>
            <p>Selecciona qué quieres ver. La app oculta automáticamente filtros y secciones que no aplican.</p>
          </div>
          <div className="smart-catalog-actions">
            <button className="btn btn-secondary" type="button" onClick={() => void loadCatalog()}>
              Recargar
            </button>
            {catalogView !== 'materials' ? (
              <button className="btn btn-primary" type="button" onClick={openCreateFit}>
                + Nuevo FIT
              </button>
            ) : null}
            {catalogView !== 'fits' ? (
              <button className="btn btn-primary" type="button" onClick={openCreateMaterial}>
                + Nuevo material
              </button>
            ) : null}
          </div>
        </div>

        <div className="filter-bar smart-filter-bar">
          <span className="filter-label">Ver</span>
          <button className={`filter-chip ${catalogView === 'all' ? 'active' : ''}`} type="button" onClick={() => setView('all')}>
            Todo
          </button>
          <button className={`filter-chip ${catalogView === 'fits' ? 'active' : ''}`} type="button" onClick={() => setView('fits')}>
            FITs
          </button>
          <button className={`filter-chip ${catalogView === 'materials' ? 'active' : ''}`} type="button" onClick={() => setView('materials')}>
            Materiales
          </button>

          <input
            className="search-input smart-search"
            placeholder={catalogView === 'fits' ? 'Buscar FIT por nombre, código, silueta...' : catalogView === 'materials' ? 'Buscar material por nombre, referencia, composición...' : 'Buscar FIT, material, referencia o composición...'}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {hasAnySmartFilter ? (
            <button className="action-btn" type="button" onClick={resetSmartFilters}>
              Limpiar filtros
            </button>
          ) : null}
        </div>

        {showFits ? (
          <div className="filter-bar smart-filter-bar contextual-filter">
            <span className="filter-label">Filtros FIT</span>
            <select className="filter-select" value={fitFilters.status} onChange={(event) => setFitFilters({ ...fitFilters, status: event.target.value })}>
              <option value="">Estado</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
            <select className="filter-select" value={fitFilters.category} onChange={(event) => setFitFilters({ ...fitFilters, category: event.target.value })}>
              <option value="">Categoría</option>
              {fitFilterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select className="filter-select" value={fitFilters.silhouette} onChange={(event) => setFitFilters({ ...fitFilters, silhouette: event.target.value })}>
              <option value="">Silueta</option>
              {fitFilterOptions.silhouettes.map((silhouette) => <option key={silhouette} value={silhouette}>{silhouette}</option>)}
            </select>
            <select className="filter-select" value={fitFilters.gender} onChange={(event) => setFitFilters({ ...fitFilters, gender: event.target.value })}>
              <option value="">Género</option>
              {fitFilterOptions.genders.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
            </select>
            <select className="filter-select" value={fitFilters.portfolio} onChange={(event) => setFitFilters({ ...fitFilters, portfolio: event.target.value })}>
              <option value="">Portafolio</option>
              {fitFilterOptions.portfolios.map((portfolio) => <option key={portfolio} value={portfolio}>{portfolio}</option>)}
            </select>
            <span className="filter-count">{filteredFits.length} de {fits.length} FITs</span>
          </div>
        ) : null}

        {showMaterials ? (
          <div className="filter-bar smart-filter-bar contextual-filter">
            <span className="filter-label">Filtros materiales</span>
            <select className="filter-select" value={materialFilters.status} onChange={(event) => setMaterialFilters({ ...materialFilters, status: event.target.value })}>
              <option value="">Estado</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
            <select className="filter-select" value={materialFilters.materialType} onChange={(event) => setMaterialFilters({ ...materialFilters, materialType: event.target.value })}>
              <option value="">Tipo</option>
              {materialFilterOptions.types.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select className="filter-select" value={materialFilters.unit} onChange={(event) => setMaterialFilters({ ...materialFilters, unit: event.target.value })}>
              <option value="">Unidad</option>
              {materialFilterOptions.units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
            <select className="filter-select" value={materialFilters.origin} onChange={(event) => setMaterialFilters({ ...materialFilters, origin: event.target.value })}>
              <option value="">Origen</option>
              {materialFilterOptions.origins.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
            </select>
            <select className="filter-select" value={materialFilters.composition} onChange={(event) => setMaterialFilters({ ...materialFilters, composition: event.target.value })}>
              <option value="">Composición</option>
              {materialFilterOptions.compositions.map((composition) => <option key={composition} value={composition}>{composition}</option>)}
            </select>
            <span className="filter-count">{filteredMaterials.length} de {materials.length} materiales</span>
          </div>
        ) : null}
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
            <span className="table-subtitle">Consultando FITs, materiales, tipos y composiciones desde Supabase</span>
          </div>
        </div>
      ) : null}

      {!isLoading && showFits ? (
        <div className="catalog-section">
          <div className="section-head compact">
            <div>
              <h3>FITs visuales</h3>
              <p>Vista rápida por imagen, código, silueta, género y portafolio.</p>
            </div>
          </div>
          {filteredFits.length > 0 ? (
            <div className="product-grid">
              {filteredFits.map((fit) => (
                <article className="product-card" key={fit.id}>
                  <div className="product-card-status">
                    <Badge>{mapStatus(fit.status)}</Badge>
                  </div>
                  <div className="entity-image small">
                    {fit.image_url ? <img src={fit.image_url} alt={fit.name} /> : <span>Sin foto FIT</span>}
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
          ) : (
            <div className="empty-state-card">No hay FITs que coincidan con los filtros seleccionados.</div>
          )}
        </div>
      ) : null}

      {!isLoading && showMaterials ? (
        <div className="catalog-section">
          <div className="section-head compact">
            <div>
              <h3>Materiales visuales</h3>
              <p>Vista rápida con imagen, tipo, unidad, composición y proveedor.</p>
            </div>
          </div>
          {filteredMaterials.length > 0 ? (
            <div className="product-grid">
              {filteredMaterials.map((material) => (
                <article className="product-card material-card" key={material.id}>
                  <div className="product-card-status">
                    <Badge>{mapStatus(material.status)}</Badge>
                  </div>
                  <div className="entity-image small">
                    {material.image_url ? <img src={material.image_url} alt={material.name} /> : <span>Sin foto material</span>}
                  </div>
                  <div className="product-card-name">{material.name}</div>
                  <div className="product-card-cat">
                    {formatMaterialTypeLabel(material.material_type, materialTypeProfiles)} · {unitLabels[material.unit]}
                  </div>
                  <div className="product-card-row">
                    <span>Código</span>
                    <strong>{material.code}</strong>
                  </div>
                  <div className="product-card-row">
                    <span>Origen</span>
                    <strong>{material.origin ? originLabels[material.origin] : 'No definido'}</strong>
                  </div>
                  <div className="product-card-row">
                    <span>Proveedor</span>
                    <strong>{material.supplier_name ?? 'No definido'}</strong>
                  </div>
                  <div className="product-card-row">
                    <span>Composición</span>
                    <strong>{material.composition_label}</strong>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button className="action-btn" type="button" onClick={() => openEditMaterial(material)}>
                      Editar material
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state-card">No hay materiales que coincidan con los filtros seleccionados.</div>
          )}
        </div>
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

          <div className="form-group">
            <label>Foto FIT (URL de imagen)</label>
            <input className="form-control" value={fitForm.image_url} onChange={(event) => setFitForm({ ...fitForm, image_url: event.target.value })} placeholder="https://.../foto-fit.jpg" />
          </div>

          {fitForm.image_url ? (
            <div className="entity-image preview">
              <img src={fitForm.image_url} alt="Vista previa FIT" />
            </div>
          ) : null}

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
        subtitle="Tela, insumo, metal, accesorio o componente usado por el BOM"
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
            <input className="form-control" value={materialForm.name} onChange={(event) => setMaterialForm({ ...materialForm, name: event.target.value })} placeholder="Denim azul 12 oz / Broche metálico chaqueta" />
          </div>

          <div className="form-group">
            <label>Foto material (URL de imagen)</label>
            <input
              className="form-control"
              value={materialForm.image_url}
              onChange={(event) => setMaterialForm({ ...materialForm, image_url: event.target.value })}
              placeholder="https://.../foto-material.jpg"
            />
            <small className="form-hint">
              Sirve para identificar visualmente telas, broches, marquillas, botones, metales o insumos especiales.
            </small>
          </div>

          {materialForm.image_url ? (
            <div className="entity-image preview">
              <img src={materialForm.image_url} alt="Vista previa material" />
            </div>
          ) : null}

          <div className="form-group">
            <label>Tipo de material</label>
            <div className="inline-control-group">
              <input
                className="form-control"
                value={materialForm.material_type_label}
                onChange={(event) => updateMaterialTypeLabel(event.target.value)}
                placeholder="Tela, metal, broche, botón..."
              />
              <button className="action-btn" type="button" onClick={() => setShowExistingTypes((current) => !current)}>
                Tipos existentes
              </button>
            </div>
            <small className="form-hint">
              Puedes escribir un tipo nuevo. Al guardar, queda disponible para futuros materiales.
            </small>
            {showExistingTypes ? (
              <div className="type-chip-grid">
                {materialTypeProfiles.map((profile) => (
                  <button
                    className={`filter-chip ${materialForm.material_type === profile.type_key ? 'active' : ''}`}
                    key={profile.type_key}
                    type="button"
                    onClick={() => selectMaterialTypeProfile(profile)}
                  >
                    {profile.type_label} · {unitLabels[profile.default_unit]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Unidad asociada al tipo</label>
              <select className="form-control" value={materialForm.unit} onChange={(event) => setMaterialForm({ ...materialForm, unit: event.target.value as MaterialFormInput['unit'] })}>
                {Object.entries(unitLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <small className="form-hint">
                Ejemplo: tela en metros, broches metálicos en kg, botones en unidades.
              </small>
            </div>
            <div className="form-group">
              <label>Composición del tipo</label>
              <div className="toggle-row">
                <button
                  className={`filter-chip ${materialForm.is_fabric ? 'active' : ''}`}
                  type="button"
                  onClick={() => setMaterialForm({ ...materialForm, is_fabric: true })}
                >
                  Requiere composición
                </button>
                <button
                  className={`filter-chip ${!materialForm.is_fabric ? 'active' : ''}`}
                  type="button"
                  onClick={() => setMaterialForm({ ...materialForm, is_fabric: false })}
                >
                  Sin composición
                </button>
              </div>
              <small className="form-hint">
                Si activas composición, la app validará que los componentes sumen 100%.
              </small>
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

          {materialForm.is_fabric ? (
            <div className="composition-box">
              <div className="composition-head">
                <div>
                  <strong>{currentCompositionLabel}</strong>
                  <span>
                    Tipo: {currentTypeLabel} · Unidad: {unitLabels[materialForm.unit]} · La suma debe ser exactamente 100%.
                  </span>
                </div>
                <button className="action-btn" type="button" onClick={addCompositionRow}>+ Componente</button>
              </div>

              {compositionForm.map((composition, index) => (
                <div className="composition-row" key={index}>
                  <input
                    className="form-control"
                    value={composition.component_name}
                    onChange={(event) => updateComposition(index, 'component_name', event.target.value)}
                    placeholder={currentCompositionPlaceholder}
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
