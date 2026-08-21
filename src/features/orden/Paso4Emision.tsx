import { useMemo } from 'react'
import type { BorradorOrden, Catalogos, OrdenAGenerar } from '@/types'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { ResumenOrden } from './ResumenOrden'
import { expandirOrdenes, totalesDe } from '@/lib/orden'
import { cantidad, hectareas, usd } from '@/lib/format'

interface Props {
  catalogos: Catalogos
  borrador: BorradorOrden
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
  onEditarDatos,
  onEditarProductos,
  onEditarCampos,
}: Props) {
  const ordenes = useMemo(() => expandirOrdenes(borrador, catalogos), [borrador, catalogos])
  const totales = totalesDe(ordenes)
  const sinHectareas = ordenes.filter((o) => o.hectareas == null).length
  const subitems = ordenes.reduce((acc, o) => acc + o.productos.length, 0)

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
            <div className="metrica-lbl">Productos (subelementos)</div>
            <div className="metrica-val">{subitems}</div>
          </div>
        </div>
        <div className="metrica">
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

      <div className="aviso aviso--info">
        <i className="fas fa-circle-info" aria-hidden />
        <span>
          Al emitir se crea un elemento por orden en el tablero ✋ Orden de Trabajo, con sus
          productos como subelementos. Todas quedan en estado{' '}
          <strong>NO Enviar por Ahora</strong>, así que no se le manda nada al contratista hasta
          que alguien lo habilite desde Monday.
        </span>
      </div>
    </div>
  )
}
