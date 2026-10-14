import { useMemo, useState, type ReactNode } from 'react'
import type { BorradorCosecha } from '@/types'
import { BuscadorAgregar, type ResultadoBusqueda } from '@/components/ui/BuscadorAgregar'
import { Opcion } from '@/components/ui/Opcion'
import { Seccion } from '@/components/ui/Seccion'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { SelectorMultiple } from '@/components/ui/SelectorMultiple'
import { aNumero, hectareas } from '@/lib/format'
import { buscar, hectareasDeLote } from '@/lib/orden'
import { esNuevo, ID_DEPOSITO_NUEVO, ID_PROVEEDOR_NUEVO } from '@/lib/altas'
import {
  depositosAptos,
  lotesDeCampo,
  proveedoresFlete,
  type ContextoCosecha,
} from '@/lib/cosecha'
import {
  PROVEEDOR_TIPO_FLETES,
  TRANSPORTE_CONTRATADO,
  TRANSPORTE_PROPIO,
} from '@/services/monday/columns'

interface Props {
  borrador: BorradorCosecha
  onCambio: (parcial: Partial<BorradorCosecha>) => void
  ctx: ContextoCosecha
  /** Número del primer bloque: el formulario va debajo de la elección de Crear / Duplicar. */
  desde: number
  /** Nombre del proveedor / destino nuevo cargado (se crea al confirmar la cosecha), o `null`. */
  proveedorNuevo: string | null
  depositoNuevo: string | null
  /** Abre la ventana de alta (o de edición, si ya hay uno nuevo cargado). */
  onAgregarDeposito: () => void
  onAgregarProveedor: () => void
  /** Tira el nuevo cargado: no se va a crear, y si estaba elegido se deja de usar. */
  onDescartarDeposito: () => void
  onDescartarProveedor: () => void
}

interface ControlesAltaProps {
  /** "destino" / "proveedor": se usa en los textos de los botones. */
  que: string
  /** Hay uno elegido en el selector (existente o nuevo). */
  hayElegido: boolean
  /** Nombre del nuevo cargado y todavía sin crear, o `null`. */
  nuevo: string | null
  /** El nuevo cargado es el que está elegido. */
  nuevoElegido: boolean
  onQuitar: () => void
  onAgregar: () => void
  onDescartar: () => void
}

/**
 * Lo que se puede hacer con lo elegido debajo de un selector: quitarlo, cargar uno nuevo si no
 * está en la lista, y —si ya se cargó uno nuevo— editarlo o descartarlo. Descartar el nuevo deja
 * libre para elegir uno existente o cargar otro distinto.
 */
function ControlesAlta({ que, hayElegido, nuevo, nuevoElegido, onQuitar, onAgregar, onDescartar }: ControlesAltaProps) {
  return (
    <>
      {nuevo && (
        <div className="alta-pendiente">
          <i className="fas fa-wand-magic-sparkles" aria-hidden />
          <span className="alta-pendiente-body">
            <span className="font-b">
              {que === 'destino' ? 'Destino' : 'Proveedor'} nuevo: {nuevo}
            </span>
            <span className="xs">
              {nuevoElegido
                ? 'Elegido. Se crea en monday recién cuando confirmes la cosecha.'
                : 'Cargado pero no elegido: si no lo elegís en la lista, no se crea.'}
            </span>
          </span>
          <span className="alta-pendiente-acciones">
            <button type="button" className="btn btn-ghost btn--sm" onClick={onAgregar}>
              <i className="fas fa-pen" aria-hidden /> Editar
            </button>
            <button type="button" className="btn btn-ghost btn-ghost--rojo btn--sm" onClick={onDescartar}>
              <i className="fas fa-trash-can" aria-hidden /> Descartar
            </button>
          </span>
        </div>
      )}
      <div className="alta-acciones">
        {hayElegido && (
          <button type="button" className="btn btn-ghost btn-ghost--rojo btn--sm" onClick={onQuitar}>
            <i className="fas fa-xmark" aria-hidden /> Quitar {que}
          </button>
        )}
        {!nuevo && (
          <button type="button" className="btn btn-outblue btn--sm" onClick={onAgregar}>
            <i className="fas fa-plus" aria-hidden /> ¿No está? Agregar {que} nuevo
          </button>
        )}
      </div>
    </>
  )
}

