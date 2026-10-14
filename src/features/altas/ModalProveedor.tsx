import { useState } from 'react'
import type { Contacto, Proveedor } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { SelectorMultiple } from '@/components/ui/SelectorMultiple'
import { SelectorUbicacion } from '@/components/ui/SelectorUbicacion'
import {
  contactoVacio,
  cuitCompleto,
  cuitVerifica,
  detalleContacto,
  faltantesContacto,
  faltantesProveedor,
  formatearCuit,
  mostrarWhatsapp,
  nombreContacto,
  normalizarWhatsapp,
  proveedorConCuit,
  proveedoresParecidos,
  type BorradorContacto,
  type BorradorProveedor,
} from '@/lib/altas'

let contador = 0
const nuevoUid = () => `c${++contador}`

function Faltan({ lista }: { lista: string[] }) {
  return (
    <div className="aviso aviso--error" style={{ marginTop: 12 }}>
      <i className="fas fa-circle-exclamation" aria-hidden />
      <span>
        Para continuar falta:
        <ul style={{ margin: '6px 0 0 18px' }}>
          {lista.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </span>
    </div>
  )
}

/* ===== Contacto ===== */

interface ModalContactoProps {
  inicial: BorradorContacto
  onListo: (c: BorradorContacto) => void
  onCerrar: () => void
}

/**
 * Datos de un contacto nuevo. No se crea al confirmar esta ventana sino junto con el proveedor:
 * así un proveedor que al final no se crea no deja contactos sueltos en el tablero.
 */
function ModalContacto({ inicial, onListo, onCerrar }: ModalContactoProps) {
  const [c, setC] = useState(inicial)
  const [mostrar, setMostrar] = useState(false)
  const faltan = faltantesContacto(c)
  const wa = c.whatsapp.trim() ? normalizarWhatsapp(c.whatsapp) : null
  const set = (p: Partial<BorradorContacto>) => setC((x) => ({ ...x, ...p }))

  return (
    <Modal
      titulo={
        <>
          <i className="fas fa-user-plus" style={{ color: '#6200ee' }} aria-hidden /> Contacto nuevo
        </>
      }
      subtitulo="Se crea junto con el proveedor, ya conectado a él, al confirmar la carga."
      onCerrar={onCerrar}
      textoCerrar="Cancelar"
      pie={
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => (faltan.length ? setMostrar(true) : onListo(c))}
        >
          <i className="fas fa-check" aria-hidden /> Listo
        </button>
      }
    >
      <div className="grid-campos">
        <label className="ig">
          <span className="ig-lbl ig-req">Nombre/s</span>
          <input className="fc" value={c.nombre} onChange={(e) => set({ nombre: e.target.value })} autoComplete="off" />
        </label>
        <label className="ig">
          <span className="ig-lbl ig-req">Apellido/s</span>
          <input className="fc" value={c.apellido} onChange={(e) => set({ apellido: e.target.value })} autoComplete="off" />
        </label>
        <label className="ig">
          <span className="ig-lbl">Cel. WhatsApp</span>
          <input
            className="fc"
            inputMode="tel"
            value={c.whatsapp}
            onChange={(e) => set({ whatsapp: e.target.value })}
            placeholder="Ej.: 2494 600860"
            autoComplete="off"
          />
          {c.whatsapp.trim() &&
            (wa ? (
              <span className="ig-hint t-green">
                <i className="fas fa-circle-check" aria-hidden /> Se guarda como {mostrarWhatsapp(wa)}
              </span>
            ) : (
              <span className="ig-hint t-red">Código de área + número, sin el 0 ni el 15 (o con ellos, se acomoda solo).</span>
            ))}
        </label>
        <label className="ig">
          <span className="ig-lbl">Email</span>
          <input
            className="fc"
            type="email"
            inputMode="email"
            value={c.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="nombre@empresa.com"
            autoComplete="off"
          />
        </label>
      </div>
      <p className="ig-hint" style={{ marginTop: 10 }}>
        Obligatorio: nombre, apellido y al menos uno de los dos medios (WhatsApp o email).
      </p>
      {mostrar && faltan.length > 0 && <Faltan lista={faltan} />}
    </Modal>
  )
}

/* ===== Proveedor ===== */

interface Props {
  proveedores: Proveedor[]
  contactos: Contacto[]
  /** Etiquetas de ✋ Tipo, leídas de monday. */
  tipos: string[]
  /** Tipo que se propone marcado: desde un flete contratado, "Fletes". */
  tipoSugerido?: string
  /** Proveedor nuevo ya cargado antes, para editarlo. */
  inicial?: BorradorProveedor | null
  /** Datos validados. No se crea nada: se crea al confirmar la carga que lo usa. */
  onListo: (p: BorradorProveedor) => void
  onCerrar: () => void
}

/**
 * Datos de un proveedor que no existe, cargados sin salir del formulario donde se lo necesita.
 *
 * Esta ventana NO crea nada en monday: valida y devuelve los datos, y el proveedor (con sus
 * contactos nuevos) se crea recién cuando se confirma la carga que lo usa. Así, si al final la
 * carga no se hace, no quedan proveedores sueltos en el tablero.
 */
export function ModalProveedor({ proveedores, contactos, tipos, tipoSugerido, inicial, onListo, onCerrar }: Props) {
  const [p, setP] = useState<BorradorProveedor>(() => inicial ?? {
    nombreCompleto: '',
    tipos: tipoSugerido && tipos.includes(tipoSugerido) ? [tipoSugerido] : [],
    cuit: '',
    ubicacion: null,
    contactoIds: [],
    contactosNuevos: [],
  })
  /** Contacto nuevo abierto en su ventana (uno nuevo o uno ya agregado que se edita). */
  const [editando, setEditando] = useState<BorradorContacto | null>(null)
  const [mostrar, setMostrar] = useState(false)

  const set = (parcial: Partial<BorradorProveedor>) => setP((x) => ({ ...x, ...parcial }))
  const faltan = faltantesProveedor(p, proveedores)
  const parecidos = proveedoresParecidos(proveedores, p.nombreCompleto)
  const cuitRepetido = proveedorConCuit(proveedores, p.cuit)
  const cuitDudoso = cuitCompleto(p.cuit) && !cuitRepetido && !cuitVerifica(p.cuit)

  const guardarContacto = (c: BorradorContacto) => {
    const ya = p.contactosNuevos.some((x) => x.uid === c.uid)
    set({ contactosNuevos: ya ? p.contactosNuevos.map((x) => (x.uid === c.uid ? c : x)) : [...p.contactosNuevos, c] })
    setEditando(null)
  }

  const listo = () => (faltan.length > 0 ? setMostrar(true) : onListo(p))

  const opContactos = contactos.map((c) => ({ id: c.id, nombre: c.nombre, detalle: detalleContacto(c) }))

  return (
    <>
      <Modal
        ancho
        titulo={
          <>
            <i className="fas fa-building-circle-check" style={{ color: '#7f5347' }} aria-hidden /> Agregar proveedor
          </>
        }
        subtitulo="Queda asignado ya, pero se crea en ✋ Proveedores (Activo) recién cuando confirmes la carga."
        onCerrar={onCerrar}
        textoCerrar="Cancelar"
        pie={
          <button type="button" className="btn btn-green" onClick={listo}>
            <i className="fas fa-check" aria-hidden /> Usar este proveedor
          </button>
        }
      >
        <div className="grid-campos">
          <label className="ig">
            <span className="ig-lbl ig-req">Nombre completo</span>
            <input
              className="fc"
              value={p.nombreCompleto}
              onChange={(e) => set({ nombreCompleto: e.target.value })}
              placeholder="Razón social o nombre y apellido"
              autoComplete="off"
            />
            {parecidos.length > 0 && (
              <span className="ig-hint" style={{ color: '#93370d' }}>
                <i className="fas fa-triangle-exclamation" aria-hidden /> Ya hay parecidos:{' '}
                {parecidos.map((x) => x.nombre).join(' · ')}. Revisá que no esté cargado.
              </span>
            )}
          </label>
          <label className="ig">
            <span className="ig-lbl ig-req">CUIT</span>
            <input
              className="fc"
              inputMode="numeric"
              value={p.cuit}
              onChange={(e) => set({ cuit: formatearCuit(e.target.value) })}
              placeholder="XX-XXXXXXXX-X"
              autoComplete="off"
            />
            {cuitRepetido ? (
              <span className="ig-hint t-red">Ya existe con ese CUIT: "{cuitRepetido.nombre}".</span>
            ) : cuitDudoso ? (
              <span className="ig-hint" style={{ color: '#93370d' }}>
                <i className="fas fa-triangle-exclamation" aria-hidden /> El dígito verificador no coincide: revisá que esté bien tipeado.
              </span>
            ) : (
              <span className="ig-hint">Se completan los guiones solos.</span>
            )}
          </label>
        </div>

        <div className="ig" style={{ marginTop: 16 }}>
          <span className="ig-lbl">
            Tipo <span className="chip chip--opcional">Opcional</span>
          </span>
          <div className="pastillas">
            {tipos.map((t) => {
              const elegido = p.tipos.includes(t)
              return (
                <button
                  type="button"
                  key={t}
                  className={`pastilla ${elegido ? 'pastilla--sel' : ''}`}
                  aria-pressed={elegido}
                  onClick={() => set({ tipos: elegido ? p.tipos.filter((x) => x !== t) : [...p.tipos, t] })}
                >
                  {t}
                </button>
              )
            })}
          </div>
          {tipoSugerido && !p.tipos.includes(tipoSugerido) && (
            <span className="ig-hint" style={{ color: '#93370d' }}>
              Sin el tipo {tipoSugerido} no se va a poder usar en esta carga.
            </span>
          )}
        </div>

        <div className="ig" style={{ marginTop: 16 }}>
          <span className="ig-lbl">
            Ubicación <span className="chip chip--opcional">Opcional</span>
          </span>
          <SelectorUbicacion valor={p.ubicacion} onCambio={(u) => set({ ubicacion: u })} />
        </div>

        <div className="ig" style={{ marginTop: 16 }}>
          <span className="ig-lbl">
            Contactos <span className="chip chip--opcional">Opcional</span>
          </span>
          <SelectorMultiple
            opciones={opContactos}
            valores={p.contactoIds}
            onCambio={(ids) => set({ contactoIds: ids })}
            placeholder="Conectar contactos existentes…"
          />
          {p.contactosNuevos.length > 0 && (
            <div className="elegidos" style={{ marginTop: 8, marginBottom: 0 }}>
              {p.contactosNuevos.map((c) => {
                const wa = normalizarWhatsapp(c.whatsapp)
                return (
                  <span className="elegido" key={c.uid}>
                    <span className="elegido-tit">
                      {nombreContacto(c)}
                      <span className="xs" style={{ display: 'block' }}>
                        {[wa && mostrarWhatsapp(wa), c.email.trim()].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="chip chip--violeta">Nuevo</span>
                    <button type="button" className="btn btn-ghost btn--sm" onClick={() => setEditando(c)}>
                      <i className="fas fa-pen" aria-hidden /> Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-ghost--rojo btn--sm"
                      onClick={() => set({ contactosNuevos: p.contactosNuevos.filter((x) => x.uid !== c.uid) })}
                    >
                      <i className="fas fa-trash-can" aria-hidden /> Quitar
                    </button>
                  </span>
                )
              })}
            </div>
          )}
          <button
            type="button"
            className="btn btn-outblue btn--sm"
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
            onClick={() => setEditando(contactoVacio(nuevoUid()))}
          >
            <i className="fas fa-user-plus" aria-hidden /> Agregar contacto nuevo
          </button>
        </div>

        {mostrar && faltan.length > 0 && <Faltan lista={faltan} />}
      </Modal>

      {editando && <ModalContacto inicial={editando} onListo={guardarContacto} onCerrar={() => setEditando(null)} />}
    </>
  )
}
