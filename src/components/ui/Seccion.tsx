import type { ReactNode } from 'react'

/**
 * Bloque numerado de un formulario de una sola pantalla. El número pasa a tilde verde cuando el
 * bloque está completo, así se ve de un vistazo qué falta.
 */
export function Seccion({
  numero,
  titulo,
  ayuda,
  completa,
  opcional = false,
  children,
}: {
  numero: number
  titulo: string
  ayuda?: string
  completa: boolean
  /** Bloque que se puede dejar vacío: lleva la etiqueta "Opcional" en vez del punto rojo. */
  opcional?: boolean
  children: ReactNode
}) {
  return (
    <section className={`card card--input seccion ${completa ? 'seccion--completa' : ''}`}>
      <div className="seccion-head">
        <span className="seccion-num">{completa ? <i className="fas fa-check" aria-hidden /> : numero}</span>
        <span className="seccion-tit">
          {titulo}
          {opcional ? (
            <span className="chip chip--opcional">Opcional</span>
          ) : (
            <span className="ig-req" aria-label="obligatorio" />
          )}
        </span>
      </div>
      {ayuda && <p className="seccion-ayuda">{ayuda}</p>}
      {children}
    </section>
  )
}
