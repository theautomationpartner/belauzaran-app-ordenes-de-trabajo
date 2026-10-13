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

/** Resultado de un alta: el item puede quedar creado aunque el archivo no haya subido. */
export interface ResultadoAlta {
  itemId: string
  /** Mensaje si el archivo no subió; el item igual existe y se puede reintentar. */
  errorArchivo: string | null
}

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

/**
 * Sube el archivo de un item recién creado. Si falla no se borra el item: queda con sus datos y el
 * archivo se puede reintentar desde la pantalla de resultado (`reintentarArchivo`).
 */
async function adjuntar(itemId: string, columnaId: string, archivo: File): Promise<ResultadoAlta> {
  try {
    await subirArchivo(itemId, columnaId, archivo)
    return { itemId, errorArchivo: null }
  } catch (e: unknown) {
    return { itemId, errorArchivo: e instanceof Error ? e.message : String(e) }
  }
}

export const reintentarArchivo = adjuntar

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

/** Crea el remito con persona, destino y formato, y le sube el archivo a la columna que toca. */
export async function crearRemito(alta: AltaRemito): Promise<ResultadoAlta> {
  const itemId = await crearItem(TABLERO_REMITOS, `Remito ${alta.formato} - ${alta.destino.nombre} - ${hoy()}`, {
    [COL_REMITO.persona]: { personsAndTeams: [{ id: Number(alta.persona.id), kind: 'person' }] },
    [COL_REMITO.destino]: { item_ids: [Number(alta.destino.id)] },
    [COL_REMITO.formato]: { label: alta.formato },
  })
  return adjuntar(itemId, columnaArchivoRemito(alta.formato), alta.archivo)
}

/** Crea la factura con origen MANUAL y le sube el PDF. */
export async function crearFactura(archivo: File): Promise<ResultadoAlta> {
  const itemId = await crearItem(TABLERO_FACTURAS, `Factura - ${archivo.name.replace(/\.pdf$/i, '')}`, {
    [COL_FACTURA.origen]: { label: FACTURA_ORIGEN_MANUAL },
  })
  return adjuntar(itemId, COL_FACTURA.archivo, archivo)
}
