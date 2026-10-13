import type { Operacion } from '@/types'

export interface TarjetaOperacion {
  id: Operacion
  /** El mismo nombre que en el desplegable de la cabecera. */
  nombre: string
  descripcion: string
  icono: string
  /** Clase de color de la tarjeta (`inicio-op--azul`…). */
  color: string
}

interface Props {
  operaciones: TarjetaOperacion[]
  onElegir: (id: Operacion) => void
}

/**
 * Pantalla de inicio: la app abre acá, sin ninguna operación cargada. Cada operación es una
 * tarjeta con su color; tocarla es lo mismo que elegirla en el desplegable de arriba.
 */
export function Inicio({ operaciones, onElegir }: Props) {
  return (
    <main className="scroll">
      <div className="view inicio">
        <h1 className="inicio-tit">¿Qué vas a hacer?</h1>
        <p className="inicio-sub">Elegí la operación, acá abajo o en el desplegable de arriba.</p>

        <div className="inicio-grid">
          {operaciones.map((op) => (
            <button
              type="button"
              key={op.id}
              className={`inicio-op ${op.color}`}
              onClick={() => onElegir(op.id)}
            >
              <span className="inicio-op-ic">
                <i className={`fas fa-${op.icono}`} aria-hidden />
              </span>
              <span className="inicio-op-body">
                <span className="inicio-op-nom">{op.nombre}</span>
                <span className="inicio-op-desc">{op.descripcion}</span>
              </span>
              <i className="fas fa-chevron-right inicio-op-flecha" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
