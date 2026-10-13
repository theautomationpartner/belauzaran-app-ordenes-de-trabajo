import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Cultivo, OrdenProduccion, PlanAsignacion, ResultadoAsignacion } from '@/types'
import { Stepper } from '@/components/ui/Stepper'
import { normalizar, plural } from '@/lib/format'
import { planDe, totalesDe } from '@/lib/barbecho'
import {
  aplicarAsignaciones,
  traerOrdenesEnBarbecho,
  type AvanceAsignacion,
} from '@/services/monday/barbecho'
import { CULTIVO_BARBECHO } from '@/services/monday/columns'
import { PasoElegir } from './PasoElegir'
import { PasoConfirmar } from './PasoConfirmar'

const PASOS = ['Elegir órdenes y cultivo', 'Confirmar cambios'] as const

interface Props {
  cultivos: Cultivo[]
  /** Arma la cabecera de la app con las etapas de esta operación. */
  cabecera: (pasos: ReactNode) => ReactNode
}

type EstadoCarga =
  | { fase: 'cargando' }
  | { fase: 'listo'; ops: OrdenProduccion[] }
  | { fase: 'error'; mensaje: string }

type EstadoAplicacion =
  | { fase: 'inactivo' }
  | { fase: 'aplicando'; avance: AvanceAsignacion }
  | { fase: 'terminado'; resultados: ResultadoAsignacion[] }
  | { fase: 'error'; mensaje: string }

/**
 * Operación "Asignación de Barbecho": a las órdenes de producción que están en barbecho se les
 * asigna el cultivo que finalmente se va a sembrar, y el cambio se propaga a sus órdenes de
 * trabajo, confirmaciones y movimientos de stock.
 */
