import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  titulo: ReactNode
  /** Bajada bajo el título. */
  subtitulo?: ReactNode
  onCerrar: () => void
  children: ReactNode
  /** Acciones del pie; sin esto el pie muestra sólo "Cerrar". */
  pie?: ReactNode
  /** Texto del botón que cierra sin hacer nada ("Cerrar", "Cancelar"). */
  textoCerrar?: string
  /** Ventana más ancha, para formularios de varias columnas. */
  ancho?: boolean
}

/**
 * Ventanas abiertas, de la de más abajo a la de arriba. Puede haber una encima de otra (el alta de
 * un contacto se abre sobre la de su proveedor): Escape y el toque afuera cierran sólo la de
 * arriba, no las dos.
 */
const abiertas: symbol[] = []

/**
 * Ventana emergente sobre la pantalla. Se cierra con la cruz, con Escape o tocando afuera, y al
 * cerrarse la pantalla de atrás queda exactamente como estaba: es para consultar o cargar algo sin
 * perder lo que se venía haciendo.
 */
export function Modal({ titulo, subtitulo, onCerrar, children, pie, textoCerrar = 'Cerrar', ancho }: Props) {
  const cerrar = useRef<HTMLButtonElement>(null)
  const yo = useRef(Symbol('modal'))
  const alCerrar = useRef(onCerrar)
  alCerrar.current = onCerrar

  useEffect(() => {
    const id = yo.current
    abiertas.push(id)
    cerrar.current?.focus()
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abiertas[abiertas.length - 1] === id) alCerrar.current()
    }
    document.addEventListener('keydown', teclas)
    // La página de atrás no se desplaza mientras la ventana está abierta.
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', teclas)
      abiertas.splice(abiertas.indexOf(id), 1)
      if (abiertas.length === 0) document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      className="modal-fondo"
      onPointerDown={(e) => {
        // Sólo el fondo cierra: un toque adentro de la ventana no.
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div className={`modal ${ancho ? 'modal--ancho' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="modal-tit-bloque">
            <div className="modal-tit">{titulo}</div>
            {subtitulo && <div className="modal-sub">{subtitulo}</div>}
          </div>
          <button
            ref={cerrar}
            type="button"
            className="btn btn-ghost modal-x"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <i className="fas fa-xmark" aria-hidden />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-pie">
          <button type="button" className="btn btn-out" onClick={onCerrar}>
            {textoCerrar}
          </button>
          {pie}
        </div>
      </div>
    </div>
  )
}
