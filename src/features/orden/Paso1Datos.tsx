import { useMemo } from 'react'
import type { BorradorOrden, Catalogos } from '@/types'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { buscar, contactosDeProveedor, proveedoresElegibles } from '@/lib/orden'

interface Props {
  catalogos: Catalogos
  borrador: BorradorOrden
  onCambio: (parcial: Partial<BorradorOrden>) => void
}

/** Iniciales para el avatar del contacto. */
function iniciales(nombre: string): string {
  const partes = nombre.split(' ').filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?'
}

/**
 * Paso 1 — Labor, proveedor, cultivo, campaña, valor y contacto.
 *
 * El orden de los campos no es decorativo: el contacto depende del proveedor, así que va DESPUÉS
 * y se habilita recién cuando hay proveedor elegido. Elegir otro proveedor limpia el contacto
 * (lo hace `App`), porque un contacto de otro proveedor no es un dato válido.
 */
export function Paso1Datos({ catalogos, borrador, onCambio }: Props) {
  const proveedores = useMemo(
    () => proveedoresElegibles(catalogos.proveedores),
    [catalogos.proveedores],
  )
  const proveedor = buscar(catalogos.proveedores, borrador.proveedorId)

  const contactos = useMemo(
    () => contactosDeProveedor(catalogos.contactos, proveedor),
    [catalogos.contactos, proveedor],
  )
  const contacto = buscar(catalogos.contactos, borrador.contactoId)

  // Sólo campañas activas: cargar una orden sobre una campaña cerrada no es una opción válida.
  const campanas = useMemo(() => catalogos.campanas.filter((c) => c.activa), [catalogos.campanas])

  const opLabores: OpcionSelector[] = catalogos.labores.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    detalle: l.codigo || undefined,
  }))

  const opProveedores: OpcionSelector[] = proveedores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    detalle: p.cuit ? `CUIT ${p.cuit}` : 'Sin CUIT cargado',
    chip: p.tipos[0],
    chipClase: 'chip--gris',
  }))

  const opCultivos: OpcionSelector[] = catalogos.cultivos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    chip: c.tipo || undefined,
    chipClase: 'chip--verde',
  }))

  const opCampanas: OpcionSelector[] = campanas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    chip: 'Activa',
    chipClase: 'chip--verde',
  }))

  const opContactos: OpcionSelector[] = contactos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    detalle: [c.telefono, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto',
    chip: c.tipos[0],
    chipClase: 'chip--gris',
  }))

  return (
    <div className="view">
      <PasoHeader
        numero={1}
        titulo="Datos de la orden"
        descripcion="Elegí la labor y el contratista que la ejecuta, sobre qué cultivo y campaña se carga, y a quién se le envía."
      />

      <div className="card card--input">
        <div className="ctitle">
          <i className="fas fa-tractor" style={{ color: '#0073ea' }} aria-hidden />
          Labor y contratista
        </div>
        <div className="csub">Qué trabajo se hace y quién lo hace.</div>

        <div className="grid-campos">
          <div className="ig">
            <label className="ig-lbl ig-req" htmlFor="sel-labor">
              Labor
            </label>
            <SelectorBuscable
              id="sel-labor"
              opciones={opLabores}
              valor={borrador.laborId}
              onCambio={(id) => onCambio({ laborId: id })}
              placeholder="Seleccioná la labor…"
              vacio="No hay labores cargadas en el tablero."
            />
          </div>

          <div className="ig">
            <label className="ig-lbl ig-req" htmlFor="sel-proveedor">
              Proveedor / Contratista
            </label>
            <SelectorBuscable
              id="sel-proveedor"
              opciones={opProveedores}
              valor={borrador.proveedorId}
              onCambio={(id) => onCambio({ proveedorId: id })}
              placeholder="Seleccioná el proveedor…"
              vacio="No hay proveedores activos."
            />
            <span className="ig-hint">Sólo se listan los proveedores con estado Activo.</span>
          </div>
        </div>
      </div>

      <div className="card card--input">
        <div className="ctitle">
          <i className="fas fa-seedling" style={{ color: '#2f6f4e' }} aria-hidden />
          Cultivo, campaña y valor
        </div>
        <div className="csub">Sobre qué se trabaja y cuánto se paga por hectárea.</div>

        <div className="grid-campos">
          <div className="ig">
            <label className="ig-lbl ig-req" htmlFor="sel-cultivo">
              Cultivo
            </label>
            <SelectorBuscable
              id="sel-cultivo"
              opciones={opCultivos}
              valor={borrador.cultivoId}
              onCambio={(id) => onCambio({ cultivoId: id })}
              placeholder="Seleccioná el cultivo…"
              vacio="No hay cultivos cargados."
            />
          </div>

          <div className="ig">
            <label className="ig-lbl ig-req" htmlFor="sel-campana">
              Campaña
            </label>
            <SelectorBuscable
              id="sel-campana"
              opciones={opCampanas}
              valor={borrador.campanaId}
              onCambio={(id) => onCambio({ campanaId: id })}
              placeholder="Seleccioná la campaña…"
              vacio="No hay campañas activas en este momento."
            />
            <span className="ig-hint">Sólo se ofrecen las campañas con estado Activa.</span>
          </div>

          <div className="ig">
            <label className="ig-lbl ig-req" htmlFor="inp-usdha">
              U$/Ha Labor
            </label>
            <div className="fc-prefijo">
              <span>U$S</span>
              <input
                id="inp-usdha"
                className="fc"
                /* `inputMode` decimal abre el teclado numérico del celular con la coma, sin
                   perder el pegado de valores con formato que sí permite un input de texto. */
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={borrador.usdPorHa}
                onChange={(e) => onCambio({ usdPorHa: e.target.value })}
              />
            </div>
            <span className="ig-hint">Valor por hectárea que se le paga al contratista.</span>
          </div>
        </div>
      </div>

      <div className="card card--input card--flush">
        <div className="ctitle">
          <i className="fas fa-paper-plane" style={{ color: '#6200ee' }} aria-hidden />
          Envío de la orden
        </div>
        <div className="csub">
          Un solo contacto por orden. Se listan únicamente los contactos vinculados al proveedor
          elegido.
        </div>

        <div className="grid-campos">
          <div className="ig">
            <label className="ig-lbl ig-req" htmlFor="sel-contacto">
              Contacto
            </label>
            <SelectorBuscable
              id="sel-contacto"
              opciones={opContactos}
              valor={borrador.contactoId}
              onCambio={(id) => onCambio({ contactoId: id })}
              placeholder={
                proveedor ? 'Seleccioná el contacto…' : 'Elegí primero un proveedor'
              }
              vacio="Este proveedor no tiene contactos vinculados."
              disabled={!proveedor}
            />
          </div>

          {contacto && (
            <div className="ig">
              <span className="ig-lbl">Destinatario</span>
              <div className="contacto-ficha">
                <div className="contacto-ava">{iniciales(contacto.nombre)}</div>
                <div className="contacto-datos">
                  <span className="contacto-nom">{contacto.nombre}</span>
                  <span className="contacto-medios">
                    {contacto.telefono && (
                      <span>
                        <i className="fab fa-whatsapp" aria-hidden /> {contacto.telefono}
                      </span>
                    )}
                    {contacto.email && (
                      <span>
                        <i className="fas fa-envelope" aria-hidden /> {contacto.email}
                      </span>
                    )}
                    {!contacto.telefono && !contacto.email && <span>Sin teléfono ni email</span>}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* El vínculo Proveedor ↔ Contacto se carga en Monday. Si falta, la app no puede
            inventarlo: se dice qué hay que hacer, en vez de dejar el campo mudo. */}
        {proveedor && contactos.length === 0 && (
          <div className="aviso aviso--warn" style={{ marginTop: 14 }}>
            <i className="fas fa-triangle-exclamation" aria-hidden />
            <span>
              <strong>{proveedor.nombre}</strong> no tiene ningún contacto vinculado en el tablero
              ✋ Contactos. Vinculalo en Monday (columna <em>✋ Provedores</em> del contacto, o
              <em> 🤖Contactos</em> del proveedor) y volvé a abrir la app para poder emitir la orden.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
