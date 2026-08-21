import { useMemo, useState } from 'react'
import type { BorradorOrden, Catalogos } from '@/types'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { BuscadorAgregar, type ResultadoBusqueda } from '@/components/ui/BuscadorAgregar'
import { PasoHeader } from '@/components/ui/PasoHeader'
import {
  buscar,
  contactosDeProveedor,
  maquinariasElegidas,
  opcionesRealizadoPor,
  proveedoresElegibles,
} from '@/lib/orden'

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
 * Paso 1 — Quién hace la labor, cuál, sobre qué y a quién se le avisa.
 *
 * El orden de los campos no es decorativo, cada uno acota al siguiente: "realizado por" define
 * qué proveedores se ofrecen, y el proveedor define qué contactos. Cambiar uno de arriba limpia
 * los de abajo (lo hace `App`), porque un valor heredado dejaría de corresponder.
 */
export function Paso1Datos({ catalogos, borrador, onCambio }: Props) {
  const [tiposMaq, setTiposMaq] = useState<string[]>([])
  const [clasifMaq, setClasifMaq] = useState<string[]>([])

  const proveedores = useMemo(
    () => proveedoresElegibles(catalogos.proveedores, borrador.realizadoPor),
    [catalogos.proveedores, borrador.realizadoPor],
  )
  const proveedor = buscar(catalogos.proveedores, borrador.proveedorId)

  const contactos = useMemo(
    () => contactosDeProveedor(catalogos.contactos, proveedor),
    [catalogos.contactos, proveedor],
  )
  const contacto = buscar(catalogos.contactos, borrador.contactoId)

  // Sólo campañas activas: cargar una orden sobre una campaña cerrada no es una opción válida.
  const campanas = useMemo(() => catalogos.campanas.filter((c) => c.activa), [catalogos.campanas])

  const opRealizado: OpcionSelector[] = opcionesRealizadoPor().map((e) => ({ id: e, nombre: e }))

  const opLabores: OpcionSelector[] = catalogos.labores.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    detalle: l.codigo || undefined,
  }))

  const opProveedores: OpcionSelector[] = proveedores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    detalle: p.cuit ? `CUIT ${p.cuit}` : 'Sin CUIT cargado',
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
    chipClase: 'chip--violeta',
  }))

  const universoMaquinaria: ResultadoBusqueda[] = useMemo(
    () =>
      catalogos.maquinarias.map((m) => ({
        id: m.id,
        titulo: m.nombre,
        detalle: [m.marca, m.patente && `Patente ${m.patente}`].filter(Boolean).join(' · '),
        chips: [m.tipo, m.clasificacion].filter(Boolean),
      })),
    [catalogos.maquinarias],
  )

  const maquinarias = maquinariasElegidas(catalogos.maquinarias, borrador.maquinariaIds)
  const idsMaquinaria = useMemo(() => new Set(borrador.maquinariaIds), [borrador.maquinariaIds])

  return (
    <div className="view">
      <PasoHeader
        numero={1}
        titulo="Datos de la orden"
        descripcion="Indicá quién hace el trabajo, qué labor es, sobre qué cultivo y campaña, y a quién se le envía."
      />

      <div className="card card--input">
        <div className="ctitle">
          <i className="fas fa-user-gear" style={{ color: '#0073ea' }} aria-hidden />
          Quién realiza la labor
        </div>
        <div className="csub">
          Define qué proveedores se pueden elegir: los contratistas de labores o el personal
          interno.
        </div>

        <div className="grid-campos">
          <div className="ig">
            <label className="ig-lbl ig-req" htmlFor="sel-realizado">
              Realizado por
            </label>
            <SelectorBuscable
              id="sel-realizado"
              opciones={opRealizado}
              valor={borrador.realizadoPor}
              onCambio={(id) => onCambio({ realizadoPor: id })}
              placeholder="Contratista o personal interno…"
              umbralBusqueda={99}
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
              placeholder={
                borrador.realizadoPor ? 'Seleccioná el proveedor…' : 'Elegí primero quién lo hace'
              }
              vacio="No hay proveedores de ese tipo."
              disabled={!borrador.realizadoPor}
            />
            {borrador.realizadoPor && (
              <span className="ig-hint">
                {proveedores.length} proveedor{proveedores.length === 1 ? '' : 'es'} activo
                {proveedores.length === 1 ? '' : 's'} de tipo &laquo;{borrador.realizadoPor}&raquo;.
              </span>
            )}
          </div>

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
        </div>

        {/* El tipo del proveedor se carga en Monday. Si nadie lo completó, la lista queda corta y
            conviene decir por qué antes de que el usuario crea que faltan proveedores. */}
        {borrador.realizadoPor && proveedores.length === 0 && (
          <div className="aviso aviso--warn" style={{ marginTop: 14 }}>
            <i className="fas fa-triangle-exclamation" aria-hidden />
            <span>
              Ningún proveedor activo tiene cargado el tipo que corresponde a{' '}
              <strong>{borrador.realizadoPor}</strong>. Completá la columna <em>✋ Tipo</em> en el
              tablero de Proveedores y volvé a abrir la app.
            </span>
          </div>
        )}
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

      <div className="card card--input">
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
              placeholder={proveedor ? 'Seleccioná el contacto…' : 'Elegí primero un proveedor'}
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
                  {/* Sólo el nombre: el teléfono y el mail ya están a la vista en el selector
                      de arriba, y repetirlos acá no agrega nada. */}
                  <span className="contacto-nom">{contacto.nombre}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {proveedor && contactos.length === 0 && (
          <div className="aviso aviso--warn" style={{ marginTop: 14 }}>
            <i className="fas fa-triangle-exclamation" aria-hidden />
            <span>
              <strong>{proveedor.nombre}</strong> no tiene ningún contacto vinculado en el tablero
              ✋ Contactos. Vinculalo en Monday y volvé a abrir la app para poder emitir la orden.
            </span>
          </div>
        )}
      </div>

      <div className="card card--input card--flush">
        <div className="ctitle" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <i className="fas fa-tractor" style={{ color: '#b25e09' }} aria-hidden />
            Maquinaria
            <span className="chip chip--opcional">Opcional</span>
          </span>
          {maquinarias.length > 0 && (
            <span className="chip chip--campo">
              {maquinarias.length} seleccionada{maquinarias.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="csub">
          Buscá por nombre, o filtrá por tipo y clasificación. Podés agregar más de una.
        </div>

        {maquinarias.length > 0 && (
          <div className="elegidos">
            {maquinarias.map((m) => (
              <span className="elegido" key={m.id}>
                <span className="elegido-tit">{m.nombre}</span>
                {m.tipo && <span className="chip chip--ambar">{m.tipo}</span>}
                <button
                  type="button"
                  className="btn btn-ghost btn-ghost--rojo btn--sm"
                  onClick={() =>
                    onCambio({
                      maquinariaIds: borrador.maquinariaIds.filter((id) => id !== m.id),
                    })
                  }
                  aria-label={`Quitar ${m.nombre}`}
                >
                  <i className="fas fa-trash-can" aria-hidden /> Quitar
                </button>
              </span>
            ))}
          </div>
        )}

        <BuscadorAgregar
          items={universoMaquinaria}
          agregados={idsMaquinaria}
          onAgregar={(id) => onCambio({ maquinariaIds: [...borrador.maquinariaIds, id] })}
          placeholder="Ej.: tractor, chimango, JD 6125…"
          ayuda={`Hay ${catalogos.maquinarias.length} maquinarias. Buscá por nombre o marca, o combiná los filtros de abajo.`}
          filtros={[
            {
              titulo: 'Tipo',
              opciones: catalogos.filtros.tiposMaquinaria,
              valores: tiposMaq,
              onCambio: setTiposMaq,
              modo: 'desplegable',
            },
            {
              titulo: 'Clasificación',
              opciones: catalogos.filtros.clasificacionesMaquinaria,
              valores: clasifMaq,
              onCambio: setClasifMaq,
              modo: 'desplegable',
            },
          ]}
        />
      </div>
    </div>
  )
}
