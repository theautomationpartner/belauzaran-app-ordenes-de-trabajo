import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  titulo: ReactNode
  /** Bajada bajo el título. */
  subtitulo?: ReactNode
  onCerrar: () => void
  children: ReactNode
  /** Acciones del pie; sin esto el pie muestra sólo "Cerrar". */
  pie?: ReactNode
}

/**
 * Ventana emergente sobre la pantalla. Se cierra con la cruz, con Escape o tocando afuera, y al
 * cerrarse la pantalla de atrás queda exactamente como estaba: es para consultar algo sin perder
 * lo que se venía cargando.
 */
export function Modal({ titulo, subtitulo, onCerrar, children, pie }: Props) {
  const cerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cerrar.current?.focus()
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', teclas)
    return () => document.removeEventListener('keydown', teclas)
  }, [onCerrar])

  return (
    <div
      className="modal-fondo"
      onPointerDown={(e) => {
        // Sólo el fondo cierra: un toque adentro de la ventana no.
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
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
          {pie}
          <button type="button" className="btn btn-out" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
