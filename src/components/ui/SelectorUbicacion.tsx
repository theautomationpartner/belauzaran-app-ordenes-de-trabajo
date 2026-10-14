import { useState } from 'react'
import type { Ubicacion } from '@/lib/altas'
import { buscarDireccion, type DireccionEncontrada } from '@/services/ubicacion'

interface Props {
  valor: Ubicacion | null
  onCambio: (u: Ubicacion | null) => void
}

type Estado =
  | { fase: 'inactivo' }
  | { fase: 'buscando' }
  | { fase: 'listo'; resultados: DireccionEncontrada[] }
  | { fase: 'error'; mensaje: string }

/**
 * Ubicación opcional: se escribe la dirección, se busca y se elige una de las coincidencias.
 * Elegir de una lista (y no guardar el texto tipeado) es lo que da las coordenadas que monday
 * exige en una columna de ubicación.
 */
export function SelectorUbicacion({ valor, onCambio }: Props) {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<Estado>({ fase: 'inactivo' })

  const buscar = () => {
    if (!texto.trim()) return
    setEstado({ fase: 'buscando' })
    buscarDireccion(texto)
      .then((resultados) => setEstado({ fase: 'listo', resultados }))
      .catch((e: unknown) => setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) }))
  }

  if (valor) {
    return (
      <div className="ubicacion-elegida">
        <i className="fas fa-location-dot" aria-hidden />
        <span className="ubicacion-txt">{valor.address}</span>
        <button
          type="button"
          className="btn btn-ghost btn-ghost--rojo btn--sm"
          onClick={() => {
            onCambio(null)
            setEstado({ fase: 'inactivo' })
          }}
        >
          <i className="fas fa-xmark" aria-hidden /> Quitar
        </button>
      </div>
    )
  }

  return (
    <div className="ubicacion">
      <div className="buscador-fila">
        <div className="buscador-campo">
          <i className="fas fa-location-dot" aria-hidden />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                buscar()
              }
            }}
            placeholder="Calle y número, localidad (ej.: Pugliese 442, Tandil)"
            aria-label="Buscar dirección"
          />
        </div>
        <button
          type="button"
          className="btn btn-outblue"
          onClick={buscar}
          disabled={!texto.trim() || estado.fase === 'buscando'}
        >
          {estado.fase === 'buscando' ? (
            <i className="fas fa-circle-notch fa-spin" aria-hidden />
          ) : (
            <i className="fas fa-search" aria-hidden />
          )}{' '}
          Buscar
        </button>
      </div>

      {estado.fase === 'error' && <p className="ig-hint t-red" style={{ marginTop: 6 }}>{estado.mensaje}</p>}
      {estado.fase === 'listo' &&
        (estado.resultados.length === 0 ? (
          <p className="ig-hint" style={{ marginTop: 6 }}>
            No se encontró esa dirección. Probá con menos datos (calle y localidad) o sólo la localidad.
          </p>
        ) : (
          <div className="ubicacion-lista">
            {estado.resultados.map((r) => (
              <button
                type="button"
                key={`${r.lat},${r.lng}`}
                className="ubicacion-op"
                onClick={() => onCambio({ lat: r.lat, lng: r.lng, address: r.address })}
                title={r.completa}
              >
                <i className="fas fa-location-dot" aria-hidden />
                {r.address}
              </button>
            ))}
          </div>
        ))}
    </div>
  )
}
