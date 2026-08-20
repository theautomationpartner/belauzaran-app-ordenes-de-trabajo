import { useMemo } from 'react'
import type { BorradorOrden, Catalogos, LineaProducto } from '@/types'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { ResumenOrden } from './ResumenOrden'
import { buscar, lineasCargadas, nuevoUid, productosTomados } from '@/lib/orden'
import { aNumero, usd } from '@/lib/format'

interface Props {
  catalogos: Catalogos
  borrador: BorradorOrden
  onCambio: (parcial: Partial<BorradorOrden>) => void
  onEditarDatos: () => void
}

/**
 * Paso 2 — Productos a utilizar.
 *
 * Los productos y sus dosis se cargan ANTES de los campos porque son los mismos para toda la
 * carga: se elige una vez qué se aplica y cuánto por hectárea, y después cada lote multiplica
 * esa dosis por su superficie. Cada producto termina siendo un subitem de la orden.
 *
 * El paso admite quedarse vacío: hay labores puramente mecánicas (disco, corte, rastra) que no
 * aplican ningún insumo.
 */
export function Paso2Productos({ catalogos, borrador, onCambio, onEditarDatos }: Props) {
  const opcionesBase: OpcionSelector[] = useMemo(
    () =>
      catalogos.productos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        detalle: [
          p.unidad && `Se mide en ${p.unidad}`,
          p.precioUnitario != null && `${usd(p.precioUnitario)} por ${p.unidad || 'unidad'}`,
        ]
          .filter(Boolean)
          .join(' · '),
        chip: p.tipo || undefined,
        chipClase: 'chip--gris',
      })),
    [catalogos.productos],
  )

  const cargadas = lineasCargadas(borrador)

  const actualizarLinea = (uid: string, parcial: Partial<LineaProducto>) => {
    onCambio({
      productos: borrador.productos.map((l) => (l.uid === uid ? { ...l, ...parcial } : l)),
    })
  }

  /**
   * Al elegir un producto se propone su cantidad por hectárea de referencia. Es una sugerencia
   * editable: ahorra tipear en los 112 productos que la tienen cargada, y no estorba en el resto.
   */
  const elegirProducto = (linea: LineaProducto, productoId: string | null) => {
    const producto = buscar(catalogos.productos, productoId)
    const sugerida = producto?.cantPorHaSugerida
    actualizarLinea(linea.uid, {
      productoId,
      cantPorHa: sugerida != null ? String(sugerida).replace('.', ',') : '',
    })
  }

  const agregarLinea = () => {
    onCambio({
      productos: [...borrador.productos, { uid: nuevoUid(), productoId: null, cantPorHa: '' }],
    })
  }

  const quitarLinea = (uid: string) => {
    const restantes = borrador.productos.filter((l) => l.uid !== uid)
    // Siempre queda una línea en blanco: sin ninguna, la pantalla no diría cómo agregar productos.
    onCambio({
      productos:
        restantes.length > 0 ? restantes : [{ uid: nuevoUid(), productoId: null, cantPorHa: '' }],
    })
  }

  return (
    <div className="view">
      <PasoHeader
        numero={2}
        titulo="Productos a utilizar"
        descripcion="Agregá los insumos de la labor y la cantidad por hectárea. Se aplican con la misma dosis en todos los lotes que elijas después."
      />

      <ResumenOrden catalogos={catalogos} borrador={borrador} onEditar={onEditarDatos} />

      <div className="bloques">
        {borrador.productos.map((linea, i) => {
          const producto = buscar(catalogos.productos, linea.productoId)
          const tomados = productosTomados(borrador, linea.uid)
          const opciones = opcionesBase.filter((o) => !tomados.has(o.id))
          const cantidad = aNumero(linea.cantPorHa)
          const completa = Boolean(producto) && cantidad != null && cantidad > 0
          const unidad = producto?.unidad || 'unidad'

          return (
            <div className={`bloque ${completa ? 'bloque--completo' : ''}`} key={linea.uid}>
              <div className="bloque-head">
                <span className="bloque-nro">
                  {completa ? <i className="fas fa-check" /> : i + 1}
                </span>
                <span className="bloque-tit">{producto ? producto.nombre : 'Nuevo producto'}</span>
                {producto?.tipo && <span className="chip chip--gris">{producto.tipo}</span>}
                {borrador.productos.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-ghost--rojo"
                    onClick={() => quitarLinea(linea.uid)}
                    aria-label={`Quitar ${producto?.nombre ?? `el producto ${i + 1}`}`}
                  >
                    <i className="fas fa-trash-can" aria-hidden /> Quitar
                  </button>
                )}
              </div>

              <div className="bloque-body">
                <div className="grid-producto">
                  <div className="ig">
                    <label className="ig-lbl ig-req">Producto</label>
                    <SelectorBuscable
                      opciones={opciones}
                      valor={linea.productoId}
                      onCambio={(id) => elegirProducto(linea, id)}
                      placeholder="Buscá el producto…"
                      vacio="Ya agregaste todos los productos disponibles."
                    />
                  </div>

                  <div className="ig">
                    <label className="ig-lbl ig-req">Cantidad por hectárea</label>
                    <div className="fc-sufijo">
                      <input
                        className="fc"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0,00"
                        disabled={!producto}
                        value={linea.cantPorHa}
                        onChange={(e) => actualizarLinea(linea.uid, { cantPorHa: e.target.value })}
                      />
                      <span>{producto ? unidad : ''}</span>
                    </div>
                    {producto?.cantPorHaSugerida != null && (
                      <span className="ig-hint">
                        Referencia del tablero: {producto.cantPorHaSugerida} {unidad} por ha.
                      </span>
                    )}
                  </div>

                  <div className="ig">
                    <span className="ig-lbl">Precio unitario</span>
                    <div className="dato-fijo">
                      {producto ? (
                        producto.precioUnitario != null ? (
                          <>
                            <strong>{usd(producto.precioUnitario)}</strong>
                            <span className="xs"> por {unidad}</span>
                          </>
                        ) : (
                          <span className="muted">Sin precio cargado en Monday</span>
                        )
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                    {completa && producto?.precioUnitario != null && (
                      <span className="ig-hint">
                        {usd(producto.precioUnitario * (cantidad ?? 0))} por hectárea.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="acciones-bloque">
        <button type="button" className="btn btn-outblue" onClick={agregarLinea}>
          <i className="fas fa-plus" aria-hidden /> Agregar otro producto
        </button>
        <span className="xs">
          {cargadas.length === 0
            ? 'Sin productos: la orden se va a cargar sólo con la labor.'
            : `${cargadas.length} producto${cargadas.length === 1 ? '' : 's'} en la orden.`}
        </span>
      </div>

      {cargadas.length === 0 && (
        <div className="aviso aviso--info" style={{ marginTop: 14 }}>
          <i className="fas fa-circle-info" aria-hidden />
          <span>
            Si la labor no aplica insumos (disco, corte, rastra…), podés continuar sin cargar
            ningún producto.
          </span>
        </div>
      )}
    </div>
  )
}
