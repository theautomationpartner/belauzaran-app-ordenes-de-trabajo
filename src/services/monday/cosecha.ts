/**
 * Registrar Cosecha: lectura de depósitos y de cosechas existentes, y alta (nueva o duplicada).
 */
import type { CosechaExistente, Deposito, TipoTransporte } from '@/types'
import { mondayApi } from './sdk'
import { traerItems, type ItemCrudo } from './catalogos'
import {
  COL_COSECHA,
  COL_DEPOSITO,
  COSECHA_DUPLICADO,
  COSECHA_REGISTRAR_DUP,
  TABLERO_COSECHA,
  TABLERO_DEPOSITOS,
  TRANSPORTE_CONTRATADO,
  TRANSPORTE_PROPIO,
} from './columns'
import { idsConectados, mostrado, porId, texto } from './parse'

const CAMPOS = `id text value
  ... on BoardRelationValue { linked_item_ids display_value }`

const columnas = (...ids: string[]) => `column_values(ids: ${JSON.stringify(ids)}) { ${CAMPOS} }`

export interface DatosCosecha {
  depositos: Deposito[]
  /**
   * La columna de maquinarias de la cosecha admite más de un item. Se lee de su configuración en
   * monday (`allowMultipleItems`) y no se fija en el código: hoy admite uno solo y la idea es
   * habilitar varios; cuando lo cambien, la app lo toma sola.
   */
  maquinariaMultiple: boolean
}

