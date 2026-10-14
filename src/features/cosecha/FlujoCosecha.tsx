import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BorradorCosecha, Catalogos, CosechaExistente, Deposito, Proveedor } from '@/types'
import { Opcion } from '@/components/ui/Opcion'
import { Seccion } from '@/components/ui/Seccion'
import { fecha, plural } from '@/lib/format'
import {
  borradorCosechaVacio,
  cambiarBorrador,
  columnasCosecha,
  faltantesCosecha,
  nombreCosecha,
  type ContextoCosecha,
} from '@/lib/cosecha'
import { ID_DEPOSITO_NUEVO, ID_PROVEEDOR_NUEVO, type BorradorProveedor } from '@/lib/altas'
import {
  crearCosecha,
  duplicarCosecha,
  marcarOrigenDuplicado,
  traerDatosCosecha,
  type DatosCosecha,
} from '@/services/monday/cosecha'
import { crearDeposito, crearProveedor, type DepositoPendiente } from '@/services/monday/altas'
import {
  PROVEEDOR_ACTIVO,
  PROVEEDOR_TIPO_FLETES,
  TABLERO_COSECHA,
  TRANSPORTE_CONTRATADO,
} from '@/services/monday/columns'
import { FormCosecha } from './FormCosecha'
import { BuscadorCosechas } from './BuscadorCosechas'
import { ModalProveedor } from '@/features/altas/ModalProveedor'
import { ModalDeposito } from '@/features/altas/ModalDeposito'

type Modo = 'CREAR' | 'DUPLICAR'

interface Props {
  catalogos: Catalogos
  cabecera: (pasos: ReactNode) => ReactNode
  /** Ver `FlujoComprobante`: avisa a la app si hay algo a medio cargar. */
  onPendiente?: (mensaje: string | null) => void
  /**
   * Suma a los catálogos de la app lo que se crea acá (un proveedor, sus contactos), para que
   * aparezca en esta operación y en las demás sin recargar.
   */
  onCatalogos: (cambio: (c: Catalogos) => Catalogos) => void
}

type EstadoDatos =
  | { fase: 'cargando' }
  | { fase: 'listo'; datos: DatosCosecha }
  | { fase: 'error'; mensaje: string }

type EstadoEnvio =
  | { fase: 'inactivo' }
  /** `etapa` dice qué se está creando: proveedor, destino o la cosecha. */
  | { fase: 'enviando'; etapa: string }
  | { fase: 'error'; mensaje: string }
  /** Todo escrito. En una duplicada, también la marca de la de origen. */
  | {
      fase: 'terminado'
      modo: Modo
      itemId: string
      nombre: string
      origen: CosechaExistente | null
      /** Lo que se creó además de la cosecha (proveedor, contactos, destino) y avisos. */
      extras: string[]
    }
  /** La duplicada se creó, pero falta marcar la de origen como "Duplicado". */
  | {
      fase: 'incompleto'
      itemId: string
      nombre: string
      origen: CosechaExistente
      error: string
      reintentando: boolean
      extras: string[]
    }

const enlace = (itemId: string) => `https://belauzaransa.monday.com/boards/${TABLERO_COSECHA}/pulses/${itemId}`
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))
const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es')

/**
 * Operación "Registrar Cosecha": crear una cosecha nueva o duplicar una existente (arrancar el
 * formulario con sus datos, editar lo que cambie y crearla como una nueva). Las reglas son las
 * mismas en los dos casos; ver `lib/cosecha.ts`.
 *
 * Si el proveedor del flete o el destino no existen, se cargan en una ventana y quedan elegidos,
 * pero NO se crean en monday hasta que se confirma la cosecha. Mientras tanto viven acá como
 * "pendientes" con un id provisorio, y se muestran y validan como cualquier otro.
 */
