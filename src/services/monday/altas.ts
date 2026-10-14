/**
 * Altas al vuelo: un proveedor (con sus contactos) o un depósito de granos que no existe todavía,
 * creados desde el formulario donde se los necesita y devueltos con la forma de los catálogos para
 * que queden elegidos en el acto.
 */
import type { Contacto, Deposito, ItemBasico, Proveedor } from '@/types'
import {
  nombreContacto,
  normalizarWhatsapp,
  type BorradorContacto,
  type BorradorProveedor,
  type Ubicacion,
} from '@/lib/altas'
import { mondayApi } from './sdk'
import { traerItems } from './catalogos'
import { porId, texto } from './parse'
import {
  COL_CONTACTO_ALTA,
  COL_DEPOSITO,
  COL_DEPOSITO_ALTA,
  COL_PROVEEDOR,
  COL_PROVEEDOR_ALTA,
  COL_SILO,
  DEPOSITO_ACTIVO,
  PROVEEDOR_ACTIVO,
  TABLEROS,
  TABLERO_DEPOSITOS,
  TABLERO_SILOS,
} from './columns'

/** Silo, silo bolsa, acopio o corredor donde se guarda el grano. */
export interface Silo extends ItemBasico {
  tipo: string
}

/** Lo que necesitan los formularios de alta y no está en los catálogos de siempre. */
export interface OpcionesAlta {
  silos: Silo[]
  /** Etiquetas de ✋ Tipo del proveedor, leídas de la columna (Contratista, Fletes…). */
  tiposProveedor: string[]
}

