import { useEffect, useMemo, useRef, useState } from 'react'
import type { Catalogos, CosechaExistente } from '@/types'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { fecha, plural } from '@/lib/format'
import {
  buscarCosechas,
  hayFiltro,
  type FiltroCosechas,
} from '@/services/monday/cosecha'
import { COSECHA_DUPLICADO } from '@/services/monday/columns'

interface Props {
  catalogos: Catalogos
  onElegir: (cosecha: CosechaExistente) => void
}

type Estado =
  | { fase: 'inactivo' }
  | { fase: 'buscando' }
  | { fase: 'listo'; cosechas: CosechaExistente[]; hayMas: boolean }
  | { fase: 'error'; mensaje: string }

const FILTRO_VACIO: FiltroCosechas = { texto: '', cultivoId: null, campoId: null, loteId: null, campanaId: null }

/** Cuánto se espera después de la última tecla antes de buscar. */
const ESPERA_MS = 350

/** "79.720 kg" a partir del texto del borrador ("79720" o "79720,5"). */
const kilos = (t: string) => {
  const n = Number(t.replace(',', '.'))
  return t && Number.isFinite(n) ? `${n.toLocaleString('es-AR')} kg` : '—'
}

/** Una cosecha encontrada: lo esencial a la vista y el resto desplegable. */
function TarjetaCosecha({ c, onElegir }: { c: CosechaExistente; onElegir: () => void }) {
  const [abierta, setAbierta] = useState(false)
  const b = c.borrador
  const transporte = b.transporte ?? 'Sin transporte'

  const detalle = [
    { lbl: 'Cultivo', val: c.textos.cultivo },
    { lbl: 'Campaña', val: c.textos.campana },
    { lbl: 'Campo', val: c.textos.campo },
    { lbl: 'Lote', val: c.textos.lote },
    { lbl: 'Fecha', val: fecha(b.fecha) },
    { lbl: 'KG', val: kilos(b.kg) },
    { lbl: 'Destino granos en depósito', val: c.textos.deposito },
    { lbl: 'Tipo de transporte', val: b.transporte ?? '' },
    b.transporte === 'Flete Propio'
      ? { lbl: 'Maquinaria', val: c.textos.maquinarias }
      : { lbl: 'Proveedor', val: c.textos.proveedor },
    { lbl: 'Carta de porte', val: b.cartaPorte },
    { lbl: 'KM', val: b.km },
    { lbl: 'CTG', val: b.ctg },
    { lbl: 'Estado de registro', val: c.estadoRegistro },
    { lbl: 'Estado duplicado', val: c.estadoDuplicado },
  ]

  return (
    <div className={`cos-card ${abierta ? 'cos-card--abierta' : ''}`}>
      <div className="cos-head">
        <div className="cos-titulo">
          <span className="cos-nombre">
            {c.codigo && <span className="cos-codigo">{c.codigo}</span>}
            {c.nombre}
          </span>
          <span className="cos-chips">
            {c.textos.cultivo && <span className="chip chip--campo">{c.textos.cultivo}</span>}
            {c.textos.campana && <span className="chip">{c.textos.campana}</span>}
            <span className="chip chip--violeta">{c.textos.campo || 'Sin campo'}</span>
            <span className={`chip ${b.transporte === 'Flete Propio' ? 'chip--verde' : 'chip--ambar'}`}>
              {transporte}
            </span>
            {c.estadoDuplicado === COSECHA_DUPLICADO && (
              <span className="chip chip--naranja">Ya fue duplicada</span>
            )}
          </span>
          <span className="cos-resumen">
            <i className="fas fa-calendar-day" aria-hidden /> {fecha(b.fecha)}
            <span className="cos-sep">·</span>
            <i className="fas fa-weight-hanging" aria-hidden /> {kilos(b.kg)}
            {c.textos.lote && (
              <>
                <span className="cos-sep">·</span>
                <i className="fas fa-map-location-dot" aria-hidden /> {c.textos.lote}
              </>
            )}
          </span>
        </div>
        <div className="cos-acciones">
          <button
            type="button"
            className="btn btn-out btn--sm"
            aria-expanded={abierta}
            onClick={() => setAbierta((v) => !v)}
          >
            <i className={`fas fa-chevron-${abierta ? 'up' : 'down'}`} aria-hidden />
            {abierta ? 'Ocultar' : 'Ver todo'}
          </button>
          <button type="button" className="btn btn-primary btn--sm" onClick={onElegir}>
            <i className="fas fa-copy" aria-hidden /> Duplicar esta
          </button>
        </div>
      </div>
      {abierta && (
        <div className="cos-detalle resumen-grid">
          {detalle.map((d) => (
            <div className="resumen-dato" key={d.lbl}>
              <span className="resumen-lbl">{d.lbl}</span>
              <span className="resumen-val cos-val" title={d.val || undefined}>
                {d.val || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Buscador de cosechas existentes para duplicar.
 *
 * No trae el tablero entero: la búsqueda la resuelve monday con lo escrito y los filtros, y sólo
 * viajan las coincidencias (las 30 más nuevas). Sin texto ni filtro no se muestra nada.
 */
export function BuscadorCosechas({ catalogos, onElegir }: Props) {
  const [filtro, setFiltro] = useState<FiltroCosechas>(FILTRO_VACIO)
  const [estado, setEstado] = useState<Estado>({ fase: 'inactivo' })
  /** Número de la última búsqueda: una respuesta vieja que llega tarde no pisa a la nueva. */
  const ultima = useRef(0)

  useEffect(() => {
    if (!hayFiltro(filtro)) {
      setEstado({ fase: 'inactivo' })
      return
    }
    const n = ++ultima.current
    const t = setTimeout(() => {
      setEstado({ fase: 'buscando' })
      buscarCosechas(filtro)
        .then((r) => n === ultima.current && setEstado({ fase: 'listo', ...r }))
        .catch(
          (e: unknown) =>
            n === ultima.current &&
            setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) }),
        )
    }, ESPERA_MS)
    return () => clearTimeout(t)
  }, [filtro])

  const cambiar = (parcial: Partial<FiltroCosechas>) => setFiltro((f) => ({ ...f, ...parcial }))

  const opCultivos: OpcionSelector[] = catalogos.cultivos.map((c) => ({ id: c.id, nombre: c.nombre }))
  const opCampanas: OpcionSelector[] = catalogos.campanas.map((c) => ({ id: c.id, nombre: c.nombre }))
  const opCampos: OpcionSelector[] = catalogos.campos.map((c) => ({ id: c.id, nombre: c.nombre }))
  /* Con un campo elegido, el filtro de lote ofrece sólo los de ese campo; sin campo, todos (con
     el campo como detalle para distinguir "LOTE 3" de un campo y de otro). */
  const opLotes: OpcionSelector[] = useMemo(() => {
    const campos = filtro.campoId ? catalogos.campos.filter((c) => c.id === filtro.campoId) : catalogos.campos
    return campos.flatMap((c) => c.lotes.map((l) => ({ id: l.id, nombre: l.nombre, detalle: c.nombre })))
  }, [catalogos.campos, filtro.campoId])

  return (
    <>
      <div className="card card--input">
        <div className="ctitle">
          <i className="fas fa-magnifying-glass" style={{ color: '#0073ea' }} aria-hidden />
          Buscar la cosecha a duplicar
        </div>
        <div className="csub">
          Escribí parte del nombre (ej.: Soja, 2025-2026, Fecha 14-08) y combiná los filtros. Se
          muestran sólo las coincidencias.
        </div>

        <div className="buscador-campo" style={{ marginBottom: 12 }}>
          <i className="fas fa-search" aria-hidden />
          <input
            value={filtro.texto}
            onChange={(e) => cambiar({ texto: e.target.value })}
            placeholder="Nombre de la cosecha…"
            aria-label="Buscar cosecha por nombre"
          />
        </div>

        <div className="filtros-cosecha">
          <div className="ig">
            <span className="ig-lbl">Cultivo</span>
            <SelectorBuscable opciones={opCultivos} valor={filtro.cultivoId} onCambio={(id) => cambiar({ cultivoId: id })} placeholder="Todos" />
          </div>
          <div className="ig">
            <span className="ig-lbl">Campo</span>
            <SelectorBuscable
              opciones={opCampos}
              valor={filtro.campoId}
              onCambio={(id) => {
                // Otro campo deja afuera al lote elegido si no es de ese campo.
                const campo = catalogos.campos.find((c) => c.id === id)
                const loteSigue = !campo || campo.lotes.some((l) => l.id === filtro.loteId)
                cambiar({ campoId: id, loteId: loteSigue ? filtro.loteId : null })
              }}
              placeholder="Todos"
            />
          </div>
          <div className="ig">
            <span className="ig-lbl">Lote</span>
            <SelectorBuscable opciones={opLotes} valor={filtro.loteId} onCambio={(id) => cambiar({ loteId: id })} placeholder="Todos" />
          </div>
          <div className="ig">
            <span className="ig-lbl">Campaña</span>
            <SelectorBuscable opciones={opCampanas} valor={filtro.campanaId} onCambio={(id) => cambiar({ campanaId: id })} placeholder="Todas" />
          </div>
        </div>

        {hayFiltro(filtro) && (
          <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setFiltro(FILTRO_VACIO)}>
            <i className="fas fa-xmark" aria-hidden /> Limpiar búsqueda
          </button>
        )}
      </div>

      {estado.fase === 'inactivo' && (
        <p className="buscador-ayuda" style={{ textAlign: 'center' }}>
          Escribí o elegí un filtro para ver las cosechas que coinciden.
        </p>
      )}
      {estado.fase === 'buscando' && (
        <div className="pantalla-estado" style={{ padding: 24 }}>
          <div className="spinner" />
        </div>
      )}
      {estado.fase === 'error' && (
        <div className="aviso aviso--error">
          <i className="fas fa-circle-exclamation" aria-hidden />
          <span>No se pudo buscar: {estado.mensaje}</span>
        </div>
      )}
      {estado.fase === 'listo' &&
        (estado.cosechas.length === 0 ? (
          <p className="buscador-ayuda" style={{ textAlign: 'center' }}>
            No hay cosechas que coincidan con la búsqueda.
          </p>
        ) : (
          <>
            <div className="buscador-cuenta">
              {estado.hayMas
                ? `Se muestran las ${estado.cosechas.length} más nuevas: afiná la búsqueda para ver otras.`
                : plural(estado.cosechas.length, 'cosecha coincide', 'cosechas coinciden')}
            </div>
            <div className="cos-lista">
              {estado.cosechas.map((c) => (
                <TarjetaCosecha key={c.id} c={c} onElegir={() => onElegir(c)} />
              ))}
            </div>
          </>
        ))}
    </>
  )
}

