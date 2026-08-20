/**
 * Carga de los tableros maestros que alimentan los selectores de la orden.
 *
 * Todo se trae en UN viaje al abrir la operación: son tableros chicos (28 labores, 65 proveedores,
 * 15 cultivos, 7 campañas, 55 contactos, 16 campos) y tenerlos en memoria hace que filtrar
 * contactos por proveedor o lotes por campo sea instantáneo, sin una request por tecla.
 */
import type { Campana, Campo, Catalogos, Contacto, Cultivo, Labor, Lote, Proveedor } from '@/types'
import { mondayApi } from './sdk'
import {
  CAMPANA_ACTIVA,
  COL_CAMPANA,
  COL_CONTACTO,
  COL_CULTIVO,
  COL_LABOR,
  COL_LOTE,
  COL_PROVEEDOR,
  TABLEROS,
} from './columns'
import { etiquetas, idsConectados, numero, porId, texto, type ColumnaCruda } from './parse'

interface ItemCrudo {
  id: string
  name: string
  column_values?: ColumnaCruda[] | null
  subitems?: ItemCrudo[] | null
}

interface PaginaCruda {
  cursor: string | null
  items: ItemCrudo[]
}

/** Lista de ids de columna lista para interpolar en la query (`ids: ["a","b"]`). */
const ids = (...cols: string[]) => JSON.stringify(cols)

/**
 * Selección de campos de cada `column_value`.
 *
 * El fragmento `BoardRelationValue` NO es opcional: en esta cuenta las columnas de conexión
 * devuelven `text` y `value` en `null` aunque tengan items vinculados, y los ids sólo aparecen
 * en `linked_item_ids`. Sin el fragmento, el filtro de contactos por proveedor no encuentra nada.
 */
const CAMPOS_COLUMNA = 'id text value ... on BoardRelationValue { linked_item_ids }'

/**
 * Trae TODOS los items de un tablero siguiendo el cursor. Monday pagina de a 500 como máximo;
 * ninguno de estos tableros llega, pero el bucle evita que la app se rompa en silencio el día
 * que Campos o Proveedores crezcan.
 */
async function traerItems(
  boardId: string,
  seleccion: string,
  limite = 200,
): Promise<ItemCrudo[]> {
  const acumulados: ItemCrudo[] = []
  let cursor: string | null = null

  do {
    const argumentos = cursor
      ? `limit: ${limite}, cursor: ${JSON.stringify(cursor)}`
      : `limit: ${limite}`
    const query = `query {
      boards(ids: ${boardId}) {
        items_page(${argumentos}) {
          cursor
          items { id name ${seleccion} }
        }
      }
    }`
    const data: { boards: { items_page: PaginaCruda }[] } = await mondayApi(query)
    const pagina = data.boards[0]?.items_page
    if (!pagina) break
    acumulados.push(...pagina.items)
    cursor = pagina.cursor
  } while (cursor)

  return acumulados
}