export async function traerOpcionesAlta(): Promise<OpcionesAlta> {
  const [silos, config] = await Promise.all([
    traerItems(TABLERO_SILOS, `column_values(ids: ["${COL_SILO.tipo}"]) { id text value }`, 200),
    mondayApi<{ boards: { columns: { settings_str: string }[] }[] }>(
      `query { boards(ids: ${TABLEROS.proveedores}) { columns(ids: ["${COL_PROVEEDOR.tipo}"]) { settings_str } } }`,
    ),
  ])
  let tiposProveedor: string[] = []
  try {
    const cfg = JSON.parse(config.boards[0]?.columns[0]?.settings_str ?? '{}') as {
      labels?: { name: string }[]
      deactivated_labels?: number[]
    }
    tiposProveedor = (cfg.labels ?? []).map((l) => l.name).filter(Boolean)
  } catch {
    // Sin la configuración el tipo queda sin opciones: es opcional, el alta igual se puede hacer.
  }
  return {
    silos: silos
      .map((it) => ({ id: it.id, nombre: it.name.trim(), tipo: texto(porId(it.column_values), COL_SILO.tipo) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    tiposProveedor,
  }
}

const ubicacion = (u: Ubicacion) => ({ lat: u.lat, lng: u.lng, address: u.address })

async function crearItem(boardId: string, nombre: string, columnas: Record<string, unknown>): Promise<string> {
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

export interface ResultadoProveedor {
  proveedor: Proveedor
  /** Contactos nuevos que se crearon, ya conectados al proveedor. */
  contactos: Contacto[]
  /** Contactos nuevos que no se pudieron crear (el proveedor igual quedó creado). */
  fallidos: { contacto: BorradorContacto; error: string }[]
}

/** Crea un contacto conectado al proveedor. La conexión es de doble vía: el proveedor lo ve solo. */
async function crearContacto(c: BorradorContacto, proveedorId: string): Promise<Contacto> {
  const whatsapp = c.whatsapp.trim() ? normalizarWhatsapp(c.whatsapp) : null
  const email = c.email.trim()
  const columnas: Record<string, unknown> = {
    [COL_CONTACTO_ALTA.nombre]: c.nombre.trim(),
    [COL_CONTACTO_ALTA.apellido]: c.apellido.trim(),
    [COL_CONTACTO_ALTA.proveedores]: { item_ids: [Number(proveedorId)] },
  }
  if (whatsapp) columnas[COL_CONTACTO_ALTA.whatsapp] = { phone: whatsapp, countryShortName: 'AR' }
  if (email) columnas[COL_CONTACTO_ALTA.email] = { email, text: email }

  const nombre = nombreContacto(c)
  const id = await crearItem(TABLEROS.contactos, nombre, columnas)
  return {
    id,
    nombre,
    nombrePila: c.nombre.trim(),
    apellido: c.apellido.trim(),
    telefono: whatsapp ?? '',
    email,
    tipos: [],
    proveedorIds: [proveedorId],
  }
}

/**
 * Crea el proveedor (Activo, con los contactos existentes elegidos) y después cada contacto nuevo
 * apuntando a él. En ese orden porque el contacto necesita el id del proveedor; y como la conexión
 * es de doble vía, al crear el contacto el proveedor ya lo muestra entre los suyos.
 *
 * Si falla un contacto, el proveedor no se deshace: queda creado y elegido, y se avisa qué
 * contacto cargar a mano.
 */
export async function crearProveedor(p: BorradorProveedor): Promise<ResultadoProveedor> {
  const nombre = p.nombreCompleto.trim()
  const columnas: Record<string, unknown> = {
    [COL_PROVEEDOR.estado]: { label: PROVEEDOR_ACTIVO },
    [COL_PROVEEDOR_ALTA.nombreCompleto]: nombre,
    [COL_PROVEEDOR.cuit]: p.cuit,
  }
  if (p.tipos.length > 0) columnas[COL_PROVEEDOR.tipo] = { labels: p.tipos }
  if (p.ubicacion) columnas[COL_PROVEEDOR_ALTA.ubicacion] = ubicacion(p.ubicacion)
  if (p.contactoIds.length > 0) columnas[COL_PROVEEDOR.contactos] = { item_ids: p.contactoIds.map(Number) }

  const id = await crearItem(TABLEROS.proveedores, nombre, columnas)

  const contactos: Contacto[] = []
  const fallidos: ResultadoProveedor['fallidos'] = []
  for (const c of p.contactosNuevos) {
    try {
      contactos.push(await crearContacto(c, id))
    } catch (e: unknown) {
      fallidos.push({ contacto: c, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return {
    proveedor: {
      id,
      nombre,
      estado: PROVEEDOR_ACTIVO,
      cuit: p.cuit,
      tipos: p.tipos,
      contactoIds: [...p.contactoIds, ...contactos.map((c) => c.id)],
    },
    contactos,
    fallidos,
  }
}

export interface BorradorDeposito {
  cultivoId: string | null
  siloId: string | null
  ubicacion: Ubicacion | null
}

/** Depósito ya validado en su ventana, a la espera de que se confirme la carga para crearse. */
export interface DepositoPendiente {
  borrador: BorradorDeposito
  cultivo: ItemBasico
  silo: ItemBasico
}

/**
 * Crea un depósito de granos Activo, con el nombre de la convención del tablero
 * ("Girasol - Rural Ceres SA" = cultivo - silo).
 */
export async function crearDeposito(
  d: BorradorDeposito,
  cultivo: ItemBasico,
  silo: ItemBasico,
): Promise<Deposito> {
  const nombre = `${cultivo.nombre} - ${silo.nombre}`
  const columnas: Record<string, unknown> = {
    [COL_DEPOSITO.cultivo]: { item_ids: [Number(cultivo.id)] },
    [COL_DEPOSITO_ALTA.silo]: { item_ids: [Number(silo.id)] },
    [COL_DEPOSITO.estado]: { label: DEPOSITO_ACTIVO },
  }
  if (d.ubicacion) columnas[COL_DEPOSITO_ALTA.ubicacion] = ubicacion(d.ubicacion)
  const id = await crearItem(TABLERO_DEPOSITOS, nombre, columnas)
  return { id, nombre, cultivoIds: [cultivo.id], siloIds: [silo.id], estado: DEPOSITO_ACTIVO }
}
