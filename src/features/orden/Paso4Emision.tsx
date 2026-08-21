import { useMemo } from 'react'
import type { BorradorOrden, Catalogos, OrdenAGenerar } from '@/types'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { ResumenOrden } from './ResumenOrden'
import { expandirOrdenes, totalesDe } from '@/lib/orden'
import { cantidad, hectareas, usd } from '@/lib/format'
import { OT_ESTADOS_ENVIO, OT_ESTADO_ENVIO_INICIAL } from '@/services/monday/columns'

interface Props {
  catalogos: Catalogos
  borrador: BorradorOrden
  onCambio: (parcial: Partial<BorradorOrden>) => void
  onEditarDatos: () => void
  onEditarProductos: () => void
  onEditarCampos: () => void
}

/** Una orden = una tarjeta. Adentro, los productos que van a ser sus subitems. */
function TarjetaOrden({ orden, indice }: { orden: OrdenAGenerar; indice: number }) {
  return (
    <div className="orden-card">
      <div className="orden-head">
        <span className="orden-nro">OT {indice + 1}</span>
        <span className="orden-ubic">
          <strong>{orden.loteNombre}</strong>
          <span className="muted"> · {orden.campoNombre}</span>
        </span>
        {/* Las hectáreas del lote son el número que multiplica todo lo demás, así que se
            muestran como dato propio de la orden y no escondidas en una columna. */}
        <span className="chip chip--campo">{hectareas(orden.hectareas)}</span>
      </div>

      <div className="orden-body">
        {orden.productos.length > 0 && (
          <div className="tabla-scroll">
            <table className="tabla tabla--compacta">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Por ha</th>
                  <th className="num">Total</th>
                  <th className="num">U$S</th>
                </tr>
              </thead>
              <tbody>
                {orden.productos.map((p) => (
                  <tr key={p.productoId}>
                    <td data-lbl="Producto">{p.etiqueta}</td>
                    <td data-lbl="Por ha" className="num">
                      {cantidad(p.cantPorHa, p.unidad)}
                    </td>
                    <td data-lbl="Total" className="num font-b">
                      {cantidad(p.cantTotal, p.unidad)}
                    </td>
                    <td data-lbl="U$S" className="num">
                      {usd(p.totalUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="orden-totales">
          <span>
            <span className="resumen-lbl">Labor</span>
            <span className="orden-total-val">{usd(orden.totalLaborUsd)}</span>
          </span>
          <span>
            <span className="resumen-lbl">Productos</span>
            <span className="orden-total-val">
              {orden.productos.length === 0 ? '—' : usd(orden.totalProductosUsd)}
            </span>
          </span>
          <span className="orden-total--fuerte">
            <span className="resumen-lbl">Total de la orden</span>
            <span className="orden-total-val">{usd(orden.totalUsd)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Paso 4 — Revisión antes de emitir.
 *
 * Muestra las órdenes YA expandidas, una por lote, con sus hectáreas y los productos calculados
 * para esa superficie. Es exactamente lo que va a quedar en el tablero: revisar sobre los bloques
 * del paso anterior obligaría al usuario a hacer esa multiplicación mentalmente.
 */
export function Paso4Emision({
  catalogos,
  borrador,
  onCambio,
  onEditarDatos,
  onEditarProductos,
  onEditarCampos,
}: Props) {
  const ordenes = useMemo(() => expandirOrdenes(borrador, catalogos), [borrador, catalogos])
  const totales = totalesDe(ordenes)
  const sinHectareas = ordenes.filter((o) => o.hectareas == null).length
  const subitems = ordenes.reduce((acc, o) => acc + o.productos.length, 0)
  /* Los productos son los mismos en todas las ordenes, asi que "por OT" es la cantidad de una
     cualquiera; el total de subelementos es ese numero por la cantidad de ordenes. */
  const porOrden = ordenes[0]?.productos.length ?? 0

  return (
    <div className="view">
      <PasoHeader
        numero={4}
        titulo="Revisar y emitir"
        descripcion="Estas son las órdenes que se van a crear en el tablero: una por cada lote, con sus productos como subelementos."
      />

      <ResumenOrden catalogos={catalogos} borrador={borrador} onEditar={onEditarDatos} />

      <div className="metricas">
        <div className="metrica">
          <div className="metrica-ic">
            <i className="fas fa-file-lines" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Órdenes a generar</div>
            <div className="metrica-val">{ordenes.length}</div>
          </div>
        </div>
        <div className="metrica">
          <div className="metrica-ic metrica-ic--campo">
            <i className="fas fa-vector-square" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Hectáreas totales</div>
            <div className="metrica-val">{hectareas(totales.hectareas)}</div>
          </div>
        </div>
        <div className="metrica">
          <div className="metrica-ic metrica-ic--violeta">
            <i className="fas fa-flask" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Productos x OT</div>
            <div className="metrica-val">{porOrden}</div>
          </div>
        </div>
        <div className="metrica">
          <div className="metrica-ic metrica-ic--naranja">
            <i className="fas fa-tractor" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Total x Labor</div>
            <div className="metrica-val">{usd(totales.labor)}</div>
          </div>
        </div>
        <div className="metrica">
          <div className="metrica-ic metrica-ic--violeta">
            <i className="fas fa-flask-vial" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Total x Producto</div>
            <div className="metrica-val">{subitems === 0 ? '—' : usd(totales.productos)}</div>
          </div>
        </div>
        <div className="metrica metrica--fuerte">
          <div className="metrica-ic metrica-ic--verde">
            <i className="fas fa-dollar-sign" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Total estimado</div>
            <div className="metrica-val">{usd(totales.general)}</div>
          </div>
        </div>
      </div>

      {sinHectareas > 0 && (
        <div className="aviso aviso--warn" style={{ marginBottom: 16 }}>
          <i className="fas fa-triangle-exclamation" aria-hidden />
          <span>
            {sinHectareas === 1 ? 'Un lote no tiene' : `${sinHectareas} lotes no tienen`} hectáreas
            cargadas en Monday, así que ni las cantidades de producto ni los importes se pueden
            calcular acá. Las órdenes igual se crean; los totales los resuelven las fórmulas del
            tablero cuando el dato esté.
          </span>
        </div>
      )}

      <div className="card card--summary">
        <div className="ctitle" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <i className="fas fa-list-check" style={{ color: '#00874d' }} aria-hidden />
            Órdenes de trabajo a crear
          </span>
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onEditarProductos}>
              <i className="fas fa-flask" aria-hidden /> Productos
            </button>
            <button type="button" className="btn btn-ghost" onClick={onEditarCampos}>
              <i className="fas fa-map-location-dot" aria-hidden /> Campos
            </button>
          </span>
        </div>
        <div className="csub">
          El tablero admite un campo y un lote por orden: cada tarjeta va a ser un item distinto.
        </div>

        <div className="ordenes-lista">
          {ordenes.map((o, i) => (
            <TarjetaOrden key={o.loteId} orden={o} indice={i} />
          ))}
        </div>

        <div className="totales-carga">
          <span>
            <span className="resumen-lbl">Labor</span>
            <span className="totales-val">{usd(totales.labor)}</span>
          </span>
          <span>
            <span className="resumen-lbl">Productos</span>
            <span className="totales-val">{subitems === 0 ? '—' : usd(totales.productos)}</span>
          </span>
          <span className="totales--fuerte">
            <span className="resumen-lbl">Total general</span>
            <span className="totales-val">{usd(totales.general)}</span>
          </span>
        </div>
      </div>

      <div className="card card--config card--flush">
        <div className="ctitle">
          <i className="fas fa-paper-plane" style={{ color: '#6200ee' }} aria-hidden />
          ¿Qué hacemos con {ordenes.length === 1 ? 'la orden' : 'las órdenes'}?
        </div>
        <div className="csub">
          Se crea un elemento por orden en ✋ Orden de Trabajo con sus productos como
          subelementos. Lo que cambia es si sale o no al contratista.
        </div>

        <div className="opciones-envio">
          {OT_ESTADOS_ENVIO.map((op) => {
            const elegida = borrador.estadoEnvio === op.etiqueta
            const envia = op.etiqueta !== OT_ESTADO_ENVIO_INICIAL
            return (
              <button
                type="button"
                key={op.etiqueta}
                className={`opcion-envio ${elegida ? 'opcion-envio--sel' : ''} ${
                  elegida && envia ? 'opcion-envio--alerta' : ''
                }`}
                aria-pressed={elegida}
                onClick={() => onCambio({ estadoEnvio: op.etiqueta })}
              >
                <span className="opcion-envio-radio">
                  {elegida && <i className="fas fa-circle" aria-hidden />}
                </span>
                <span className="opcion-envio-body">
                  <span className="opcion-envio-tit">
                    {op.titulo}
                    {!envia && <span className="chip chip--gris">Por defecto</span>}
                  </span>
                  <span className="opcion-envio-det">{op.detalle}</span>
                  <span className="opcion-envio-col">
                    Estado en Monday: <strong>{op.etiqueta}</strong>
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {/* El envío no se puede deshacer, así que elegir la opción que manda tiene que verse
            distinto de la que sólo deja la orden cargada. */}
        {borrador.estadoEnvio !== OT_ESTADO_ENVIO_INICIAL && (
          <div className="aviso aviso--warn" style={{ marginTop: 14 }}>
            <i className="fas fa-triangle-exclamation" aria-hidden />
            <span>
              {ordenes.length === 1 ? 'La orden va a salir' : `Las ${ordenes.length} órdenes van a salir`}{' '}
              al contratista apenas se {ordenes.length === 1 ? 'cree' : 'creen'}. Revisá los datos
              antes de continuar: un envío no se puede deshacer.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
