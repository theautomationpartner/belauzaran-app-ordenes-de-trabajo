import { useMemo, useRef, useState } from 'react'
import { normalizar } from '@/lib/format'
import { useClickAfuera } from '@/hooks/useClickAfuera'

export interface ResultadoBusqueda {
  id: string
  /** Texto principal del resultado. */
  titulo: string
  /** Segunda línea: marca, patente, precio… lo que ayude a distinguir homónimos. */
  detalle?: string
  /** Etiquetas por las que se puede filtrar (tipo, clasificación). */
  chips?: string[]
}

export interface GrupoFiltro {
  /** Rótulo del grupo ("Tipo", "Clasificación"). */
  titulo: string
  opciones: string[]
  /** Opciones activas. Vacío = sin filtrar por este grupo. */
  valores: string[]
  onCambio: (valores: string[]) => void
  /**
   * `pastillas` pinta todas las opciones a la vista; sirve cuando son pocas. `desplegable` las
   * esconde detrás de un menú y deja afuera sólo las elegidas: con 35 tipos de maquinaria, la
   * lista completa tapaba el buscador.
   */
  modo?: 'pastillas' | 'desplegable'
}

interface Props {
  /** Universo completo sobre el que se busca. Nunca se renderiza entero. */
  items: ResultadoBusqueda[]
  /** IDs ya agregados: se muestran marcados y no se pueden volver a agregar. */
  agregados: Set<string>
  onAgregar: (id: string) => void
  placeholder: string
  filtros?: GrupoFiltro[]
  /** Máximo de resultados a pintar de una vez. */
  tope?: number
  /** Texto de ayuda bajo el buscador cuando todavía no se buscó nada. */
  ayuda?: string
  /**
   * Muestra el universo completo sin necesidad de buscar. Sólo para catálogos chicos —los 16
   * campos—, donde ver la lista entera ES la forma más rápida de elegir.
   */
  mostrarTodo?: boolean
}

/** Menú de selección múltiple para un grupo de filtros. */
function MenuFiltro({ grupo }: { grupo: GrupoFiltro }) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  useClickAfuera(caja, abierto, () => setAbierto(false))

  const alternar = (op: string) => {
    grupo.onCambio(
      grupo.valores.includes(op)
        ? grupo.valores.filter((v) => v !== op)
        : [...grupo.valores, op],
    )
  }

  return (
    <div className="filtro-menu" ref={caja}>
      <button
        type="button"
        className={`filtro-trigger ${grupo.valores.length > 0 ? 'filtro-trigger--activo' : ''}`}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        {grupo.titulo}
        {grupo.valores.length > 0 && <span className="filtro-cuenta">{grupo.valores.length}</span>}
        <i className={`fas fa-chevron-${abierto ? 'up' : 'down'}`} aria-hidden />
      </button>

      {abierto && (
        <div className="filtro-lista">
          {grupo.opciones.map((op) => {
            const elegida = grupo.valores.includes(op)
            return (
              <button
                type="button"
                key={op}
                className={`filtro-op ${elegida ? 'filtro-op--sel' : ''}`}
                aria-pressed={elegida}
                onClick={() => alternar(op)}
              >
                <span className="filtro-check">{elegida && <i className="fas fa-check" />}</span>
                {op}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Buscador con filtros para agregar items de un catálogo grande.
 *
 * La regla de fondo: NO se renderiza la lista completa. Con 215 productos o 144 maquinarias,
 * pintar todo de entrada hace que el desplegable tarde y que encontrar algo sea peor que buscarlo.
 * No se muestra nada hasta que hay una búsqueda o un filtro activo, y aun entonces se corta en
 * `tope` resultados avisando cuántos quedaron afuera. La excepción es `mostrarTodo`, para
 * catálogos chicos donde ver la lista entera sí ayuda.
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
  mostrarTodo = false,
}: Props) {
  const [consulta, setConsulta] = useState('')
  /* Lo que se buscó efectivamente. Separado de `consulta` para que la lista NO se recalcule con
     cada tecla: se actualiza al apretar Buscar o Enter. En modo `mostrarTodo` sí filtra al tipear,
     porque ahí la lista ya está a la vista y esperar un clic se siente roto. */
  const [buscado, setBuscado] = useState('')

  const desplegables = filtros.filter((f) => f.modo === 'desplegable')
  const pastillas = filtros.filter((f) => f.modo !== 'desplegable')

  const consultaEfectiva = mostrarTodo ? consulta : buscado
  const hayFiltro = filtros.some((f) => f.valores.length > 0)
  const activo = mostrarTodo || consultaEfectiva.trim().length > 0 || hayFiltro

  const resultados = useMemo(() => {
    if (!activo) return []
    const q = normalizar(consultaEfectiva.trim())
    return items.filter((it) => {
      if (q && !normalizar(`${it.titulo} ${it.detalle ?? ''}`).includes(q)) return false
      // Dentro de un grupo alcanza con cumplir UNA opción; entre grupos, se piden todas.
      return filtros.every(
        (f) => f.valores.length === 0 || f.valores.some((v) => (it.chips ?? []).includes(v)),
      )
    })
  }, [items, consultaEfectiva, activo, filtros])

  const visibles = resultados.slice(0, tope)
  const ocultos = resultados.length - visibles.length

  const limpiar = () => {
    setConsulta('')
    setBuscado('')
    filtros.forEach((f) => f.onCambio([]))
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
                setBuscado(consulta)
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
          />
        </div>

        {desplegables.map((grupo) => (
          <MenuFiltro grupo={grupo} key={grupo.titulo} />
        ))}

        {!mostrarTodo && (
          <button type="button" className="btn btn-primary" onClick={() => setBuscado(consulta)}>
            <i className="fas fa-search" aria-hidden /> Buscar
          </button>
        )}
        {(consulta || buscado || hayFiltro) && (
          <button type="button" className="btn btn-out" onClick={limpiar}>
            Limpiar
          </button>
        )}
      </div>

      {/* Los filtros elegidos en los desplegables salen acá como chips con su cruz: quedan a la
          vista sin que las 35 opciones tapen el buscador. */}
      {desplegables.some((f) => f.valores.length > 0) && (
        <div className="filtros-elegidos">
          {desplegables.flatMap((grupo) =>
            grupo.valores.map((v) => (
              <span className="chip-filtro" key={`${grupo.titulo}-${v}`}>
                {v}
                <button
                  type="button"
                  onClick={() => grupo.onCambio(grupo.valores.filter((x) => x !== v))}
                  aria-label={`Quitar el filtro ${v}`}
                >
                  <i className="fas fa-xmark" aria-hidden />
                </button>
              </span>
            )),
          )}
        </div>
      )}

      {pastillas.map((grupo) => (
        <div className="buscador-filtro" key={grupo.titulo}>
          <span className="buscador-filtro-lbl">{grupo.titulo}</span>
          <div className="pastillas">
            {grupo.opciones.map((op) => {
              const elegida = grupo.valores.includes(op)
              return (
                <button
                  type="button"
                  key={op}
                  className={`pastilla ${elegida ? 'pastilla--sel' : ''}`}
                  aria-pressed={elegida}
                  onClick={() =>
                    grupo.onCambio(
                      elegida ? grupo.valores.filter((v) => v !== op) : [...grupo.valores, op],
                    )
                  }
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
          No hay coincidencias
          {consultaEfectiva.trim() ? ` para "${consultaEfectiva.trim()}"` : ''}
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
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
