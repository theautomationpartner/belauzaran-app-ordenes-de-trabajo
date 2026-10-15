import { Fragment, useMemo, useState } from 'react'
import { fecha } from '@/lib/format'
import { CAMBIO, COLOR_TIPO, type Movimiento, type TipoMovimiento } from '@/lib/hacienda'
import { TABLERO_MOVIMIENTOS } from '@/services/monday/columns'

/** Chip del tipo de movimiento: punto de color + texto en tinta (el color solo identifica). */
export function ChipTipo({ tipo }: { tipo: string }) {
  return (
    <span className="hc-chip-tipo">
      <span className="hc-punto" style={{ background: COLOR_TIPO[tipo as TipoMovimiento] ?? '#98a2b3' }} />
      {tipo || 'Sin tipo'}
    </span>
  )
}

/** "Terneras → Vaquillonas 1-2 años" en un cambio; la categoría en el resto. */
export const queCategoria = (m: Movimiento) => (m.tipo === CAMBIO ? `${m.origen} → ${m.destino}` : m.categoria || '—')

/**
 * Tabla de movimientos: lo esencial en la fila y el resto (observaciones, responsable, código) al
 * desplegarla. Las más nuevas primero.
 */
export function ListaMovimientos({ movs, buscador = false }: { movs: Movimiento[]; buscador?: boolean }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return [...movs]
      .filter(
        (m) =>
          !t ||
          [m.nombre, m.codigo, m.campo, m.categoria, m.origen, m.destino, m.responsable, m.observaciones, m.tipo]
            .join(' ')
            .toLowerCase()
            .includes(t),
      )
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
  }, [movs, q])

  const total = lista.reduce((a, m) => a + m.cantidad, 0)

  return (
    <div>
      {buscador && (
        <div className="buscador-campo" style={{ marginBottom: 10 }}>
          <i className="fas fa-search" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por categoría, campo, responsable, observaciones…" />
        </div>
      )}
      {lista.length === 0 ? (
        <p className="muted" style={{ padding: '10px 0' }}>No hay movimientos para mostrar.</p>
      ) : (
        <div className="tabla-wrap">
          <div className="tabla-scroll">
            <table className="tabla tabla--compacta hc-tabla hc-tabla-fija">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Campo</th>
                  <th className="num">Cabezas</th>
                  <th aria-label="Detalle" />
                </tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <Fragment key={m.id}>
                    <tr className="hc-fila" onClick={() => setAbierto(abierto === m.id ? null : m.id)}>
                      <td data-lbl="Fecha">{fecha(m.fecha)}</td>
                      <td data-lbl="Tipo">
                        <ChipTipo tipo={m.tipo} />
                      </td>
                      <td data-lbl="Categoría">{queCategoria(m)}</td>
                      <td data-lbl="Campo">{m.campo || '—'}</td>
                      <td data-lbl="Cabezas" className="num font-b">{m.cantidad.toLocaleString('es-AR')}</td>
                      <td data-lbl="" className="celda-accion">
                        <i className={`fas fa-chevron-${abierto === m.id ? 'up' : 'down'} muted`} aria-hidden />
                      </td>
                    </tr>
                    {abierto === m.id && (
                      <tr className="hc-fila-detalle">
                        <td colSpan={6}>
                          <div className="resumen-grid">
                            <div className="resumen-dato">
                              <span className="resumen-lbl">ID</span>
                              <span className="resumen-val">{m.codigo || '—'}</span>
                            </div>
                            <div className="resumen-dato">
                              <span className="resumen-lbl">Responsable</span>
                              <span className="resumen-val">{m.responsable || '—'}</span>
                            </div>
                            <div className="resumen-dato" style={{ gridColumn: 'span 2' }}>
                              <span className="resumen-lbl">Observaciones</span>
                              <span className="resumen-val hc-obs">{m.observaciones || '—'}</span>
                            </div>
                          </div>
                          <a
                            className="btn btn-ghost btn--sm"
                            href={`https://belauzaransa.monday.com/boards/${TABLERO_MOVIMIENTOS}/pulses/${m.id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ marginTop: 6 }}
                          >
                            <i className="fas fa-arrow-up-right-from-square" aria-hidden /> Ver en monday
                          </a>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>{lista.length === 1 ? '1 movimiento' : `${lista.length} movimientos`}</td>
                  <td className="num">{total.toLocaleString('es-AR')}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
