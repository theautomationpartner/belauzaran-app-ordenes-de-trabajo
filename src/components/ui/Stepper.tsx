import { Fragment } from 'react'

interface Props {
  pasos: readonly string[]
  /** Índice del paso actual (0-based). Los anteriores se marcan como completados. */
  actual: number
  /**
   * Índice MÁS AVANZADO alcanzado: sólo se puede navegar a pasos con índice ≤ este valor.
   * Los pasos futuros quedan bloqueados hasta validar los anteriores.
   */
  maxAlcanzado?: number
  onPaso?: (indice: number) => void
}

const estadoDe = (i: number, actual: number) => (i < actual ? 'done' : i === actual ? 'cur' : 'off')

/** Barra de etapas: el ordinal en el círculo y el nombre de la etapa debajo. */
export function Stepper({ pasos, actual, maxAlcanzado, onPaso }: Props) {
  const limite = Math.max(maxAlcanzado ?? actual, actual)
  const puedeIr = (i: number) => !!onPaso && i !== actual && i <= limite

  return (
    <div className="stepper">
      {pasos.map((nombre, i) => {
        const estado = estadoDe(i, actual)
        const nav = puedeIr(i)
        const bloqueado = !!onPaso && i > limite
        return (
          <Fragment key={nombre}>
            <div
              className={[
                'step',
                estado,
                nav ? 'step--nav' : '',
                bloqueado ? 'step--locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role={nav ? 'button' : undefined}
              tabIndex={nav ? 0 : undefined}
              aria-current={estado === 'cur' ? 'step' : undefined}
              aria-disabled={bloqueado || undefined}
              aria-label={`Paso ${i + 1}: ${nombre}`}
              title={bloqueado ? 'Completá los pasos anteriores para llegar a esta etapa.' : undefined}
              onClick={nav ? () => onPaso!(i) : undefined}
              onKeyDown={
                nav
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPaso!(i)
                      }
                    }
                  : undefined
              }
            >
              <div className="sic">{estado === 'done' ? <i className="fas fa-check" /> : i + 1}</div>
              <span className="step-nom">{nombre}</span>
            </div>
            {i < pasos.length - 1 && <div className={`sline ${i < actual ? 'done' : ''}`} />}
          </Fragment>
        )
      })}
    </div>
  )
}
