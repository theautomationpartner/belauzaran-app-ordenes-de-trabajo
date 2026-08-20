import { useMemo } from 'react'
import type { BorradorOrden, Catalogos } from '@/types'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { ResumenOrden } from './ResumenOrden'
import { expandirOrdenes, hectareasTotales, totalGeneral } from '@/lib/orden'
import { hectareas, usd } from '@/lib/format'
import { emisionHabilitada } from '@/services/emision'

interface Props {
  catalogos: Catalogos
  borrador: BorradorOrden
  onEditarPaso1: () => void
  onEditarPaso2: () => void
}

/**
 * Paso 3 — Revisión antes de emitir.
 *
 * Muestra las órdenes YA expandidas, una por lote, que es exactamente lo que va a quedar en el
 * tablero. Revisar sobre los bloques del paso anterior obligaría al usuario a hacer esa
 * multiplicación mentalmente.
 */
export function Paso3Emision({ catalogos, borrador, onEditarPaso1, onEditarPaso2 }: Props) {
  const ordenes = useMemo(
    () => expandirOrdenes(borrador, catalogos.campos),
    [borrador, catalogos.campos],
  )
  const total = totalGeneral(ordenes)
  const has = hectareasTotales(ordenes)
  const sinHectareas = ordenes.filter((o) => o.hectareas == null).length

  return (
    <div className="view">
      <PasoHeader
        numero={3}
        titulo="Revisar y emitir"
        descripcion="Estas son las órdenes que se van a crear en el tablero: una por cada lote seleccionado."
      />

      <ResumenOrden catalogos={catalogos} borrador={borrador} onEditar={onEditarPaso1} />

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
            <div className="metrica-val">{hectareas(has)}</div>
          </div>
        </div>
        <div className="metrica">
          <div className="metrica-ic metrica-ic--verde">
            <i className="fas fa-dollar-sign" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Total estimado</div>
            <div className="metrica-val">{usd(total)}</div>
          </div>
        </div>
      </div>

      {sinHectareas > 0 && (
        <div className="aviso aviso--warn" style={{ marginBottom: 16 }}>
          <i className="fas fa-triangle-exclamation" aria-hidden />
          <span>
            {sinHectareas === 1 ? 'Un lote no tiene' : `${sinHectareas} lotes no tienen`} hectáreas
            cargadas en Monday, así que su importe no se puede calcular acá. La orden igual se crea;
            el total lo va a resolver la fórmula del tablero cuando el dato esté.
          </span>
        </div>
      )}

      <div className="card card--summary card--flush">
        <div className="ctitle" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <i className="fas fa-list-check" style={{ color: '#00874d' }} aria-hidden />
            Órdenes de trabajo a crear
          </span>
          <button type="button" className="btn btn-ghost" onClick={onEditarPaso2}>
            <i className="fas fa-pen" aria-hidden /> Editar campos
          </button>
        </div>
        <div className="csub">
          El tablero admite un campo y un lote por orden: cada fila va a ser un item distinto.
        </div>

        <div className="tabla-wrap">
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Campo</th>
                  <th>Lote</th>
                  <th className="num">Hectáreas</th>
                  <th className="num">Total U$S</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o, i) => (
                  <tr key={o.loteId}>
                    <td data-lbl="Orden" className="tabla-ot">
                      OT {i + 1}
                    </td>
                    <td data-lbl="Campo">{o.campoNombre}</td>
                    <td data-lbl="Lote" className="font-b">
                      {o.loteNombre}
                    </td>
                    <td data-lbl="Hectáreas" className="num">
                      {hectareas(o.hectareas)}
                    </td>
                    <td data-lbl="Total U$S" className="num font-b">
                      {usd(o.totalUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td data-lbl="Órdenes" colSpan={3}>
                    {ordenes.length} orden{ordenes.length === 1 ? '' : 'es'}
                  </td>
                  <td data-lbl="Hectáreas" className="num">
                    {hectareas(has)}
                  </td>
                  <td data-lbl="Total U$S" className="num">
                    {usd(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* El envío es un detalle de implementación: al usuario se le dice que todavía no está
            conectado, sin exponerle el payload ni el nombre del escenario. */}
        {!emisionHabilitada() && (
          <div className="aviso aviso--info" style={{ marginTop: 16 }}>
            <i className="fas fa-circle-info" aria-hidden />
            <span>
              El envío automático al tablero todavía no está habilitado. La revisión de arriba ya
              refleja exactamente las órdenes que se van a crear.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
