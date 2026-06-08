import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Drawer } from '../../components/Drawer'
import { KpiCard } from '../../components/KpiCard'
import { TableShell } from '../../components/TableShell'
import { formatDate, formatNumber, formatQuantity } from '../../utils/format'
import {
  importInventoryBalances,
  listInventoryRows,
  updateInventoryBalance,
} from './inventoryService'
import type { InventoryBalanceView, InventoryImportRow, InventoryRowView } from './inventoryTypes'

type EditableInventoryState = {
  totalBodega: string
  notes: string
}

type InventoryTypeSummary = {
  materialType: string
  label: string
  unit: string
  materialCount: number
  totalBodega: number
  updatedCount: number
}

export function InventoryPage() {
  const [rows, setRows] = useState<InventoryRowView[]>([])
  const [selectedMaterialType, setSelectedMaterialType] = useState('all')
  const [search, setSearch] = useState('')
  const [editingByMaterial, setEditingByMaterial] = useState<Record<string, EditableInventoryState>>({})
  const [selectedInventoryRow, setSelectedInventoryRow] = useState<InventoryRowView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function loadInventory() {
    setIsLoading(true)
    setError(null)

    try {
      const inventoryRows = await listInventoryRows()
      setRows(inventoryRows)
      setEditingByMaterial(buildEditableState(inventoryRows))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el inventario de bodega.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadInventory()
  }, [])

  const materialTypes = useMemo(() => buildTypeSummaries(rows), [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows
      .filter((row) => {
        const matchesType = selectedMaterialType === 'all' || row.materialType === selectedMaterialType
        const matchesSearch = !query || [
          row.materialCode,
          row.materialName,
          row.materialTypeLabel,
          row.unit,
          row.notes ?? '',
        ].join(' ').toLowerCase().includes(query)

        return matchesType && matchesSearch
      })
      .sort(compareInventoryRowsByMaterialCode)
  }, [rows, search, selectedMaterialType])

  const filteredSummaries = useMemo(() => buildTypeSummaries(filteredRows), [filteredRows])
  const globalTotal = filteredRows.reduce((sum, row) => sum + row.totalBodega, 0)
  const updatedRowsCount = filteredRows.filter((row) => row.updatedAt).length
  const activeTypeSummary = selectedMaterialType === 'all'
    ? null
    : materialTypes.find((type) => type.materialType === selectedMaterialType) ?? null
  const selectedDraft = selectedInventoryRow
    ? editingByMaterial[selectedInventoryRow.materialId] ?? { totalBodega: String(selectedInventoryRow.totalBodega), notes: selectedInventoryRow.notes ?? '' }
    : null
  const selectedDraftChanged = Boolean(selectedInventoryRow && selectedDraft && (
    Number(selectedDraft.totalBodega || 0) !== selectedInventoryRow.totalBodega
    || (selectedDraft.notes || '') !== (selectedInventoryRow.notes ?? '')
  ))

  function openEditDrawer(row: InventoryRowView) {
    setSelectedInventoryRow(row)
    setEditingByMaterial((current) => ({
      ...current,
      [row.materialId]: current[row.materialId] ?? {
        totalBodega: String(row.totalBodega),
        notes: row.notes ?? '',
      },
    }))
    setError(null)
    setFeedback(null)
  }

  function closeEditDrawer() {
    if (isSaving) return
    setSelectedInventoryRow(null)
  }

  async function handleSaveRow(row: InventoryRowView) {
    const edit = editingByMaterial[row.materialId]
    const totalBodega = Number(edit?.totalBodega ?? 0)

    if (Number.isNaN(totalBodega) || totalBodega < 0) {
      setError('La bodega debe ser un número válido y no puede ser negativa.')
      return
    }

    setIsSaving(row.materialId)
    setError(null)
    setFeedback(null)

    try {
      const previous: InventoryBalanceView | null = row.updatedAt
        ? {
          materialId: row.materialId,
          totalBodega: row.totalBodega,
          notes: row.notes,
          updatedAt: row.updatedAt,
        }
        : null

      await updateInventoryBalance(
        {
          materialId: row.materialId,
          totalBodega,
          notes: edit?.notes ?? '',
        },
        previous,
        'Actualización manual de inventario de bodega por material',
      )

      setFeedback(`Inventario actualizado para ${row.materialCode}.`)
      setSelectedInventoryRow(null)
      await loadInventory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar el inventario del material.')
    } finally {
      setIsSaving(null)
    }
  }

  function handleExportCsv() {
    const csv = buildInventoryCsv(filteredRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const suffix = activeTypeSummary?.label ? `_${slugify(activeTypeSummary.label)}` : ''

    link.href = url
    link.download = `inventario_bodega${suffix}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setIsImporting(true)
    setError(null)
    setFeedback(null)

    try {
      const importRows = await parseInventoryFile(file)
      const result = await importInventoryBalances(importRows, 'Importación', file.name)
      await loadInventory()

      const skippedMessage = result.skippedRows.length
        ? ` Filas omitidas: ${result.skippedRows.slice(0, 3).join(' | ')}${result.skippedRows.length > 3 ? '...' : ''}`
        : ''

      setFeedback(`Importación finalizada: ${result.imported} materiales actualizados, ${result.skipped} filas omitidas.${skippedMessage}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible importar el archivo.')
    } finally {
      setIsImporting(false)
    }
  }

  function updateDraft(materialId: string, patch: Partial<EditableInventoryState>) {
    setEditingByMaterial((current) => ({
      ...current,
      [materialId]: {
        totalBodega: current[materialId]?.totalBodega ?? '0',
        notes: current[materialId]?.notes ?? '',
        ...patch,
      },
    }))
  }

  return (
    <>
      <div className="filter-bar smart-filter inventory-filter">
        <span className="filter-label">Inventario</span>
        <select className="filter-select" value={selectedMaterialType} onChange={(event) => setSelectedMaterialType(event.target.value)}>
          <option value="all">Todos los tipos de material</option>
          {materialTypes.map((type) => (
            <option key={type.materialType} value={type.materialType}>{type.label} · {type.materialCount} materiales</option>
          ))}
        </select>
        <input
          className="search-input"
          placeholder="Buscar material, código o tipo..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadInventory()}>Recargar</button>
        <button className="btn btn-secondary" type="button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
          {isImporting ? 'Importando...' : 'Importar Excel/CSV'}
        </button>
        <button className="btn btn-primary" type="button" onClick={handleExportCsv} disabled={filteredRows.length === 0}>Exportar Excel/CSV</button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.txt" style={{ display: 'none' }} onChange={handleImportFile} />
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {feedback ? <div className="auth-alert success" style={{ marginBottom: 16 }}>{feedback}</div> : null}

      <div className="planning-note">
        <strong>Inventario de bodega:</strong> este valor queda por material y Kardex lo usa como fuente para llenar automáticamente el campo Total bodega cuando registras un input. Para modificarlo debes abrir la acción <strong>Editar</strong> del material o importar el archivo de Excel/CSV.
      </div>

      <div className="kpi-row compact">
        <KpiCard label="Total bodega visible" value={formatNumber(globalTotal, 2)} sub="suma de materiales filtrados" />
        <KpiCard label="Materiales visibles" value={String(filteredRows.length)} sub="según filtros actuales" />
        <KpiCard label="Materiales actualizados" value={`${updatedRowsCount}/${filteredRows.length}`} sub="con saldo guardado" />
        <KpiCard label="Tipos visibles" value={String(filteredSummaries.length)} sub="agrupación Kardex" />
      </div>

      <TableShell title="Resumen de bodega por tipo de material" subtitle="Se calcula internamente después de cada edición o importación, agrupando los materiales por su tipo.">
        <table>
          <thead>
            <tr>
              <th>Tipo de material</th>
              <th>Materiales</th>
              <th>Total bodega</th>
              <th>Actualizados</th>
              <th>Unidad base</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5}>Cargando inventario...</td></tr>
            ) : filteredSummaries.length === 0 ? (
              <tr><td colSpan={5}>No hay materiales para los filtros seleccionados.</td></tr>
            ) : filteredSummaries.map((summary) => (
              <tr key={summary.materialType}>
                <td><strong>{summary.label}</strong></td>
                <td>{summary.materialCount}</td>
                <td>{formatQuantity(summary.totalBodega, summary.unit)}</td>
                <td>{summary.updatedCount}/{summary.materialCount}</td>
                <td>{summary.unit || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableShell title="Inventario de bodega por material" subtitle="Vista de consulta. Para cambiar unidades, usa Editar; para carga masiva, importa un Excel/CSV con Material y Cantidad.">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Tipo</th>
              <th>Bodega actual</th>
              <th>Última actualización</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6}>Cargando inventario...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={6}>No hay materiales para los filtros seleccionados.</td></tr>
            ) : filteredRows.map((row) => (
              <tr key={row.materialId}>
                <td>
                  <strong>{row.materialCode}</strong> · {row.materialName}
                  {row.notes ? <small className="inventory-row-note">Nota: {row.notes}</small> : null}
                </td>
                <td>{row.materialTypeLabel}</td>
                <td>{formatQuantity(row.totalBodega, row.unit)}</td>
                <td>{row.updatedAt ? formatDate(row.updatedAt) : '-'}</td>
                <td><Badge>{row.updatedAt ? 'Actualizado' : 'Sin saldo'}</Badge></td>
                <td>
                  <button className="action-btn" type="button" onClick={() => openEditDrawer(row)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <Drawer
        isOpen={Boolean(selectedInventoryRow)}
        title="Editar inventario de bodega"
        subtitle={selectedInventoryRow ? `${selectedInventoryRow.materialCode} · ${selectedInventoryRow.materialName}` : undefined}
        onClose={closeEditDrawer}
        footer={selectedInventoryRow ? (
          <>
            <button className="btn btn-ghost" type="button" onClick={closeEditDrawer} disabled={Boolean(isSaving)}>Cancelar</button>
            <button
              className="btn btn-primary"
              type="submit"
              form="inventory-edit-form"
              disabled={!selectedDraftChanged || isSaving === selectedInventoryRow.materialId}
            >
              {isSaving === selectedInventoryRow.materialId ? 'Guardando...' : 'Guardar inventario'}
            </button>
          </>
        ) : null}
      >
        {selectedInventoryRow && selectedDraft ? (
          <form id="inventory-edit-form" className="drawer-form" onSubmit={(event) => { event.preventDefault(); void handleSaveRow(selectedInventoryRow) }}>
            <div className="form-group">
              <label>Material</label>
              <input className="form-control" value={`${selectedInventoryRow.materialCode} · ${selectedInventoryRow.materialName}`} disabled />
            </div>

            <div className="form-group">
              <label>Tipo de material</label>
              <input className="form-control" value={selectedInventoryRow.materialTypeLabel} disabled />
            </div>

            <div className="form-group">
              <label>Bodega actual</label>
              <input className="form-control" value={formatQuantity(selectedInventoryRow.totalBodega, selectedInventoryRow.unit)} disabled />
            </div>

            <div className="form-group">
              <label>Nueva bodega</label>
              <input
                className="form-control"
                type="number"
                step="0.0001"
                min="0"
                value={selectedDraft.totalBodega}
                onChange={(event) => updateDraft(selectedInventoryRow.materialId, { totalBodega: event.target.value })}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Notas</label>
              <textarea
                className="form-control"
                rows={4}
                value={selectedDraft.notes}
                onChange={(event) => updateDraft(selectedInventoryRow.materialId, { notes: event.target.value })}
                placeholder="Observación del ajuste de inventario."
              />
            </div>
          </form>
        ) : null}
      </Drawer>
    </>
  )
}

function compareInventoryRowsByMaterialCode(a: InventoryRowView, b: InventoryRowView) {
  return a.materialCode.localeCompare(b.materialCode, 'es', {
    numeric: true,
    sensitivity: 'base',
  })
}

function buildEditableState(rows: InventoryRowView[]): Record<string, EditableInventoryState> {
  return rows.reduce<Record<string, EditableInventoryState>>((acc, row) => {
    acc[row.materialId] = {
      totalBodega: String(row.totalBodega),
      notes: row.notes ?? '',
    }
    return acc
  }, {})
}

function buildTypeSummaries(rows: InventoryRowView[]): InventoryTypeSummary[] {
  const grouped = rows.reduce<Record<string, InventoryTypeSummary>>((acc, row) => {
    acc[row.materialType] = acc[row.materialType] ?? {
      materialType: row.materialType,
      label: row.materialTypeLabel,
      unit: row.unit,
      materialCount: 0,
      totalBodega: 0,
      updatedCount: 0,
    }

    acc[row.materialType].materialCount += 1
    acc[row.materialType].totalBodega += row.totalBodega
    acc[row.materialType].updatedCount += row.updatedAt ? 1 : 0

    return acc
  }, {})

  return Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

function buildInventoryCsv(rows: InventoryRowView[]) {
  const header = ['material', 'cantidad_bodega', 'notas']
  const body = rows.map((row) => [
    row.materialCode,
    String(row.totalBodega).replace('.', ','),
    row.notes ?? '',
  ])

  return [header, ...body]
    .map((columns) => columns.map(escapeCsvValue).join(';'))
    .join('\n')
}

async function parseInventoryFile(file: File): Promise<InventoryImportRow[]> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.xlsx')) {
    return parseInventoryXlsx(await file.arrayBuffer())
  }

  if (name.endsWith('.xls')) {
    throw new Error('El formato .xls antiguo no se puede leer en el navegador. Guarda el archivo como .xlsx o .csv e inténtalo de nuevo.')
  }

  return parseInventoryCsv(await file.text())
}

function parseInventoryCsv(text: string): InventoryImportRow[] {
  const cleanText = text.trim()
  if (!cleanText) throw new Error('El archivo está vacío.')

  const lines = cleanText.split(/\r?\n/).filter(Boolean)
  const delimiter = detectDelimiter(lines[0])
  const table = lines.map((line) => splitCsvLine(line, delimiter))

  return parseInventoryTable(table)
}

async function parseInventoryXlsx(buffer: ArrayBuffer): Promise<InventoryImportRow[]> {
  const entries = parseZipEntries(buffer)
  const sheetPath = Object.keys(entries).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))

  if (!sheetPath) throw new Error('No se encontró una hoja válida dentro del archivo Excel.')

  const [sheetXml, sharedStringsXml] = await Promise.all([
    readZipText(entries[sheetPath]),
    entries['xl/sharedStrings.xml'] ? readZipText(entries['xl/sharedStrings.xml']) : Promise.resolve(''),
  ])

  return parseInventoryTable(parseXlsxWorksheet(sheetXml, sharedStringsXml))
}

