import { useMemo } from 'react'
import type { BloqueCampo, BorradorOrden, Catalogos } from '@/types'
import { BuscadorAgregar, type ResultadoBusqueda } from '@/components/ui/BuscadorAgregar'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { ResumenOrden } from './ResumenOrden'
import { buscar, expandirOrdenes, hectareasDeLote, lotesTomados, nuevoUid } from '@/lib/orden'
import { hectareas } from '@/lib/format'

interface Props {
  catalogos: Catalogos
  borrador: BorradorOrden
  onCambio: (parcial: Partial<BorradorOrden>) => void
  onEditarDatos: () => void
}

/**
 * Paso 3 — Campos y lotes.
 *
 * El buscador de campos vive arriba, igual que el de productos: se agrega un campo y su bloque de
 * lotes aparece debajo. Son sólo 16 campos, así que el buscador los muestra TODOS de entrada y
 * filtra a medida que se escribe —con un catálogo tan chico, ver la lista completa es más rápido
 * que buscar a ciegas—.
 *
 * Al emitir, cada lote se convierte en una orden propia: el tablero ✋ Orden de Trabajo admite un
 * solo campo y un solo lote por item.
 */
export function Paso3Campos({ catalogos, borrador, onCambio, onEditarDatos }: Props) {
  const universo: ResultadoBusqueda[] = useMemo(
    () =>
      catalogos.campos.map((c) => ({
        id: c.id,
        titulo: c.nombre,
        detalle: c.lotes.length === 1 ? '1 lote' : `${c.lotes.length} lotes`,
      })),
    [catalogos.campos],
  )

  const bloques = borrador.bloques.filter((b) => b.campoId)
  const agregados = useMemo(
    () => new Set(bloques.map((b) => b.campoId as string)),
    [bloques],
  )

  const ordenes = useMemo(
    () => expandirOrdenes(borrador, catalogos),
    [borrador, catalogos],
  )

  const actualizarBloque = (uid: string, parcial: Partial<BloqueCampo>) => {
    onCambio({
      bloques: borrador.bloques.map((b) => (b.uid === uid ? { ...b, ...parcial } : b)),
    })
  }

  const agregarCampo = (campoId: string) => {
    onCambio({ bloques: [...bloques, { uid: nuevoUid(), campoId, loteIds: [] }] })
  }

  const quitarBloque = (uid: string) => {
    onCambio({ bloques: borrador.bloques.filter((b) => b.uid !== uid) })
  }

  const alternarLote = (bloque: BloqueCampo, loteId: string) => {
    const ya = bloque.loteIds.includes(loteId)
    actualizarBloque(bloque.uid, {
      loteIds: ya ? bloque.loteIds.filter((id) => id !== loteId) : [...bloque.loteIds, loteId],
    })
  }

  return (
    <div className="view">
      <PasoHeader
        numero={3}
        titulo="Campos y lotes"
        descripcion="Agregá los campos y marcá los lotes de cada uno. Se genera una orden por cada lote."
      />

      <ResumenOrden catalogos={catalogos} borrador={borrador} onEditar={onEditarDatos} />

      <div className="card card--input">
        <div className="ctitle">
          <i className="fas fa-map-location-dot" style={{ color: '#0073ea' }} aria-hidden />
          Buscar campos
        </div>
        <div className="csub">
          Tocá un campo para agregarlo. Sus lotes aparecen abajo para que elijas cuáles entran.
        </div>

        <BuscadorAgregar
          items={universo}
          agregados={agregados}
          onAgregar={agregarCampo}
          placeholder="Filtrá por nombre del campo…"
          /* Con 16 campos, esconder la lista detrás de un botón "Buscar" sería peor: se muestran
             todos y el texto sólo achica la lista. */
          mostrarTodo
        />
      </div>

      {bloques.length > 0 && (
        <div className="bloques">
          {bloques.map((bloque, i) => {
            const campo = buscar(catalogos.campos, bloque.campoId)
            if (!campo) return null

            const tomados = lotesTomados(borrador, bloque.uid)
            const completo = bloque.loteIds.length > 0
            const seleccionables = campo.lotes.filter((l) => !tomados.has(l.id))
            const todosMarcados =
              seleccionables.length > 0 && seleccionables.every((l) => bloque.loteIds.includes(l.id))

            return (
              <div className={`bloque ${completo ? 'bloque--completo' : ''}`} key={bloque.uid}>
                <div className="bloque-head">
                  <span className="bloque-nro">
                    {completo ? <i className="fas fa-check" /> : i + 1}
                  </span>
                  <span className="bloque-tit">{campo.nombre}</span>
                  {completo && (
                    <span className="chip chip--campo">
                      {bloque.loteIds.length === 1 ? '1 lote' : `${bloque.loteIds.length} lotes`}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-ghost--rojo"
                    onClick={() => quitarBloque(bloque.uid)}
                    aria-label={`Quitar el campo ${campo.nombre}`}
                  >
                    <i className="fas fa-trash-can" aria-hidden /> Quitar
                  </button>
                </div>

                <div className="bloque-body">
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
                          <i
                            className={`fas fa-${todosMarcados ? 'xmark' : 'list-check'}`}
                            aria-hidden
                          />
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
                          const ocupado = tomados.has(lote.id)
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
                                  <span className="lote-ha">{hectareas(hectareasDeLote(lote))}</span>
                                )}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="acciones-bloque">
        <span className="xs">
          {ordenes.length === 0
            ? 'Todavía no hay lotes seleccionados.'
            : `Se van a generar ${ordenes.length} orden${ordenes.length === 1 ? '' : 'es'} de trabajo.`}
        </span>
      </div>
    </div>
  )
}
