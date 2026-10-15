import { useEffect, useState, type ReactNode } from 'react'
import type { Campo } from '@/types'
import { Opcion } from '@/components/ui/Opcion'
import { Seccion } from '@/components/ui/Seccion'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { fecha } from '@/lib/format'
import { hoyIso } from '@/lib/cosecha'
import {
  categoriasPara,
  cambiarMovimiento,
  destinosPara,
  faltantesMovimiento,
  movimientoVacio,
  nombreMovimiento,
  origenesPosibles,
  tipoDe,
  type BorradorMovimiento,
  type OpcionesHacienda,
} from '@/lib/hacienda'
import { crearMovimiento } from '@/services/monday/hacienda'
import { TABLERO_MOVIMIENTOS } from '@/services/monday/columns'

interface Props {
  opciones: OpcionesHacienda
  campos: Campo[]
  /** Nombre de quien está usando la App: se propone como responsable. */
  responsableInicial: string
  /** Avisa que se registró uno (el dashboard recarga los datos). */
  onRegistrado: () => void
  onVerDashboard: () => void
  onPendiente?: (mensaje: string | null) => void
  /** Pie fijo con el botón, que arma el flujo. */
  pie: (contenido: ReactNode) => ReactNode
}

type Envio =
  | { fase: 'inactivo' }
  | { fase: 'enviando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; itemId: string; nombre: string }

/**
 * Registrar un movimiento de hacienda: el formulario original (ingreso, egreso o cambio de
 * categoría) con las mismas reglas, en el estilo de la App. Lo que no corresponde no se ofrece:
 * un nacimiento sólo puede ser de terneros o terneras, y un cambio de categoría sólo a la
 * categoría que sigue en el crecimiento del animal.
 */
export function RegistrarMovimiento({
  opciones,
  campos,
  responsableInicial,
  onRegistrado,
  onVerDashboard,
  onPendiente,
  pie,
}: Props) {
  const [b, setB] = useState<BorradorMovimiento>(() => movimientoVacio(responsableInicial))
  const [envio, setEnvio] = useState<Envio>({ fase: 'inactivo' })
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false)

  // Si el nombre de quien usa la App llega después de abrir el formulario, se completa.
  useEffect(() => {
    if (responsableInicial) setB((x) => (x.responsable ? x : { ...x, responsable: responsableInicial }))
  }, [responsableInicial])

  useEffect(() => {
    onPendiente?.(envio.fase === 'enviando' ? 'Todavía se está registrando el movimiento.' : null)
    return () => onPendiente?.(null)
  }, [envio.fase, onPendiente])

  const cambiar = (p: Partial<BorradorMovimiento>) => {
    setB((x) => cambiarMovimiento(x, p, opciones))
    setEnvio((e) => (e.fase === 'error' ? { fase: 'inactivo' } : e))
  }

  const faltantes = faltantesMovimiento(b, opciones)
  const tipo = tipoDe(b)
  const campo = campos.find((c) => c.id === b.campoId) ?? null

  const registrar = async () => {
    if (faltantes.length) {
      setMostrarFaltantes(true)
      return
    }
    setEnvio({ fase: 'enviando' })
    try {
      const itemId = await crearMovimiento(b, opciones)
      setEnvio({ fase: 'listo', itemId, nombre: nombreMovimiento(b) })
      onRegistrado()
    } catch (e: unknown) {
      setEnvio({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) })
    }
  }

  const otro = () => {
    // Se conservan el campo y el responsable: lo habitual es cargar varios seguidos del mismo campo.
    setB({ ...movimientoVacio(b.responsable), campoId: b.campoId })
    setEnvio({ fase: 'inactivo' })
    setMostrarFaltantes(false)
    window.scrollTo({ top: 0 })
  }

  if (envio.fase === 'listo') {
    return (
      <main className="scroll">
        <div className="view hacienda">
          <div className="exito exito--hacienda" role="status">
            <span className="exito-ic">
              <i className="fas fa-circle-check" aria-hidden />
            </span>
            <h2 className="exito-tit">¡Movimiento registrado con éxito!</h2>
            <p className="exito-txt">
              Se registró <strong>{envio.nombre}</strong> en el tablero de Movimientos.
            </p>
            <div className="acciones-bloque exito-acciones">
              <button type="button" className="btn btn-primary" onClick={otro}>
                <i className="fas fa-plus" aria-hidden /> Registrar otro movimiento
              </button>
              <button type="button" className="btn btn-out" onClick={onVerDashboard}>
                <i className="fas fa-chart-column" aria-hidden /> Ver el dashboard
              </button>
              <a
                className="btn btn-out"
                href={`https://belauzaransa.monday.com/boards/${TABLERO_MOVIMIENTOS}/pulses/${envio.itemId}`}
                target="_blank"
                rel="noreferrer"
              >
                <i className="fas fa-arrow-up-right-from-square" aria-hidden /> Ver en monday
              </a>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const opCategorias: OpcionSelector[] = categoriasPara(opciones, b.subtipo).map((c) => ({ id: c, nombre: c }))
  const opOrigenes: OpcionSelector[] = origenesPosibles(opciones).map((o) => ({
    id: o,
    nombre: o,
    detalle: `Pasa a ${destinosPara(opciones, o).join(' o ')}`,
  }))
  const opDestinos: OpcionSelector[] = destinosPara(opciones, b.origen).map((d) => ({ id: d, nombre: d }))
  const opCampos: OpcionSelector[] = campos.map((c) => ({ id: c.id, nombre: c.nombre }))
  const enviando = envio.fase === 'enviando'
  const categoriaCompleta =
    b.clase === 'cambio' ? Boolean(b.origen && b.destino) : Boolean(b.categoria)
  const datosCompletos = Boolean(b.campoId && b.cantidad && b.responsable.trim().length >= 3)

  return (
    <>
      <main className="scroll">
        <div className="view hacienda hc-form">
          <Seccion numero={1} titulo="¿Qué tipo de movimiento es?" ayuda="Elegí una sola opción." completa={tipo != null}>
            <div className="opciones opciones--3" role="radiogroup" aria-label="Tipo de movimiento">
              <Opcion
                grande
                color="ingreso"
                icono="arrow-trend-up"
                titulo="Ingreso"
                detalle="Compra o nacimiento"
                activa={b.clase === 'ingreso'}
                apagada={b.clase != null && b.clase !== 'ingreso'}
                onElegir={() => cambiar({ clase: 'ingreso' })}
              />
              <Opcion
                grande
                color="egreso"
                icono="arrow-trend-down"
                titulo="Egreso"
                detalle="Venta o muerte"
                activa={b.clase === 'egreso'}
                apagada={b.clase != null && b.clase !== 'egreso'}
                onElegir={() => cambiar({ clase: 'egreso' })}
              />
              <Opcion
                grande
                color="cambio"
                icono="arrows-rotate"
                titulo="Cambio de categoría"
                detalle="Recategorización"
                activa={b.clase === 'cambio'}
                apagada={b.clase != null && b.clase !== 'cambio'}
                onElegir={() => cambiar({ clase: 'cambio' })}
              />
            </div>

            {(b.clase === 'ingreso' || b.clase === 'egreso') && (
              <div className="hc-subtipo">
                <span className="ig-lbl ig-req">{b.clase === 'ingreso' ? 'Tipo de ingreso' : 'Tipo de egreso'}</span>
                <div className="opciones opciones--2" role="radiogroup">
                  {(b.clase === 'ingreso' ? (['Compra', 'Nacimiento'] as const) : (['Venta', 'Muerte'] as const)).map((s) => (
                    <Opcion
                      key={s}
                      color={s.toLowerCase()}
                      icono={{ Compra: 'cart-shopping', Nacimiento: 'baby', Venta: 'hand-holding-dollar', Muerte: 'skull-crossbones' }[s]}
                      titulo={s}
                      detalle={s === 'Nacimiento' ? 'Sólo terneros o terneras' : undefined}
                      activa={b.subtipo === s}
                      apagada={b.subtipo != null && b.subtipo !== s}
                      onElegir={() => cambiar({ subtipo: s })}
                    />
                  ))}
                </div>
              </div>
            )}
          </Seccion>

          {tipo && b.clase !== 'cambio' && (
            <Seccion
              numero={2}
              titulo="Categoría"
              ayuda={b.subtipo === 'Nacimiento' ? 'En un nacimiento sólo pueden ser terneros o terneras.' : 'Categoría de los animales.'}
              completa={categoriaCompleta}
            >
              <SelectorBuscable
                opciones={opCategorias}
                valor={b.categoria}
                onCambio={(id) => cambiar({ categoria: id })}
                placeholder="Elegí la categoría…"
              />
            </Seccion>
          )}

          {b.clase === 'cambio' && (
            <Seccion
              numero={2}
              titulo="Cambio de categoría"
              ayuda="De qué categoría pasan y a cuál. Sólo se ofrece la categoría que sigue en el crecimiento del animal."
              completa={categoriaCompleta}
            >
              <div className="hc-cambio">
                <div className="ig">
                  <span className="ig-lbl ig-req">Categoría de origen</span>
                  <SelectorBuscable
                    opciones={opOrigenes}
                    valor={b.origen}
                    onCambio={(id) => cambiar({ origen: id })}
                    placeholder="De qué categoría pasan…"
                  />
                </div>
                <i className="fas fa-arrow-right hc-cambio-flecha" aria-hidden />
                <div className="ig">
                  <span className="ig-lbl ig-req">Categoría de destino</span>
                  <SelectorBuscable
                    opciones={opDestinos}
                    valor={b.destino}
                    onCambio={(id) => cambiar({ destino: id })}
                    placeholder="A qué categoría pasan…"
                    vacio="Elegí primero la categoría de origen."
                  />
                  {b.origen && opDestinos.length === 1 && (
                    <span className="ig-hint">{b.origen} sólo puede pasar a {opDestinos[0].nombre}: se eligió solo.</span>
                  )}
                </div>
              </div>
            </Seccion>
          )}

          {tipo && (
            <Seccion numero={3} titulo="Datos del movimiento" completa={datosCompletos && faltantes.length === 0}>
              <div className="grid-campos">
                <div className="ig">
                  <span className="ig-lbl ig-req">Campo</span>
                  <SelectorBuscable opciones={opCampos} valor={b.campoId} onCambio={(id) => cambiar({ campoId: id })} placeholder="Elegí el campo…" />
                </div>
                <label className="ig">
                  <span className="ig-lbl ig-req">Fecha del movimiento</span>
                  <input className="fc" type="date" value={b.fecha} max={hoyIso()} onChange={(e) => cambiar({ fecha: e.target.value })} />
                  <span className="ig-hint">No puede ser una fecha futura.</span>
                </label>
                <label className="ig">
                  <span className="ig-lbl ig-req">Cantidad</span>
                  <div className="fc-sufijo">
                    <input
                      className="fc"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      value={b.cantidad}
                      // Sólo números enteros: lo que no es un dígito no entra.
                      onChange={(e) => cambiar({ cantidad: e.target.value.replace(/\D/g, '') })}
                    />
                    <span>cabezas</span>
                  </div>
                </label>
                <label className="ig">
                  <span className="ig-lbl ig-req">Responsable</span>
                  <input
                    className="fc"
                    value={b.responsable}
                    maxLength={100}
                    onChange={(e) => cambiar({ responsable: e.target.value })}
                    placeholder="Nombre y apellido"
                    autoComplete="name"
                  />
                  <span className="ig-hint">Se propone el usuario actual de monday; se puede cambiar.</span>
                </label>
              </div>
              <label className="ig" style={{ marginTop: 14 }}>
                <span className="ig-lbl">
                  Observaciones <span className="chip chip--opcional">Opcional</span>
                </span>
                <textarea
                  className="fc hc-textarea"
                  maxLength={2000}
                  value={b.observaciones}
                  onChange={(e) => cambiar({ observaciones: e.target.value })}
                  placeholder="Lote, caravanas, motivo, comprador…"
                />
              </label>
            </Seccion>
          )}

          {tipo && faltantes.length === 0 && (
            <div className="card card--summary">
              <div className="ctitle">
                <i className="fas fa-list-check" style={{ color: '#00874d' }} aria-hidden /> Se va a registrar este movimiento
              </div>
              <div className="resumen-grid" style={{ marginTop: 10 }}>
                <div className="resumen-dato">
                  <span className="resumen-lbl">Tipo</span>
                  <span className="resumen-val">{tipo}</span>
                </div>
                <div className="resumen-dato">
                  <span className="resumen-lbl">Categoría</span>
                  <span className="resumen-val">{b.clase === 'cambio' ? `${b.origen} → ${b.destino}` : b.categoria}</span>
                </div>
                <div className="resumen-dato">
                  <span className="resumen-lbl">Campo</span>
                  <span className="resumen-val">{campo?.nombre}</span>
                </div>
                <div className="resumen-dato">
                  <span className="resumen-lbl">Fecha</span>
                  <span className="resumen-val">{fecha(b.fecha)}</span>
                </div>
                <div className="resumen-dato">
                  <span className="resumen-lbl">Cantidad</span>
                  <span className="resumen-val">{Number(b.cantidad).toLocaleString('es-AR')} cabezas</span>
                </div>
                <div className="resumen-dato">
                  <span className="resumen-lbl">Responsable</span>
                  <span className="resumen-val">{b.responsable.trim()}</span>
                </div>
              </div>
            </div>
          )}

          {mostrarFaltantes && faltantes.length > 0 && (
            <div className="aviso aviso--error">
              <i className="fas fa-circle-exclamation" aria-hidden />
              <span>
                Para registrar falta:
                <ul style={{ margin: '6px 0 0 18px' }}>
                  {faltantes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </span>
            </div>
          )}
          {envio.fase === 'error' && (
            <div className="aviso aviso--error" style={{ marginTop: 12 }}>
              <i className="fas fa-circle-exclamation" aria-hidden />
              <span>No se pudo registrar el movimiento: {envio.mensaje}</span>
            </div>
          )}
        </div>
      </main>

      {pie(
        <>
          <span className={`footbar-msg ${mostrarFaltantes && faltantes.length ? 'footbar-msg--bloqueo' : ''}`}>
            <i className={`fas fa-${faltantes.length ? 'circle-exclamation' : 'circle-check'}`} aria-hidden />
            {enviando ? 'Registrando el movimiento…' : faltantes[0] ?? 'Todo completo: ya se puede registrar el movimiento.'}
          </span>
          <div className="footbar-acciones">
            <button type="button" className="btn btn-green" onClick={registrar} disabled={enviando}>
              {enviando ? (
                <>
                  <i className="fas fa-circle-notch fa-spin" aria-hidden /> Registrando…
                </>
              ) : (
                <>
                  <i className="fas fa-cloud-arrow-up" aria-hidden /> Registrar movimiento
                </>
              )}
            </button>
          </div>
        </>,
      )}
    </>
  )
}
