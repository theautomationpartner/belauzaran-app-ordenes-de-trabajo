import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BorradorCosecha, Catalogos, CosechaExistente } from '@/types'
import { Opcion } from '@/components/ui/Opcion'
import { Seccion } from '@/components/ui/Seccion'
import { fecha } from '@/lib/format'
import {
  borradorCosechaVacio,
  cambiarBorrador,
  columnasCosecha,
  faltantesCosecha,
  nombreCosecha,
  type ContextoCosecha,
} from '@/lib/cosecha'
import {
  crearCosecha,
  duplicarCosecha,
  marcarOrigenDuplicado,
  traerDatosCosecha,
  type DatosCosecha,
} from '@/services/monday/cosecha'
import { TABLERO_COSECHA } from '@/services/monday/columns'
import { FormCosecha } from './FormCosecha'
import { BuscadorCosechas } from './BuscadorCosechas'

type Modo = 'CREAR' | 'DUPLICAR'

interface Props {
  catalogos: Catalogos
  cabecera: (pasos: ReactNode) => ReactNode
  /** Ver `FlujoComprobante`: avisa a la app si hay algo a medio cargar. */
  onPendiente?: (mensaje: string | null) => void
}

type EstadoDatos =
  | { fase: 'cargando' }
  | { fase: 'listo'; datos: DatosCosecha }
  | { fase: 'error'; mensaje: string }

type EstadoEnvio =
  | { fase: 'inactivo' }
  | { fase: 'enviando' }
  | { fase: 'error'; mensaje: string }
  /** Todo escrito. En una duplicada, también la marca de la de origen. */
  | { fase: 'terminado'; modo: Modo; itemId: string; nombre: string; origen: CosechaExistente | null }
  /** La duplicada se creó, pero falta marcar la de origen como "Duplicado". */
  | {
      fase: 'incompleto'
      itemId: string
      nombre: string
      origen: CosechaExistente
      error: string
      reintentando: boolean
    }

const enlace = (itemId: string) => `https://belauzaransa.monday.com/boards/${TABLERO_COSECHA}/pulses/${itemId}`

/**
 * Operación "Registrar Cosecha": crear una cosecha nueva o duplicar una existente (arrancar el
 * formulario con sus datos, editar lo que cambie y crearla como una nueva). Las reglas son las
 * mismas en los dos casos; ver `lib/cosecha.ts`.
 */