/** Aviso rojo dentro de un bloque, para combinaciones inválidas que vienen de una duplicada. */
function Problema({ children }: { children: ReactNode }) {
  return (
    <div className="aviso aviso--error" style={{ marginTop: 10 }}>
      <i className="fas fa-circle-exclamation" aria-hidden />
      <span>{children}</span>
    </div>
  )
}

/**
 * Formulario de la cosecha. Es el mismo para una cosecha nueva y para una duplicada: lo único que
 * cambia es con qué datos arranca.
 *
 * Las dependencias se ven en la pantalla: el lote se habilita después del campo y sólo ofrece los
 * de ese campo; el destino se habilita después del cultivo y sólo ofrece depósitos de ese cultivo;
 * el transporte abre maquinarias (Flete Propio) o proveedor de fletes (Flete Contratado).
 */
export function FormCosecha({
  borrador: b,
  onCambio,
  ctx,
  desde,
  proveedorNuevo,
  depositoNuevo,
  onAgregarDeposito,
  onAgregarProveedor,
  onDescartarDeposito,
  onDescartarProveedor,
}: Props) {
  const { catalogos, depositos, maquinariaMultiple } = ctx
  const [tiposMaq, setTiposMaq] = useState<string[]>([])
  const [clasifMaq, setClasifMaq] = useState<string[]>([])

  const cultivo = buscar(catalogos.cultivos, b.cultivoId)
  const campo = buscar(catalogos.campos, b.campoId)
  const lotes = lotesDeCampo(catalogos, b.campoId)
  const aptos = depositosAptos(depositos, cultivo)
  const fletes = useMemo(() => proveedoresFlete(catalogos.proveedores), [catalogos.proveedores])

  const opCultivos: OpcionSelector[] = catalogos.cultivos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    chip: c.tipo || undefined,
    chipClase: 'chip--campo',
  }))
  // Las activas primero: es donde va casi toda la cosecha, sin esconder las cerradas.
  const opCampanas: OpcionSelector[] = [...catalogos.campanas]
    .sort((x, y) => Number(y.activa) - Number(x.activa) || y.nombre.localeCompare(x.nombre))
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      chip: c.activa ? 'Activa' : c.estado || undefined,
      chipClase: c.activa ? 'chip--verde' : 'chip--naranja',
    }))
  const opCampos: OpcionSelector[] = catalogos.campos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    detalle: `${c.lotes.length} lote${c.lotes.length === 1 ? '' : 's'}`,
  }))
  const opLotes = lotes.map((l) => ({ id: l.id, nombre: l.nombre, detalle: hectareas(hectareasDeLote(l)) }))
  /* Lo nuevo (todavía sin crear) se distingue en la lista: se crea recién al confirmar. */
  const chipDe = (id: string, estado: string): Pick<OpcionSelector, 'chip' | 'chipClase' | 'detalle'> =>
    esNuevo(id)
      ? { chip: 'Nuevo', chipClase: 'chip--violeta', detalle: 'Se crea al confirmar la cosecha' }
      : { chip: estado && estado !== 'Activo' ? estado : undefined, chipClase: 'chip--naranja' }
  const opDepositos: OpcionSelector[] = aptos.map((d) => ({ id: d.id, nombre: d.nombre, ...chipDe(d.id, d.estado) }))
  const opFletes: OpcionSelector[] = fletes.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    detalle: p.cuit ? `CUIT ${p.cuit}` : undefined,
    ...chipDe(p.id, p.estado),
  }))

  const universoMaquinaria: ResultadoBusqueda[] = useMemo(
    () =>
      catalogos.maquinarias.map((m) => ({
        id: m.id,
        titulo: m.nombre,
        detalle: [m.tipo, m.clasificacion, m.marca, m.patente && `Patente ${m.patente}`]
          .filter(Boolean)
          .join(' · '),
        chips: [m.tipo, m.clasificacion].filter(Boolean),
      })),
    [catalogos.maquinarias],
  )
  const maquinarias = catalogos.maquinarias.filter((m) => b.maquinariaIds.includes(m.id))
  const idsMaquinaria = useMemo(() => new Set(b.maquinariaIds), [b.maquinariaIds])

  // Problemas de combinación: sólo aparecen al duplicar una cosecha con datos que ya no valen.
  const lotesAjenos = campo ? b.loteIds.filter((id) => !campo.lotes.some((l) => l.id === id)) : []
  const depositoNoApto = Boolean(cultivo && b.depositoId && !aptos.some((d) => d.id === b.depositoId))
  const provElegido = buscar(catalogos.proveedores, b.proveedorId)
  const provNoFlete = Boolean(provElegido && !provElegido.tipos.includes(PROVEEDOR_TIPO_FLETES))

  const kg = aNumero(b.kg)
  let n = desde

  return (
    <>
      <Seccion
        numero={n++}
        titulo="Cultivo y campaña"
        completa={Boolean(cultivo && b.campanaId)}
      >
        <div className="grid-campos">
          <div className="ig">
            <span className="ig-lbl ig-req">Cultivo</span>
            <SelectorBuscable
              opciones={opCultivos}
              valor={b.cultivoId}
              onCambio={(id) => onCambio({ cultivoId: id })}
              placeholder="Elegí el cultivo…"
            />
          </div>
          <div className="ig">
            <span className="ig-lbl ig-req">Campaña</span>
            <SelectorBuscable
              opciones={opCampanas}
              valor={b.campanaId}
              onCambio={(id) => onCambio({ campanaId: id })}
              placeholder="Elegí la campaña…"
            />
          </div>
        </div>
      </Seccion>

      <Seccion
        numero={n++}
        titulo="Campo y lote"
        ayuda="Primero el campo: el lote sólo ofrece los lotes de ese campo. Podés elegir más de uno."
        completa={Boolean(campo && b.loteIds.length > 0 && lotesAjenos.length === 0)}
      >
        <div className="grid-campos">
          <div className="ig">
            <span className="ig-lbl ig-req">Campo</span>
            <SelectorBuscable
              opciones={opCampos}
              valor={b.campoId}
              onCambio={(id) => onCambio({ campoId: id })}
              placeholder="Elegí el campo…"
            />
          </div>
          <div className="ig">
            <span className="ig-lbl ig-req">Lote</span>
            <SelectorMultiple
              opciones={opLotes}
              valores={b.loteIds.filter((id) => lotes.some((l) => l.id === id))}
              onCambio={(ids) => onCambio({ loteIds: ids })}
              placeholder="Elegí uno o más lotes…"
              vacio={campo ? 'Este campo no tiene lotes cargados.' : 'Elegí primero el campo.'}
            />
            {campo && <span className="ig-hint">Lotes de {campo.nombre}.</span>}
          </div>
        </div>
        {b.loteIds.length > 0 && (
          <div className="filtros-elegidos" style={{ marginTop: 10 }}>
            {b.loteIds.map((id) => {
              const lote = lotes.find((l) => l.id === id)
              return (
                <span className={`chip-filtro ${lote ? '' : 'chip-filtro--mal'}`} key={id}>
                  {lote?.nombre ?? 'Lote de otro campo'}
                  <button
                    type="button"
                    onClick={() => onCambio({ loteIds: b.loteIds.filter((x) => x !== id) })}
                    aria-label="Quitar el lote"
                  >
                    <i className="fas fa-xmark" aria-hidden />
                  </button>
                </span>
              )
            })}
          </div>
        )}
        {lotesAjenos.length > 0 && campo && (
          <Problema>
            {lotesAjenos.length === 1 ? 'Hay un lote' : `Hay ${lotesAjenos.length} lotes`} que no{' '}
            {lotesAjenos.length === 1 ? 'pertenece' : 'pertenecen'} a <strong>{campo.nombre}</strong>.
            Quitalo{lotesAjenos.length === 1 ? '' : 's'} o elegí lotes de ese campo.
          </Problema>
        )}
      </Seccion>

      <Seccion numero={n++} titulo="Fecha y kilos" completa={Boolean(b.fecha && kg != null && kg > 0)}>
        <div className="grid-campos">
          <div className="ig">
            <span className="ig-lbl ig-req">Fecha</span>
            <input
              className="fc"
              type="date"
              value={b.fecha}
              onChange={(e) => onCambio({ fecha: e.target.value })}
              aria-label="Fecha de la cosecha"
            />
          </div>
          <div className="ig">
            <span className="ig-lbl ig-req">KG</span>
            <div className="fc-sufijo">
              <input
                className="fc"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={b.kg}
                onChange={(e) => onCambio({ kg: e.target.value })}
                aria-label="Kilos cosechados"
              />
              <span>kg</span>
            </div>
          </div>
        </div>
      </Seccion>

      <Seccion
        numero={n++}
        titulo="Destino granos en depósito"
        ayuda={
          cultivo
            ? `Sólo aparecen los depósitos de ${cultivo.nombre}.`
            : 'Elegí primero el cultivo: el destino tiene que ser un depósito de ese cultivo.'
        }
        completa={Boolean(b.depositoId && !depositoNoApto)}
      >
        <SelectorBuscable
          opciones={opDepositos}
          valor={depositoNoApto ? null : b.depositoId}
          onCambio={(id) => onCambio({ depositoId: id })}
          placeholder="Elegí el depósito…"
          vacio={cultivo ? `No hay depósitos de ${cultivo.nombre}.` : 'Elegí primero el cultivo.'}
        />
        <ControlesAlta
          que="destino"
          hayElegido={Boolean(b.depositoId)}
          nuevo={depositoNuevo}
          nuevoElegido={b.depositoId === ID_DEPOSITO_NUEVO}
          onQuitar={() => onCambio({ depositoId: null })}
          onAgregar={onAgregarDeposito}
          onDescartar={onDescartarDeposito}
        />
        {depositoNoApto && (
          <Problema>
            El destino "{buscar(depositos, b.depositoId)?.nombre ?? 'elegido'}" no recibe{' '}
            <strong>{cultivo?.nombre}</strong>. Elegí uno de la lista.
          </Problema>
        )}
      </Seccion>

      <Seccion
        numero={n++}
        titulo="Tipo de transporte"
        ayuda="Elegí una sola opción."
        completa={
          (b.transporte === TRANSPORTE_PROPIO && b.maquinariaIds.length > 0) ||
          (b.transporte === TRANSPORTE_CONTRATADO && Boolean(provElegido) && !provNoFlete)
        }
      >
        <div className="opciones opciones--2" role="radiogroup" aria-label="Tipo de transporte">
          <Opcion
            color="propio"
            icono="truck-pickup"
            titulo={TRANSPORTE_PROPIO}
            detalle="Con maquinaria de la empresa."
            activa={b.transporte === TRANSPORTE_PROPIO}
            apagada={b.transporte === TRANSPORTE_CONTRATADO}
            onElegir={() => onCambio({ transporte: TRANSPORTE_PROPIO })}
          />
          <Opcion
            color="contratado"
            icono="truck-moving"
            titulo={TRANSPORTE_CONTRATADO}
            detalle="Con un proveedor de fletes."
            activa={b.transporte === TRANSPORTE_CONTRATADO}
            apagada={b.transporte === TRANSPORTE_PROPIO}
            onElegir={() => onCambio({ transporte: TRANSPORTE_CONTRATADO })}
          />
        </div>

        {b.transporte === TRANSPORTE_PROPIO && (
          <div className="transporte-detalle transporte-detalle--propio">
            <div className="ig-lbl ig-req" style={{ marginBottom: 8 }}>
              Maquinaria utilizada {maquinariaMultiple ? '(una o más)' : '(una)'}
            </div>
            {maquinarias.length > 0 && (
              <div className="elegidos">
                {maquinarias.map((m) => (
                  <span className="elegido" key={m.id}>
                    <span className="elegido-tit">{m.nombre}</span>
                    {m.tipo && <span className="chip chip--ambar">{m.tipo}</span>}
                    {m.clasificacion && <span className="chip chip--violeta">{m.clasificacion}</span>}
                    <button
                      type="button"
                      className="btn btn-ghost btn-ghost--rojo btn--sm"
                      onClick={() => onCambio({ maquinariaIds: b.maquinariaIds.filter((id) => id !== m.id) })}
                      aria-label={`Quitar ${m.nombre}`}
                    >
                      <i className="fas fa-trash-can" aria-hidden /> Quitar
                    </button>
                  </span>
                ))}
              </div>
            )}
            {!maquinariaMultiple && (
              <p className="ig-hint" style={{ marginBottom: 8 }}>
                La columna de la cosecha admite una sola maquinaria: elegir otra reemplaza la anterior.
              </p>
            )}
            <BuscadorAgregar
              items={universoMaquinaria}
              agregados={idsMaquinaria}
              onAgregar={(id) =>
                onCambio({ maquinariaIds: maquinariaMultiple ? [...b.maquinariaIds, id] : [id] })
              }
              placeholder="Ej.: tractor, tolva, camión…"
              ayuda={`Hay ${catalogos.maquinarias.length} maquinarias. Buscá por nombre o marca, o combiná los filtros de tipo y clasificación.`}
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
        )}

        {b.transporte === TRANSPORTE_CONTRATADO && (
          <div className="transporte-detalle transporte-detalle--contratado">
            <div className="ig">
              <span className="ig-lbl ig-req">Proveedor del flete</span>
              <SelectorBuscable
                opciones={opFletes}
                valor={provNoFlete ? null : b.proveedorId}
                onCambio={(id) => onCambio({ proveedorId: id })}
                placeholder="Elegí el proveedor…"
                vacio="No hay proveedores de tipo Fletes cargados."
              />
              <span className="ig-hint">Sólo aparecen los proveedores de tipo Fletes.</span>
            </div>
            <ControlesAlta
              que="proveedor"
              hayElegido={Boolean(b.proveedorId)}
              nuevo={proveedorNuevo}
              nuevoElegido={b.proveedorId === ID_PROVEEDOR_NUEVO}
              onQuitar={() => onCambio({ proveedorId: null })}
              onAgregar={onAgregarProveedor}
              onDescartar={onDescartarProveedor}
            />
            {provNoFlete && (
              <Problema>
                "{provElegido?.nombre}" no es un proveedor de Fletes. Elegí uno de la lista.
              </Problema>
            )}
          </div>
        )}
      </Seccion>

      <Seccion
        numero={n++}
        titulo="Carta de porte, KM y CTG"
        opcional
        completa={Boolean(b.cartaPorte.trim() || b.km.trim() || b.ctg.trim())}
      >
        <div className="grid-campos">
          <div className="ig">
            <span className="ig-lbl">Carta de porte</span>
            <input
              className="fc"
              value={b.cartaPorte}
              onChange={(e) => onCambio({ cartaPorte: e.target.value })}
              placeholder="Nº de carta de porte"
            />
          </div>
          <div className="ig">
            <span className="ig-lbl">KM</span>
            <div className="fc-sufijo">
              <input
                className="fc"
                inputMode="decimal"
                autoComplete="off"
                value={b.km}
                onChange={(e) => onCambio({ km: e.target.value })}
                placeholder="0"
              />
              <span>km</span>
            </div>
          </div>
          <div className="ig">
            <span className="ig-lbl">CTG</span>
            <input
              className="fc"
              value={b.ctg}
              onChange={(e) => onCambio({ ctg: e.target.value })}
              placeholder="Código de trazabilidad de granos"
            />
          </div>
        </div>
      </Seccion>
    </>
  )
}
