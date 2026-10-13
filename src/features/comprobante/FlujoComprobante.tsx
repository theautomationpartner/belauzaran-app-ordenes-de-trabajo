import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { motivoPeso, motivoRechazo, prepararArchivo, peso } from '@/lib/archivos'
import {
  crearFactura,
  crearRemito,
  columnaArchivoRemito,
  reintentarArchivo,
  traerDatosRemito,
  type DatosRemito,
  type ResultadoAlta,
} from '@/services/monday/comprobantes'
import { COL_FACTURA, TABLERO_FACTURAS, TABLERO_REMITOS } from '@/services/monday/columns'
import { SelectorArchivo } from './SelectorArchivo'

type Tipo = 'REMITO' | 'FACTURA'
type Formato = 'PDF' | 'JPEG'

interface Props {
  cabecera: (pasos: ReactNode) => ReactNode
}

type EstadoDatos =
  | { fase: 'cargando' }
  | { fase: 'listo'; datos: DatosRemito }
  | { fase: 'error'; mensaje: string }

type EstadoEnvio =
  | { fase: 'inactivo' }
  | { fase: 'enviando'; etapa: string }
  | { fase: 'terminado'; tipo: Tipo; resultado: ResultadoAlta; columna: string; archivo: File }
  | { fase: 'error'; mensaje: string }

const iniciales = (nombre: string) =>
  nombre
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

/** Encabezado numerado de cada bloque del formulario. */
function Seccion({
  numero,
  titulo,
  ayuda,
  completa,
  children,
}: {
  numero: number
  titulo: string
  ayuda?: string
  completa: boolean
  children: ReactNode
}) {
  return (
    <section className={`card card--input seccion ${completa ? 'seccion--completa' : ''}`}>
      <div className="seccion-head">
        <span className="seccion-num">{completa ? <i className="fas fa-check" aria-hidden /> : numero}</span>
        <span className="seccion-tit">
          {titulo}
          <span className="ig-req" aria-label="obligatorio" />
        </span>
      </div>
      {ayuda && <p className="seccion-ayuda">{ayuda}</p>}
      {children}
    </section>
  )
}

interface OpcionProps {
  activa: boolean
  /** Hay otra opción elegida: esta se apaga para que quede claro cuál vale. */
  apagada: boolean
  color: string
  icono: string
  titulo: string
  detalle?: string
  onElegir: () => void
  grande?: boolean
}

