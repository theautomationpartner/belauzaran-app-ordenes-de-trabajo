/**
 * Registrar Remito / Factura: lo que hay que leer para el formulario y la creación del item con
 * su archivo.
 */
import type { ItemBasico } from '@/types'
import { mondayApi, subirArchivo } from './sdk'
import {
  COL_FACTURA,
  COL_REMITO,
  FACTURA_ORIGEN_MANUAL,
  TABLERO_DESTINOS,
  TABLERO_FACTURAS,
  TABLERO_REMITOS,
} from './columns'

/** Usuario de monday que se puede asignar en ✋ Persona. */
export interface PersonaMonday {
  id: string
  nombre: string
  esInvitado: boolean
}

export interface DatosRemito {
  personas: PersonaMonday[]
  destinos: ItemBasico[]
}

/**
 * Personas y destinos, en un solo viaje.
 *
 * Las personas son los suscriptores del tablero de remitos: la columna sólo acepta a quien tiene
 * acceso al tablero, y ofrecer a cualquier usuario de la cuenta haría fallar el alta.
 */
export async function traerDatosRemito(): Promise<DatosRemito> {
  const data = await mondayApi<{
    remitos: { subscribers: { id: string; name: string; enabled: boolean; is_guest: boolean }[] }[]
    destinos: { items_page: { items: { id: string; name: string }[] } }[]
  }>(`query {
    remitos: boards(ids: ${TABLERO_REMITOS}) { subscribers { id name enabled is_guest } }
    destinos: boards(ids: ${TABLERO_DESTINOS}) { items_page(limit: 100) { items { id name } } }
  }`)

  const personas = (data.remitos[0]?.subscribers ?? [])
    .filter((s) => s.enabled)
    .map((s) => ({ id: String(s.id), nombre: s.name.trim(), esInvitado: s.is_guest }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const destinos = (data.destinos[0]?.items_page.items ?? []).map((it) => ({
    id: it.id,
    nombre: it.name.trim(),
  }))

  return { personas, destinos }
}

/**
 * Estado de un alta. El proceso tiene etapas —crear el item, subir el archivo y, en la factura,
 * marcarla MANUAL— y puede cortarse en cualquiera: `archivoSubido` y `completo` dicen hasta dónde
 * llegó, para retomar desde ahí sin crear otro item.
 */
export interface ResultadoAlta {
  itemId: string
  archivoSubido: boolean
  /** Todas las etapas terminaron: recién ahí se avisa que se cargó con éxito. */
  completo: boolean
  /** Motivo del corte, si lo hubo. */
  error: string | null
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function crearItem(boardId: string, nombre: string, columnas: Record<string, unknown>) {
  const data = await mondayApi<{ create_item: { id: string } | null }>(
    `mutation ($b: ID!, $n: String!, $c: JSON!) {
      create_item(board_id: $b, item_name: $n, column_values: $c, create_labels_if_missing: false) { id }
    }`,
    { b: boardId, n: nombre, c: JSON.stringify(columnas) },
  )
  const id = data.create_item?.id
  if (!id) throw new Error('monday no devolvió el id del item creado.')
  return id
}

const hoy = () => new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export interface AltaRemito {
  persona: PersonaMonday
  destino: ItemBasico
  formato: 'PDF' | 'JPEG'
  archivo: File
}

/** Columna `file` donde va el archivo del remito según su formato. */
export const columnaArchivoRemito = (formato: 'PDF' | 'JPEG'): string =>
  formato === 'PDF' ? COL_REMITO.archivoPdf : COL_REMITO.archivoJpeg

/**
 * Sube el archivo del remito. La automatización del tablero procesa el remito al crearse (si ya
 * tiene archivo) o cuando la columna del archivo cambia, así que un remito creado sin archivo no
 * dispara nada a medias: reintentar la subida alcanza.
 */
export async function subirArchivoRemito(itemId: string, formato: 'PDF' | 'JPEG', archivo: File): Promise<ResultadoAlta> {
  try {
    await subirArchivo(itemId, columnaArchivoRemito(formato), archivo)
    return { itemId, archivoSubido: true, completo: true, error: null }
  } catch (e: unknown) {
    return { itemId, archivoSubido: false, completo: false, error: mensaje(e) }
  }
}

/** Crea el remito con persona, destino y formato, y le sube el archivo a la columna que toca. */
export async function crearRemito(alta: AltaRemito): Promise<ResultadoAlta> {
  const itemId = await crearItem(TABLERO_REMITOS, `Remito ${alta.formato} - ${alta.destino.nombre} - ${hoy()}`, {
    [COL_REMITO.persona]: { personsAndTeams: [{ id: Number(alta.persona.id), kind: 'person' }] },
    [COL_REMITO.destino]: { item_ids: [Number(alta.destino.id)] },
    [COL_REMITO.formato]: { label: alta.formato },
  })
  return subirArchivoRemito(itemId, alta.formato, alta.archivo)
}

/**
 * Termina el alta de una factura a partir de donde haya quedado: sube el PDF si falta y, SÓLO con
 * el PDF ya en la columna, marca el origen MANUAL.
 *
 * El orden importa: el cambio a MANUAL es lo que pone a procesar la factura, y una factura
 * procesada sin PDF falla. Por eso el item se crea sin estado y MANUAL va al final.
 */
export async function completarFactura(
  itemId: string,
  archivo: File,
  archivoSubido: boolean,
): Promise<ResultadoAlta> {
  if (!archivoSubido) {
    try {
      await subirArchivo(itemId, COL_FACTURA.archivo, archivo)
    } catch (e: unknown) {
      return {
        itemId,
        archivoSubido: false,
        completo: false,
        error: `No se pudo subir el PDF: ${mensaje(e)}`,
      }
    }
  }
  try {
    await mondayApi(
      `mutation ($i: ID!, $c: JSON!) {
        change_multiple_column_values(board_id: ${TABLERO_FACTURAS}, item_id: $i, column_values: $c) { id }
      }`,
      { i: itemId, c: JSON.stringify({ [COL_FACTURA.origen]: { label: FACTURA_ORIGEN_MANUAL } }) },
    )
    return { itemId, archivoSubido: true, completo: true, error: null }
  } catch (e: unknown) {
    return {
      itemId,
      archivoSubido: true,
      completo: false,
      error: `El PDF se subió, pero no se pudo marcar como MANUAL: ${mensaje(e)}`,
    }
  }
}

/** Crea la factura sin estado y la completa (PDF primero, MANUAL después). */
export async function crearFactura(archivo: File): Promise<ResultadoAlta> {
  const itemId = await crearItem(TABLERO_FACTURAS, `Factura - ${archivo.name.replace(/\.pdf$/i, '')}`, {})
  return completarFactura(itemId, archivo, false)
}