export function FlujoCosecha({ catalogos, cabecera, onPendiente, onCatalogos }: Props) {
  const [datos, setDatos] = useState<EstadoDatos>({ fase: 'cargando' })
  const [modo, setModo] = useState<Modo | null>(null)
  const [borrador, setBorrador] = useState<BorradorCosecha>(borradorCosechaVacio)
  /** Cosecha de la que se copian los datos (sólo al duplicar). */
  const [origen, setOrigen] = useState<CosechaExistente | null>(null)
  const [envio, setEnvio] = useState<EstadoEnvio>({ fase: 'inactivo' })
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false)
  /** Ventana de alta abierta. */
  const [alta, setAlta] = useState<'proveedor' | 'deposito' | null>(null)
  /** Proveedor y destino cargados en su ventana, a crear cuando se confirme la cosecha. */
  const [proveedorNuevo, setProveedorNuevo] = useState<BorradorProveedor | null>(null)
  const [depositoNuevo, setDepositoNuevo] = useState<DepositoPendiente | null>(null)
  /** Aviso de lo último que se cargó en una ventana. */
  const [avisoAlta, setAvisoAlta] = useState<{ tipo: 'ok' | 'warn'; texto: string } | null>(null)

  const cargar = useCallback(() => {
    setDatos({ fase: 'cargando' })
    traerDatosCosecha()
      .then((d) => setDatos({ fase: 'listo', datos: d }))
      .catch((e: unknown) => setDatos({ fase: 'error', mensaje: mensaje(e) }))
  }, [])
  useEffect(() => cargar(), [cargar])

  /* Los pendientes entran a los catálogos con su id provisorio: así el selector los ofrece, el
     formulario los muestra elegidos y las validaciones (tipo Fletes, depósito del cultivo) los
     tratan igual que a uno real. */
  const ctx: ContextoCosecha | null = useMemo(() => {
    if (datos.fase !== 'listo') return null
    const proveedores: Proveedor[] = proveedorNuevo
      ? [
          ...catalogos.proveedores,
          {
            id: ID_PROVEEDOR_NUEVO,
            nombre: proveedorNuevo.nombreCompleto.trim(),
            estado: PROVEEDOR_ACTIVO,
            cuit: proveedorNuevo.cuit,
            tipos: proveedorNuevo.tipos,
            contactoIds: proveedorNuevo.contactoIds,
          },
        ]
      : catalogos.proveedores
    const depositos: Deposito[] = depositoNuevo
      ? [
          ...datos.datos.depositos,
          {
            id: ID_DEPOSITO_NUEVO,
            nombre: `${depositoNuevo.cultivo.nombre} - ${depositoNuevo.silo.nombre}`,
            cultivoIds: [depositoNuevo.cultivo.id],
            siloIds: [depositoNuevo.silo.id],
            estado: 'Activo',
          },
        ]
      : datos.datos.depositos
    return { ...datos.datos, catalogos: { ...catalogos, proveedores }, depositos }
  }, [datos, catalogos, proveedorNuevo, depositoNuevo])

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
    setAvisoAlta(null)
  }

  /** Arranca el formulario con los datos de la cosecha elegida: es una copia, no la original. */
  const elegirOrigen = (c: CosechaExistente) => {
    setOrigen(c)
    setBorrador({ ...c.borrador, maquinariaIds: [...c.borrador.maquinariaIds], loteIds: [...c.borrador.loteIds] })
    setMostrarFaltantes(false)
    window.scrollTo({ top: 0 })
  }

  /** Proveedor cargado en la ventana: queda elegido, todavía sin crear. */
  const proveedorListo = (p: BorradorProveedor) => {
    setProveedorNuevo(p)
    setAlta(null)
    const esFlete = p.tipos.includes(PROVEEDOR_TIPO_FLETES)
    if (esFlete) setBorrador((b) => ({ ...b, proveedorId: ID_PROVEEDOR_NUEVO }))
    else setBorrador((b) => (b.proveedorId === ID_PROVEEDOR_NUEVO ? { ...b, proveedorId: null } : b))
    setAvisoAlta(
      esFlete
        ? { tipo: 'ok', texto: `"${p.nombreCompleto.trim()}" quedó elegido. Se crea en monday cuando confirmes la cosecha.` }
        : { tipo: 'warn', texto: `"${p.nombreCompleto.trim()}" no es de tipo Fletes, así que no se puede usar en este flete.` },
    )
  }

  /** Destino cargado en la ventana: queda elegido si es del cultivo de la cosecha, sin crear. */
  const depositoListo = (d: DepositoPendiente) => {
    setDepositoNuevo(d)
    setAlta(null)
    const apto = borrador.cultivoId === d.cultivo.id
    const nombre = `${d.cultivo.nombre} - ${d.silo.nombre}`
    if (apto) setBorrador((b) => ({ ...b, depositoId: ID_DEPOSITO_NUEVO }))
    else setBorrador((b) => (b.depositoId === ID_DEPOSITO_NUEVO ? { ...b, depositoId: null } : b))
    setAvisoAlta(
      apto
        ? { tipo: 'ok', texto: `"${nombre}" quedó elegido. Se crea en monday cuando confirmes la cosecha.` }
        : { tipo: 'warn', texto: `"${nombre}" es de otro cultivo, así que no se puede usar en esta cosecha.` },
    )
  }

  /** Tira el proveedor nuevo: no se crea, y si estaba elegido el flete queda sin proveedor. */
  const descartarProveedor = () => {
    setProveedorNuevo(null)
    setBorrador((b) => (b.proveedorId === ID_PROVEEDOR_NUEVO ? { ...b, proveedorId: null } : b))
    setAvisoAlta(null)
  }

  /** Tira el destino nuevo: no se crea, y si estaba elegido la cosecha queda sin destino. */
  const descartarDeposito = () => {
    setDepositoNuevo(null)
    setBorrador((b) => (b.depositoId === ID_DEPOSITO_NUEVO ? { ...b, depositoId: null } : b))
    setAvisoAlta(null)
  }

  const reiniciar = () => {
    setModo(null)
    setOrigen(null)
    setBorrador(borradorCosechaVacio())
    setMostrarFaltantes(false)
    setEnvio({ fase: 'inactivo' })
    setProveedorNuevo(null)
    setDepositoNuevo(null)
    setAvisoAlta(null)
  }

  const faltantes = ctx ? faltantesCosecha(borrador, ctx) : []
  const listoParaForm = modo === 'CREAR' || (modo === 'DUPLICAR' && origen != null)
  const bloqueado = !listoParaForm || faltantes.length > 0

  /**
   * Confirma la cosecha. Recién acá se crea lo pendiente, en este orden: el proveedor (y sus
   * contactos), el destino y por último la cosecha, que ya los conecta con sus ids reales.
   *
   * Sólo se crea lo pendiente que la cosecha USA: un proveedor cargado y después reemplazado (o
   * que quedó de un flete contratado cuando al final es propio) no se crea.
   *
   * Cada cosa creada se guarda en el momento como real: si después falla la cosecha, reintentar no
   * vuelve a crear el proveedor ni el destino.
   */
  const crear = async () => {
    if (!ctx || bloqueado) {
      setMostrarFaltantes(true)
      return
    }
    let b = borrador
    const extras: string[] = []
    try {
      if (b.transporte === TRANSPORTE_CONTRATADO && b.proveedorId === ID_PROVEEDOR_NUEVO && proveedorNuevo) {
        setEnvio({ fase: 'enviando', etapa: 'Creando el proveedor…' })
        const r = await crearProveedor(proveedorNuevo)
        onCatalogos((c) => ({
          ...c,
          proveedores: [...c.proveedores, r.proveedor].sort(porNombre),
          contactos: [...c.contactos, ...r.contactos].sort(porNombre),
        }))
        b = { ...b, proveedorId: r.proveedor.id }
        setBorrador(b)
        setProveedorNuevo(null)
        extras.push(
          `Se creó el proveedor "${r.proveedor.nombre}"` +
            (r.contactos.length ? ` con ${plural(r.contactos.length, 'contacto nuevo', 'contactos nuevos')}.` : '.'),
        )
        if (r.fallidos.length > 0) {
          extras.push(
            `No se pudo crear ${r.fallidos.map((f) => `"${f.contacto.nombre} ${f.contacto.apellido}"`).join(', ')}: cargalo a mano en ✋ Contactos.`,
          )
        }
      }

      if (b.depositoId === ID_DEPOSITO_NUEVO && depositoNuevo) {
        setEnvio({ fase: 'enviando', etapa: 'Creando el destino de granos…' })
        const d = await crearDeposito(depositoNuevo.borrador, depositoNuevo.cultivo, depositoNuevo.silo)
        setDatos((x) =>
          x.fase === 'listo' ? { fase: 'listo', datos: { ...x.datos, depositos: [...x.datos.depositos, d].sort(porNombre) } } : x,
        )
        b = { ...b, depositoId: d.id }
        setBorrador(b)
        setDepositoNuevo(null)
        extras.push(`Se creó el destino "${d.nombre}".`)
      }
    } catch (e: unknown) {
      setEnvio({
        fase: 'error',
        mensaje: `${mensaje(e)}${extras.length ? ` (${extras.join(' ')} La cosecha todavía no se creó: reintentá.)` : ' No se creó nada: reintentá.'}`,
      })
      return
    }

    const nombre = nombreCosecha(b, catalogos)
    const columnas = columnasCosecha(b)
    setEnvio({ fase: 'enviando', etapa: 'Creando la cosecha…' })
    try {
      if (modo === 'DUPLICAR' && origen) {
        const r = await duplicarCosecha(nombre, columnas, origen.id)
        setEnvio(
          r.origenMarcado
            ? { fase: 'terminado', modo: 'DUPLICAR', itemId: r.itemId, nombre, origen, extras }
            : { fase: 'incompleto', itemId: r.itemId, nombre, origen, error: r.error ?? '', reintentando: false, extras },
        )
      } else {
        const itemId = await crearCosecha(nombre, columnas)
        setEnvio({ fase: 'terminado', modo: 'CREAR', itemId, nombre, origen: null, extras })
      }
    } catch (e: unknown) {
      // La cosecha no se creó y la original no se tocó. Lo que se creó antes ya quedó como real.
      setEnvio({
        fase: 'error',
        mensaje: `${mensaje(e)}${extras.length ? ` (${extras.join(' ')} Ya quedó elegido: al reintentar no se vuelve a crear.)` : ''}`,
      })
    }
  }

  const reintentarMarca = async () => {
    if (envio.fase !== 'incompleto') return
    setEnvio({ ...envio, reintentando: true })
    try {
      await marcarOrigenDuplicado(envio.origen.id)
      setEnvio({
        fase: 'terminado',
        modo: 'DUPLICAR',
        itemId: envio.itemId,
        nombre: envio.nombre,
        origen: envio.origen,
        extras: envio.extras,
      })
    } catch (e: unknown) {
      setEnvio({ ...envio, reintentando: false, error: mensaje(e) })
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
                {envio.extras.length > 0 && (
                  <ul className="exito-extras">
                    {envio.extras.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
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
  /* Lo nuevo que efectivamente se va a crear al confirmar, para decirlo antes del botón. */
  const seCreaProveedor = borrador.transporte === TRANSPORTE_CONTRATADO && borrador.proveedorId === ID_PROVEEDOR_NUEVO
  const seCreaDeposito = borrador.depositoId === ID_DEPOSITO_NUEVO
  const tambien = [seCreaProveedor && 'el proveedor nuevo', seCreaDeposito && 'el destino nuevo'].filter(Boolean)
  const mensajePie = enviando
    ? envio.etapa
    : !modo
      ? 'Elegí si vas a crear o duplicar una cosecha.'
      : modo === 'DUPLICAR' && !origen
        ? 'Buscá y elegí la cosecha a duplicar.'
        : faltantes[0] ??
          (tambien.length ? `Todo listo. Al confirmar se crea también ${tambien.join(' y ')}.` : 'Todo listo para crear la cosecha.')

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

          {avisoAlta && (
            <div className={`aviso aviso--${avisoAlta.tipo === 'ok' ? 'ok' : 'warn'}`} style={{ marginBottom: 16 }}>
              <i className={`fas fa-${avisoAlta.tipo === 'ok' ? 'circle-check' : 'triangle-exclamation'}`} aria-hidden />
              <span style={{ flex: 1 }}>{avisoAlta.texto}</span>
              <button type="button" className="btn btn-ghost btn--sm" onClick={() => setAvisoAlta(null)} aria-label="Cerrar aviso">
                <i className="fas fa-xmark" aria-hidden />
              </button>
            </div>
          )}

          {ctx && listoParaForm && (
            <FormCosecha
              borrador={borrador}
              onCambio={cambiar}
              ctx={ctx}
              desde={2}
              proveedorNuevo={proveedorNuevo ? proveedorNuevo.nombreCompleto.trim() : null}
              depositoNuevo={depositoNuevo ? `${depositoNuevo.cultivo.nombre} - ${depositoNuevo.silo.nombre}` : null}
              onAgregarDeposito={() => setAlta('deposito')}
              onAgregarProveedor={() => setAlta('proveedor')}
              onDescartarDeposito={descartarDeposito}
              onDescartarProveedor={descartarProveedor}
            />
          )}

          {datos.fase === 'listo' && alta === 'proveedor' && (
            <ModalProveedor
              proveedores={catalogos.proveedores}
              contactos={catalogos.contactos}
              tipos={datos.datos.alta.tiposProveedor}
              tipoSugerido={PROVEEDOR_TIPO_FLETES}
              inicial={proveedorNuevo}
              onListo={proveedorListo}
              onCerrar={() => setAlta(null)}
            />
          )}
          {datos.fase === 'listo' && alta === 'deposito' && (
            <ModalDeposito
              cultivos={catalogos.cultivos}
              cultivoInicial={borrador.cultivoId}
              silos={datos.datos.alta.silos}
              depositos={datos.datos.depositos}
              inicial={depositoNuevo?.borrador}
              onListo={depositoListo}
              onCerrar={() => setAlta(null)}
            />
          )}

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
