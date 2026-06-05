import { Badge } from '../../components/Badge'
import { TableShell } from '../../components/TableShell'
import { kardexRows } from '../../app/mockData'

export function KardexPage() {
  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Material:</span>
        <select className="filter-select">
          <option>Denim azul 12 oz</option>
          <option>Tela bolsillo blanca</option>
          <option>Lente gafas</option>
        </select>
        <select className="filter-select">
          <option>Octubre 2026</option>
          <option>Noviembre 2026</option>
          <option>Diciembre 2026</option>
        </select>
        <button className="btn btn-secondary" type="button" style={{ marginLeft: 'auto' }}>
          Exportar Kardex
        </button>
      </div>

      <TableShell title="Kardex semanal por material" subtitle="Las fechas de control pueden variar por material">
        <table>
          <thead>
            <tr>
              <th>Fecha control</th>
              <th>Material</th>
              <th>Total bodega</th>
              <th>Pedido</th>
              <th>Tránsito</th>
              <th>Consumo proyectado</th>
              <th>Entrega producción</th>
              <th>Stock seguridad</th>
              <th>Industrialización</th>
              <th>Inventario final</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {kardexRows.map((row) => (
              <tr key={`${row.material}-${row.controlDate}`}>
                <td>{row.controlDate}</td>
                <td>{row.material}</td>
                <td>{row.totalBodega}</td>
                <td>{row.pedido}</td>
                <td>{row.transito}</td>
                <td>{row.consumoProjected}</td>
                <td>{row.entregaProduccion}</td>
                <td>{row.stockSeguridad}</td>
                <td>{row.industrializacion}</td>
                <td>{row.inventarioFinal}</td>
                <td><Badge>{row.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