export function FlujoBarbecho({ cultivos, cabecera }: Props) {
  const barbecho = useMemo(
    () => cultivos.find((c) => normalizar(c.nombre) === normalizar(CULTIVO_BARBECHO)) ?? null,
    [cultivos],
  )

  const [carga, setCarga] = useState<EstadoCarga>({ fase: 'cargando' })
  const [asignaciones, setAsignaciones] = useState<Record<string, string | null>>({})
  const [paso, setPaso] = useState(0)
  const [aplicacion, setAplicacion] = useState<EstadoAplicacion>({ fase: 'inactivo' })
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false)

  const cargar = useCallback(() => {
    if (!barbecho) {
      setCarga({
        fase: 'error',
        mensaje: `No se encontró el cultivo "${CULTIVO_BARBECHO}" en el tablero de Cultivos.`,
      })
      return
    }
    setCarga({ fase: 'cargando' })
    traerOrdenesEnBarbecho(barbecho)
      .then((ops) => setCarga({ fase: 'listo', ops }))
      .catch((e: unknown) =>
        setCarga({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) }),
      )
  }, [barbecho])

  useEffect(() => cargar(), [cargar])

  const ops = carga.fase === 'listo' ? carga.ops : []

  /* El plan se arma con las órdenes en el orden de la lista, no en el que se marcaron: así la
     revisión se lee igual que la pantalla anterior. */
  const planes: PlanAsignacion[] = useMemo(
    () =>
      ops.flatMap((op) => {
        const cultivoId = asignaciones[op.id]
        const cultivo = cultivoId ? cultivos.find((c) => c.id === cultivoId) : null
        return cultivo ? [planDe(op, { id: cultivo.id, nombre: cultivo.nombre })] : []
      }),
    [ops, asignaciones, cultivos],
  )

  const marcadas = Object.keys(asignaciones).length
  const sinCultivo = Object.values(asignaciones).filter((v) => !v).length
  const faltantes = [
    ...(marcadas === 0 ? ['Marcá al menos una orden de producción.'] : []),
    ...(sinCultivo > 0
      ? [
          sinCultivo === 1
            ? 'Hay una orden marcada sin cultivo elegido.'
            : `Hay ${sinCultivo} órdenes marcadas sin cultivo elegido.`,
        ]
      : []),
  ]

  const cambiarAsignaciones = (proximas: Record<string, string | null>) => {
    setAsignaciones(proximas)
    setAplicacion({ fase: 'inactivo' })
  }

  const irA = (destino: number) => {
    setPaso(destino)
    setMostrarFaltantes(false)
    // Cada paso arranca desde arriba: la lista del primero es larga y se cambia de pantalla abajo.
    window.scrollTo({ top: 0 })
  }

  const avanzar = () => {
    if (faltantes.length > 0) {
      setMostrarFaltantes(true)
      return
    }
    irA(1)
  }

  const aplicar = async () => {
    if (planes.length === 0) return
    setAplicacion({ fase: 'aplicando', avance: { hechas: 0, total: planes.length, actual: '' } })
    try {
      const resultados = await aplicarAsignaciones(planes, (avance) =>
        setAplicacion({ fase: 'aplicando', avance }),
      )
      setAplicacion({ fase: 'terminado', resultados })
    } catch (e: unknown) {
      setAplicacion({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) })
    }
  }

  /** Vuelve a empezar con la lista recargada: las que se asignaron ya no están en barbecho. */
  const empezarDeNuevo = () => {
    setAsignaciones({})
    setAplicacion({ fase: 'inactivo' })
    setPaso(0)
    setMostrarFaltantes(false)
    cargar()
  }

  const stepper = <Stepper pasos={PASOS} actual={paso} maxAlcanzado={paso} onPaso={irA} />

  if (carga.fase !== 'listo') {
    return (
      <div className="app">
        {cabecera(null)}
        <div className="pantalla-estado">
          {carga.fase === 'cargando' ? (
            <>
              <div className="spinner" />
              <h2>Buscando órdenes en barbecho…</h2>
              <p>Órdenes de producción, sus órdenes de trabajo, confirmaciones y stock.</p>
            </>
          ) : (
            <>
              <i className="fas fa-plug-circle-xmark" style={{ fontSize: 30, color: '#b42318' }} aria-hidden />
              <h2>No se pudieron traer las órdenes</h2>
              <p>{carga.mensaje}</p>
              <button type="button" className="btn btn-primary" onClick={cargar}>
                <i className="fas fa-rotate-right" aria-hidden /> Reintentar
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (aplicacion.fase === 'terminado') {
    return (
      <div className="app">
        {cabecera(null)}
        <main className="scroll">
          <Resultado resultados={aplicacion.resultados} onOtra={empezarDeNuevo} />
        </main>
      </div>
    )
  }

  const totales = totalesDe(planes)
  const bloqueado = paso === 0 && faltantes.length > 0
  const mensaje =
    paso === 0
      ? bloqueado
        ? faltantes[0]
        : `${plural(marcadas, 'orden lista', 'órdenes listas')}. Siguiente: ${PASOS[1]}`
      : `Se modifican ${plural(totales.ordenesTrabajo, 'OT', 'OT')}, ${plural(
          totales.confirmaciones,
          'confirmación',
          'confirmaciones',
        )} y ${plural(totales.stock, 'movimiento de stock', 'movimientos de stock')}.`

  return (
    <div className="app">
      {cabecera(stepper)}

      <main className="scroll">
        {paso === 0 && ops.length === 0 && (
          <div className="view">
            <div className="pantalla-estado">
              <i className="fas fa-circle-check" style={{ fontSize: 30, color: '#00874d' }} aria-hidden />
              <h2>No hay órdenes de producción en barbecho</h2>
              <p>Todas tienen un cultivo asignado.</p>
            </div>
          </div>
        )}
        {paso === 0 && ops.length > 0 && (
          <PasoElegir
            ops={ops}
            cultivos={cultivos}
            asignaciones={asignaciones}
            onCambio={cambiarAsignaciones}
          />
        )}
        {paso === 1 && <PasoConfirmar planes={planes} onEditar={() => irA(0)} />}

        {mostrarFaltantes && bloqueado && (
          <div className="aviso aviso--error view" style={{ marginTop: 16 }}>
            <i className="fas fa-circle-exclamation" aria-hidden />
            <span>
              Para continuar falta:
              <ul style={{ margin: '6px 0 0 18px' }}>
                {faltantes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </span>
          </div>
        )}

        {aplicacion.fase === 'error' && (
          <div className="aviso aviso--error view" style={{ marginTop: 16 }}>
            <i className="fas fa-circle-exclamation" aria-hidden />
            <span>No se pudieron aplicar los cambios: {aplicacion.mensaje}</span>
          </div>
        )}
      </main>

      <footer className="footbar">
        <div className="footbar-in">
          <span className="version" title="Versión desplegada">
            {__COMMIT__}
          </span>
          <span className={`footbar-msg ${bloqueado ? 'footbar-msg--bloqueo' : ''}`}>
            <i className={`fas fa-${bloqueado ? 'circle-exclamation' : 'arrow-turn-down'}`} aria-hidden />
            {mensaje}
          </span>
          <div className="footbar-acciones">
            {paso > 0 && (
              <button
                type="button"
                className="btn btn-out"
                disabled={aplicacion.fase === 'aplicando'}
                onClick={() => irA(0)}
              >
                <i className="fas fa-arrow-left" aria-hidden /> Volver
              </button>
            )}
            {paso === 0 ? (
              <button type="button" className="btn btn-primary" onClick={avanzar}>
                Revisar cambios <i className="fas fa-arrow-right" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-green"
                disabled={planes.length === 0 || aplicacion.fase === 'aplicando'}
                onClick={aplicar}
              >
                {aplicacion.fase === 'aplicando' ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin" aria-hidden /> Aplicando{' '}
                    {Math.min(aplicacion.avance.hechas + 1, aplicacion.avance.total)} de{' '}
                    {aplicacion.avance.total}…
                  </>
                ) : (
                  <>
                    <i className="fas fa-cloud-arrow-up" aria-hidden /> Aplicar cambios
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

/**
 * Resumen de lo que efectivamente se escribió. Se detalla orden por orden porque un fallo no corta
 * la tanda: puede haber órdenes actualizadas y otras no, y hay que saber cuáles reintentar.
 */
function Resultado({ resultados, onOtra }: { resultados: ResultadoAsignacion[]; onOtra: () => void }) {
  const ok = resultados.filter((r) => r.opActualizada && !r.error)
  const fallidas = resultados.filter((r) => !r.opActualizada || r.error)
  const suma = (k: 'ordenesTrabajo' | 'confirmaciones' | 'stock') =>
    resultados.reduce((a, r) => a + r[k], 0)

  return (
    <div className="view">
      <div className={`card ${fallidas.length === 0 ? 'card--summary' : 'card--data'}`}>
        <div className="ctitle">
          <i
            className={`fas fa-${fallidas.length === 0 ? 'circle-check' : 'triangle-exclamation'}`}
            style={{ color: fallidas.length === 0 ? '#00874d' : '#b25e09' }}
            aria-hidden
          />
          {plural(ok.length, 'orden de producción actualizada', 'órdenes de producción actualizadas')}
          {fallidas.length > 0 && ` · ${fallidas.length} con error`}
        </div>
        <div className="csub">
          Se actualizaron {plural(suma('ordenesTrabajo'), 'orden de trabajo', 'órdenes de trabajo')},{' '}
          {plural(suma('confirmaciones'), 'confirmación', 'confirmaciones')} y se renombraron{' '}
          {plural(suma('stock'), 'movimiento de stock', 'movimientos de stock')}.
        </div>

        <div className="resultados-lista">
          {resultados.map((r) => {
            const bien = r.opActualizada && !r.error
            return (
              <div className={`resultado-orden ${bien ? '' : 'resultado-orden--error'}`} key={r.plan.op.id}>
                <i className={`fas fa-${bien ? 'circle-check' : 'circle-xmark'}`} aria-hidden />
                <span className="resultado-orden-body">
                  <span className="font-b">
                    {r.plan.nombreOp.nuevo !== r.plan.nombreOp.anterior && bien
                      ? r.plan.nombreOp.nuevo
                      : r.plan.op.nombre}
                  </span>
                  <span className="xs">
                    {bien
                      ? `${r.plan.op.cultivo} → ${r.plan.cultivo.nombre} · ${plural(r.ordenesTrabajo, 'OT', 'OT')}, ${plural(
                          r.confirmaciones,
                          'confirmación',
                          'confirmaciones',
                        )}, ${plural(r.stock, 'mov. de stock', 'mov. de stock')}`
                      : r.error}
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="acciones-bloque">
          <button type="button" className="btn btn-primary" onClick={onOtra}>
            <i className="fas fa-seedling" aria-hidden /> Asignar otras órdenes
          </button>
          <a
            className="btn btn-out"
            href="https://belauzaransa.monday.com/boards/18410927170"
            target="_blank"
            rel="noreferrer"
          >
            <i className="fas fa-arrow-up-right-from-square" aria-hidden /> Ver órdenes de producción
          </a>
        </div>
      </div>
    </div>
  )
}