/** Tarjeta de elección única (radio): se pinta entera con su color cuando está elegida. */
function Opcion({ activa, apagada, color, icono, titulo, detalle, onElegir, grande }: OpcionProps) {
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

/**
 * Operación "Registrar Remito / Factura": se elige qué se sube y se crea el item en su tablero con
 * el archivo adjunto. Es un formulario de una sola pantalla en bloques numerados: son pocos datos
 * y en el celular se completa de arriba abajo sin saltar entre pasos.
 */
export function FlujoComprobante({ cabecera }: Props) {
  const [datos, setDatos] = useState<EstadoDatos>({ fase: 'cargando' })
  const [tipo, setTipo] = useState<Tipo | null>(null)
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [destinoId, setDestinoId] = useState<string | null>(null)
  const [formato, setFormato] = useState<Formato | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  /** Explica por qué se sacó el archivo al cambiar de formato o de tipo. */
  const [avisoArchivo, setAvisoArchivo] = useState<string | null>(null)
  const [envio, setEnvio] = useState<EstadoEnvio>({ fase: 'inactivo' })
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false)

  const cargar = useCallback(() => {
    setDatos({ fase: 'cargando' })
    traerDatosRemito()
      .then((d) => setDatos({ fase: 'listo', datos: d }))
      .catch((e: unknown) => setDatos({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) }))
  }, [])
  useEffect(() => cargar(), [cargar])

  /** Formato de archivo que corresponde a lo elegido. La factura es siempre PDF. */
  const formatoArchivo = tipo === 'FACTURA' ? 'pdf' : formato === 'PDF' ? 'pdf' : formato === 'JPEG' ? 'imagen' : null

  /**
   * Cambiar de tipo o de formato puede dejar al archivo cargado fuera de lugar (una foto con PDF
   * elegido). En ese caso se saca y se dice por qué, en vez de subir algo que no corresponde.
   */
  const revisarArchivo = (nuevoFormato: 'pdf' | 'imagen' | null) => {
    if (!archivo) return
    if (!nuevoFormato) {
      setArchivo(null)
      return
    }
    const motivo = motivoRechazo(archivo, nuevoFormato)
    if (motivo) {
      setArchivo(null)
      setAvisoArchivo(`Se quitó el archivo que habías elegido: ${motivo}`)
    }
  }

  const elegirTipo = (t: Tipo) => {
    if (t === tipo) return
    setTipo(t)
    setEnvio({ fase: 'inactivo' })
    setMostrarFaltantes(false)
    setAvisoArchivo(null)
    revisarArchivo(t === 'FACTURA' ? 'pdf' : formato === 'PDF' ? 'pdf' : formato === 'JPEG' ? 'imagen' : null)
  }

  const elegirFormato = (f: Formato) => {
    setFormato(f)
    setAvisoArchivo(null)
    revisarArchivo(f === 'PDF' ? 'pdf' : 'imagen')
  }

  const cambiarArchivo = (f: File | null) => {
    setArchivo(f)
    setAvisoArchivo(null)
  }

  const lista = datos.fase === 'listo' ? datos.datos : null
  const persona = lista?.personas.find((p) => p.id === personaId) ?? null
  const destino = lista?.destinos.find((d) => d.id === destinoId) ?? null

  const faltantes: string[] = []
  if (!tipo) faltantes.push('Elegí si vas a registrar un remito o una factura.')
  if (tipo === 'REMITO') {
    if (!persona) faltantes.push('Elegí la persona.')
    if (!destino) faltantes.push('Elegí el destino de almacenamiento.')
    if (!formato) faltantes.push('Elegí si el remito es PDF o JPEG.')
  }
  if (tipo && (tipo === 'FACTURA' || formato) && !archivo) {
    faltantes.push(tipo === 'FACTURA' ? 'Subí la factura en PDF.' : `Subí el remito en ${formato}.`)
  }
  const bloqueado = faltantes.length > 0

  const reiniciar = () => {
    setTipo(null)
    setPersonaId(null)
    setDestinoId(null)
    setFormato(null)
    setArchivo(null)
    setAvisoArchivo(null)
    setEnvio({ fase: 'inactivo' })
    setMostrarFaltantes(false)
  }

  const crear = async () => {
    if (bloqueado || !tipo || !archivo || !formatoArchivo) {
      setMostrarFaltantes(true)
      return
    }
    // Un PDF pesado no se puede achicar acá: se frena antes de crear nada.
    const pesoMal = formatoArchivo === 'pdf' ? motivoPeso(archivo) : null
    if (pesoMal) {
      setEnvio({ fase: 'error', mensaje: pesoMal })
      return
    }

    try {
      setEnvio({ fase: 'enviando', etapa: 'Preparando el archivo…' })
      const listo = await prepararArchivo(archivo, formatoArchivo)

      setEnvio({ fase: 'enviando', etapa: tipo === 'REMITO' ? 'Creando el remito…' : 'Creando la factura…' })
      const resultado =
        tipo === 'REMITO'
          ? await crearRemito({ persona: persona!, destino: destino!, formato: formato!, archivo: listo })
          : await crearFactura(listo)
      const columna = tipo === 'REMITO' ? columnaArchivoRemito(formato!) : COL_FACTURA.archivo
      setEnvio({ fase: 'terminado', tipo, resultado, columna, archivo: listo })
    } catch (e: unknown) {
      setEnvio({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) })
    }
  }

  const reintentar = async () => {
    if (envio.fase !== 'terminado') return
    const { resultado, columna, archivo: f, tipo: t } = envio
    setEnvio({ fase: 'enviando', etapa: 'Subiendo el archivo de nuevo…' })
    const r = await reintentarArchivo(resultado.itemId, columna, f)
    setEnvio({ fase: 'terminado', tipo: t, resultado: r, columna, archivo: f })
  }

  if (envio.fase === 'terminado') {
    const { resultado, tipo: t } = envio
    const tablero = t === 'REMITO' ? TABLERO_REMITOS : TABLERO_FACTURAS
    const ok = !resultado.errorArchivo
    return (
      <div className="app">
        {cabecera(null)}
        <main className="scroll">
          <div className="view">
            <div className={`card ${ok ? 'card--summary' : 'card--data'}`}>
              <div className="ctitle">
                <i
                  className={`fas fa-${ok ? 'circle-check' : 'triangle-exclamation'}`}
                  style={{ color: ok ? '#00874d' : '#b25e09' }}
                  aria-hidden
                />
                {t === 'REMITO' ? 'Remito registrado' : 'Factura registrada'}
                {!ok && ' sin el archivo'}
              </div>
              <div className="csub">
                {ok
                  ? `Se creó el item con el archivo "${envio.archivo.name}" adjunto.`
                  : `El item se creó, pero el archivo no se pudo subir: ${resultado.errorArchivo}`}
              </div>
              <div className="acciones-bloque">
                {!ok && (
                  <button type="button" className="btn btn-primary" onClick={reintentar}>
                    <i className="fas fa-rotate-right" aria-hidden /> Reintentar subir el archivo
                  </button>
                )}
                <button type="button" className={`btn ${ok ? 'btn-primary' : 'btn-out'}`} onClick={reiniciar}>
                  <i className="fas fa-plus" aria-hidden /> Registrar otro
                </button>
                <a
                  className="btn btn-out"
                  href={`https://belauzaransa.monday.com/boards/${tablero}/pulses/${resultado.itemId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i className="fas fa-arrow-up-right-from-square" aria-hidden /> Ver en monday
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const enviando = envio.fase === 'enviando'
  let n = 1

  return (
    <div className="app">
      {cabecera(null)}

      <main className="scroll">
        <div className="view comprobante">
          <div className="header-section">
            <div className="step-badge" style={{ background: '#2f6f4e' }}>
              <i className="fas fa-file-arrow-up" style={{ fontSize: 13 }} aria-hidden />
            </div>
            <div className="step-details">
              <div className="step-title">Registrar Remito / Factura</div>
              <div className="step-desc">Elegí qué vas a registrar, completá los datos y subí el archivo.</div>
            </div>
          </div>

          <Seccion numero={n++} titulo="¿Qué vas a registrar?" ayuda="Elegí una sola opción." completa={tipo != null}>
            <div className="opciones opciones--2" role="radiogroup" aria-label="Tipo de comprobante">
              <Opcion
                grande
                color="remito"
                icono="truck-ramp-box"
                titulo="REMITO"
                detalle="Retiro de productos en el proveedor. PDF o foto."
                activa={tipo === 'REMITO'}
                apagada={tipo === 'FACTURA'}
                onElegir={() => elegirTipo('REMITO')}
              />
              <Opcion
                grande
                color="factura"
                icono="file-invoice-dollar"
                titulo="FACTURA"
                detalle="Comprobante de compra. Sólo PDF."
                activa={tipo === 'FACTURA'}
                apagada={tipo === 'REMITO'}
                onElegir={() => elegirTipo('FACTURA')}
              />
            </div>
          </Seccion>

          {tipo === 'REMITO' && (
            <>
              {datos.fase !== 'listo' ? (
                <div className="card card--data" style={{ textAlign: 'center' }}>
                  {datos.fase === 'cargando' ? (
                    <p className="muted">Cargando personas y destinos…</p>
                  ) : (
                    <>
                      <p className="t-red" style={{ marginBottom: 10 }}>{datos.mensaje}</p>
                      <button type="button" className="btn btn-primary" onClick={cargar}>
                        <i className="fas fa-rotate-right" aria-hidden /> Reintentar
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <Seccion
                    numero={n++}
                    titulo="Persona"
                    ayuda="Quién registra el remito. Sólo aparecen las personas con acceso al tablero de remitos."
                    completa={persona != null}
                  >
                    <div className="opciones" role="radiogroup" aria-label="Persona">
                      {datos.datos.personas.map((p) => (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={p.id === personaId}
                          key={p.id}
                          className={`persona ${p.id === personaId ? 'persona--activa' : ''}`}
                          onClick={() => setPersonaId(p.id)}
                        >
                          <span className="persona-ava">{iniciales(p.nombre)}</span>
                          <span className="persona-nom">
                            {p.nombre}
                            {p.esInvitado && <span className="xs" style={{ display: 'block' }}>Invitado</span>}
                          </span>
                          {p.id === personaId && <i className="fas fa-circle-check persona-ok" aria-hidden />}
                        </button>
                      ))}
                    </div>
                  </Seccion>

                  <Seccion
                    numero={n++}
                    titulo="Destino de almacenamiento de productos"
                    completa={destino != null}
                  >
                    <div className="opciones opciones--3" role="radiogroup" aria-label="Destino">
                      {datos.datos.destinos.map((d) => (
                        <Opcion
                          key={d.id}
                          color="destino"
                          icono="warehouse"
                          titulo={d.nombre}
                          activa={d.id === destinoId}
                          apagada={destinoId != null && d.id !== destinoId}
                          onElegir={() => setDestinoId(d.id)}
                        />
                      ))}
                    </div>
                  </Seccion>

                  <Seccion
                    numero={n++}
                    titulo="¿El remito es PDF o JPEG?"
                    ayuda="Elegí una sola opción. Define qué archivo se puede subir."
                    completa={formato != null}
                  >
                    <div className="opciones opciones--2" role="radiogroup" aria-label="Formato del remito">
                      <Opcion
                        grande
                        color="pdf"
                        icono="file-pdf"
                        titulo="PDF"
                        detalle="El remito digital, en un archivo .pdf."
                        activa={formato === 'PDF'}
                        apagada={formato === 'JPEG'}
                        onElegir={() => elegirFormato('PDF')}
                      />
                      <Opcion
                        grande
                        color="jpeg"
                        icono="camera"
                        titulo="JPEG"
                        detalle="Una foto del remito (.jpg, .png…). No PDF."
                        activa={formato === 'JPEG'}
                        apagada={formato === 'PDF'}
                        onElegir={() => elegirFormato('JPEG')}
                      />
                    </div>
                  </Seccion>
                </>
              )}
            </>
          )}

          {formatoArchivo && (tipo === 'FACTURA' || datos.fase === 'listo') && (
            <Seccion
              numero={n++}
              titulo={
                tipo === 'FACTURA' ? 'Factura en PDF' : formato === 'PDF' ? 'Remito en PDF' : 'Foto del remito (JPEG)'
              }
              ayuda={
                formatoArchivo === 'pdf'
                  ? 'Asegurate de subir el documento en PDF: cualquier otro tipo de archivo se rechaza.'
                  : 'Asegurate de subir una foto del remito: los PDF se rechazan acá. Si es PDF, elegí ese formato arriba.'
              }
              completa={archivo != null}
            >
              <SelectorArchivo
                formato={formatoArchivo}
                archivo={archivo}
                onCambio={cambiarArchivo}
                aviso={avisoArchivo}
              />
            </Seccion>
          )}

          {/* Lo que se va a crear, a la vista antes de confirmar. */}
          {!bloqueado && tipo && archivo && (
            <div className="card card--summary">
              <div className="ctitle">
                <i className="fas fa-list-check" style={{ color: '#00874d' }} aria-hidden />
                {tipo === 'REMITO' ? 'Se va a crear este remito' : 'Se va a crear esta factura'}
              </div>
              <div className="resumen-grid" style={{ marginTop: 10 }}>
                {tipo === 'REMITO' ? (
                  <>
                    <div className="resumen-dato">
                      <span className="resumen-lbl">Persona</span>
                      <span className="resumen-val">{persona?.nombre}</span>
                    </div>
                    <div className="resumen-dato">
                      <span className="resumen-lbl">Destino</span>
                      <span className="resumen-val">{destino?.nombre}</span>
                    </div>
                    <div className="resumen-dato">
                      <span className="resumen-lbl">Tipo de archivo</span>
                      <span className="resumen-val">{formato}</span>
                    </div>
                  </>
                ) : (
                  <div className="resumen-dato">
                    <span className="resumen-lbl">Origen</span>
                    <span className="resumen-val">MANUAL</span>
                  </div>
                )}
                <div className="resumen-dato">
                  <span className="resumen-lbl">Archivo</span>
                  <span className="resumen-val" title={archivo.name}>
                    {archivo.name} ({peso(archivo.size)})
                  </span>
                </div>
              </div>
            </div>
          )}

          {mostrarFaltantes && bloqueado && (
            <div className="aviso aviso--error" style={{ marginTop: 4 }}>
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

          {envio.fase === 'error' && (
            <div className="aviso aviso--error" style={{ marginTop: 12 }}>
              <i className="fas fa-circle-exclamation" aria-hidden />
              <span>No se pudo registrar: {envio.mensaje}</span>
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
            {enviando ? envio.etapa : bloqueado ? faltantes[0] : 'Todo listo para registrar.'}
          </span>
          <div className="footbar-acciones">
            <button
              type="button"
              className="btn btn-green"
              disabled={enviando}
              onClick={() => (bloqueado ? setMostrarFaltantes(true) : crear())}
            >
              {enviando ? (
                <>
                  <i className="fas fa-circle-notch fa-spin" aria-hidden /> Registrando…
                </>
              ) : (
                <>
                  <i className="fas fa-cloud-arrow-up" aria-hidden />{' '}
                  {tipo === 'FACTURA' ? 'Registrar factura' : tipo === 'REMITO' ? 'Registrar remito' : 'Registrar'}
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
