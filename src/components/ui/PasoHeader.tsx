interface Props {
  numero: number
  titulo: string
  descripcion: string
}

/** Encabezado de cada etapa: ordinal, título y una bajada que dice qué se hace en el paso. */
export function PasoHeader({ numero, titulo, descripcion }: Props) {
  return (
    <div className="header-section">
      <div className="step-badge">{numero}</div>
      <div className="step-details">
        <div className="step-title">{titulo}</div>
        <div className="step-desc">{descripcion}</div>
      </div>
    </div>
  )
}