/** 🚜💨 Labores. */
async function traerLabores(): Promise<Labor[]> {
  const items = await traerItems(TABLEROS.labores, `column_values(ids: ${ids(COL_LABOR.codigo)}) { ${CAMPOS_COLUMNA} }`)
  return items
    .map((it) => ({ id: it.id, nombre: it.name, codigo: texto(porId(it.column_values), COL_LABOR.codigo) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** ✋ Proveedores. Se devuelven todos; el filtro por `Activo` lo decide la vista. */
async function traerProveedores(): Promise<Proveedor[]> {
  const seleccion = `column_values(ids: ${ids(
    COL_PROVEEDOR.estado,
    COL_PROVEEDOR.cuit,
    COL_PROVEEDOR.tipo,
    COL_PROVEEDOR.contactos,
  )}) { ${CAMPOS_COLUMNA} }`
  const items = await traerItems(TABLEROS.proveedores, seleccion)
  return items
    .map((it) => {
      const cols = porId(it.column_values)
      return {
        id: it.id,
        nombre: it.name,
        estado: texto(cols, COL_PROVEEDOR.estado),
        cuit: texto(cols, COL_PROVEEDOR.cuit),
        tipos: etiquetas(cols, COL_PROVEEDOR.tipo),
        contactoIds: idsConectados(cols, COL_PROVEEDOR.contactos),
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** 🌻🌱 Cultivos. */
async function traerCultivos(): Promise<Cultivo[]> {
  const items = await traerItems(TABLEROS.cultivos, `column_values(ids: ${ids(COL_CULTIVO.tipo)}) { ${CAMPOS_COLUMNA} }`)
  return items
    .map((it) => ({ id: it.id, nombre: it.name, tipo: texto(porId(it.column_values), COL_CULTIVO.tipo) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * 📅 Campañas. La regla del negocio es que sólo se puede cargar sobre una campaña ACTIVA, así
 * que la marca viaja con el item y la vista ni siquiera ofrece las cerradas.
 */
async function traerCampanas(): Promise<Campana[]> {
  const items = await traerItems(TABLEROS.campanas, `column_values(ids: ${ids(COL_CAMPANA.estado)}) { ${CAMPOS_COLUMNA} }`)
  return items
    .map((it) => {
      const estado = texto(porId(it.column_values), COL_CAMPANA.estado)
      return { id: it.id, nombre: it.name, estado, activa: estado === CAMPANA_ACTIVA }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** ✋ Contactos, con los proveedores a los que están vinculados. */
async function traerContactos(): Promise<Contacto[]> {
  const seleccion = `column_values(ids: ${ids(
    COL_CONTACTO.nombre,
    COL_CONTACTO.apellido,
    COL_CONTACTO.telefono,
    COL_CONTACTO.email,
    COL_CONTACTO.proveedores,
    COL_CONTACTO.tipo,
  )}) { ${CAMPOS_COLUMNA} }`
  const items = await traerItems(TABLEROS.contactos, seleccion)
  return items
    .map((it) => {
      const cols = porId(it.column_values)
      return {
        id: it.id,
        // Varios contactos traen saltos de línea en el nombre del item: en un selector eso
        // rompe la fila, así que se normaliza a un solo espacio.
        nombre: it.name.replace(/\s+/g, ' ').trim(),
        nombrePila: texto(cols, COL_CONTACTO.nombre),
        apellido: texto(cols, COL_CONTACTO.apellido),
        telefono: texto(cols, COL_CONTACTO.telefono),
        email: texto(cols, COL_CONTACTO.email),
        tipos: etiquetas(cols, COL_CONTACTO.tipo),
        proveedorIds: idsConectados(cols, COL_CONTACTO.proveedores),
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * 📍 Campos con sus lotes. Los lotes son SUBITEMS del campo, así que vienen anidados en la misma
 * query: pedirlos aparte obligaría a una request por campo.
 */
async function traerCampos(): Promise<Campo[]> {
  const seleccion = `subitems {
    id
    name
    column_values(ids: ${ids(COL_LOTE.hectareasTotales, COL_LOTE.hectareasProductivas)}) { ${CAMPOS_COLUMNA} }
  }`
  const items = await traerItems(TABLEROS.campos, seleccion, 100)

  return items
    .map((it) => {
      const lotes: Lote[] = (it.subitems ?? []).map((sub) => {
        const cols = porId(sub.column_values)
        return {
          id: sub.id,
          nombre: sub.name,
          campoId: it.id,
          hectareasTotales: numero(cols, COL_LOTE.hectareasTotales),
          hectareasProductivas: numero(cols, COL_LOTE.hectareasProductivas),
        }
      })
      lotes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
      return { id: it.id, nombre: it.name, lotes }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Trae los seis catálogos en paralelo: la espera total es la del tablero más lento, no la suma. */
export async function traerCatalogos(): Promise<Catalogos> {
  const [labores, proveedores, cultivos, campanas, contactos, campos] = await Promise.all([
    traerLabores(),
    traerProveedores(),
    traerCultivos(),
    traerCampanas(),
    traerContactos(),
    traerCampos(),
  ])
  return { labores, proveedores, cultivos, campanas, contactos, campos }
}
