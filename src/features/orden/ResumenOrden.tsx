import type { BorradorOrden, Catalogos } from '@/types'
import { aNumero, usd } from '@/lib/format'
import { buscar, lineasCargadas } from '@/lib/orden'

interface Props {
  catalogos: Catalogos
  borrador: BorradorOrden
  /** Vuelve al paso 1 a corregir. Sin handler, la banda es sólo informativa. */
  onEditar?: () => void
}

/**
 * Banda con los datos ya confirmados en el paso 1. Acompaña a los pasos siguientes para que el
 * usuario no tenga que volver atrás sólo para recordar qué labor o qué contratista eligió.
 */
export function ResumenOrden({ catalogos, borrador, onEditar }: Props) {
  const labor = buscar(catalogos.labores, borrador.laborId)
  const proveedor = buscar(catalogos.proveedores, borrador.proveedorId)
  const cultivo = buscar(catalogos.cultivos, borrador.cultivoId)
  const campana = buscar(catalogos.campanas, borrador.campanaId)
  const contacto = buscar(catalogos.contactos, borrador.contactoId)
  const valor = aNumero(borrador.usdPorHa)

  const datos = [
    { lbl: 'Labor', val: labor?.nombre },
    { lbl: 'Proveedor', val: proveedor?.nombre },
    { lbl: 'Cultivo', val: cultivo?.nombre },
    { lbl: 'Campaña', val: campana?.nombre },
    { lbl: 'U$/Ha', val: valor != null ? usd(valor) : null },
    { lbl: 'Contacto', val: contacto?.nombre },
  ]

  // Los productos aparecen recién cuando hay alguno cargado: en el primer paso todavía no existen
  // y una casilla en "—" haría creer que falta completar algo.
  const productos = lineasCargadas(borrador)
  if (productos.length > 0) {
    datos.push({
      lbl: 'Productos',
      val: `${productos.length} insumo${productos.length === 1 ? '' : 's'}`,
    })
  }

  return (
    <div className="card card--data">
      <div className="ctitle" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <i className="fas fa-circle-check" style={{ color: '#00874d' }} aria-hidden />
          Datos de la orden
        </span>
        {onEditar && (
          <button type="button" className="btn btn-ghost" onClick={onEditar}>
            <i className="fas fa-pen" aria-hidden /> Editar
          </button>
        )}
      </div>

      <div className="resumen-grid">
        {datos.map((d) => (
          <div className="resumen-dato" key={d.lbl}>
            <span className="resumen-lbl">{d.lbl}</span>
            <span className="resumen-val" title={d.val ?? undefined}>
              {d.val ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
