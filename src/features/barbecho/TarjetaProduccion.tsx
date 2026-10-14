import { useState } from 'react'
import type { Cultivo, OrdenProduccion } from '@/types'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { fecha, hectareas, plural, usd } from '@/lib/format'
import { montosDe } from '@/lib/barbecho'

interface Props {
  op: OrdenProduccion
  marcada: boolean
  /** Cultivo elegido para esta orden; `null` si está marcada pero todavía sin cultivo. */
  cultivoId: string | null
  opcionesCultivo: OpcionSelector[]
  cultivos: Cultivo[]
  onAlternar: () => void
  onCultivo: (id: string | null) => void
}

/**
 * Una orden de producción en barbecho. Arranca PLEGADA: a la vista quedan el nombre, el cultivo y
 * el resumen de lo que cuelga de ella (OT, confirmaciones, movimientos de stock y el total). Con
 * 100 órdenes, mostrar el detalle de todas de golpe hacía la lista ilegible; el detalle (datos,
 * montos y la tabla de OT) se despliega en la que interese.
 *
 * Al marcarla aparece el selector de cultivo en la propia tarjeta, así cada orden puede ir a un
 * cultivo distinto aunque se hayan marcado varias juntas.
 */
export function TarjetaProduccion({
  op,
  marcada,
  cultivoId,
  opcionesCultivo,
  cultivos,
  onAlternar,
  onCultivo,
}: Props) {
  const montos = montosDe(op)
  const confirmaciones = op.ordenesTrabajo.reduce((a, o) => a + o.confirmaciones.length, 0)
  const cultivo = cultivos.find((c) => c.id === cultivoId) ?? null
  const ha = op.ordenesTrabajo.find((o) => o.hectareas != null)?.hectareas ?? null
  const [abierta, setAbierta] = useState(false)

  const clases = [
    'op-card',
    marcada ? 'op-card--marcada' : '',
    marcada && !cultivo ? 'op-card--pendiente' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={clases}>
      <div className="op-head">
        {/* Toda la franja del nombre marca y desmarca: el casillero solo es un blanco chico. */}
        <button
          type="button"
          className="op-marca"
          aria-pressed={marcada}
          onClick={onAlternar}
          title={marcada ? 'Quitar de la asignación' : 'Marcar para asignarle cultivo'}
        >
          <span className="op-check">{marcada && <i className="fas fa-check" aria-hidden />}</span>
          <span className="op-titulo">
            <span className="op-nombre">{op.nombre}</span>
            <span className="op-sub">
              {op.campo || 'Sin campo'} · {op.campana || 'Sin campaña'}
              {ha != null && ` · ${hectareas(ha)}`}
            </span>
          </span>
        </button>

        <div className="op-cultivo">
          <span className="chip chip--ambar">{op.cultivo}</span>
          <i className="fas fa-arrow-right op-flecha" aria-hidden />
          {marcada ? (
            <div className="op-cultivo-sel">
              <SelectorBuscable
                opciones={opcionesCultivo}
                valor={cultivoId}
                onCambio={onCultivo}
                placeholder="Elegí el cultivo…"
                umbralBusqueda={8}
              />
            </div>
          ) : (
            <span className="op-cultivo-vacio">Marcala para elegir</span>
          )}
        </div>
      </div>

      {/* Resumen siempre visible: cuánto cuelga de la orden, sin desplegarla. */}
      <div className="op-resumen">
        <span className="op-cuenta">
          <i className="fas fa-file-lines" aria-hidden />
          {plural(op.ordenesTrabajo.length, 'orden de trabajo', 'órdenes de trabajo')}
        </span>
        <span className="op-cuenta">
          <i className="fas fa-clipboard-check" aria-hidden />
          {plural(confirmaciones, 'confirmación', 'confirmaciones')}
        </span>
        <span className="op-cuenta">
          <i className="fas fa-boxes-stacked" aria-hidden />
          {plural(op.stock.length, 'movimiento de stock', 'movimientos de stock')}
        </span>
        <span className="op-cuenta op-cuenta--total">U$ Total OT: {usd(montos.total)}</span>
        <button
          type="button"
          className="btn btn-ghost btn--sm op-desplegar"
          aria-expanded={abierta}
          onClick={() => setAbierta((v) => !v)}
        >
          <i className={`fas fa-chevron-${abierta ? 'up' : 'down'}`} aria-hidden />
          {abierta ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
      </div>

      {abierta && (
        <div className="op-body">
          <div className="resumen-grid op-datos">
            <div className="resumen-dato">
              <span className="resumen-lbl">Campo</span>
              <span className="resumen-val" title={op.campo}>{op.campo || '—'}</span>
            </div>
            <div className="resumen-dato">
              <span className="resumen-lbl">Lote</span>
              <span className="resumen-val" title={op.lote}>{op.lote || '—'}</span>
            </div>
            <div className="resumen-dato">
              <span className="resumen-lbl">Campaña</span>
              <span className="resumen-val">{op.campana || '—'}</span>
            </div>
            <div className="resumen-dato">
              <span className="resumen-lbl">Comienzo</span>
              <span className="resumen-val">{fecha(op.comienzo)}</span>
            </div>
            <div className="resumen-dato">
              <span className="resumen-lbl">U$ Producto</span>
              <span className="resumen-val">{usd(montos.productos)}</span>
            </div>
            <div className="resumen-dato">
              <span className="resumen-lbl">Costo U$ x Ha</span>
              <span className="resumen-val">{usd(montos.porHa)}</span>
            </div>
            <div className="resumen-dato">
              <span className="resumen-lbl">U$ Labor</span>
              <span className="resumen-val">{usd(montos.labor)}</span>
            </div>
            <div className="resumen-dato">
              <span className="resumen-lbl">U$ Total OT</span>
              <span className="resumen-val op-total">{usd(montos.total)}</span>
            </div>
          </div>

          {op.ordenesTrabajo.length > 0 ? (
            <div className="tabla-scroll">
              <table className="tabla tabla--compacta op-tabla">
                <thead>
                  <tr>
                    <th>Orden de trabajo</th>
                    <th className="num">U$ Producto</th>
                    <th className="num">U$ x Ha</th>
                    <th className="num">U$ Labor</th>
                    <th className="num">U$ Total</th>
                  </tr>
                </thead>
                <tbody>
                  {op.ordenesTrabajo.map((ot) => (
                    <tr key={ot.id}>
                      <td data-lbl="Orden de trabajo">
                        <span className="op-ot-nom">{ot.nombre}</span>
                        <span className="xs">
                          {[ot.estadoEnvio, plural(ot.confirmaciones.length, 'confirmación', 'confirmaciones')]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </td>
                      <td data-lbl="U$ Producto" className="num">{usd(ot.usdProductos)}</td>
                      <td data-lbl="U$ x Ha" className="num">{usd(ot.usdPorHa)}</td>
                      <td data-lbl="U$ Labor" className="num">{usd(ot.usdLabor)}</td>
                      <td data-lbl="U$ Total" className="num font-b">{usd(ot.usdTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="op-sin-ot">
              <i className="fas fa-circle-info" aria-hidden /> No tiene órdenes de trabajo conectadas.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