function parseInventoryTable(table: string[][]): InventoryImportRow[] {
  const rows = table
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some(Boolean))

  if (rows.length === 0) throw new Error('El archivo está vacío.')

  const headers = rows[0].map(normalizeHeader)
  let materialIndex = findHeaderIndex(headers, ['material', 'materiales', 'codigo_material', 'código_material', 'codigo', 'código', 'code', 'material_code'])
  let bodegaIndex = findHeaderIndex(headers, ['cantidad', 'cantidad_bodega', 'total_bodega', 'bodega', 'inventario', 'inventario_bodega', 'stock'])
  let notesIndex = findHeaderIndex(headers, ['notas', 'notes', 'observaciones'])
  let dataRows = rows.slice(1)

  if (materialIndex === -1 || bodegaIndex === -1) {
    if (rows[0].length < 2) {
      throw new Error('El archivo debe tener dos columnas: Material y Cantidad.')
    }

    materialIndex = 0
    bodegaIndex = 1
    notesIndex = rows[0].length > 2 ? 2 : -1
    dataRows = rows
  }

  const parsedRows = dataRows
    .map((row) => ({
      materialCode: row[materialIndex]?.trim(),
      totalBodega: parseFlexibleNumber(row[bodegaIndex]),
      notes: notesIndex >= 0 ? row[notesIndex]?.trim() : '',
    }))
    .filter((row) => row.materialCode || !Number.isNaN(row.totalBodega))

  if (parsedRows.length === 0) {
    throw new Error('No se encontraron filas válidas. Usa la primera columna para Material y la segunda para Cantidad.')
  }

  return parsedRows
}

