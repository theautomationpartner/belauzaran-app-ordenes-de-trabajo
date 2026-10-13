import { useCallback, useMemo, useState } from 'react'
import type { BorradorOrden, Catalogos, LineaProducto, Producto } from '@/types'
import { BuscadorAgregar, type ResultadoBusqueda } from '@/components/ui/BuscadorAgregar'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { Modal } from '@/components/ui/Modal'
import { ResumenOrden } from './ResumenOrden'
import { buscar, lineasCargadas, nuevoUid, reemplazosDe } from '@/lib/orden'
import { aNumero, usd } from '@/lib/format'

interface ToggleProps {
  activo: boolean
  onAlternar: () => void
  etiqueta: string
}

/** Casillero "Permitir reemplazo" de una línea: el mismo en la tabla y en la ventana de reemplazos. */
function ToggleReemplazo({ activo, onAlternar, etiqueta }: ToggleProps) {
  return (
    <button
      type="button"
      className={`reemplazo-toggle ${activo ? 'reemplazo-toggle--on' : ''}`}
      aria-pressed={activo}
      aria-label={`Permitir reemplazo de ${etiqueta}`}
      onClick={onAlternar}
    >
      <span className="reemplazo-toggle-box">{activo && <i className="fas fa-check" aria-hidden />}</span>
      {activo ? 'Sí, permitido' : 'Permitir'}
    </button>
  )
}

interface VentanaProps {
  producto: Producto
  reemplazos: Producto[]
  /** Productos que ya están en la orden, para marcarlos en la lista. */
  enLaOrden: Set<string>
  permitido: boolean
  onAlternar: () => void
  onCerrar: () => void
}

/**
 * Lista de equivalentes de un producto: los activos que comparten su principio activo. Es sólo
 * de consulta; al cerrarla se sigue cargando donde se estaba.
 */
