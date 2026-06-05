import { useEffect, useState } from 'react'
import { Badge } from '../../components/Badge'
import { TableShell } from '../../components/TableShell'
import { formatDateMonth } from '../../utils/format'
import { listCollections, type CollectionRecord } from './collectionsService'

function mapCollectionStatus(status: CollectionRecord['status']) {
  const labels: Record<CollectionRecord['status'], string> = {
    draft: 'Borrador',
    active: 'Activo',
    closed: 'Cerrado',
    archived: 'Inactivo',
  }

  return labels[status]
}

export function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadCollections() {
    setIsLoading(true)
    setError(null)

    try {
      setCollections(await listCollections())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las colecciones.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCollections()
  }, [])

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Vigencia real:</span>
        <button className="filter-chip active" type="button">Supabase conectado</button>
        <button className="filter-chip" type="button">{collections.length} colecciones</button>
        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} type="button" onClick={() => void loadCollections()}>
          Recargar
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <TableShell title="Colecciones y vigencias" subtitle="Los cambios de colección no borran historia; crean nueva vigencia">
        <table>
          <thead>
            <tr>
              <th>Colección</th>
              <th>Nombre</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Descripción</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6}>Cargando colecciones...</td></tr>
            ) : collections.length === 0 ? (
              <tr><td colSpan={6}>No hay colecciones registradas.</td></tr>
            ) : collections.map((collection) => (
              <tr key={collection.id}>
                <td>{collection.code}</td>
                <td>{collection.name}</td>
                <td>{formatDateMonth(collection.start_month)}</td>
                <td>{formatDateMonth(collection.end_month)}</td>
                <td>{collection.description ?? 'Sin descripción'}</td>
                <td><Badge>{mapCollectionStatus(collection.status)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
