import { useMemo, useState } from 'react'
import type { BorradorOrden, Catalogos, LineaProducto } from '@/types'
import { BuscadorAgregar, type ResultadoBusqueda } from '@/components/ui/BuscadorAgregar'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { ResumenOrden } from './ResumenOrden'
import { buscar, lineasCargadas, nuevoUid } from '@/lib/orden'
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
 * carga: se elige una vez qué se aplica y cuánto por hectárea, y después cada lote multiplica esa
 * dosis por su superficie. Cada producto termina siendo un subitem de la orden.
 *
 * El paso admite quedarse vacío: hay labores puramente mecánicas (disco, corte, rastra) que no
 * aplican ningún insumo.
 */
export function Paso2Productos({ catalogos, borrador, onCambio, onEditarDatos }: Props) {
  const [tipo, setTipo] = useState<string | null>(null)

  /** Universo de búsqueda. Se arma una vez; el buscador decide qué pintar. */
  const universo: ResultadoBusqueda[] = useMemo(
    () =>
      catalogos.productos.map((p) => ({
        id: p.id,
        // La etiqueta oficial del tablero es la que ellos reconocen y la que va al subitem.
        titulo: p.etiqueta,
        detalle:
          p.precioUnitario != null
            ? `${usd(p.precioUnitario)} por ${p.unidad || 'unidad'}`
            : 'Sin precio cargado',
        chips: [p.tipo].filter(Boolean),
      })),
    [catalogos.productos],
  )

  const cargadas = lineasCargadas(borrador)
  const agregados = useMemo(
    () => new Set(cargadas.map((l) => l.productoId as string)),
    [cargadas],
  )

  const actualizarLinea = (uid: string, parcial: Partial<LineaProducto>) => {
    onCambio({
      productos: borrador.productos.map((l) => (l.uid === uid ? { ...l, ...parcial } : l)),
    })
  }

  /**
   * Agrega el producto con su cantidad por hectárea de referencia ya puesta. Es una sugerencia
   * editable: ahorra tipear en los productos que la tienen cargada y no estorba en el resto.
   */
  const agregar = (productoId: string) => {
    const producto = buscar(catalogos.productos, productoId)
    const sugerida = producto?.cantPorHaSugerida
    onCambio({
      productos: [
        ...borrador.productos,
        {
          uid: nuevoUid(),
          productoId,
          cantPorHa: sugerida != null ? String(sugerida).replace('.', ',') : '',
        },
      ],
    })
  }

  const quitar = (uid: string) => {
    onCambio({ productos: borrador.productos.filter((l) => l.uid !== uid) })
  }

  return (
    <div className="view">
      <PasoHeader
        numero={2}
        titulo="Productos a utilizar"
        descripcion="Buscá los insumos de la labor y cargá la cantidad por hectárea. Se aplican con la misma dosis en todos los lotes que elijas después."
      />

      <ResumenOrden catalogos={catalogos} borrador={borrador} onEditar={onEditarDatos} />

      <div className="card card--input">
        <div className="ctitle">
          <i className="fas fa-magnifying-glass" style={{ color: '#0073ea' }} aria-hidden />
          Buscar productos
        </div>
        <div className="csub">
          Escribí parte del nombre y tocá Buscar, o filtrá por tipo. Podés agregar varios seguidos
          sin salir del buscador.
        </div>

        <BuscadorAgregar
          items={universo}
          agregados={agregados}
          onAgregar={agregar}
          placeholder="Ej.: round up, urea, avena…"
          ayuda={`Hay ${catalogos.productos.length} productos activos. Buscá por nombre o elegí un tipo para ver los que correspondan.`}
          filtros={[
            {
              titulo: 'Tipo de producto',
              opciones: catalogos.filtros.tiposProducto,
              valor: tipo,
              onCambio: setTipo,
            },
          ]}
        />
      </div>

      {cargadas.length > 0 && (
        <div className="bloques">
          {borrador.productos.map((linea, i) => {
            const producto = buscar(catalogos.productos, linea.productoId)
            if (!producto) return null

            const cant = aNumero(linea.cantPorHa)
            const completa = cant != null && cant > 0
            const unidad = producto.unidad || 'unidad'

            return (
              <div className={`bloque ${completa ? 'bloque--completo' : ''}`} key={linea.uid}>
                <div className="bloque-head">
                  <span className="bloque-nro">
                    {completa ? <i className="fas fa-check" /> : i + 1}
                  </span>
                  <span className="bloque-tit">{producto.etiqueta}</span>
                  {producto.tipo && <span className="chip chip--gris">{producto.tipo}</span>}
                  <button
                    type="button"
                    className="btn btn-ghost btn-ghost--rojo"
                    onClick={() => quitar(linea.uid)}
                    aria-label={`Quitar ${producto.etiqueta}`}
                  >
                    <i className="fas fa-trash-can" aria-hidden /> Quitar
                  </button>
                </div>

                <div className="bloque-body">
                  <div className="grid-producto">
                    <div className="ig">
                      <label className="ig-lbl ig-req">Cantidad por hectárea</label>
                      <div className="fc-sufijo">
                        <input
                          className="fc"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0,00"
                          value={linea.cantPorHa}
                          onChange={(e) =>
                            actualizarLinea(linea.uid, { cantPorHa: e.target.value })
                          }
                        />
                        <span>{unidad}</span>
                      </div>
                      {producto.cantPorHaSugerida != null && (
                        <span className="ig-hint">
                          Referencia del tablero: {producto.cantPorHaSugerida} {unidad} por ha.
                        </span>
                      )}
                    </div>

                    <div className="ig">
                      <span className="ig-lbl">Precio unitario</span>
                      <div className="dato-fijo">
                        {producto.precioUnitario != null ? (
                          <>
                            <strong>{usd(producto.precioUnitario)}</strong>
                            <span className="xs">&nbsp;por {unidad}</span>
                          </>
                        ) : (
                          <span className="muted">Sin precio cargado en Monday</span>
                        )}
                      </div>
                    </div>

                    <div className="ig">
                      <span className="ig-lbl">Costo por hectárea</span>
                      <div className="dato-fijo">
                        {completa && producto.precioUnitario != null ? (
                          <strong className="t-green">
                            {usd(producto.precioUnitario * (cant ?? 0))}
                          </strong>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="acciones-bloque">
        <span className="xs">
          {cargadas.length === 0
            ? 'Sin productos: la orden se va a cargar sólo con la labor.'
            : `${cargadas.length} producto${cargadas.length === 1 ? '' : 's'} en la orden.`}
        </span>
      </div>

      {cargadas.length === 0 && (
        <div className="aviso aviso--info" style={{ marginTop: 4 }}>
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
