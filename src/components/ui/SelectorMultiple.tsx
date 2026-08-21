import { useEffect, useMemo, useRef, useState } from 'react'
import { useClickAfuera } from '@/hooks/useClickAfuera'
import { normalizar } from '@/lib/format'

export interface OpcionMultiple {
  id: string
  nombre: string
  /** Segunda línea: cantidad de lotes, marca… lo que ayude a distinguir. */
  detalle?: string
}

interface Props {
  opciones: OpcionMultiple[]
  /** IDs elegidos. */
  valores: string[]
  onCambio: (valores: string[]) => void
  placeholder: string
  vacio?: string
  id?: string
}

/**
 * Desplegable con búsqueda y selección múltiple.
 *
 * Es el mismo gesto que el selector de un solo valor —se abre, se escribe, se elige—, pero el
 * menú NO se cierra al tildar: se marcan varios de una pasada y recién ahí se cierra. Para un
 * catálogo chico como los campos, esto evita el paso extra de "buscar → agregar → volver a
 * buscar" que impone un buscador.
 */
export function SelectorMultiple({
  opciones,
  valores,
  onCambio,
  placeholder,
  vacio = 'No hay opciones disponibles.',
  id,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const caja = useRef<HTMLDivElement>(null)
  const campoBusqueda = useRef<HTMLInputElement>(null)

  useClickAfuera(caja, abierto, () => setAbierto(false))

  // Cada apertura arranca limpia: el filtro anterior escondería opciones sin que se note.
  useEffect(() => {
    if (!abierto) return
    setConsulta('')
    campoBusqueda.current?.focus()
  }, [abierto])

  const filtradas = useMemo(() => {
    const q = normalizar(consulta.trim())
    if (!q) return opciones
    return opciones.filter((o) => normalizar(`${o.nombre} ${o.detalle ?? ''}`).includes(q))
  }, [opciones, consulta])

  const elegidos = new Set(valores)

  const alternar = (idOpcion: string) => {
    onCambio(
      elegidos.has(idOpcion) ? valores.filter((v) => v !== idOpcion) : [...valores, idOpcion],
    )
  }

  const resumen =
    valores.length === 0
      ? placeholder
      : valores.length === 1
        ? opciones.find((o) => o.id === valores[0])?.nombre ?? '1 seleccionado'
        : `${valores.length} seleccionados`

  return (
    <div className={`dd ${abierto ? 'dd--abierto' : ''} ${valores.length ? 'dd--elegido' : ''}`} ref={caja}>
      <button
        type="button"
        id={id}
        className="dd-trigger"
        disabled={opciones.length === 0}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="dd-val">
          <span className={`dd-val-txt ${valores.length ? '' : 'dd-ph'}`}>
            {opciones.length === 0 ? vacio : resumen}
          </span>
        </span>
        <i className={`fas fa-chevron-${abierto ? 'up' : 'down'} dd-caret`} aria-hidden />
      </button>

      {abierto && (
        <div className="dd-menu" role="listbox" aria-multiselectable>
          <div className="dd-buscar">
            <i className="fas fa-search" aria-hidden />
            <input
              ref={campoBusqueda}
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setAbierto(false)
              }}
              placeholder="Buscar…"
              aria-label="Buscar en la lista"
            />
          </div>

          <div className="dd-lista">
            {filtradas.length === 0 ? (
              <div className="dd-vacio">{consulta ? 'Sin resultados.' : vacio}</div>
            ) : (
              filtradas.map((op) => {
                const marcada = elegidos.has(op.id)
                return (
                  <button
                    key={op.id}
                    type="button"
                    role="option"
                    aria-selected={marcada}
                    className={`dd-op ${marcada ? 'dd-op--sel' : ''}`}
                    onClick={() => alternar(op.id)}
                  >
                    <span className="filtro-check">{marcada && <i className="fas fa-check" />}</span>
                    <span className="dd-op-body">
                      <span className="dd-op-nom">{op.nombre}</span>
                      {op.detalle && <span className="dd-op-sub">{op.detalle}</span>}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {/* Cerrar es explícito: como el menú queda abierto para marcar varios, hace falta una
              salida clara además del clic afuera. */}
          <button type="button" className="dd-cerrar" onClick={() => setAbierto(false)}>
            Listo
          </button>
        </div>
      )}
    </div>
  )
}
