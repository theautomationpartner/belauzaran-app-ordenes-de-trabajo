import { useMemo, useState } from 'react'
import type { Cultivo, OrdenProduccion } from '@/types'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { normalizar, plural } from '@/lib/format'
import { TarjetaProduccion } from './TarjetaProduccion'

interface Props {
  ops: OrdenProduccion[]
  cultivos: Cultivo[]
  /** Órdenes marcadas → cultivo elegido (`null` si todavía no se eligió). */
  asignaciones: Record<string, string | null>
  onCambio: (asignaciones: Record<string, string | null>) => void
}

const unicos = (valores: string[]) =>
  [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))

/**
 * Paso 1 — Elegir las órdenes en barbecho y el cultivo de cada una.
 *
 * Se marcan las órdenes y se les asigna cultivo de dos maneras que conviven: desde la barra, a
 * todas las marcadas de una vez, o desde cada tarjeta, para que una vaya a un cultivo distinto.
 */
export function PasoElegir({ ops, cultivos, asignaciones, onCambio }: Props) {
  const [consulta, setConsulta] = useState('')
  const [campo, setCampo] = useState<string | null>(null)
  const [campana, setCampana] = useState<string | null>(null)

  /* Barbecho no se ofrece como destino: asignarlo dejaría la orden exactamente como está. */
  const opcionesCultivo: OpcionSelector[] = useMemo(
    () =>
      cultivos
        .filter((c) => normalizar(c.nombre) !== 'barbecho')
        .map((c) => ({ id: c.id, nombre: c.nombre, chip: c.tipo || undefined, chipClase: 'chip--campo' })),
    [cultivos],
  )

  const opcionesCampo = useMemo(
    () => unicos(ops.map((o) => o.campo)).map((c) => ({ id: c, nombre: c })),
    [ops],
  )
  const opcionesCampana = useMemo(
    () => unicos(ops.map((o) => o.campana)).map((c) => ({ id: c, nombre: c })),
    [ops],
  )

  const visibles = useMemo(() => {
    const q = normalizar(consulta.trim())
    return ops.filter((o) => {
      if (campo && o.campo !== campo) return false
      if (campana && o.campana !== campana) return false
      if (!q) return true
      const ots = o.ordenesTrabajo.map((t) => t.nombre).join(' ')
      return normalizar(`${o.nombre} ${o.lote} ${ots}`).includes(q)
    })
  }, [ops, consulta, campo, campana])

  const marcadas = Object.keys(asignaciones)
  const sinCultivo = marcadas.filter((id) => !asignaciones[id]).length
  const visiblesMarcadas = visibles.filter((o) => o.id in asignaciones).length
  const todasVisiblesMarcadas = visibles.length > 0 && visiblesMarcadas === visibles.length

  /* El selector de la barra muestra un cultivo sólo cuando TODAS las marcadas lo comparten; si
     tienen cultivos distintos queda vacío, y elegir uno los pisa a todos. */
  const elegidos = new Set(marcadas.map((id) => asignaciones[id]))
  const cultivoComun = elegidos.size === 1 ? [...elegidos][0] : null

  const alternar = (id: string) => {
    const proximo = { ...asignaciones }
    if (id in proximo) delete proximo[id]
    // Una orden nueva hereda el cultivo de la barra, si las demás ya comparten uno.
    else proximo[id] = cultivoComun ?? null
    onCambio(proximo)
  }

  const alternarVisibles = () => {
    const proximo = { ...asignaciones }
    if (todasVisiblesMarcadas) visibles.forEach((o) => delete proximo[o.id])
    else visibles.forEach((o) => (proximo[o.id] = proximo[o.id] ?? cultivoComun ?? null))
    onCambio(proximo)
  }

  const aTodas = (cultivoId: string | null) => {
    if (!cultivoId) return
    onCambio(Object.fromEntries(marcadas.map((id) => [id, cultivoId])))
  }

  const hayFiltro = Boolean(consulta || campo || campana)

  return (
    <div className="view">
      <PasoHeader
        numero={1}
        titulo="Asignar cultivo a las órdenes en barbecho"
        descripcion="Marcá las órdenes de producción que dejan de estar en barbecho y elegí su cultivo. Podés darles a todas el mismo o uno distinto a cada una."
      />

      <div className="card card--input">
        <div className="filtros-op">
          <div className="ig">
            <span className="ig-lbl">Buscar</span>
            <div className="buscador-campo">
              <i className="fas fa-search" aria-hidden />
              <input
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder="Lote, campo u orden de trabajo…"
                aria-label="Buscar orden de producción"
              />
            </div>
          </div>
          <div className="ig">
            <span className="ig-lbl">Campo</span>
            <SelectorBuscable
              opciones={opcionesCampo}
              valor={campo}
              onCambio={setCampo}
              placeholder="Todos los campos"
            />
          </div>
          <div className="ig">
            <span className="ig-lbl">Campaña</span>
            <SelectorBuscable
              opciones={opcionesCampana}
              valor={campana}
              onCambio={setCampana}
              placeholder="Todas las campañas"
            />
          </div>
        </div>
        {hayFiltro && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 8 }}
            onClick={() => {
              setConsulta('')
              setCampo(null)
              setCampana(null)
            }}
          >
            <i className="fas fa-xmark" aria-hidden /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Barra de selección: cuántas hay marcadas y el cultivo para todas juntas. */}
      <div className={`barra-seleccion ${marcadas.length > 0 ? 'barra-seleccion--activa' : ''}`}>
        <div className="barra-seleccion-txt">
          <strong>{plural(marcadas.length, 'marcada', 'marcadas')}</strong>
          <span className="muted">
            {' '}
            de {plural(ops.length, 'orden', 'órdenes')} en barbecho
            {hayFiltro && ` · ${visibles.length} a la vista`}
          </span>
          {sinCultivo > 0 && (
            <span className="barra-seleccion-falta">
              <i className="fas fa-circle-exclamation" aria-hidden />
              {sinCultivo === 1 ? 'Una sin cultivo elegido' : `${sinCultivo} sin cultivo elegido`}
            </span>
          )}
        </div>

        <div className="barra-seleccion-acciones">
          <div className="barra-seleccion-cultivo">
            <SelectorBuscable
              opciones={opcionesCultivo}
              valor={cultivoComun}
              onCambio={aTodas}
              disabled={marcadas.length === 0}
              placeholder={
                marcadas.length === 0
                  ? 'Marcá órdenes para asignar cultivo'
                  : `Cultivo para las ${marcadas.length === 1 ? 'marcada' : `${marcadas.length} marcadas`}…`
              }
              umbralBusqueda={8}
            />
          </div>
          <button type="button" className="btn btn-outblue btn--sm" onClick={alternarVisibles}>
            <i className={`fas fa-${todasVisiblesMarcadas ? 'square-minus' : 'list-check'}`} aria-hidden />
            {todasVisiblesMarcadas
              ? 'Desmarcar las visibles'
              : hayFiltro
                ? 'Marcar las visibles'
                : 'Marcar todas'}
          </button>
          {marcadas.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => onCambio({})}>
              Limpiar selección
            </button>
          )}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="card card--data" style={{ textAlign: 'center' }}>
          <p className="muted">No hay órdenes en barbecho que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="op-lista">
          {visibles.map((op) => (
            <TarjetaProduccion
              key={op.id}
              op={op}
              marcada={op.id in asignaciones}
              cultivoId={asignaciones[op.id] ?? null}
              opcionesCultivo={opcionesCultivo}
              cultivos={cultivos}
              onAlternar={() => alternar(op.id)}
              onCultivo={(id) => onCambio({ ...asignaciones, [op.id]: id })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