export function FlujoCosecha({ catalogos, cabecera, onPendiente }: Props) {
  const [datos, setDatos] = useState<EstadoDatos>({ fase: 'cargando' })
  const [modo, setModo] = useState<Modo | null>(null)
  const [borrador, setBorrador] = useState<BorradorCosecha>(borradorCosechaVacio)
  /** Cosecha de la que se copian los datos (sólo al duplicar). */
  const [origen, setOrigen] = useState<CosechaExistente | null>(null)
  const [envio, setEnvio] = useState<EstadoEnvio>({ fase: 'inactivo' })
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false)

  const cargar = useCallback(() => {
    setDatos({ fase: 'cargando' })
    traerDatosCosecha()
      .then((d) => setDatos({ fase: 'listo', datos: d }))
      .catch((e: unknown) => setDatos({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) }))
  }, [])
  useEffect(() => cargar(), [cargar])

  const ctx: ContextoCosecha | null = useMemo(
    () => (datos.fase === 'listo' ? { catalogos, ...datos.datos } : null),
    [datos, catalogos],
  )

  const pendiente =
    envio.fase === 'enviando'
      ? 'Todavía se está creando la cosecha en monday.'
      : envio.fase === 'incompleto'
        ? 'La cosecha duplicada se creó, pero la original todavía no quedó marcada como Duplicado.'
        : null

  useEffect(() => {
    onPendiente?.(pendiente)
    if (!pendiente) return
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendiente, onPendiente])
  useEffect(() => () => onPendiente?.(null), [onPendiente])

  const cambiar = (parcial: Partial<BorradorCosecha>) => {
    if (!ctx) return
    setBorrador((prev) => cambiarBorrador(prev, parcial, ctx))
    setEnvio((e) => (e.fase === 'error' ? { fase: 'inactivo' } : e))
  }

  const elegirModo = (m: Modo) => {
    if (m === modo) return
    setModo(m)
    setOrigen(null)
    setBorrador(borradorCosechaVacio())
    setMostrarFaltantes(false)
    setEnvio({ fase: 'inactivo' })
  }

  /** Arranca el formulario con los datos de la cosecha elegida: es una copia, no la original. */
  const elegirOrigen = (c: CosechaExistente) => {
    setOrigen(c)
    setBorrador({ ...c.borrador, maquinariaIds: [...c.borrador.maquinariaIds], loteIds: [...c.borrador.loteIds] })
    setMostrarFaltantes(false)
    window.scrollTo({ top: 0 })
  }

  const reiniciar = () => {
    setModo(null)
    setOrigen(null)
    setBorrador(borradorCosechaVacio())
    setMostrarFaltantes(false)
    setEnvio({ fase: 'inactivo' })
  }

  const faltantes = ctx ? faltantesCosecha(borrador, ctx) : []
  const listoParaForm = modo === 'CREAR' || (modo === 'DUPLICAR' && origen != null)
  const bloqueado = !listoParaForm || faltantes.length > 0

  const crear = async () => {
    if (!ctx || bloqueado) {
      setMostrarFaltantes(true)
      return
    }
    const nombre = nombreCosecha(borrador, catalogos)
    const columnas = columnasCosecha(borrador)
    setEnvio({ fase: 'enviando' })
    try {
      if (modo === 'DUPLICAR' && origen) {
        const r = await duplicarCosecha(nombre, columnas, origen.id)
        setEnvio(
          r.origenMarcado
            ? { fase: 'terminado', modo: 'DUPLICAR', itemId: r.itemId, nombre, origen }
            : { fase: 'incompleto', itemId: r.itemId, nombre, origen, error: r.error ?? '', reintentando: false },
        )
      } else {
        const itemId = await crearCosecha(nombre, columnas)
        setEnvio({ fase: 'terminado', modo: 'CREAR', itemId, nombre, origen: null })
      }
    } catch (e: unknown) {
      // Falló el alta: no se creó nada y la original no se tocó. Se puede volver a intentar.
      setEnvio({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) })
    }
  }

  const reintentarMarca = async () => {
    if (envio.fase !== 'incompleto') return
    setEnvio({ ...envio, reintentando: true })
    try {
      await marcarOrigenDuplicado(envio.origen.id)
      setEnvio({ fase: 'terminado', modo: 'DUPLICAR', itemId: envio.itemId, nombre: envio.nombre, origen: envio.origen })
    } catch (e: unknown) {
      setEnvio({ ...envio, reintentando: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  /* ===== Resultado ===== */
  if (envio.fase === 'terminado' || envio.fase === 'incompleto') {
    const ok = envio.fase === 'terminado'
    const dup = envio.fase === 'incompleto' || envio.modo === 'DUPLICAR'
    return (
      <div className="app">
        {cabecera(null)}
        <main className="scroll">
          <div className="view cosecha">
            {ok ? (
              <div className="exito exito--cosecha" role="status">
                <span className="exito-ic">
                  <i className="fas fa-circle-check" aria-hidden />
                </span>
                <h2 className="exito-tit">{dup ? '¡Cosecha duplicada con éxito!' : '¡Cosecha creada con éxito!'}</h2>
                <p className="exito-txt">
                  Se creó <strong>{envio.nombre}</strong>.
                  {dup && envio.origen && (
                    <>
                      {' '}La original ({envio.origen.codigo || envio.origen.nombre}) quedó en <strong>Duplicado</strong>.
                    </>
                  )}{' '}
                  La automatización se encarga del resto.
                </p>
                <div className="acciones-bloque exito-acciones">
                  <button type="button" className="btn btn-primary" onClick={reiniciar}>
                    <i className="fas fa-plus" aria-hidden /> Registrar otra cosecha
                  </button>
                  <a className="btn btn-out" href={enlace(envio.itemId)} target="_blank" rel="noreferrer">
                    <i className="fas fa-arrow-up-right-from-square" aria-hidden /> Ver en monday
                  </a>
                </div>
              </div>
            ) : (
              <div className="card card--data">
                <div className="ctitle">
                  <i className="fas fa-triangle-exclamation" style={{ color: '#b25e09' }} aria-hidden />
                  Falta marcar la cosecha original como Duplicado
                </div>
                <div className="csub">
                  La cosecha nueva ya se creó, pero no se pudo marcar{' '}
                  {envio.origen.codigo || envio.origen.nombre} como Duplicado: {envio.error}
                </div>
                <div className="aviso aviso--warn" style={{ marginBottom: 14 }}>
                  <i className="fas fa-hand" aria-hidden />
                  <span>No cierres la app: reintentá hasta que diga que se duplicó con éxito. No se crea otra cosecha.</span>
                </div>
                <div className="acciones-bloque">
                  <button type="button" className="btn btn-green" onClick={reintentarMarca} disabled={envio.reintentando}>
                    {envio.reintentando ? (
                      <>
                        <i className="fas fa-circle-notch fa-spin" aria-hidden /> Reintentando…
                      </>
                    ) : (
                      <>
                        <i className="fas fa-rotate-right" aria-hidden /> Reintentar marcar Duplicado
                      </>
                    )}
                  </button>
                  <a className="btn btn-out" href={enlace(envio.itemId)} target="_blank" rel="noreferrer">
                    Ver la nueva en monday
                  </a>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  const enviando = envio.fase === 'enviando'
  const mensajePie = enviando
    ? 'Creando la cosecha en monday…'
    : !modo
      ? 'Elegí si vas a crear o duplicar una cosecha.'
      : modo === 'DUPLICAR' && !origen
        ? 'Buscá y elegí la cosecha a duplicar.'
        : faltantes[0] ?? 'Todo listo para crear la cosecha.'

  return (
    <div className="app">
      {cabecera(null)}

      <main className="scroll">
        <div className="view cosecha">
          <div className="header-section">
            <div className="step-badge" style={{ background: '#0e7c86' }}>
              <i className="fas fa-wheat-awn" style={{ fontSize: 13 }} aria-hidden />
            </div>
            <div className="step-details">
              <div className="step-title">Registrar Cosecha</div>
              <div className="step-desc">Creá una cosecha nueva o duplicá una existente para no cargar todo de nuevo.</div>
            </div>
          </div>

          <Seccion numero={1} titulo="¿Qué vas a hacer?" ayuda="Elegí una sola opción." completa={modo != null}>
            <div className="opciones opciones--2" role="radiogroup" aria-label="Crear o duplicar">
              <Opcion
                grande
                color="crear"
                icono="wheat-awn"
                titulo="Crear Cosecha"
                detalle="Cargar una cosecha nueva desde cero."
                activa={modo === 'CREAR'}
                apagada={modo === 'DUPLICAR'}
                onElegir={() => elegirModo('CREAR')}
              />
              <Opcion
                grande
                color="duplicar"
                icono="copy"
                titulo="Duplicar Cosecha"
                detalle="Copiar los datos de una existente y editar lo que cambie."
                activa={modo === 'DUPLICAR'}
                apagada={modo === 'CREAR'}
                onElegir={() => elegirModo('DUPLICAR')}
              />
            </div>
          </Seccion>

          {modo && datos.fase !== 'listo' && (
            <div className="card card--data" style={{ textAlign: 'center' }}>
              {datos.fase === 'cargando' ? (
                <p className="muted">Cargando depósitos…</p>
              ) : (
                <>
                  <p className="t-red" style={{ marginBottom: 10 }}>{datos.mensaje}</p>
                  <button type="button" className="btn btn-primary" onClick={cargar}>
                    <i className="fas fa-rotate-right" aria-hidden /> Reintentar
                  </button>
                </>
              )}
            </div>
          )}

          {ctx && modo === 'DUPLICAR' && !origen && (
            <BuscadorCosechas catalogos={catalogos} onElegir={elegirOrigen} />
          )}

          {ctx && modo === 'DUPLICAR' && origen && (
            <div className="origen">
              <i className="fas fa-copy origen-ic" aria-hidden />
              <span className="origen-body">
                <span className="origen-lbl">Duplicando</span>
                <span className="origen-nom">
                  {origen.codigo && <span className="cos-codigo">{origen.codigo}</span>}
                  {origen.nombre}
                </span>
                <span className="xs">
                  {fecha(origen.borrador.fecha)} · {origen.textos.campo || 'Sin campo'} · {origen.textos.deposito || 'Sin destino'}. Editá lo que
                  cambie: la original no se modifica, sólo queda marcada como Duplicado.
                </span>
              </span>
              <button type="button" className="btn btn-out btn--sm" onClick={() => setOrigen(null)}>
                <i className="fas fa-arrow-rotate-left" aria-hidden /> Elegir otra
              </button>
            </div>
          )}

          {ctx && listoParaForm && <FormCosecha borrador={borrador} onCambio={cambiar} ctx={ctx} desde={2} />}

          {mostrarFaltantes && listoParaForm && faltantes.length > 0 && (
            <div className="aviso aviso--error" style={{ marginTop: 4 }}>
              <i className="fas fa-circle-exclamation" aria-hidden />
              <span>
                Para crear la cosecha falta:
                <ul style={{ margin: '6px 0 0 18px' }}>
                  {faltantes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </span>
            </div>
          )}

          {enviando && (
            <div className="aviso aviso--warn" style={{ marginTop: 12 }}>
              <i className="fas fa-hourglass-half" aria-hidden />
              <span>
                <strong>No cierres la app</strong> hasta que aparezca el aviso de que se creó con éxito.
              </span>
            </div>
          )}
          {envio.fase === 'error' && (
            <div className="aviso aviso--error" style={{ marginTop: 12 }}>
              <i className="fas fa-circle-exclamation" aria-hidden />
              <span>No se pudo crear la cosecha: {envio.mensaje}</span>
            </div>
          )}
        </div>
      </main>

      <footer className="footbar">
        <div className="footbar-in">
          <span className="version" title="Versión desplegada">
            {__COMMIT__}
          </span>
          <span className={`footbar-msg ${mostrarFaltantes && bloqueado ? 'footbar-msg--bloqueo' : ''}`}>
            <i className={`fas fa-${bloqueado ? 'circle-exclamation' : 'circle-check'}`} aria-hidden />
            {mensajePie}
          </span>
          <div className="footbar-acciones">
            <button
              type="button"
              className="btn btn-green"
              disabled={enviando || !listoParaForm}
              onClick={crear}
            >
              {enviando ? (
                <>
                  <i className="fas fa-circle-notch fa-spin" aria-hidden /> Creando…
                </>
              ) : (
                <>
                  <i className="fas fa-cloud-arrow-up" aria-hidden />{' '}
                  {modo === 'DUPLICAR' ? 'Crear cosecha duplicada' : 'Crear cosecha'}
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
