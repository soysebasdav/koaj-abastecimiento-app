import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Drawer } from '../../components/Drawer'
import { TableShell } from '../../components/TableShell'
import { formatDateMonth, formatNumber, formatPercent, mapUnit } from '../../utils/format'
import { formatMaterialTypeLabel } from '../../utils/materialTypes'
import {
  createBomLine,
  createVersionWithMix,
  getBomFormOptions,
  listBomLines,
  listVersionMix,
  updateBomLine,
  updateVersionWithMix,
} from './bomService'
import type {
  BomFormOptions,
  BomLineFormInput,
  BomLineRecordForAudit,
  BomLineView,
  FitVersionMixRecordForAudit,
  FitVersionRecordForAudit,
  VersionMixFormInput,
  VersionMixView,
} from './bomTypes'

type DrawerMode = 'version-create' | 'version-edit' | 'bom-create' | 'bom-edit' | null

const emptyVersionForm: VersionMixFormInput = {
  collection_id: '',
  fit_id: '',
  version_code: '',
  description: '',
  color_range_start: '',
  color_range_end: '',
  main_material_id: '',
  image_url: '',
  share_percentage: '',
  valid_from_month: '',
  valid_to_month: '',
  change_reason: '',
  status: 'active',
}

const emptyBomForm: BomLineFormInput = {
  fit_version_id: '',
  piece_name: '',
  material_id: '',
  pieces_per_unit: '1',
  consumption_per_piece: '',
  waste_percentage: '0',
  image_url: '',
  valid_from_month: '',
  valid_to_month: '',
  status: 'active',
  notes: '',
}

function mapStatus(status: 'active' | 'inactive') {
  return status === 'active' ? 'Activo' : 'Inactivo'
}

function toMonthInputValue(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 7)
}

function fromMonthInputValue(value: string) {
  return value ? `${value}-01` : ''
}

function versionToForm(row: VersionMixView): VersionMixFormInput {
  return {
    collection_id: row.collectionId,
    fit_id: row.fitId,
    version_code: row.versionCode,
    description: row.description ?? '',
    color_range_start: row.colorRangeStart?.toString() ?? '',
    color_range_end: row.colorRangeEnd?.toString() ?? '',
    main_material_id: row.mainMaterialId ?? '',
    image_url: row.versionImageUrl ?? '',
    share_percentage: row.sharePercentage.toString(),
    valid_from_month: toMonthInputValue(row.validFromMonth),
    valid_to_month: toMonthInputValue(row.validToMonth),
    change_reason: row.changeReason ?? '',
    status: row.status,
  }
}

function versionAuditRecord(row: VersionMixView): FitVersionRecordForAudit {
  return {
    id: row.fitVersionId,
    collection_id: row.collectionId,
    fit_id: row.fitId,
    version_code: row.versionCode,
    description: row.description,
    color_range_start: row.colorRangeStart,
    color_range_end: row.colorRangeEnd,
    main_material_id: row.mainMaterialId,
    image_url: row.versionImageUrl,
    status: row.status,
  }
}

function mixAuditRecord(row: VersionMixView): FitVersionMixRecordForAudit {
  return {
    id: row.id,
    fit_version_id: row.fitVersionId,
    valid_from_month: row.validFromMonth,
    valid_to_month: row.validToMonth,
    share_percentage: row.sharePercentage,
    change_reason: row.changeReason,
  }
}

function bomToForm(row: BomLineView, _options: BomFormOptions): BomLineFormInput {
  return {
    fit_version_id: row.fitVersionId,
    piece_name: row.pieceName,
    material_id: row.materialId,
    pieces_per_unit: row.piecesPerUnit.toString(),
    consumption_per_piece: row.consumptionPerPiece.toString(),
    waste_percentage: row.wastePercentage.toString(),
    image_url: row.pieceImageUrl ?? '',
    valid_from_month: toMonthInputValue(row.validFromMonth),
    valid_to_month: toMonthInputValue(row.validToMonth),
    status: row.status,
    notes: row.notes ?? '',
  }
}

function bomAuditRecord(row: BomLineView, _options: BomFormOptions): BomLineRecordForAudit {
  return {
    id: row.id,
    fit_version_id: row.fitVersionId,
    piece_name: row.pieceName,
    material_id: row.materialId,
    pieces_per_unit: row.piecesPerUnit,
    consumption_per_piece: row.consumptionPerPiece,
    waste_percentage: row.wastePercentage,
    image_url: row.pieceImageUrl,
    valid_from_month: row.validFromMonth,
    valid_to_month: row.validToMonth,
    status: row.status,
    notes: row.notes,
  }
}

