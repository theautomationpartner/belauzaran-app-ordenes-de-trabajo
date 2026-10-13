/**
 * Asignación de cultivo a las órdenes de producción en barbecho: lectura del árbol
 * OP → OT → confirmaciones / stock y escritura de los cambios.
 */
import type {
  CambioNombre,
  ConfirmacionVinculada,
  ItemBasico,
  ItemVinculado,
  OrdenProduccion,
  OrdenTrabajoVinculada,
  PlanAsignacion,
  ResultadoAsignacion,
} from '@/types'
import { seRenombra, sumar } from '@/lib/barbecho'
import { mondayApi } from './sdk'
import { traerItems, type ItemCrudo } from './catalogos'
import {
  COL_CONFIRMACION,
  COL_OP,
  COL_OT,
  COL_PRODUCTO_OT_USD,
  TABLEROS,
} from './columns'
import { idsConectados, mostrado, numeroMostrado, porId, texto } from './parse'

/**
 * Selección de cada `column_value`. Conexiones y fórmulas sólo traen su texto en `display_value`,
 * que hay que pedir con el fragmento de cada tipo: sin ellos llegan vacías.
 */
const CAMPOS = `id text value
  ... on BoardRelationValue { linked_item_ids display_value }
  ... on FormulaValue { display_value }
  ... on MirrorValue { display_value }`

const columnas = (...ids: string[]) => `column_values(ids: ${JSON.stringify(ids)}) { ${CAMPOS} }`

/**
 * Trae items sueltos por id.
 *
 * `items(ids:)` devuelve 25 por defecto aunque se le pasen más ids, y como máximo 100 por pedido:
 * sin el `limit` y sin trocear, una orden con muchos movimientos de stock se quedaba con 25 y el
 * resto no se renombraba.
 */
async function traerPorIds(ids: string[], seleccion: string): Promise<ItemCrudo[]> {
  const unicos = [...new Set(ids)]
  const items: ItemCrudo[] = []
  for (let i = 0; i < unicos.length; i += 100) {
    const tanda = unicos.slice(i, i + 100)
    const data = await mondayApi<{ items: ItemCrudo[] }>(
      `query { items(ids: ${JSON.stringify(tanda)}, limit: 100) { id name ${seleccion} } }`,
    )
    items.push(...data.items)
  }
  return items
}

const limpio = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * Órdenes de producción cuyo cultivo es `barbecho`, con todo lo que cuelga de ellas.
 *
 * Son cuatro viajes —OP, OT, confirmaciones, stock— y no uno por orden: el tablero de producción
 * tiene ~130 items y traerlo entero para filtrar acá es más barato que una consulta por orden.
 */
