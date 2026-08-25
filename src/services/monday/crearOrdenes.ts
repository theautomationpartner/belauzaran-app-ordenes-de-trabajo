/**
 * Creación de las órdenes en ✋ Orden de Trabajo.
 *
 * La app escribe directo contra la API: un item por cada par campo+lote, y debajo de cada uno un
 * subitem por producto con la cantidad ya calculada para las hectáreas de ese lote.
 *
 * El estado de envío con el que nacen lo decide el usuario antes de emitir: por defecto quedan
 * cargadas sin enviar, y sólo si lo cambia a mano salen al circuito de envío al contratista.
 */
import type { AvanceEmision, CargaAEmitir, OrdenAGenerar, ResultadoOrden } from '@/types'
import { aTextoMonday } from '@/lib/format'
import { mondayApi } from './sdk'
import { COL_OT, COL_PRODUCTO_OT, OT_ESTADO_ENVIO_INICIAL, TABLEROS } from './columns'

/** Valor de una columna `board_relation`. Monday espera los ids de los items conectados. */
const conexion = (...itemIds: string[]) => ({ item_ids: itemIds.map(Number) })

/** Valor de una columna `status` / `color`: se manda la etiqueta, no el índice. */
const estado = (label: string) => ({ label })

/** Valor de una columna `dropdown`: las etiquetas elegidas. */
const opciones = (...labels: string[]) => ({ labels })

/**
 * Nombre del item, siguiendo la convención que ya usa el tablero:
 * `LABOR-PROVEEDOR-LOTE-CULTIVO-CAMPAÑA`. El nombre del lote ya incluye al campo.
 */
function nombreDeOrden(carga: CargaAEmitir, orden: OrdenAGenerar): string {
  return [
    carga.labor.nombre,
    carga.proveedor.nombre,
    orden.loteNombre,
    carga.cultivo.nombre,
    carga.campana.nombre,
  ]
    .map((p) => p.trim())
    .filter(Boolean)
    .join('-')
}

/**
 * Columnas del item de la orden.
 *
 * El contacto elegido NO se escribe: `COL_OT.contactoEspejo` es una columna mirror que refleja los
 * contactos del proveedor conectado, y la API rechaza escribir sobre un mirror. Al conectar el
 * proveedor, la columna se completa sola.
 */
function columnasDeOrden(carga: CargaAEmitir, orden: OrdenAGenerar): Record<string, unknown> {
  const columnas: Record<string, unknown> = {
    [COL_OT.realizadoPor]: estado(carga.realizadoPor),
    [COL_OT.labor]: conexion(carga.labor.id),
    [COL_OT.proveedor]: conexion(carga.proveedor.id),
    [COL_OT.cultivo]: conexion(carga.cultivo.id),
    [COL_OT.campana]: conexion(carga.campana.id),
    [COL_OT.campo]: conexion(orden.campoId),
    [COL_OT.lote]: conexion(orden.loteId),
    [COL_OT.usdPorHa]: aTextoMonday(carga.usdPorHa),
    /* Cada orden trae el suyo: en una misma tanda se pueden mandar unas y dejar otras
       cargadas. Si viniera vacío, se cae al conservador. */
    [COL_OT.estadoEnvio]: estado(orden.estadoEnvio || OT_ESTADO_ENVIO_INICIAL),
  }

  // La maquinaria es opcional: mandar la columna vacía borraría lo que hubiera puesto una
  // automatización, así que sólo se incluye cuando hay algo que conectar.
  if (carga.maquinarias.length > 0) {
    columnas[COL_OT.maquinarias] = conexion(...carga.maquinarias.map((m) => m.id))
  }
  return columnas
}

interface RespuestaItem {
  create_item: { id: string } | null
}

interface RespuestaSubitem {
  create_subitem: { id: string } | null
}

/** Crea el item de una orden y devuelve su id. */
async function crearItem(carga: CargaAEmitir, orden: OrdenAGenerar): Promise<string> {
  const query = `mutation ($boardId: ID!, $nombre: String!, $columnas: JSON!) {
    create_item(
      board_id: $boardId,
      item_name: $nombre,
      column_values: $columnas,
      create_labels_if_missing: false
    ) { id }
  }`

  const data = await mondayApi<RespuestaItem>(query, {
    boardId: TABLEROS.ordenTrabajo,
    nombre: nombreDeOrden(carga, orden),
    columnas: JSON.stringify(columnasDeOrden(carga, orden)),
  })

  const id = data.create_item?.id
  if (!id) throw new Error('Monday no devolvió el id de la orden creada.')
  return id
}

/**
 * Crea los subitems de producto de una orden.
 *
 * Van en serie y no en paralelo: Monday cobra por complejidad y limita las escrituras por minuto,
 * y una ráfaga de subitems es la forma más rápida de comerse un 429 a mitad de la carga.
 */
async function crearSubitems(itemId: string, orden: OrdenAGenerar): Promise<number> {
  const query = `mutation ($itemId: ID!, $nombre: String!, $columnas: JSON!) {
    create_subitem(
      parent_item_id: $itemId,
      item_name: $nombre,
      column_values: $columnas,
      create_labels_if_missing: false
    ) { id }
  }`

  let creados = 0
  for (const producto of orden.productos) {
    const columnas: Record<string, unknown> = {
      [COL_PRODUCTO_OT.producto]: opciones(producto.etiqueta),
      [COL_PRODUCTO_OT.cantPorHa]: aTextoMonday(producto.cantPorHa),
    }
    // Las hectáreas del lote son las que multiplican la dosis; si el lote no las tiene cargadas
    // se deja la columna vacía en vez de inventar un cero, que daría un total falso de 0.
    if (orden.hectareas != null) {
      columnas[COL_PRODUCTO_OT.hectareas] = aTextoMonday(orden.hectareas)
    }

    const data = await mondayApi<RespuestaSubitem>(query, {
      itemId,
      nombre: producto.etiqueta,
      columnas: JSON.stringify(columnas),
    })
    if (data.create_subitem?.id) creados += 1
  }
  return creados
}

/**
 * Crea todas las órdenes de la carga.
 *
 * Se procesan de a una y los fallos NO cortan el lote: si una orden falla, se registra y sigue
 * con las demás. Cortar dejaría la carga a medias sin que el usuario sepa qué entró y qué no;
 * así el resumen final puede decir exactamente cuáles se crearon.
 */
export async function crearOrdenes(
  carga: CargaAEmitir,
  onAvance?: (avance: AvanceEmision) => void,
): Promise<ResultadoOrden[]> {
  const resultados: ResultadoOrden[] = []

  for (const [i, orden] of carga.ordenes.entries()) {
    onAvance?.({ hechas: i, total: carga.ordenes.length, actual: orden.loteNombre })
    try {
      const itemId = await crearItem(carga, orden)
      const subitemsCreados = await crearSubitems(itemId, orden)
      resultados.push({ orden, itemId, subitemsCreados, error: null })
    } catch (e: unknown) {
      resultados.push({
        orden,
        itemId: null,
        subitemsCreados: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  onAvance?.({ hechas: carga.ordenes.length, total: carga.ordenes.length, actual: '' })
  return resultados
}