function VentanaReemplazos({ producto, reemplazos, enLaOrden, permitido, onAlternar, onCerrar }: VentanaProps) {
  return (
    <Modal
      titulo={
        <>
          <i className="fas fa-right-left" style={{ color: 'var(--campo)' }} aria-hidden /> Reemplazos
          posibles
        </>
      }
      subtitulo={
        <>
          <strong>{producto.etiqueta}</strong> · Principio activo:{' '}
          {producto.principiosActivos.map((pa) => (
            <span className="chip chip--campo" key={pa} style={{ marginLeft: 4 }}>
              {pa}
            </span>
          ))}
        </>
      }
      onCerrar={onCerrar}
      pie={<ToggleReemplazo activo={permitido} onAlternar={onAlternar} etiqueta={producto.etiqueta} />}
    >
      {reemplazos.length === 0 ? (
        <p className="muted">No hay otros productos activos con este principio activo.</p>
      ) : (
        <div className="tabla-wrap">
          <div className="tabla-scroll">
            <table className="tabla tabla--compacta">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th className="num">Precio unitario</th>
                </tr>
              </thead>
              <tbody>
                {reemplazos.map((r) => (
                  <tr key={r.id}>
                    <td data-lbl="Producto">
                      <span className="font-b">{r.etiqueta}</span>
                      {/* Un principio activo combinado (o distinto) se aclara: no todo equivalente lo es al 100%. */}
                      {r.principiosActivos.join() !== producto.principiosActivos.join() && (
                        <span className="xs" style={{ display: 'block' }}>
                          {r.principiosActivos.join(' + ')}
                        </span>
                      )}
                      {enLaOrden.has(r.id) && (
                        <span className="chip chip--violeta" style={{ marginTop: 4 }}>
                          Ya está en la orden
                        </span>
                      )}
                    </td>
                    <td data-lbl="Tipo">{r.tipo || '—'}</td>
                    <td data-lbl="Precio unitario" className="num">
                      {r.precioUnitario != null ? (
                        `${usd(r.precioUnitario)} / ${r.unidad || 'unidad'}`
                      ) : (
                        <span className="muted">Sin precio</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}

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
  const [principios, setPrincipios] = useState<string[]>([])
  /** Línea cuyos reemplazos se están mirando en la ventana emergente. */
  const [viendoReemplazos, setViendoReemplazos] = useState<string | null>(null)
  const cerrarVentana = useCallback(() => setViendoReemplazos(null), [])

  /** Universo de búsqueda. Se arma una vez; el buscador decide qué pintar. */
  const universo: ResultadoBusqueda[] = useMemo(
    () =>
      catalogos.productos.map((p) => ({
        id: p.id,
        // La etiqueta oficial del tablero es la que ellos reconocen y la que va al subitem.
        titulo: p.etiqueta,
        detalle: [
          p.tipo,
          p.principiosActivos.length > 0 ? `P.A.: ${p.principiosActivos.join(' + ')}` : '',
          p.precioUnitario != null
            ? `${usd(p.precioUnitario)} por ${p.unidad || 'unidad'}`
            : 'Sin precio cargado',
        ]
          .filter(Boolean)
          .join(' · '),
        // Los filtros miran estas etiquetas: el tipo y los principios activos.
        chips: [p.tipo, ...p.principiosActivos].filter(Boolean),
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
          // Reemplazar es una decisión a conciencia: arranca en NO.
          permitirReemplazo: false,
        },
      ],
    })
  }

  /* La columna de reemplazo aparece sólo si hay algún producto con principio activo: para el
     resto no hay equivalente posible y la columna sería ruido. */
  const conPrincipio = cargadas.some(
    (l) => (buscar(catalogos.productos, l.productoId)?.principiosActivos.length ?? 0) > 0,
  )
  const lineaVentana = borrador.productos.find((l) => l.uid === viendoReemplazos) ?? null
  const productoVentana = lineaVentana ? buscar(catalogos.productos, lineaVentana.productoId) : null

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
          Escribí parte del nombre y tocá Buscar, o filtrá por principio activo o por tipo. Podés
          agregar varios seguidos sin salir del buscador.
        </div>

        <BuscadorAgregar
          items={universo}
          agregados={agregados}
          onAgregar={agregar}
          placeholder="Ej.: round up, urea, avena…"
          ayuda={`Hay ${catalogos.productos.length} productos activos. Buscá por nombre, o elegí un tipo o un principio activo para ver los que correspondan.`}
          filtros={[
            {
              titulo: 'Principio Activo',
              opciones: catalogos.filtros.principiosActivos,
              valores: principios,
              onCambio: setPrincipios,
              modo: 'desplegable',
            },
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
                    {conPrincipio && <th>Permitir reemplazo</th>}
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
                          {producto.principiosActivos.length > 0 && (
                            <span className="prod-pa">
                              P.A.: {producto.principiosActivos.join(' + ')}
                            </span>
                          )}
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

                        {conPrincipio && (
                          <td data-lbl="Permitir reemplazo">
                            {producto.principiosActivos.length > 0 ? (
                              <div className="reemplazo-celda">
                                <ToggleReemplazo
                                  activo={linea.permitirReemplazo}
                                  etiqueta={producto.etiqueta}
                                  onAlternar={() =>
                                    actualizarLinea(linea.uid, {
                                      permitirReemplazo: !linea.permitirReemplazo,
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn-link"
                                  onClick={() => setViendoReemplazos(linea.uid)}
                                >
                                  <i className="fas fa-list" aria-hidden /> Ver{' '}
                                  {reemplazosDe(producto, catalogos.productos).length} reemplazos
                                </button>
                              </div>
                            ) : (
                              <span className="muted xs">Sin principio activo</span>
                            )}
                          </td>
                        )}

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

      {lineaVentana && productoVentana && (
        <VentanaReemplazos
          producto={productoVentana}
          reemplazos={reemplazosDe(productoVentana, catalogos.productos)}
          enLaOrden={agregados}
          permitido={lineaVentana.permitirReemplazo}
          onAlternar={() =>
            actualizarLinea(lineaVentana.uid, {
              permitirReemplazo: !lineaVentana.permitirReemplazo,
            })
          }
          onCerrar={cerrarVentana}
        />
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
