import { Badge } from '../../components/Badge'
import { TableShell } from '../../components/TableShell'
import { fits, materials } from '../../app/mockData'

export function CatalogPage() {
  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Catálogo:</span>
        <button className="filter-chip active" type="button">FITs</button>
        <button className="filter-chip" type="button">Materiales</button>
        <button className="filter-chip" type="button">Telas</button>
        <input className="search-input" placeholder="Buscar FIT o material..." style={{ marginLeft: 'auto' }} />
      </div>

      <div className="product-grid">
        {fits.map((fit) => (
          <article className="product-card" key={fit.code}>
            <div className="product-card-status"><Badge>{fit.status}</Badge></div>
            <div className="product-card-name">{fit.name}</div>
            <div className="product-card-cat">{fit.category} · {fit.silhouette}</div>
            <div className="product-card-row"><span>Código</span><strong>{fit.code}</strong></div>
            <div className="product-card-row"><span>Versiones</span><strong>{fit.versions}</strong></div>
            <div className="product-card-row"><span>Proy. diciembre</span><strong>{fit.projectedDecember.toLocaleString('es-CO')}</strong></div>
          </article>
        ))}
      </div>

      <TableShell title="Materiales y telas" subtitle="Base para piezas BOM y Kardex">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Material</th>
              <th>Tipo</th>
              <th>Unidad</th>
              <th>Composición</th>
              <th>Lead time</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((material) => (
              <tr key={material.code}>
                <td>{material.code}</td>
                <td>{material.name}</td>
                <td>{material.type}</td>
                <td>{material.unit}</td>
                <td>{material.composition}</td>
                <td>{material.leadTime}</td>
                <td><Badge>{material.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
