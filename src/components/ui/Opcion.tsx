import type { ReactNode } from 'react'

export interface OpcionProps {
  activa: boolean
  /** Hay otra opción elegida: esta se apaga para que quede claro cuál vale. */
  apagada: boolean
  color: string
  icono: string
  titulo: ReactNode
  detalle?: string
  onElegir: () => void
  grande?: boolean
}

/** Tarjeta de elección única (radio): se pinta entera con su color cuando está elegida. */
export function Opcion({ activa, apagada, color, icono, titulo, detalle, onElegir, grande }: OpcionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      className={[
        'opcion',
        `opcion--${color}`,
        grande ? 'opcion--grande' : '',
        activa ? 'opcion--activa' : '',
        apagada ? 'opcion--apagada' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onElegir}
    >
      <span className="opcion-ic">
        <i className={`fas fa-${icono}`} aria-hidden />
      </span>
      <span className="opcion-body">
        <span className="opcion-tit">{titulo}</span>
        {detalle && <span className="opcion-det">{detalle}</span>}
      </span>
      <span className="opcion-radio">{activa && <i className="fas fa-check" aria-hidden />}</span>
    </button>
  )
}