function detectDelimiter(headerLine: string) {
  const delimiters = [';', ',', '\t']
  return delimiters
    .map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter
}

function splitCsvLine(line: string, delimiter: string) {
  const result: string[] = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      insideQuotes = !insideQuotes
      continue
    }

    if (char === delimiter && !insideQuotes) {
      result.push(current)
      current = ''
      continue
    }

    current += char
  }

  result.push(current)
  return result
}

function findHeaderIndex(headers: string[], options: string[]) {
  return headers.findIndex((header) => options.includes(header))
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function parseFlexibleNumber(value: string | undefined) {
  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const withoutSpaces = raw.replace(/\s/g, '')
  const normalized = withoutSpaces.includes(',') && !withoutSpaces.includes('.')
    ? withoutSpaces.replace(',', '.')
    : withoutSpaces.replace(/,/g, '')

  return Number(normalized)
}

function escapeCsvValue(value: string) {
  if (!/[;,"\n]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

type ZipEntry = {
  name: string
  compressionMethod: number
  compressedData: Uint8Array
}

function parseZipEntries(buffer: ArrayBuffer): Record<string, ZipEntry> {
  const data = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const eocdOffset = findEndOfCentralDirectory(data)

  if (eocdOffset === -1) throw new Error('El archivo Excel no parece ser un .xlsx válido.')

  const centralDirectorySize = view.getUint32(eocdOffset + 12, true)
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true)
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize
  const entries: Record<string, ZipEntry> = {}
  let offset = centralDirectoryOffset

  while (offset < centralDirectoryEnd) {
    if (view.getUint32(offset, true) !== 0x02014b50) break

    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const nameStart = offset + 46
    const name = new TextDecoder().decode(data.slice(nameStart, nameStart + fileNameLength))

    if (view.getUint32(localHeaderOffset, true) === 0x04034b50) {
      const localFileNameLength = view.getUint16(localHeaderOffset + 26, true)
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true)
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength
      const compressedData = data.slice(dataStart, dataStart + compressedSize)

      entries[name] = { name, compressionMethod, compressedData }
    }

    offset = nameStart + fileNameLength + extraLength + commentLength
  }

  return entries
}

function findEndOfCentralDirectory(data: Uint8Array) {
  for (let index = data.length - 22; index >= 0; index -= 1) {
    if (
      data[index] === 0x50
      && data[index + 1] === 0x4b
      && data[index + 2] === 0x05
      && data[index + 3] === 0x06
    ) {
      return index
    }
  }

  return -1
}

async function readZipText(entry: ZipEntry): Promise<string> {
  const bytes = entry.compressionMethod === 0
    ? entry.compressedData
    : entry.compressionMethod === 8
      ? await inflateRaw(entry.compressedData)
      : null

  if (!bytes) throw new Error(`El archivo Excel usa una compresión no soportada para ${entry.name}.`)

  return new TextDecoder().decode(bytes)
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no puede leer .xlsx directamente. Guarda el archivo como CSV e impórtalo de nuevo.')
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function parseXlsxWorksheet(sheetXml: string, sharedStringsXml: string): string[][] {
  const parser = new DOMParser()
  const sheetDoc = parser.parseFromString(sheetXml, 'application/xml')
  const sharedStrings = parseSharedStrings(sharedStringsXml, parser)
  const result: string[][] = []

  Array.from(sheetDoc.getElementsByTagName('row')).forEach((rowNode) => {
    const row: string[] = []

    Array.from(rowNode.getElementsByTagName('c')).forEach((cellNode) => {
      const ref = cellNode.getAttribute('r') ?? ''
      const columnIndex = xlsxColumnIndex(ref)
      row[columnIndex] = readXlsxCell(cellNode, sharedStrings)
    })

    result.push(row.map((cell) => cell ?? ''))
  })

  return result
}

function parseSharedStrings(xml: string, parser: DOMParser) {
  if (!xml) return [] as string[]

  const doc = parser.parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagName('si')).map((node) => {
    return Array.from(node.getElementsByTagName('t')).map((part) => part.textContent ?? '').join('')
  })
}

function readXlsxCell(cellNode: Element, sharedStrings: string[]) {
  const type = cellNode.getAttribute('t')

  if (type === 'inlineStr') {
    return Array.from(cellNode.getElementsByTagName('t')).map((part) => part.textContent ?? '').join('')
  }

  const value = cellNode.getElementsByTagName('v')[0]?.textContent ?? ''
  if (type === 's') return sharedStrings[Number(value)] ?? ''

  return value
}

function xlsxColumnIndex(cellReference: string) {
  const letters = (cellReference.match(/[A-Z]+/i)?.[0] ?? 'A').toUpperCase()
  return letters.split('').reduce((acc, letter) => acc * 26 + letter.charCodeAt(0) - 64, 0) - 1
}
