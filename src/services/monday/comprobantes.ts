/**
 * Registrar Remito / Factura: lo que hay que leer para el formulario y la creación del item con
 * su archivo.
 */
import type { ItemBasico } from '@/types'
import { mondayApi, subirArchivo } from './sdk'
import { obtenerDatosSesion } from './sesion'
import {
  COL_FACTURA,
  COL_REMITO,
  COL_FACTURA_ESTADO,
  FACTURA_ESTADO_REGISTRAR,
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
  /** Usuario de monday que está usando la App; `null` si no se pudo saber. */
  usuarioActualId: string | null
}

/**
 * Id del usuario que está usando la App.
 *
 * En monday sale del `sessionToken`, que monday firma con el usuario logueado: es el mismo token
 * que verifica el servidor, así que no se puede hacer pasar por otro desde el navegador. NO se
 * pregunta `me` a la API, porque en el deploy la API responde con el token de la cuenta y
 * devolvería siempre el mismo usuario. En local no hay sesión de monday: ahí `me` es el dueño
 * del token de desarrollo, que alcanza para probar.
 */
async function idUsuarioActual(): Promise<string | null> {
  try {
    if (import.meta.env.DEV) {
      const d = await mondayApi<{ me: { id: string } | null }>('query { me { id } }')
      return d.me ? String(d.me.id) : null
    }
    const sesion = await obtenerDatosSesion()
    return sesion.userId ? String(sesion.userId) : null
  } catch {
    // Sin saber quién es, la persona se elige a mano: no impide registrar.
    return null
  }
}

/**
 * Personas y destinos, en un solo viaje.
 *
 * Las personas son los suscriptores del tablero de remitos: la columna sólo acepta a quien tiene
 * acceso al tablero, y ofrecer a cualquier usuario de la cuenta haría fallar el alta.
 */
export async function traerDatosRemito(): Promise<DatosRemito> {
  const [data, usuarioActualId] = await Promise.all([
    mondayApi<{
      remitos: { subscribers: { id: string; name: string; enabled: boolean; is_guest: boolean }[] }[]
      destinos: { items_page: { items: { id: string; name: string }[] } }[]
    }>(`query {
      remitos: boards(ids: ${TABLERO_REMITOS}) { subscribers { id name enabled is_guest } }
      destinos: boards(ids: ${TABLERO_DESTINOS}) { items_page(limit: 100) { items { id name } } }
    }`),
    idUsuarioActual(),
  ])

  const personas = (data.remitos[0]?.subscribers ?? [])
    .filter((s) => s.enabled)
    .map((s) => ({ id: String(s.id), nombre: s.name.trim(), esInvitado: s.is_guest }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const destinos = (data.destinos[0]?.items_page.items ?? []).map((it) => ({
    id: it.id,
    nombre: it.name.trim(),
  }))

  return { personas, destinos, usuarioActualId }
}

/**
 * Estado de un alta. El proceso tiene etapas —crear el item, subir el archivo y, en la factura,
 * marcarla MANUAL y después Registrar— y puede cortarse en cualquiera: `archivoSubido`,
 * `manualMarcado` y `completo` dicen hasta dónde llegó, para retomar sin crear otro item.
 */
export interface ResultadoAlta {
  itemId: string
  archivoSubido: boolean
  /** Sólo factura: el origen ya quedó en MANUAL (falta, como mucho, pasar a Registrar). */
  manualMarcado: boolean
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
    return { itemId, archivoSubido: true, manualMarcado: false, completo: true, error: null }
  } catch (e: unknown) {
    return { itemId, archivoSubido: false, manualMarcado: false, completo: false, error: mensaje(e) }
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

/** Cambia una columna de estado de la factura. */
const marcarFactura = (itemId: string, columna: string, etiqueta: string) =>
  mondayApi(
    `mutation ($i: ID!, $c: JSON!) {
      change_multiple_column_values(board_id: ${TABLERO_FACTURAS}, item_id: $i, column_values: $c) { id }
    }`,
    { i: itemId, c: JSON.stringify({ [columna]: { label: etiqueta } }) },
  )

/** Hasta dónde llegó una factura; es lo que se guarda para retomarla. */
export type ProgresoFactura = Pick<ResultadoAlta, 'archivoSubido' | 'manualMarcado'>

/**
 * Termina el alta de una factura a partir de donde haya quedado, en este orden y cada paso SÓLO si
 * el anterior salió bien:
 *
 * 1. Sube el PDF.
 * 2. Marca el origen MANUAL.
 * 3. Pasa 🤖 Estado de Registro a "Registrar", que es lo que la manda a procesar.
 *
 * El orden importa: una factura que se procesa sin PDF falla. Por eso el item se crea sin estados
 * y los dos estados van al final, con el PDF ya en la columna.
 */
export async function completarFactura(
  itemId: string,
  archivo: File,
  progreso: ProgresoFactura,
): Promise<ResultadoAlta> {
  const corte = (archivoSubido: boolean, manualMarcado: boolean, error: string): ResultadoAlta => ({
    itemId,
    archivoSubido,
    manualMarcado,
    completo: false,
    error,
  })

  if (!progreso.archivoSubido) {
    try {
      await subirArchivo(itemId, COL_FACTURA.archivo, archivo)
    } catch (e: unknown) {
      return corte(false, false, `No se pudo subir el PDF: ${mensaje(e)}`)
    }
  }
  if (!progreso.manualMarcado) {
    try {
      await marcarFactura(itemId, COL_FACTURA.origen, FACTURA_ORIGEN_MANUAL)
    } catch (e: unknown) {
      return corte(true, false, `El PDF se subió, pero no se pudo marcar como MANUAL: ${mensaje(e)}`)
    }
  }
  try {
    await marcarFactura(itemId, COL_FACTURA_ESTADO, FACTURA_ESTADO_REGISTRAR)
  } catch (e: unknown) {
    return corte(
      true,
      true,
      `La factura quedó con el PDF y en MANUAL, pero no se pudo pasar a Registrar: ${mensaje(e)}`,
    )
  }
  return { itemId, archivoSubido: true, manualMarcado: true, completo: true, error: null }
}

/** Crea la factura sin estados y la completa (PDF → MANUAL → Registrar). */
export async function crearFactura(archivo: File): Promise<ResultadoAlta> {
  const itemId = await crearItem(TABLERO_FACTURAS, `Factura - ${archivo.name.replace(/\.pdf$/i, '')}`, {})
  return completarFactura(itemId, archivo, { archivoSubido: false, manualMarcado: false })
}