export async function traerOrdenesEnBarbecho(barbecho: ItemBasico): Promise<OrdenProduccion[]> {
  const crudas = await traerItems(
    TABLEROS.ordenProduccion,
    columnas(
      COL_OP.estado,
      COL_OP.campo,
      COL_OP.lote,
      COL_OP.cultivo,
      COL_OP.campana,
      COL_OP.comienzo,
      COL_OP.ordenesTrabajo,
      COL_OP.stock,
    ),
    200,
  )
  const ops = crudas.filter((it) =>
    idsConectados(porId(it.column_values), COL_OP.cultivo).includes(barbecho.id),
  )

  const otIds = ops.flatMap((it) => idsConectados(porId(it.column_values), COL_OP.ordenesTrabajo))
  const stockIds = ops.flatMap((it) => idsConectados(porId(it.column_values), COL_OP.stock))

  const otsCrudas = await traerPorIds(
    otIds,
    `${columnas(
      COL_OT.labor,
      COL_OT.proveedor,
      COL_OT.lote,
      COL_OT.cultivo,
      COL_OT.campana,
      COL_OT.estadoEnvio,
      COL_OT.confirmaciones,
      COL_OT.hectareasEspejo,
      COL_OT.usdLabor,
      COL_OT.usdTotal,
      COL_OT.usdPorHaTotal,
    )}
    subitems { id ${columnas(COL_PRODUCTO_OT_USD)} }`,
  )

  const confIds = otsCrudas.flatMap((it) =>
    idsConectados(porId(it.column_values), COL_OT.confirmaciones),
  )
  const [confsCrudas, stockCrudo] = await Promise.all([
    traerPorIds(confIds, columnas(COL_CONFIRMACION.cultivo)),
    traerPorIds(stockIds, ''),
  ])

  const confirmaciones = new Map<string, ConfirmacionVinculada>(
    confsCrudas.map((it) => [
      it.id,
      {
        id: it.id,
        nombre: limpio(it.name),
        cultivo: texto(porId(it.column_values), COL_CONFIRMACION.cultivo),
      },
    ]),
  )

  const ordenesTrabajo = new Map<string, OrdenTrabajoVinculada>(
    otsCrudas.map((it) => {
      const cols = porId(it.column_values)
      /* El U$ de productos de la OT es un espejo de sus subelementos y la API lo devuelve vacío:
         se suma acá el importe de cada producto, que es lo mismo que muestra el tablero. */
      const productos = (it.subitems ?? []).map((sub) =>
        numeroMostrado(porId(sub.column_values), COL_PRODUCTO_OT_USD),
      )
      const ot: OrdenTrabajoVinculada = {
        id: it.id,
        nombre: limpio(it.name),
        labor: mostrado(cols, COL_OT.labor),
        proveedor: mostrado(cols, COL_OT.proveedor),
        lote: mostrado(cols, COL_OT.lote),
        cultivo: mostrado(cols, COL_OT.cultivo),
        campana: mostrado(cols, COL_OT.campana),
        estadoEnvio: texto(cols, COL_OT.estadoEnvio),
        hectareas: numeroMostrado(cols, COL_OT.hectareasEspejo),
        usdLabor: numeroMostrado(cols, COL_OT.usdLabor),
        usdProductos: productos.length === 0 ? 0 : sumar(productos),
        usdTotal: numeroMostrado(cols, COL_OT.usdTotal),
        usdPorHa: numeroMostrado(cols, COL_OT.usdPorHaTotal),
        confirmaciones: idsConectados(cols, COL_OT.confirmaciones)
          .map((id) => confirmaciones.get(id))
          .filter((c): c is ConfirmacionVinculada => Boolean(c)),
      }
      return [it.id, ot]
    }),
  )

  const stock = new Map<string, ItemVinculado>(
    stockCrudo.map((it) => [it.id, { id: it.id, nombre: limpio(it.name) }]),
  )

  return ops
    .map((it): OrdenProduccion => {
      const cols = porId(it.column_values)
      return {
        id: it.id,
        nombre: limpio(it.name),
        estado: texto(cols, COL_OP.estado),
        campo: mostrado(cols, COL_OP.campo),
        lote: mostrado(cols, COL_OP.lote),
        campana: mostrado(cols, COL_OP.campana),
        cultivo: mostrado(cols, COL_OP.cultivo) || barbecho.nombre,
        comienzo: texto(cols, COL_OP.comienzo) || null,
        ordenesTrabajo: idsConectados(cols, COL_OP.ordenesTrabajo)
          .map((id) => ordenesTrabajo.get(id))
          .filter((o): o is OrdenTrabajoVinculada => Boolean(o)),
        stock: idsConectados(cols, COL_OP.stock)
          .map((id) => stock.get(id))
          .filter((s): s is ItemVinculado => Boolean(s)),
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
}

/* ===== Escritura ===== */

/** Una escritura sobre un item: el tablero, el item y las columnas a cambiar. */
interface Escritura {
  boardId: string
  itemId: string
  columnas: Record<string, unknown>
}

/** Cuántas escrituras viajan en un mismo pedido. */
const POR_PEDIDO = 20

/** Escribe un solo item. */
async function escribirUno(e: Escritura): Promise<void> {
  await mondayApi(
    `mutation ($b: ID!, $i: ID!, $c: JSON!) {
      change_multiple_column_values(board_id: $b, item_id: $i, column_values: $c) { id }
    }`,
    { b: e.boardId, i: e.itemId, c: JSON.stringify(e.columnas) },
  )
}

/**
 * Escribe una lista de items y devuelve los ids que fallaron, con su motivo.
 *
 * Van de a `POR_PEDIDO` en un mismo pedido con alias, para no hacer un viaje por movimiento de
 * stock (una orden llega a tener 14). Si el pedido falla, se repite item por item: monday no dice
 * cuál de los alias rompió, y todas estas escrituras se pueden repetir sin efecto (ponen el mismo
 * nombre y el mismo cultivo), así que reintentar las que ya habían entrado no hace daño.
 */
async function escribir(escrituras: Escritura[]): Promise<Map<string, string>> {
  const fallos = new Map<string, string>()

  for (let i = 0; i < escrituras.length; i += POR_PEDIDO) {
    const tanda = escrituras.slice(i, i + POR_PEDIDO)
    const declaraciones = tanda.map((_, k) => `$b${k}: ID!, $i${k}: ID!, $c${k}: JSON!`).join(', ')
    const cuerpo = tanda
      .map(
        (_, k) =>
          `m${k}: change_multiple_column_values(board_id: $b${k}, item_id: $i${k}, column_values: $c${k}) { id }`,
      )
      .join('\n')
    const variables: Record<string, unknown> = {}
    tanda.forEach((e, k) => {
      variables[`b${k}`] = e.boardId
      variables[`i${k}`] = e.itemId
      variables[`c${k}`] = JSON.stringify(e.columnas)
    })

    try {
      await mondayApi(`mutation (${declaraciones}) {\n${cuerpo}\n}`, variables)
    } catch {
      for (const e of tanda) {
        try {
          await escribirUno(e)
        } catch (err: unknown) {
          fallos.set(e.itemId, err instanceof Error ? err.message : String(err))
        }
      }
    }
  }
  return fallos
}

/**
 * Aplica el plan de UNA orden de producción.
 *
 * Primero se escribe todo lo que cuelga de ella (stock, confirmaciones, OT) y recién al final la
 * orden de producción. Si algo de abajo falla, la OP NO se toca: sigue en barbecho, vuelve a
 * aparecer en la lista y se puede reintentar. Al revés, una OP que ya dice "Girasol" con OT que
 * siguen diciendo "Barbecho" desaparecería de la operación y quedaría inconsistente sin aviso.
 */
async function aplicarPlan(plan: PlanAsignacion): Promise<ResultadoAsignacion> {
  const { cultivo } = plan
  const conNombre = (c: CambioNombre, columnas: Record<string, unknown>) =>
    seRenombra(c) ? { ...columnas, name: c.nuevo } : columnas

  const stock: Escritura[] = plan.stock.filter(seRenombra).map((c) => ({
    boardId: TABLEROS.movimientosStock,
    itemId: c.itemId,
    columnas: { name: c.nuevo },
  }))
  const confirmaciones: Escritura[] = plan.confirmaciones.map((c) => ({
    boardId: TABLEROS.confirmaciones,
    itemId: c.itemId,
    columnas: conNombre(c, { [COL_CONFIRMACION.cultivo]: cultivo.nombre }),
  }))
  const ordenes: Escritura[] = plan.ordenesTrabajo.map((c) => ({
    boardId: TABLEROS.ordenTrabajo,
    itemId: c.itemId,
    columnas: conNombre(c, { [COL_OT.cultivo]: { item_ids: [Number(cultivo.id)] } }),
  }))

  const fallos = await escribir([...stock, ...confirmaciones, ...ordenes])
  const okDe = (lista: Escritura[]) => lista.filter((e) => !fallos.has(e.itemId)).length
  const resultado: ResultadoAsignacion = {
    plan,
    stock: okDe(stock),
    confirmaciones: okDe(confirmaciones),
    ordenesTrabajo: okDe(ordenes),
    opActualizada: false,
    error: null,
  }

  if (fallos.size > 0) {
    const [primero] = fallos.values()
    resultado.error =
      `${fallos.size} item${fallos.size === 1 ? '' : 's'} no se pudo actualizar (${primero}). ` +
      'La orden de producción quedó en barbecho para reintentar.'
    return resultado
  }

  try {
    await escribirUno({
      boardId: TABLEROS.ordenProduccion,
      itemId: plan.op.id,
      columnas: conNombre(plan.nombreOp, { [COL_OP.cultivo]: { item_ids: [Number(cultivo.id)] } }),
    })
    resultado.opActualizada = true
  } catch (e: unknown) {
    resultado.error = `No se pudo actualizar la orden de producción: ${
      e instanceof Error ? e.message : String(e)
    }`
  }
  return resultado
}

export interface AvanceAsignacion {
  hechas: number
  total: number
  /** Nombre de la orden de producción que se está escribiendo. */
  actual: string
}

/**
 * Aplica todas las asignaciones, una orden de producción por vez. Un fallo no corta la tanda: se
 * registra y sigue con la próxima, para que el resumen final diga exactamente qué entró.
 */
export async function aplicarAsignaciones(
  planes: PlanAsignacion[],
  onAvance?: (avance: AvanceAsignacion) => void,
): Promise<ResultadoAsignacion[]> {
  const resultados: ResultadoAsignacion[] = []
  for (const [i, plan] of planes.entries()) {
    onAvance?.({ hechas: i, total: planes.length, actual: plan.op.nombre })
    try {
      resultados.push(await aplicarPlan(plan))
    } catch (e: unknown) {
      resultados.push({
        plan,
        stock: 0,
        confirmaciones: 0,
        ordenesTrabajo: 0,
        opActualizada: false,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
  onAvance?.({ hechas: planes.length, total: planes.length, actual: '' })
  return resultados
}