/** Depósitos y configuración de la columna de maquinarias, en paralelo. */
export async function traerDatosCosecha(): Promise<DatosCosecha> {
  const [crudos, config] = await Promise.all([
    traerItems(TABLERO_DEPOSITOS, columnas(COL_DEPOSITO.cultivo, COL_DEPOSITO.estado), 200),
    mondayApi<{ boards: { columns: { settings_str: string }[] }[] }>(
      `query { boards(ids: ${TABLERO_COSECHA}) { columns(ids: ["${COL_COSECHA.maquinarias}"]) { settings_str } } }`,
    ),
  ])

  const depositos = crudos
    .map((it) => {
      const cols = porId(it.column_values)
      return {
        id: it.id,
        nombre: it.name.replace(/\s+/g, ' ').trim(),
        cultivoIds: idsConectados(cols, COL_DEPOSITO.cultivo),
        estado: texto(cols, COL_DEPOSITO.estado),
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  let maquinariaMultiple = true
  try {
    const cfg = JSON.parse(config.boards[0]?.columns[0]?.settings_str ?? '{}') as {
      allowMultipleItems?: boolean
    }
    // monday omite la clave cuando admite varios: sólo un `false` explícito la limita a uno.
    maquinariaMultiple = cfg.allowMultipleItems !== false
  } catch {
    // Sin poder leer la configuración se asume la del tablero por defecto (varios).
  }

  return { depositos, maquinariaMultiple }
}

/** Filtros de la búsqueda de cosechas para duplicar. Todos se combinan (Y). */
export interface FiltroCosechas {
  texto: string
  cultivoId: string | null
  campoId: string | null
  loteId: string | null
  campanaId: string | null
}

export const hayFiltro = (f: FiltroCosechas): boolean =>
  Boolean(f.texto.trim() || f.cultivoId || f.campoId || f.loteId || f.campanaId)

const SELECCION_COSECHA = columnas(
  COL_COSECHA.cultivo,
  COL_COSECHA.campana,
  COL_COSECHA.campo,
  COL_COSECHA.lote,
  COL_COSECHA.fecha,
  COL_COSECHA.kg,
  COL_COSECHA.deposito,
  COL_COSECHA.transporte,
  COL_COSECHA.maquinarias,
  COL_COSECHA.proveedor,
  COL_COSECHA.cartaPorte,
  COL_COSECHA.km,
  COL_COSECHA.ctg,
  COL_COSECHA.estadoRegistro,
  COL_COSECHA.estadoDuplicado,
  COL_COSECHA.idCosecha,
)

const uno = (ids: string[]) => ids[0] ?? null

/** Cosecha cruda → la forma que usa la app, con sus datos ya listos para el formulario. */
function aCosecha(it: ItemCrudo): CosechaExistente {
  const cols = porId(it.column_values)
  const transporte = texto(cols, COL_COSECHA.transporte)
  return {
    id: it.id,
    nombre: it.name.trim(),
    codigo: texto(cols, COL_COSECHA.idCosecha),
    borrador: {
      cultivoId: uno(idsConectados(cols, COL_COSECHA.cultivo)),
      campanaId: uno(idsConectados(cols, COL_COSECHA.campana)),
      campoId: uno(idsConectados(cols, COL_COSECHA.campo)),
      loteIds: idsConectados(cols, COL_COSECHA.lote),
      fecha: texto(cols, COL_COSECHA.fecha),
      // Los números de monday vienen con punto decimal; el formulario los muestra con coma.
      kg: texto(cols, COL_COSECHA.kg).replace('.', ','),
      depositoId: uno(idsConectados(cols, COL_COSECHA.deposito)),
      transporte:
        transporte === TRANSPORTE_PROPIO || transporte === TRANSPORTE_CONTRATADO
          ? (transporte as TipoTransporte)
          : null,
      maquinariaIds: idsConectados(cols, COL_COSECHA.maquinarias),
      proveedorId: uno(idsConectados(cols, COL_COSECHA.proveedor)),
      cartaPorte: texto(cols, COL_COSECHA.cartaPorte),
      km: texto(cols, COL_COSECHA.km).replace('.', ','),
      ctg: texto(cols, COL_COSECHA.ctg),
    },
    textos: {
      cultivo: mostrado(cols, COL_COSECHA.cultivo),
      campana: mostrado(cols, COL_COSECHA.campana),
      campo: mostrado(cols, COL_COSECHA.campo),
      lote: mostrado(cols, COL_COSECHA.lote),
      deposito: mostrado(cols, COL_COSECHA.deposito),
      proveedor: mostrado(cols, COL_COSECHA.proveedor),
      maquinarias: mostrado(cols, COL_COSECHA.maquinarias),
    },
    estadoRegistro: texto(cols, COL_COSECHA.estadoRegistro),
    estadoDuplicado: texto(cols, COL_COSECHA.estadoDuplicado),
  }
}

export interface ResultadoBusquedaCosechas {
  cosechas: CosechaExistente[]
  /** Hay más coincidencias que las traídas: conviene afinar la búsqueda. */
  hayMas: boolean
}

/**
 * Busca cosechas para duplicar. El filtro lo resuelve monday (nombre que contiene el texto,
 * conexiones iguales a lo elegido), así que sólo viajan las coincidencias y nunca el tablero
 * entero. Las más nuevas primero: lo habitual es duplicar una de los últimos días.
 */
export async function buscarCosechas(
  f: FiltroCosechas,
  limite = 30,
): Promise<ResultadoBusquedaCosechas> {
  const reglas: { column_id: string; compare_value: (string | number)[]; operator: string }[] = []
  if (f.texto.trim()) reglas.push({ column_id: 'name', compare_value: [f.texto.trim()], operator: 'contains_text' })
  const porConexion: [string, string | null][] = [
    [COL_COSECHA.cultivo, f.cultivoId],
    [COL_COSECHA.campo, f.campoId],
    [COL_COSECHA.lote, f.loteId],
    [COL_COSECHA.campana, f.campanaId],
  ]
  for (const [columna, id] of porConexion) {
    if (id) reglas.push({ column_id: columna, compare_value: [Number(id)], operator: 'any_of' })
  }

  const data = await mondayApi<{
    boards: { items_page: { cursor: string | null; items: ItemCrudo[] } }[]
  }>(
    `query ($reglas: [ItemsQueryRule!]) {
      boards(ids: ${TABLERO_COSECHA}) {
        items_page(
          limit: ${limite},
          query_params: { rules: $reglas, order_by: [{ column_id: "__creation_log__", direction: desc }] }
        ) {
          cursor
          items { id name ${SELECCION_COSECHA} }
        }
      }
    }`,
    { reglas },
  )
  const pagina = data.boards[0]?.items_page
  return { cosechas: (pagina?.items ?? []).map(aCosecha), hayMas: Boolean(pagina?.cursor) }
}

/* ===== Alta ===== */

async function crearItem(nombre: string, columnasItem: Record<string, unknown>): Promise<string> {
  const data = await mondayApi<{ create_item: { id: string } | null }>(
    `mutation ($n: String!, $c: JSON!) {
      create_item(board_id: ${TABLERO_COSECHA}, item_name: $n, column_values: $c, create_labels_if_missing: false) { id }
    }`,
    { n: nombre, c: JSON.stringify(columnasItem) },
  )
  const id = data.create_item?.id
  if (!id) throw new Error('monday no devolvió el id de la cosecha creada.')
  return id
}

/** Crea una cosecha nueva, con todas sus columnas y sin estado: Make la procesa al crearse. */
export async function crearCosecha(nombre: string, columnasItem: Record<string, unknown>): Promise<string> {
  return crearItem(nombre, columnasItem)
}

export interface ResultadoDuplicado {
  itemId: string
  /** La cosecha de origen ya quedó en "Duplicado". */
  origenMarcado: boolean
  error: string | null
}

/** Marca la cosecha de la que se copiaron los datos como "Duplicado". */
export async function marcarOrigenDuplicado(origenId: string): Promise<void> {
  await mondayApi(
    `mutation ($i: ID!, $c: JSON!) {
      change_multiple_column_values(board_id: ${TABLERO_COSECHA}, item_id: $i, column_values: $c) { id }
    }`,
    { i: origenId, c: JSON.stringify({ [COL_COSECHA.estadoDuplicado]: { label: COSECHA_DUPLICADO } }) },
  )
}

/**
 * Crea la cosecha duplicada en "Registrar DUP" y recién después marca la de origen como
 * "Duplicado". En ese orden: si el alta falla, la de origen no queda marcada como duplicada de
 * algo que no existe. Si lo que falla es la marca, la nueva ya está y se reintenta sólo la marca.
 */
export async function duplicarCosecha(
  nombre: string,
  columnasItem: Record<string, unknown>,
  origenId: string,
): Promise<ResultadoDuplicado> {
  const itemId = await crearItem(nombre, {
    ...columnasItem,
    [COL_COSECHA.estadoRegistro]: { label: COSECHA_REGISTRAR_DUP },
  })
  try {
    await marcarOrigenDuplicado(origenId)
    return { itemId, origenMarcado: true, error: null }
  } catch (e: unknown) {
    return { itemId, origenMarcado: false, error: e instanceof Error ? e.message : String(e) }
  }
}

