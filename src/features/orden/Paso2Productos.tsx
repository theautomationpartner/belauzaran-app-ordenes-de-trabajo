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
  const [tipos, setTipos] = useState<string[]>([])

  /** Universo de búsqueda. Se arma una vez; el buscador decide qué pintar. */
  const universo: ResultadoBusqueda[] = useMemo(
    () =>
      catalogos.productos.map((p) => ({
        id: p.id,
        // La etiqueta oficial del tablero es la que ellos reconocen y la que va al subitem.
        titulo: p.etiqueta,
        detalle: [
          p.tipo,
          p.precioUnitario != null
            ? `${usd(p.precioUnitario)} por ${p.unidad || 'unidad'}`
            : 'Sin precio cargado',
        ]
          .filter(Boolean)
          .join(' · '),
        chips: [p.tipo].filter(Boolean),
      })),
    [catalogos.productos],
  )

  const cargadas = lineasCargadas(borrador)
  const agregados = useMemo(() => new Set(cargadas.map((l) => l.productoId as string)), [cargadas])

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
          <span className="chip chip--opcional">Opcional</span>
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
              valores: tipos,
              onCambio: setTipos,
            },
          ]}
        />
      </div>

      {/* Los productos cargados van en UNA tabla, una fila por insumo: puestos en tarjetas
          separadas había que recorrer la pantalla entera para comparar dos dosis. */}
      {cargadas.length > 0 && (
        <div className="card card--input card--flush">
          <div className="ctitle">
            <i className="fas fa-flask" style={{ color: '#6200ee' }} aria-hidden />
            Productos de la orden
            <span className="chip">{cargadas.length}</span>
          </div>
          <div className="csub">
            Cada uno va a ser un subelemento de la orden, con la cantidad recalculada según las
            hectáreas de cada lote.
          </div>

          <div className="tabla-wrap">
            <div className="tabla-scroll">
              <table className="tabla tabla-productos">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Cantidad por hectárea</th>
                    <th className="num">Precio unitario</th>
                    <th className="num">Costo por hectárea</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {borrador.productos.map((linea) => {
                    const producto = buscar(catalogos.productos, linea.productoId)
                    if (!producto) return null

                    const cant = aNumero(linea.cantPorHa)
                    const completa = cant != null && cant > 0
                    const unidad = producto.unidad || 'unidad'

                    return (
                      <tr key={linea.uid} className={completa ? '' : 'fila--incompleta'}>
                        <td data-lbl="Producto">
                          <span className="prod-nom">{producto.etiqueta}</span>
                        </td>

                        <td data-lbl="Cantidad por hectárea" className="num">
                          <div className="fc-sufijo fc-sufijo--tabla">
                            <input
                              className="fc fc--tabla"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="0,00"
                              aria-label={`Cantidad por hectárea de ${producto.etiqueta}`}
                              value={linea.cantPorHa}
                              onChange={(e) =>
                                actualizarLinea(linea.uid, { cantPorHa: e.target.value })
                              }
                            />
                            <span>{unidad}</span>
                          </div>
                        </td>

                        <td data-lbl="Precio unitario" className="num">
                          {producto.precioUnitario != null ? (
                            usd(producto.precioUnitario)
                          ) : (
                            <span className="muted">Sin precio</span>
                          )}
                        </td>

                        <td data-lbl="Costo por hectárea" className="num font-b">
                          {completa && producto.precioUnitario != null ? (
                            <span className="t-green">
                              {usd(producto.precioUnitario * (cant ?? 0))}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>

                        <td data-lbl="" className="celda-accion">
                          <button
                            type="button"
                            className="btn btn-ghost btn-ghost--rojo btn--sm"
                            onClick={() => quitar(linea.uid)}
                            aria-label={`Quitar ${producto.etiqueta}`}
                          >
                            <i className="fas fa-trash-can" aria-hidden /> Quitar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {cargadas.length === 0 && (
        <div className="aviso aviso--info">
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
