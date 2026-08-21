import { useMemo, useState } from 'react'
import { normalizar } from '@/lib/format'

export interface ResultadoBusqueda {
  id: string
  /** Texto principal del resultado. */
  titulo: string
  /** Segunda línea: marca, patente, precio… lo que ayude a distinguir homónimos. */
  detalle?: string
  /** Etiquetas cortas a la derecha (tipo, clasificación). */
  chips?: string[]
}

export interface FiltroPastillas {
  /** Rótulo del grupo ("Tipo", "Clasificación"). */
  titulo: string
  opciones: string[]
  /** Opción activa; `null` = sin filtrar por este grupo. */
  valor: string | null
  onCambio: (valor: string | null) => void
}

interface Props {
  /** Universo completo sobre el que se busca. Nunca se renderiza entero. */
  items: ResultadoBusqueda[]
  /** IDs ya agregados: se muestran marcados y no se pueden volver a agregar. */
  agregados: Set<string>
  onAgregar: (id: string) => void
  placeholder: string
  filtros?: FiltroPastillas[]
  /** Máximo de resultados a pintar de una vez. */
  tope?: number
  /** Texto de ayuda bajo el buscador cuando todavía no se buscó nada. */
  ayuda?: string
}

/**
 * Buscador con filtros para agregar items de un catálogo grande.
 *
 * La regla de fondo: NO se renderiza la lista completa. Con 215 productos o 144 maquinarias,
 * pintar todo de entrada hace que el desplegable tarde y que encontrar algo sea peor que buscarlo.
 * Acá no se muestra nada hasta que hay una búsqueda o un filtro activo, y aun entonces se corta
 * en `tope` resultados avisando cuántos quedaron afuera.
 *
 * Los resultados quedan a la vista mientras se agregan varios seguidos: agregar tres productos
 * no obliga a reabrir el buscador tres veces.
 */
export function BuscadorAgregar({
  items,
  agregados,
  onAgregar,
  placeholder,
  filtros = [],
  tope = 40,
  ayuda,
}: Props) {
  const [consulta, setConsulta] = useState('')
  // Lo que se buscó efectivamente. Separado de `consulta` para que la lista NO se recalcule con
  // cada tecla: se actualiza al apretar Buscar o Enter.
  const [buscado, setBuscado] = useState('')

  const hayFiltro = filtros.some((f) => f.valor)
  const activo = buscado.trim().length > 0 || hayFiltro

  const resultados = useMemo(() => {
    if (!activo) return []
    const q = normalizar(buscado.trim())
    return items.filter((it) => {
      if (q && !normalizar(`${it.titulo} ${it.detalle ?? ''}`).includes(q)) return false
      // Cada grupo de filtros se cumple contra los chips del item (tipo, clasificación…).
      return filtros.every((f) => !f.valor || (it.chips ?? []).includes(f.valor))
    })
  }, [items, buscado, activo, filtros])

  const visibles = resultados.slice(0, tope)
  const ocultos = resultados.length - visibles.length

  const buscar = () => setBuscado(consulta)

  const limpiar = () => {
    setConsulta('')
    setBuscado('')
    filtros.forEach((f) => f.onCambio(null))
  }

  return (
    <div className="buscador">
      <div className="buscador-fila">
        <div className="buscador-campo">
          <i className="fas fa-search" aria-hidden />
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                buscar()
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={buscar}>
          <i className="fas fa-search" aria-hidden /> Buscar
        </button>
        {activo && (
          <button type="button" className="btn btn-out" onClick={limpiar}>
            Limpiar
          </button>
        )}
      </div>

      {filtros.map((filtro) => (
        <div className="buscador-filtro" key={filtro.titulo}>
          <span className="buscador-filtro-lbl">{filtro.titulo}</span>
          <div className="pastillas">
            {filtro.opciones.map((op) => {
              const elegida = filtro.valor === op
              return (
                <button
                  type="button"
                  key={op}
                  className={`pastilla ${elegida ? 'pastilla--sel' : ''}`}
                  aria-pressed={elegida}
                  // Volver a tocar la pastilla activa quita el filtro: es la forma natural de
                  // deshacer sin tener que ir hasta "Limpiar".
                  onClick={() => filtro.onCambio(elegida ? null : op)}
                >
                  {op}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {!activo ? (
        ayuda && <p className="buscador-ayuda">{ayuda}</p>
      ) : resultados.length === 0 ? (
        <p className="buscador-ayuda">
          No hay coincidencias{buscado.trim() ? ` para "${buscado.trim()}"` : ''}
          {hayFiltro ? ' con esos filtros' : ''}.
        </p>
      ) : (
        <>
          <div className="buscador-cuenta">
            {resultados.length} resultado{resultados.length === 1 ? '' : 's'}
            {ocultos > 0 && ` · se muestran los primeros ${tope}, afiná la búsqueda para ver el resto`}
          </div>
          <div className="resultados">
            {visibles.map((it) => {
              const yaEsta = agregados.has(it.id)
              return (
                <button
                  type="button"
                  key={it.id}
                  className={`resultado ${yaEsta ? 'resultado--puesto' : ''}`}
                  disabled={yaEsta}
                  onClick={() => onAgregar(it.id)}
                >
                  <span className="resultado-ic">
                    <i className={`fas fa-${yaEsta ? 'check' : 'plus'}`} aria-hidden />
                  </span>
                  <span className="resultado-body">
                    <span className="resultado-tit">{it.titulo}</span>
                    {it.detalle && <span className="resultado-det">{it.detalle}</span>}
                  </span>
                  {(it.chips ?? []).filter(Boolean).map((c) => (
                    <span className="chip chip--gris" key={c}>
                      {c}
                    </span>
                  ))}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
