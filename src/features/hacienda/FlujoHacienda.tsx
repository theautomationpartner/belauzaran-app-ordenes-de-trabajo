import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Campo } from '@/types'
import type { Movimiento, OpcionesHacienda } from '@/lib/hacienda'
import { traerMovimientos, traerOpcionesHacienda } from '@/services/monday/hacienda'
import { usuarioActual } from '@/services/monday/usuario'
import { RegistrarMovimiento } from './RegistrarMovimiento'
import { Dashboard } from './Dashboard'

type Pestana = 'registrar' | 'dashboard'

interface Props {
  campos: Campo[]
  cabecera: (pasos: ReactNode) => ReactNode
  onPendiente?: (mensaje: string | null) => void
}

type Estado =
  | { fase: 'cargando' }
  | { fase: 'listo'; opciones: OpcionesHacienda }
  | { fase: 'error'; mensaje: string }

/**
 * Operación "Hacienda": registrar movimientos de hacienda (compras, nacimientos, ventas, muertes
 * y cambios de categoría) y verlos en un dashboard. Las dos pestañas comparten los datos: lo que
 * se registra aparece en el dashboard sin recargar la App.
 */
export function FlujoHacienda({ campos, cabecera, onPendiente }: Props) {
  const [pestana, setPestana] = useState<Pestana>('registrar')
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [cargandoMovs, setCargandoMovs] = useState(true)
  const [errorMovs, setErrorMovs] = useState<string | null>(null)
  const [responsable, setResponsable] = useState('')

  const cargarOpciones = useCallback(() => {
    setEstado({ fase: 'cargando' })
    traerOpcionesHacienda()
      .then((opciones) => setEstado({ fase: 'listo', opciones }))
      .catch((e: unknown) => setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) }))
  }, [])

  const cargarMovimientos = useCallback(() => {
    setCargandoMovs(true)
    setErrorMovs(null)
    traerMovimientos()
      .then(setMovs)
      .catch((e: unknown) => setErrorMovs(e instanceof Error ? e.message : String(e)))
      .finally(() => setCargandoMovs(false))
  }, [])

  useEffect(() => {
    cargarOpciones()
    cargarMovimientos()
    usuarioActual().then((u) => u?.nombre && setResponsable(u.nombre))
  }, [cargarOpciones, cargarMovimientos])

  const pestanas = (
    <div className="hc-pestanas" role="tablist" aria-label="Hacienda">
      {(
        [
          { id: 'registrar', texto: 'Registrar Movimiento', icono: 'pen-to-square' },
          { id: 'dashboard', texto: 'Dashboard', icono: 'chart-column' },
        ] as const
      ).map((p) => (
        <button
          type="button"
          role="tab"
          key={p.id}
          aria-selected={pestana === p.id}
          className={`hc-pestana ${pestana === p.id ? 'hc-pestana--activa' : ''}`}
          onClick={() => {
            setPestana(p.id)
            window.scrollTo({ top: 0 })
          }}
        >
          <i className={`fas fa-${p.icono}`} aria-hidden /> {p.texto}
        </button>
      ))}
    </div>
  )

  const pie = (contenido: ReactNode) => (
    <footer className="footbar">
      <div className="footbar-in">
        <span className="version" title="Versión desplegada">
          {__COMMIT__}
        </span>
        {contenido}
      </div>
    </footer>
  )

  return (
    <div className="app">
      {cabecera(pestanas)}
      {estado.fase !== 'listo' ? (
        <div className="pantalla-estado">
          {estado.fase === 'cargando' ? (
            <>
              <div className="spinner" />
              <h2>Cargando hacienda…</h2>
            </>
          ) : (
            <>
              <i className="fas fa-plug-circle-xmark" style={{ fontSize: 30, color: '#b42318' }} aria-hidden />
              <h2>No se pudieron traer los datos</h2>
              <p>{estado.mensaje}</p>
              <button type="button" className="btn btn-primary" onClick={cargarOpciones}>
                <i className="fas fa-rotate-right" aria-hidden /> Reintentar
              </button>
            </>
          )}
        </div>
      ) : pestana === 'registrar' ? (
        <RegistrarMovimiento
          opciones={estado.opciones}
          campos={campos}
          responsableInicial={responsable}
          onRegistrado={cargarMovimientos}
          onVerDashboard={() => setPestana('dashboard')}
          onPendiente={onPendiente}
          pie={pie}
        />
      ) : (
        <main className="scroll">
          {errorMovs ? (
            <div className="view">
              <div className="aviso aviso--error">
                <i className="fas fa-circle-exclamation" aria-hidden />
                <span>
                  No se pudieron traer los movimientos: {errorMovs}{' '}
                  <button type="button" className="btn btn-ghost btn--sm" onClick={cargarMovimientos}>
                    Reintentar
                  </button>
                </span>
              </div>
            </div>
          ) : cargandoMovs && movs.length === 0 ? (
            <div className="pantalla-estado">
              <div className="spinner" />
              <h2>Cargando movimientos…</h2>
            </div>
          ) : (
            <Dashboard
              movimientos={movs}
              opciones={estado.opciones}
              campos={campos}
              onRecargar={cargarMovimientos}
              cargando={cargandoMovs}
            />
          )}
        </main>
      )}
    </div>
  )
}