function monthRangesOverlap(
  firstFrom: string,
  firstTo: string | null | undefined,
  secondFrom: string,
  secondTo: string | null | undefined,
) {
  const firstStart = firstFrom.slice(0, 7)
  const firstEnd = firstTo ? firstTo.slice(0, 7) : '9999-12'
  const secondStart = secondFrom.slice(0, 7)
  const secondEnd = secondTo ? secondTo.slice(0, 7) : '9999-12'

  return firstStart <= secondEnd && secondStart <= firstEnd
}


function uniqueBy<T>(items: T[], keyGetter: (item: T) => string) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyGetter(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function ImageBox({ src, label, className = '' }: { src?: string | null; label: string; className?: string }) {
  return (
    <div className={`entity-image ${className}`}>
      {src ? <img src={src} alt={label} /> : <span>{label}</span>}
    </div>
  )
}

export function BomPage() {
  const [bomLines, setBomLines] = useState<BomLineView[]>([])
  const [versionMix, setVersionMix] = useState<VersionMixView[]>([])
  const [options, setOptions] = useState<BomFormOptions>({
    collections: [],
    fits: [],
    materials: [],
    fitVersions: [],
  })
  const [search, setSearch] = useState('')
  const [selectedVisualFitId, setSelectedVisualFitId] = useState<string | null>(null)
  const [selectedVisualVersionId, setSelectedVisualVersionId] = useState<string | null>(null)
  const [selectedVisualPieceId, setSelectedVisualPieceId] = useState<string | null>(null)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [versionForm, setVersionForm] = useState<VersionMixFormInput>(emptyVersionForm)
  const [bomForm, setBomForm] = useState<BomLineFormInput>(emptyBomForm)
  const [selectedVersion, setSelectedVersion] = useState<VersionMixView | null>(null)
  const [selectedBomLine, setSelectedBomLine] = useState<BomLineView | null>(null)
  const [lockedVersionFitId, setLockedVersionFitId] = useState<string | null>(null)
  const [lockedBomVersionId, setLockedBomVersionId] = useState<string | null>(null)
  const [bomMaterialTypeFilter, setBomMaterialTypeFilter] = useState('')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function loadBom() {
    setIsLoading(true)
    setError(null)

    try {
      const [lines, mix, formOptions] = await Promise.all([listBomLines(), listVersionMix(), getBomFormOptions()])
      setBomLines(lines)
      setVersionMix(mix)
      setOptions(formOptions)
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

  const visualFits = useMemo(() => {
    const query = search.trim().toLowerCase()

    return options.fits
      .filter((fit) => {
        if (!query) return true
        return [fit.code, fit.name, fit.silhouette ?? '', fit.category ?? ''].join(' ').toLowerCase().includes(query)
      })
      .map((fit) => {
        const fitVersions = uniqueBy<VersionMixView>(versionMix.filter((mix) => mix.fitId === fit.id), (mix) => mix.fitVersionId)
        const fitVersionIds = new Set(fitVersions.map((mix) => mix.fitVersionId))
        const fitPieces = bomLines.filter((line) => fitVersionIds.has(line.fitVersionId))

        return {
          ...fit,
          versionCount: fitVersions.length,
          pieceCount: fitPieces.length,
        }
      })
  }, [bomLines, options.fits, search, versionMix])

  const selectedVisualFit = useMemo(
    () => options.fits.find((fit) => fit.id === selectedVisualFitId) ?? null,
    [options.fits, selectedVisualFitId],
  )

  const selectedFitVersions = useMemo(() => {
    if (!selectedVisualFitId) return []
    return uniqueBy<VersionMixView>(
      versionMix.filter((mix) => mix.fitId === selectedVisualFitId),
      (mix) => mix.fitVersionId,
    ).sort((a, b) => a.versionCode.localeCompare(b.versionCode))
  }, [selectedVisualFitId, versionMix])

  const visualVersion = useMemo(
    () => selectedFitVersions.find((version) => version.fitVersionId === selectedVisualVersionId) ?? null,
    [selectedFitVersions, selectedVisualVersionId],
  )

  const visualVersionPieces = useMemo(() => {
    if (!visualVersion) return []
    return bomLines
      .filter((line) => line.fitVersionId === visualVersion.fitVersionId)
      .sort((a, b) => a.pieceName.localeCompare(b.pieceName))
  }, [bomLines, visualVersion])

  const visualPiece = useMemo(
    () => visualVersionPieces.find((piece) => piece.id === selectedVisualPieceId) ?? null,
    [selectedVisualPieceId, visualVersionPieces],
  )

  const fitPieceSuggestions = useMemo(() => {
    if (!selectedVisualFitId) return ['Base', 'Bolsillo', 'Botón', 'Marquilla', 'Cremallera']

    const versionIds = new Set(
      versionMix
        .filter((mix) => mix.fitId === selectedVisualFitId)
        .map((mix) => mix.fitVersionId),
    )
    const existingPieces = bomLines
      .filter((line) => versionIds.has(line.fitVersionId))
      .map((line) => line.pieceName)

    return Array.from(new Set(['Base', 'Bolsillo', 'Botón', 'Marquilla', 'Cremallera', ...existingPieces]))
      .filter(Boolean)
      .slice(0, 10)
  }, [bomLines, selectedVisualFitId, versionMix])

  const mixTotalForCurrentFit = useMemo(() => {
    if (!versionForm.collection_id || !versionForm.fit_id) return 0

    return versionMix
      .filter((mix) => {
        const isSameContext = mix.collectionId === versionForm.collection_id && mix.fitId === versionForm.fit_id
        const isNotCurrent = drawerMode !== 'version-edit' || mix.id !== selectedVersion?.id
        const overlaps = monthRangesOverlap(
          fromMonthInputValue(versionForm.valid_from_month),
          fromMonthInputValue(versionForm.valid_to_month) || null,
          mix.validFromMonth,
          mix.validToMonth,
        )
        return isSameContext && isNotCurrent && overlaps && mix.status === 'active'
      })
      .reduce((sum, mix) => sum + mix.sharePercentage, 0)
  }, [drawerMode, selectedVersion?.id, versionForm.collection_id, versionForm.fit_id, versionForm.valid_from_month, versionForm.valid_to_month, versionMix])

  const projectedMixTotal = mixTotalForCurrentFit + Number(versionForm.share_percentage || 0)
  const isProjectedMixComplete = Math.round(projectedMixTotal * 100) / 100 === 100
  const isProjectedMixExceeded = projectedMixTotal > 100

  const isVersionFitLocked = drawerMode === 'version-edit' || Boolean(lockedVersionFitId)
  const isBomVersionLocked = drawerMode === 'bom-edit' || Boolean(lockedBomVersionId)

  const materialTypeOptions = useMemo(() => (
    uniqueBy(options.materials, (material) => material.material_type)
      .map((material) => ({
        value: material.material_type,
        label: formatMaterialTypeLabel(material.material_type),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  ), [options.materials])

  const filteredBomMaterials = useMemo(() => {
    if (!bomMaterialTypeFilter) return options.materials
    return options.materials.filter((material) => material.material_type === bomMaterialTypeFilter)
  }, [bomMaterialTypeFilter, options.materials])

  function getFitLabel(fitId: string) {
    const fit = options.fits.find((item) => item.id === fitId)
    return fit ? `${fit.code} · ${fit.name}` : 'FIT seleccionado'
  }

  function getFitVersionLabel(versionId: string) {
    const version = options.fitVersions.find((item) => item.id === versionId)
    return version ? `${version.collectionCode} · ${version.fitName} · ${version.versionCode}` : 'Versión seleccionada'
  }

  function handleBomMaterialTypeChange(materialType: string) {
    setBomMaterialTypeFilter(materialType)
    setBomForm((current) => ({ ...current, material_id: '' }))
  }

  function handleBomMaterialChange(materialId: string) {
    const material = options.materials.find((item) => item.id === materialId)
    setBomMaterialTypeFilter(material?.material_type ?? '')
    setBomForm((current) => ({ ...current, material_id: materialId }))
  }

  function getNextVersionCode(fitId: string) {
    if (!fitId) return ''

    const versionCodes = [
      ...versionMix.filter((mix) => mix.fitId === fitId).map((mix) => mix.versionCode),
      ...options.fitVersions.filter((version) => version.fitId === fitId).map((version) => version.versionCode),
    ]

    const lastVersionNumber = versionCodes.reduce((max, code) => {
      const match = code.trim().match(/^V(\d+)$/i)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0)

    return `V${lastVersionNumber + 1}`
  }

  function openCreateVersion(prefilledFitId?: string) {
    const initialFitId = prefilledFitId ?? options.fits[0]?.id ?? ''

    setDrawerMode('version-create')
    setSelectedVersion(null)
    setLockedVersionFitId(prefilledFitId ?? null)
    setVersionForm({
      ...emptyVersionForm,
      collection_id: options.collections[0]?.id ?? '',
      fit_id: initialFitId,
      version_code: getNextVersionCode(initialFitId),
      main_material_id: options.materials[0]?.id ?? '',
    })
    setReason('Creación de versión y mix porcentual desde BOM')
    setError(null)
    setFeedback(null)
  }

  function openEditVersion(row: VersionMixView) {
    setDrawerMode('version-edit')
    setSelectedVersion(row)
    setLockedVersionFitId(row.fitId)
    setVersionForm(versionToForm(row))
    setReason('Actualización de versión y mix porcentual desde BOM')
    setError(null)
    setFeedback(null)
  }

  function openCreateBomLine(prefilledVersionId?: string, prefilledPieceName = '') {
    setDrawerMode('bom-create')
    setSelectedBomLine(null)
    setLockedBomVersionId(prefilledVersionId ?? null)
    setBomMaterialTypeFilter('')
    setBomForm({
      ...emptyBomForm,
      fit_version_id: prefilledVersionId ?? '',
      piece_name: prefilledPieceName,
      material_id: '',
    })
    setReason('Creación de pieza BOM')
    setError(null)
    setFeedback(null)
  }

  function openEditBomLine(row: BomLineView) {
    setDrawerMode('bom-edit')
    setSelectedBomLine(row)
    setLockedBomVersionId(row.fitVersionId)
    setBomMaterialTypeFilter(row.materialType)
    setBomForm(bomToForm(row, options))
    setReason('Actualización de pieza BOM')
    setError(null)
    setFeedback(null)
  }

  function closeDrawer() {
    setDrawerMode(null)
    setSelectedVersion(null)
    setSelectedBomLine(null)
    setLockedVersionFitId(null)
    setLockedBomVersionId(null)
    setBomMaterialTypeFilter('')
    setError(null)
  }

  function openVisualFit(fitId: string) {
    setSelectedVisualFitId(fitId)
    setSelectedVisualVersionId(null)
    setSelectedVisualPieceId(null)
  }

  function openVisualVersion(versionId: string) {
    setSelectedVisualVersionId(versionId)
    setSelectedVisualPieceId(null)
  }

  function backToFitList() {
    setSelectedVisualFitId(null)
    setSelectedVisualVersionId(null)
    setSelectedVisualPieceId(null)
  }

  function backToSelectedFit() {
    setSelectedVisualVersionId(null)
    setSelectedVisualPieceId(null)
  }

  async function handleVersionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const effectiveVersionForm = {
        ...versionForm,
        version_code: versionForm.version_code.trim() || getNextVersionCode(versionForm.fit_id),
      }

      if (!effectiveVersionForm.collection_id || !effectiveVersionForm.fit_id || !effectiveVersionForm.version_code) {
        throw new Error('Colección, FIT y código de versión son obligatorios.')
      }

      if (!effectiveVersionForm.valid_from_month) {
        throw new Error('La vigencia desde es obligatoria.')
      }

      if (effectiveVersionForm.valid_to_month && effectiveVersionForm.valid_to_month < effectiveVersionForm.valid_from_month) {
        throw new Error('La vigencia hasta no puede ser anterior a la vigencia desde.')
      }

      const share = Number(effectiveVersionForm.share_percentage)
      if (Number.isNaN(share) || share < 0 || share > 100) {
        throw new Error('El porcentaje de participación debe estar entre 0 y 100.')
      }

      if (effectiveVersionForm.status === 'active' && isProjectedMixExceeded) {
        throw new Error(`El mix vigente del FIT supera 100% para la vigencia seleccionada. Total estimado: ${projectedMixTotal.toLocaleString('es-CO')}%.`)
      }

      if (!reason.trim()) {
        throw new Error('El motivo es obligatorio para auditoría.')
      }

      const normalizedInput = {
        ...effectiveVersionForm,
        valid_from_month: fromMonthInputValue(effectiveVersionForm.valid_from_month),
        valid_to_month: fromMonthInputValue(effectiveVersionForm.valid_to_month),
      }

      if (drawerMode === 'version-edit' && selectedVersion) {
        await updateVersionWithMix(
          selectedVersion.fitVersionId,
          selectedVersion.id,
          versionAuditRecord(selectedVersion),
          mixAuditRecord(selectedVersion),
          normalizedInput,
          reason,
        )
        setFeedback('Versión y mix actualizados correctamente.')
      } else {
        await createVersionWithMix(normalizedInput, reason)
        setFeedback('Versión y mix creados correctamente.')
      }

      await loadBom()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la versión.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBomSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      if (!bomForm.fit_version_id || !bomForm.material_id || !bomForm.piece_name.trim()) {
        throw new Error('Versión, material y nombre de pieza son obligatorios.')
      }

      if (!bomForm.valid_from_month) {
        throw new Error('La vigencia desde es obligatoria.')
      }

      if (bomForm.valid_to_month && bomForm.valid_to_month < bomForm.valid_from_month) {
        throw new Error('La vigencia hasta no puede ser anterior a la vigencia desde.')
      }

      const pieces = Number(bomForm.pieces_per_unit)
      const consumption = Number(bomForm.consumption_per_piece)
      const waste = Number(bomForm.waste_percentage || 0)

      if (Number.isNaN(pieces) || pieces <= 0) {
        throw new Error('Las piezas por unidad deben ser mayores a 0.')
      }

      if (Number.isNaN(consumption) || consumption < 0) {
        throw new Error('El consumo por pieza no puede ser negativo.')
      }

      if (Number.isNaN(waste) || waste < 0 || waste > 100) {
        throw new Error('El desperdicio debe estar entre 0 y 100%.')
      }

      if (!reason.trim()) {
        throw new Error('El motivo es obligatorio para auditoría.')
      }

      const normalizedInput = {
        ...bomForm,
        valid_from_month: fromMonthInputValue(bomForm.valid_from_month),
        valid_to_month: fromMonthInputValue(bomForm.valid_to_month),
      }

      if (drawerMode === 'bom-edit' && selectedBomLine) {
        await updateBomLine(selectedBomLine.id, bomAuditRecord(selectedBomLine, options), normalizedInput, reason)
        setFeedback('Pieza BOM actualizada correctamente.')
      } else {
        await createBomLine(normalizedInput, reason)
        setFeedback('Pieza BOM creada correctamente.')
      }

      await loadBom()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la pieza BOM.')
    } finally {
      setIsSaving(false)
    }
  }

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
        <button className="btn btn-primary" type="button" onClick={() => openCreateVersion()}>
          + Versión / mix
        </button>
        <button className="btn btn-primary" type="button" onClick={() => openCreateBomLine()}>
          + Pieza BOM
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {feedback ? <div className="auth-alert success" style={{ marginBottom: 16 }}>{feedback}</div> : null}

      <section className="visual-bom-panel">
        <div className="visual-bom-head">
          <div>
            <span className="table-title">Explorador visual FIT → versión → piezas BOM</span>
            <p>Selecciona un FIT para ver sus versiones. Luego abre una versión para consultar o crear sus piezas asociadas.</p>
          </div>
          <div className="inline-actions">
            {selectedVisualVersionId ? (
              <button className="btn btn-secondary" type="button" onClick={backToSelectedFit}>
                ← Volver al FIT
              </button>
            ) : selectedVisualFitId ? (
              <button className="btn btn-secondary" type="button" onClick={backToFitList}>
                ← Todos los FITs
              </button>
            ) : null}
            {selectedVisualFit && !visualVersion ? (
              <button className="btn btn-primary" type="button" onClick={() => openCreateVersion(selectedVisualFit.id)}>
                + Versión para este FIT
              </button>
            ) : null}
            {visualVersion ? (
              <button className="btn btn-primary" type="button" onClick={() => openCreateBomLine(visualVersion.fitVersionId)}>
                + Pieza para esta versión
              </button>
            ) : null}
          </div>
        </div>

        {!selectedVisualFit ? (
          <div className="visual-fit-grid">
            {visualFits.length === 0 ? (
              <div className="empty-state">No hay FITs activos para mostrar.</div>
            ) : visualFits.map((fit) => (
              <article className="visual-card" key={fit.id} onClick={() => openVisualFit(fit.id)}>
                <ImageBox src={fit.imageUrl} label="Sin foto FIT" className="fit" />
                <div className="visual-card-body">
                  <div className="visual-eyebrow">{fit.code}</div>
                  <h3>{fit.name}</h3>
                  <p>{fit.category ?? 'Sin categoría'} · {fit.silhouette ?? 'Sin silueta'}</p>
                  <div className="visual-card-metrics">
                    <span>{fit.versionCount} versiones</span>
                    <span>{fit.pieceCount} piezas BOM</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {selectedVisualFit && !visualVersion ? (
          <div className="visual-detail-layout">
            <aside className="visual-master-card">
              <ImageBox src={selectedVisualFit.imageUrl} label="Sin foto FIT" className="hero" />
              <div className="visual-eyebrow">{selectedVisualFit.code}</div>
              <h2>{selectedVisualFit.name}</h2>
              <p>{selectedVisualFit.category ?? 'Sin categoría'} · {selectedVisualFit.silhouette ?? 'Sin silueta'}</p>
              <div className="visual-card-metrics stacked">
                <span>{selectedFitVersions.length} versiones asociadas</span>
                <span>{bomLines.filter((line) => selectedFitVersions.some((version) => version.fitVersionId === line.fitVersionId)).length} piezas BOM asociadas</span>
              </div>
            </aside>

            <div className="visual-child-area">
              <div className="visual-section-title">
                <strong>Versiones asociadas al FIT</strong>
                <span>Al crear una versión desde aquí queda relacionada automáticamente con este FIT.</span>
              </div>

              {selectedFitVersions.length === 0 ? (
                <div className="empty-state">Este FIT todavía no tiene versiones. Usa “+ Versión para este FIT”.</div>
              ) : (
                <div className="visual-version-grid">
                  {selectedFitVersions.map((version) => (
                    <article className="visual-card compact" key={version.fitVersionId} onClick={() => openVisualVersion(version.fitVersionId)}>
                      <ImageBox src={version.versionImageUrl} label="Sin foto versión" className="version" />
                      <div className="visual-card-body">
                        <div className="visual-eyebrow">{version.collectionCode} · {version.versionCode}</div>
                        <h3>{version.description || version.mainMaterialName}</h3>
                        <p>Color {version.colorRange} · {formatPercent(version.sharePercentage, 2)} del mix</p>
                        <div className="visual-card-metrics">
                          <span>{bomLines.filter((line) => line.fitVersionId === version.fitVersionId).length} piezas</span>
                          <span>{mapStatus(version.status)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {visualVersion ? (
          <div className="visual-version-view">
            <div className="visual-version-hero">
              <ImageBox src={visualVersion.versionImageUrl || visualVersion.fitImageUrl} label="Sin foto versión" className="hero wide" />
              <div>
                <div className="visual-eyebrow">{visualVersion.collectionCode} · {visualVersion.fitName}</div>
                <h2>{visualVersion.versionCode}</h2>
                <p>{visualVersion.description || 'Versión sin descripción registrada.'}</p>
                <div className="visual-card-metrics">
                  <span>Color {visualVersion.colorRange}</span>
                  <span>Material principal: {visualVersion.mainMaterialName}</span>
                  <span>Mix {formatPercent(visualVersion.sharePercentage, 2)}</span>
                </div>
                <div className="inline-actions" style={{ marginTop: 12 }}>
                  <button className="action-btn" type="button" onClick={() => openEditVersion(visualVersion)}>Editar versión</button>
                  <button className="action-btn" type="button" onClick={() => openCreateBomLine(visualVersion.fitVersionId)}>Agregar pieza BOM</button>
                </div>
              </div>
            </div>

            <div className="visual-section-title">
              <strong>Piezas asociadas a la versión</strong>
              <span>Al agregar una pieza desde aquí queda asociada automáticamente a esta versión del FIT.</span>
            </div>

            <div className="piece-suggestion-row">
              <span>Piezas rápidas:</span>
              {fitPieceSuggestions.map((pieceName) => (
                <button className="filter-chip" key={pieceName} type="button" onClick={() => openCreateBomLine(visualVersion.fitVersionId, pieceName)}>
                  + {pieceName}
                </button>
              ))}
            </div>

            {visualVersionPieces.length === 0 ? (
              <div className="empty-state">Esta versión todavía no tiene piezas BOM asociadas.</div>
            ) : (
              <div className="visual-piece-grid">
                {visualVersionPieces.map((piece) => (
                  <article
                    className={`visual-card piece ${selectedVisualPieceId === piece.id ? 'selected' : ''}`}
                    key={piece.id}
                    onClick={() => setSelectedVisualPieceId(piece.id)}
                  >
                    <ImageBox src={piece.pieceImageUrl} label="Sin foto pieza" className="piece-img" />
                    <div className="visual-card-body">
                      <div className="visual-eyebrow">{piece.materialCode}</div>
                      <h3>{piece.pieceName}</h3>
                      <p>{piece.materialName}</p>
                      <div className="visual-card-metrics stacked">
                        <span>{formatNumber(piece.piecesPerUnit, 2)} piezas/u</span>
                        <span>{formatNumber(piece.effectiveConsumptionPerUnit, 4)} {mapUnit(piece.materialUnit)} efectivos/u</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {visualPiece ? (
              <div className="piece-detail-panel">
                <ImageBox src={visualPiece.pieceImageUrl} label="Sin foto pieza" className="hero" />
                <div className="piece-detail-content">
                  <div className="visual-eyebrow">Detalle pieza BOM</div>
                  <h3>{visualPiece.pieceName}</h3>
                  <p>{visualPiece.notes ?? 'Sin notas técnicas registradas.'}</p>
                  <div className="piece-detail-grid">
                    <span>Material</span><strong>{visualPiece.materialCode} · {visualPiece.materialName}</strong>
                    <span>Tipo material</span><strong>{formatMaterialTypeLabel(visualPiece.materialType)}</strong>
                    <span>Piezas por unidad</span><strong>{formatNumber(visualPiece.piecesPerUnit, 4)}</strong>
                    <span>Consumo por pieza</span><strong>{formatNumber(visualPiece.consumptionPerPiece, 4)} {mapUnit(visualPiece.materialUnit)}</strong>
                    <span>Desperdicio</span><strong>{formatPercent(visualPiece.wastePercentage, 2)}</strong>
                    <span>Consumo efectivo/u</span><strong>{formatNumber(visualPiece.effectiveConsumptionPerUnit, 4)} {mapUnit(visualPiece.materialUnit)}</strong>
                    <span>Vigencia</span><strong>{formatDateMonth(visualPiece.validFromMonth)} → {visualPiece.validToMonth ? formatDateMonth(visualPiece.validToMonth) : 'abierta'}</strong>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={() => openEditBomLine(visualPiece)}>
                    Editar pieza
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

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
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={12}>Cargando BOM...</td></tr>
            ) : filteredLines.length === 0 ? (
              <tr><td colSpan={12}>No hay líneas BOM registradas.</td></tr>
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
                <td><button className="action-btn" type="button" onClick={() => openEditBomLine(line)}>Editar</button></td>
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
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10}>Cargando mix de versiones...</td></tr>
            ) : filteredMix.length === 0 ? (
              <tr><td colSpan={10}>No hay mix porcentual registrado.</td></tr>
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
                <td><button className="action-btn" type="button" onClick={() => openEditVersion(mix)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <Drawer
        isOpen={drawerMode === 'version-create' || drawerMode === 'version-edit'}
        title={drawerMode === 'version-edit' ? 'Editar versión y mix' : 'Nueva versión y mix'}
        subtitle="Color, tela principal, participación y vigencia"
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="version-form" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar versión'}
            </button>
          </>
        }
      >
        <form id="version-form" className="drawer-form" onSubmit={handleVersionSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Colección</label>
              <select className="form-control" value={versionForm.collection_id} onChange={(event) => setVersionForm({ ...versionForm, collection_id: event.target.value })}>
                <option value="">Selecciona...</option>
                {options.collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>{collection.code} · {collection.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>FIT</label>
              {isVersionFitLocked ? (
                <input className="form-control" value={getFitLabel(versionForm.fit_id)} readOnly aria-readonly="true" />
              ) : (
                <select
                  className="form-control"
                  value={versionForm.fit_id}
                  onChange={(event) => {
                    const fitId = event.target.value
                    setVersionForm({ ...versionForm, fit_id: fitId, version_code: getNextVersionCode(fitId) })
                  }}
                >
                  <option value="">Selecciona...</option>
                  {options.fits.map((fit) => (
                    <option key={fit.id} value={fit.id}>{fit.code} · {fit.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Código versión</label>
              <input
                className="form-control"
                value={versionForm.version_code}
                readOnly
                aria-readonly="true"
                placeholder="Se asigna automáticamente"
              />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select className="form-control" value={versionForm.status} onChange={(event) => setVersionForm({ ...versionForm, status: event.target.value as VersionMixFormInput['status'] })}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <input className="form-control" value={versionForm.description} onChange={(event) => setVersionForm({ ...versionForm, description: event.target.value })} placeholder="Versión Denim azul rango 940-942" />
          </div>

          <div className="form-group">
            <label>Foto de la versión (URL de imagen)</label>
            <input className="form-control" value={versionForm.image_url} onChange={(event) => setVersionForm({ ...versionForm, image_url: event.target.value })} placeholder="https://.../version-color-940.jpg" />
          </div>

          {versionForm.image_url ? (
            <ImageBox src={versionForm.image_url} label="Vista previa versión" className="preview" />
          ) : null}

          <div className="form-row">
            <div className="form-group">
              <label>Rango color inicio</label>
              <input className="form-control" type="number" value={versionForm.color_range_start} onChange={(event) => setVersionForm({ ...versionForm, color_range_start: event.target.value })} placeholder="940" />
            </div>
            <div className="form-group">
              <label>Rango color fin</label>
              <input className="form-control" type="number" value={versionForm.color_range_end} onChange={(event) => setVersionForm({ ...versionForm, color_range_end: event.target.value })} placeholder="942" />
            </div>
          </div>

          <div className="form-group">
            <label>Tela / material principal</label>
            <select className="form-control" value={versionForm.main_material_id} onChange={(event) => setVersionForm({ ...versionForm, main_material_id: event.target.value })}>
              <option value="">No definido</option>
              {options.materials.map((material) => (
                <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Participación %</label>
              <input className="form-control" type="number" min="0" max="100" step="0.01" value={versionForm.share_percentage} onChange={(event) => setVersionForm({ ...versionForm, share_percentage: event.target.value })} placeholder="60" />
            </div>
            <div className="form-group">
              <label>Vigente desde</label>
              <input className="form-control" type="month" value={versionForm.valid_from_month} onChange={(event) => setVersionForm({ ...versionForm, valid_from_month: event.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Vigente hasta</label>
              <input className="form-control" type="month" value={versionForm.valid_to_month} onChange={(event) => setVersionForm({ ...versionForm, valid_to_month: event.target.value })} />
            </div>
            <div className="form-group">
              <label>Total mix estimado</label>
              <div className={`composition-total ${isProjectedMixComplete ? 'ok' : 'warn'}`}>
                {projectedMixTotal.toLocaleString('es-CO')}%
              </div>
            </div>
          </div>

          <div className="impact-box">
            <div className="impact-title">Validación de mix por vigencia</div>
            <div className="impact-row">
              <span>Regla</span>
              <strong>FIT + colección + meses solapados no debe superar 100%</strong>
            </div>
            <div className="impact-row">
              <span>Estado</span>
              <strong>{isProjectedMixComplete ? 'Completo para activar/publicar' : isProjectedMixExceeded ? 'Excede 100%' : 'Incompleto; puede seguir en configuración'}</strong>
            </div>
          </div>

          <div className="form-group">
            <label>Motivo del cambio de mix</label>
            <textarea className="form-control textarea-control" value={versionForm.change_reason} onChange={(event) => setVersionForm({ ...versionForm, change_reason: event.target.value })} placeholder="Mix inicial, cierre de colección, cambio comercial..." />
          </div>

          <div className="form-group">
            <label>Motivo auditoría</label>
            <textarea className="form-control textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se crea o modifica esta versión." />
          </div>
        </form>
      </Drawer>

      <Drawer
        isOpen={drawerMode === 'bom-create' || drawerMode === 'bom-edit'}
        title={drawerMode === 'bom-edit' ? 'Editar pieza BOM' : 'Nueva pieza BOM'}
        subtitle="Base, bolsillo, botón, marquilla, cremallera, empaque u otro componente"
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="bom-form" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar pieza'}
            </button>
          </>
        }
      >
        <form id="bom-form" className="drawer-form" onSubmit={handleBomSubmit}>
          <div className="form-group">
            <label>Versión del FIT</label>
            {isBomVersionLocked ? (
              <input className="form-control" value={getFitVersionLabel(bomForm.fit_version_id)} readOnly aria-readonly="true" />
            ) : (
              <select className="form-control" value={bomForm.fit_version_id} onChange={(event) => setBomForm({ ...bomForm, fit_version_id: event.target.value })}>
                <option value="">Selecciona...</option>
                {options.fitVersions.map((version) => (
                  <option key={version.id} value={version.id}>{version.collectionCode} · {version.fitName} · {version.versionCode}</option>
                ))}
              </select>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Nombre pieza</label>
              <input className="form-control" value={bomForm.piece_name} onChange={(event) => setBomForm({ ...bomForm, piece_name: event.target.value })} placeholder="Base, bolsillo, botón..." />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select className="form-control" value={bomForm.status} onChange={(event) => setBomForm({ ...bomForm, status: event.target.value as BomLineFormInput['status'] })}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tipo de material</label>
              <select className="form-control" value={bomMaterialTypeFilter} onChange={(event) => handleBomMaterialTypeChange(event.target.value)}>
                <option value="">Todos los tipos</option>
                {materialTypeOptions.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Material</label>
              <select className="form-control" value={bomForm.material_id} onChange={(event) => handleBomMaterialChange(event.target.value)}>
                <option value="">Selecciona...</option>
                {filteredBomMaterials.map((material) => (
                  <option key={material.id} value={material.id}>{material.code} · {material.name} · {formatMaterialTypeLabel(material.material_type)} · {mapUnit(material.unit)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Foto de la pieza (URL de imagen)</label>
            <input className="form-control" value={bomForm.image_url} onChange={(event) => setBomForm({ ...bomForm, image_url: event.target.value })} placeholder="https://.../pieza-base.jpg" />
          </div>

          {bomForm.image_url ? (
            <ImageBox src={bomForm.image_url} label="Vista previa pieza" className="preview" />
          ) : null}

          <div className="form-row">
            <div className="form-group">
              <label>Piezas por unidad</label>
              <input className="form-control" type="number" min="0.0001" step="0.0001" value={bomForm.pieces_per_unit} onChange={(event) => setBomForm({ ...bomForm, pieces_per_unit: event.target.value })} placeholder="1" />
            </div>
            <div className="form-group">
              <label>Consumo por pieza</label>
              <input className="form-control" type="number" min="0" step="0.0001" value={bomForm.consumption_per_piece} onChange={(event) => setBomForm({ ...bomForm, consumption_per_piece: event.target.value })} placeholder="1.20" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Desperdicio %</label>
              <input className="form-control" type="number" min="0" max="100" step="0.01" value={bomForm.waste_percentage} onChange={(event) => setBomForm({ ...bomForm, waste_percentage: event.target.value })} placeholder="3" />
            </div>
            <div className="form-group">
              <label>Vigente desde</label>
              <input className="form-control" type="month" value={bomForm.valid_from_month} onChange={(event) => setBomForm({ ...bomForm, valid_from_month: event.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Vigente hasta</label>
            <input className="form-control" type="month" value={bomForm.valid_to_month} onChange={(event) => setBomForm({ ...bomForm, valid_to_month: event.target.value })} />
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea className="form-control textarea-control" value={bomForm.notes} onChange={(event) => setBomForm({ ...bomForm, notes: event.target.value })} placeholder="Detalle técnico o comentario del consumo." />
          </div>

          <div className="form-group">
            <label>Motivo auditoría</label>
            <textarea className="form-control textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se crea o modifica esta pieza BOM." />
          </div>
        </form>
      </Drawer>
    </>
  )
}
