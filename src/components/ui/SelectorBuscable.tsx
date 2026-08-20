import { useEffect, useMemo, useRef, useState } from 'react'
import { useClickAfuera } from '@/hooks/useClickAfuera'
import { normalizar } from '@/lib/format'

export interface OpcionSelector {
  id: string
  /** Texto principal de la opción. */
  nombre: string
  /** Segunda línea: CUIT, tipo de cultivo, hectáreas… Lo que ayude a distinguir homónimos. */
  detalle?: string
  /** Etiqueta corta a la derecha de la opción. */
  chip?: string
  /** Clase del chip (`chip--verde`, `chip--campo`…). */
  chipClase?: string
}

interface Props {
  opciones: OpcionSelector[]
  valor: string | null
  onCambio: (id: string | null) => void
  placeholder: string
  /** Se muestra en el menú cuando no hay ninguna opción para ofrecer. */
  vacio?: string
  disabled?: boolean
  /** Debajo de este umbral el buscador estorba más de lo que ayuda. */
  umbralBusqueda?: number
  id?: string
}

/**
 * Selector de un valor con búsqueda incorporada. Reemplaza al `<select>` nativo porque los
 * catálogos llegan a 65 proveedores: en una lista nativa hay que scrollear a ciegas, y en el
 * celular la rueda del sistema no permite filtrar.
 *
 * El disparador es un `<button>` de 44px de alto —el mínimo cómodo para el pulgar— y muestra
 * el valor elegido con su detalle, así el dato queda a la vista sin tener que reabrir la lista.
 */
export function SelectorBuscable({
  opciones,
  valor,
  onCambio,
  placeholder,
  vacio = 'No hay opciones disponibles.',
  disabled = false,
  umbralBusqueda = 7,
  id,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [activa, setActiva] = useState(0)
  const caja = useRef<HTMLDivElement>(null)
  const campoBusqueda = useRef<HTMLInputElement>(null)

  useClickAfuera(caja, abierto, () => setAbierto(false))

  // Cada apertura arranca limpia: el filtro anterior escondería opciones sin que se note.
  useEffect(() => {
    if (!abierto) return
    setConsulta('')
    setActiva(0)
    campoBusqueda.current?.focus()
  }, [abierto])

  const elegida = useMemo(() => opciones.find((o) => o.id === valor) ?? null, [opciones, valor])

  const filtradas = useMemo(() => {
    const q = normalizar(consulta.trim())
    if (!q) return opciones
    // Se busca por nombre Y por detalle: al proveedor a veces lo ubican por el CUIT.
    return opciones.filter((o) => normalizar(`${o.nombre} ${o.detalle ?? ''}`).includes(q))
  }, [opciones, consulta])

  const conBuscador = opciones.length >= umbralBusqueda

  const elegir = (idOpcion: string) => {
    // Volver a tocar la opción elegida la deselecciona: es la única forma de vaciar el campo.
    onCambio(idOpcion === valor ? null : idOpcion)
    setAbierto(false)
  }

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setAbierto(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (filtradas.length === 0) return
      const paso = e.key === 'ArrowDown' ? 1 : -1
      setActiva((i) => (i + paso + filtradas.length) % filtradas.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const op = filtradas[activa]
      if (op) elegir(op.id)
    }
  }

  const clases = ['dd', abierto ? 'dd--abierto' : '', elegida ? 'dd--elegido' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={clases} ref={caja}>
      <button
        type="button"
        id={id}
        className="dd-trigger"
        disabled={disabled || opciones.length === 0}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={(e) => {
          if (!abierto && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            e.preventDefault()
            setAbierto(true)
          }
        }}
      >
        <span className="dd-val">
          <span className={`dd-val-txt ${elegida ? '' : 'dd-ph'}`}>
            {elegida ? elegida.nombre : opciones.length === 0 ? vacio : placeholder}
          </span>
          {elegida?.detalle && <span className="dd-sub">{elegida.detalle}</span>}
        </span>
        <i className={`fas fa-chevron-${abierto ? 'up' : 'down'} dd-caret`} aria-hidden />
      </button>

      {abierto && (
        <div className="dd-menu" role="listbox">
          {conBuscador && (
            <div className="dd-buscar">
              <i className="fas fa-search" aria-hidden />
              <input
                ref={campoBusqueda}
                value={consulta}
                onChange={(e) => {
                  setConsulta(e.target.value)
                  setActiva(0)
                }}
                onKeyDown={teclas}
                placeholder="Buscar…"
                aria-label="Buscar en la lista"
              />
            </div>
          )}
          <div className="dd-lista">
            {filtradas.length === 0 ? (
              <div className="dd-vacio">{consulta ? 'Sin resultados.' : vacio}</div>
            ) : (
              filtradas.map((op, i) => (
                <button
                  key={op.id}
                  type="button"
                  role="option"
                  aria-selected={op.id === valor}
                  className={[
                    'dd-op',
                    op.id === valor ? 'dd-op--sel' : '',
                    i === activa ? 'dd-op--activa' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => setActiva(i)}
                  onClick={() => elegir(op.id)}
                >
                  <span className="dd-op-body">
                    <span className="dd-op-nom">{op.nombre}</span>
                    {op.detalle && <span className="dd-op-sub">{op.detalle}</span>}
                  </span>
                  {op.chip && <span className={`chip ${op.chipClase ?? ''}`}>{op.chip}</span>}
                  {op.id === valor && <i className="fas fa-check" style={{ color: '#2f6f4e' }} aria-hidden />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
