import { useMemo } from 'react'
import type { BloqueCampo, BorradorOrden, Campo, Catalogos } from '@/types'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { ResumenOrden } from './ResumenOrden'
import { buscar, expandirOrdenes, lotesTomados, nuevoUid } from '@/lib/orden'
import { hectareas } from '@/lib/format'

interface Props {
  catalogos: Catalogos
  borrador: BorradorOrden
  onCambio: (parcial: Partial<BorradorOrden>) => void
  onEditarPaso1: () => void
}

/** Hectáreas del lote: se muestra la productiva y, si no está cargada, la total. */
const hectareasDe = (l: { hectareasProductivas: number | null; hectareasTotales: number | null }) =>
  l.hectareasProductivas ?? l.hectareasTotales

/**
 * Paso 2 — Campos y lotes.
 *
 * Cada bloque es UN campo con los lotes que se le eligen. El usuario puede agregar tantos bloques
 * como campos necesite. Al emitir, cada lote se convierte en una orden propia: el tablero
 * ✋ Orden de Trabajo admite un solo campo y un solo lote por item.
 */
export function Paso2Campos({ catalogos, borrador, onCambio, onEditarPaso1 }: Props) {
  const opCampos: OpcionSelector[] = catalogos.campos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    detalle: c.lotes.length === 1 ? '1 lote' : `${c.lotes.length} lotes`,
  }))

  const ordenes = useMemo(
    () => expandirOrdenes(borrador, catalogos.campos),
    [borrador, catalogos.campos],
  )

  const actualizarBloque = (uid: string, parcial: Partial<BloqueCampo>) => {
    onCambio({
      bloques: borrador.bloques.map((b) => (b.uid === uid ? { ...b, ...parcial } : b)),
    })
  }

  const agregarBloque = () => {
    onCambio({ bloques: [...borrador.bloques, { uid: nuevoUid(), campoId: null, loteIds: [] }] })
  }

  const quitarBloque = (uid: string) => {
    const restantes = borrador.bloques.filter((b) => b.uid !== uid)
    // Nunca queda vacío: sin ningún bloque la pantalla no diría qué hacer a continuación.
    onCambio({
      bloques: restantes.length > 0 ? restantes : [{ uid: nuevoUid(), campoId: null, loteIds: [] }],
    })
  }

  const alternarLote = (bloque: BloqueCampo, loteId: string) => {
    const ya = bloque.loteIds.includes(loteId)
    actualizarBloque(bloque.uid, {
      loteIds: ya ? bloque.loteIds.filter((id) => id !== loteId) : [...bloque.loteIds, loteId],
    })
  }

  /** Al cambiar de campo se descartan los lotes elegidos: eran de otro campo. */
  const cambiarCampo = (bloque: BloqueCampo, campoId: string | null) => {
    actualizarBloque(bloque.uid, { campoId, loteIds: [] })
  }

  /** Campos ya usados en otros bloques: repetirlos duplicaría la carga sin sentido. */
  const camposTomados = (uid: string) =>
    new Set(
      borrador.bloques.filter((b) => b.uid !== uid && b.campoId).map((b) => b.campoId as string),
    )

  return (
    <div className="view">
      <PasoHeader
        numero={2}
        titulo="Campos y lotes"
        descripcion="Agregá un campo por bloque y marcá los lotes de ese campo. Se genera una orden por cada lote."
      />

      <ResumenOrden catalogos={catalogos} borrador={borrador} onEditar={onEditarPaso1} />

      <div className="bloques">
        {borrador.bloques.map((bloque, i) => {
          const campo: Campo | null = buscar(catalogos.campos, bloque.campoId)
          const tomadosLotes = lotesTomados(borrador, bloque.uid)
          const tomadosCampos = camposTomados(bloque.uid)
          const opciones = opCampos.filter((o) => !tomadosCampos.has(o.id))
          const completo = Boolean(campo) && bloque.loteIds.length > 0
          const seleccionables = campo ? campo.lotes.filter((l) => !tomadosLotes.has(l.id)) : []
          const todosMarcados =
            seleccionables.length > 0 && seleccionables.every((l) => bloque.loteIds.includes(l.id))

          return (
            <div className={`bloque ${completo ? 'bloque--completo' : ''}`} key={bloque.uid}>
              <div className="bloque-head">
                <span className="bloque-nro">{completo ? <i className="fas fa-check" /> : i + 1}</span>
                <span className="bloque-tit">{campo ? campo.nombre : 'Nuevo campo'}</span>
                {completo && (
                  <span className="chip chip--campo">
                    {bloque.loteIds.length === 1
                      ? '1 lote'
                      : `${bloque.loteIds.length} lotes`}
                  </span>
                )}
                {borrador.bloques.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-ghost--rojo"
                    onClick={() => quitarBloque(bloque.uid)}
                    aria-label={`Quitar el campo ${campo?.nombre ?? i + 1}`}
                  >
                    <i className="fas fa-trash-can" aria-hidden /> Quitar
                  </button>
                )}
              </div>

              <div className="bloque-body">
                <div className="ig" style={{ maxWidth: 380 }}>
                  <label className="ig-lbl ig-req">Campo</label>
                  <SelectorBuscable
                    opciones={opciones}
                    valor={bloque.campoId}
                    onCambio={(id) => cambiarCampo(bloque, id)}
                    placeholder="Seleccioná el campo…"
                    vacio="Ya agregaste todos los campos disponibles."
                  />
                </div>

                {campo && (
                  <div className="ig">
                    <div className="lotes-head">
                      <span className="ig-lbl ig-req">
                        Lotes de {campo.nombre}
                        {bloque.loteIds.length > 0 && (
                          <span className="ig-ok">
                            <i className="fas fa-check" aria-hidden /> {bloque.loteIds.length}{' '}
                            seleccionado{bloque.loteIds.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                      {seleccionables.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-outblue btn--sm"
                          onClick={() =>
                            actualizarBloque(bloque.uid, {
                              loteIds: todosMarcados ? [] : seleccionables.map((l) => l.id),
                            })
                          }
                        >
                          <i className={`fas fa-${todosMarcados ? 'xmark' : 'list-check'}`} aria-hidden />
                          {todosMarcados ? 'Quitar todos' : 'Seleccionar todos'}
                        </button>
                      )}
                    </div>

                    {campo.lotes.length === 0 ? (
                      <div className="aviso aviso--warn">
                        <i className="fas fa-triangle-exclamation" aria-hidden />
                        <span>
                          El campo <strong>{campo.nombre}</strong> no tiene lotes cargados como
                          subelementos en Monday.
                        </span>
                      </div>
                    ) : (
                      <div className="lotes-grid">
                        {campo.lotes.map((lote) => {
                          const marcado = bloque.loteIds.includes(lote.id)
                          const ocupado = tomadosLotes.has(lote.id)
                          return (
                            <button
                              type="button"
                              key={lote.id}
                              className={`lote ${marcado ? 'lote--sel' : ''}`}
                              aria-pressed={marcado}
                              disabled={ocupado}
                              title={
                                ocupado
                                  ? 'Este lote ya está cargado en otro bloque de esta misma orden.'
                                  : undefined
                              }
                              onClick={() => alternarLote(bloque, lote.id)}
                            >
                              <span className="lote-box">
                                {marcado && <i className="fas fa-check" aria-hidden />}
                              </span>
                              <span className="lote-body">
                                <span className="lote-nom">{lote.nombre}</span>
                                {ocupado ? (
                                  <span className="lote-tomado">Ya usado en otro bloque</span>
                                ) : (
                                  <span className="lote-ha">{hectareas(hectareasDe(lote))}</span>
                                )}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="btn btn-outblue" onClick={agregarBloque}>
          <i className="fas fa-plus" aria-hidden /> Agregar otro campo
        </button>
        <span className="xs">
          {ordenes.length === 0
            ? 'Todavía no hay lotes seleccionados.'
            : `Se van a generar ${ordenes.length} orden${ordenes.length === 1 ? '' : 'es'} de trabajo.`}
        </span>
      </div>
    </div>
  )
}
