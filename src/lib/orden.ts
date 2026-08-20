/**
 * Reglas de la orden de trabajo: qué contactos se pueden elegir, cuándo un paso está completo
 * y cómo se expanden los bloques campo+lotes a las órdenes que se van a crear.
 *
 * Vive fuera de los componentes a propósito: son decisiones del negocio, no de la pantalla.
 */
import type {
  BorradorOrden,
  Campo,
  Catalogos,
  Contacto,
  OrdenAGenerar,
  PayloadEmision,
  Proveedor,
} from '@/types'
import { aNumero } from './format'
import { TABLEROS } from '@/services/monday/columns'

let contador = 0
/** Clave local de un bloque. No usa `crypto.randomUUID` para no depender de contexto seguro. */
export const nuevoUid = (): string => `b${++contador}`

/** Borrador vacío: un único bloque de campo listo para completar. */
export const borradorInicial = (): BorradorOrden => ({
  laborId: null,
  proveedorId: null,
  cultivoId: null,
  campanaId: null,
  usdPorHa: '',
  contactoId: null,
  bloques: [{ uid: nuevoUid(), campoId: null, loteIds: [] }],
})

/** Sólo se ofrecen proveedores activos: los bloqueados no pueden recibir una orden. */
export const proveedoresElegibles = (proveedores: Proveedor[]): Proveedor[] =>
  proveedores.filter((p) => p.estado === 'Activo')

/**
 * Contactos a los que se le puede mandar la orden de un proveedor: SÓLO los que tienen a ese
 * proveedor conectado. La conexión se mira desde los dos lados porque en Monday son dos columnas
 * distintas (`Proveedores.🤖Contactos` y `Contactos.✋ Provedores`) y no siempre se cargan ambas.
 */
export function contactosDeProveedor(
  contactos: Contacto[],
  proveedor: Proveedor | null,
): Contacto[] {
  if (!proveedor) return []
  const desdeProveedor = new Set(proveedor.contactoIds)
  return contactos.filter((c) => desdeProveedor.has(c.id) || c.proveedorIds.includes(proveedor.id))
}

/** Busca por id en cualquier catálogo con forma `{ id }`. */
export const buscar = <T extends { id: string }>(lista: T[], id: string | null): T | null =>
  id ? lista.find((x) => x.id === id) ?? null : null

/** Lotes ya tomados por OTROS bloques: un mismo lote no puede repetirse en la misma carga. */
export function lotesTomados(borrador: BorradorOrden, uidActual: string): Set<string> {
  const tomados = new Set<string>()
  for (const b of borrador.bloques) {
    if (b.uid === uidActual) continue
    for (const id of b.loteIds) tomados.add(id)
  }
  return tomados
}

/**
 * Motivos por los que el paso 1 todavía no se puede confirmar. Devolver la lista —en vez de un
 * booleano— es lo que permite decirle al usuario QUÉ le falta en lugar de sólo deshabilitar.
 */
export function faltantesPaso1(borrador: BorradorOrden, catalogos: Catalogos): string[] {
  const faltan: string[] = []
  if (!borrador.laborId) faltan.push('Elegí la labor.')
  if (!borrador.proveedorId) faltan.push('Elegí el proveedor / contratista.')
  if (!borrador.cultivoId) faltan.push('Elegí el cultivo.')
  if (!borrador.campanaId) faltan.push('Elegí una campaña activa.')

  const valor = aNumero(borrador.usdPorHa)
  if (valor == null) faltan.push('Cargá el valor U$/Ha de la labor.')
  else if (valor <= 0) faltan.push('El valor U$/Ha tiene que ser mayor a cero.')

  const proveedor = buscar(catalogos.proveedores, borrador.proveedorId)
  const disponibles = contactosDeProveedor(catalogos.contactos, proveedor)
  if (proveedor && disponibles.length === 0) {
    faltan.push(`"${proveedor.nombre}" todavía no tiene contactos vinculados en Monday.`)
  } else if (!borrador.contactoId) {
    faltan.push('Elegí el contacto al que se le envía la orden.')
  }
  return faltan
}

/** Motivos por los que el paso 2 todavía no se puede confirmar. */
export function faltantesPaso2(borrador: BorradorOrden): string[] {
  const faltan: string[] = []
  const conCampo = borrador.bloques.filter((b) => b.campoId)
  if (conCampo.length === 0) return ['Agregá al menos un campo con sus lotes.']

  const sinLotes = conCampo.filter((b) => b.loteIds.length === 0).length
  if (sinLotes > 0) {
    faltan.push(
      sinLotes === 1
        ? 'Hay un campo sin lotes seleccionados.'
        : `Hay ${sinLotes} campos sin lotes seleccionados.`,
    )
  }
  if (borrador.bloques.some((b) => !b.campoId)) {
    faltan.push('Hay un bloque sin campo elegido: completalo o quitalo.')
  }
  return faltan
}

/**
 * Expande los bloques a las órdenes concretas. El tablero admite UN campo y UN lote por orden,
 * así que un bloque con 3 lotes produce 3 órdenes idénticas salvo por el lote conectado.
 */
export function expandirOrdenes(borrador: BorradorOrden, campos: Campo[]): OrdenAGenerar[] {
  const usdHa = aNumero(borrador.usdPorHa)
  const ordenes: OrdenAGenerar[] = []

  for (const bloque of borrador.bloques) {
    const campo = buscar(campos, bloque.campoId)
    if (!campo) continue
    for (const loteId of bloque.loteIds) {
      const lote = campo.lotes.find((l) => l.id === loteId)
      if (!lote) continue
      // Se prioriza la hectárea productiva; si el lote no la tiene cargada, se usa la total.
      const has = lote.hectareasProductivas ?? lote.hectareasTotales
      ordenes.push({
        campoId: campo.id,
        campoNombre: campo.nombre,
        loteId: lote.id,
        loteNombre: lote.nombre,
        hectareas: has,
        totalUsd: has != null && usdHa != null ? Math.round(has * usdHa * 100) / 100 : null,
      })
    }
  }
  return ordenes
}

/** Total en dólares de todas las órdenes. `null` si alguna no tiene hectáreas cargadas. */
export function totalGeneral(ordenes: OrdenAGenerar[]): number | null {
  if (ordenes.length === 0 || ordenes.some((o) => o.totalUsd == null)) return null
  return Math.round(ordenes.reduce((acc, o) => acc + (o.totalUsd ?? 0), 0) * 100) / 100
}

/** Suma de hectáreas de las órdenes. `null` si alguna no tiene el dato cargado. */
export function hectareasTotales(ordenes: OrdenAGenerar[]): number | null {
  if (ordenes.length === 0 || ordenes.some((o) => o.hectareas == null)) return null
  return Math.round(ordenes.reduce((acc, o) => acc + (o.hectareas ?? 0), 0) * 100) / 100
}

/**
 * Arma el payload que consume Make para crear un item por orden. Devuelve `null` si el borrador
 * está incompleto: emitir a medias crearía órdenes rotas en el tablero.
 */
export function armarPayload(borrador: BorradorOrden, catalogos: Catalogos): PayloadEmision | null {
  const labor = buscar(catalogos.labores, borrador.laborId)
  const proveedor = buscar(catalogos.proveedores, borrador.proveedorId)
  const cultivo = buscar(catalogos.cultivos, borrador.cultivoId)
  const campana = buscar(catalogos.campanas, borrador.campanaId)
  const contacto = buscar(catalogos.contactos, borrador.contactoId)
  const usdPorHa = aNumero(borrador.usdPorHa)
  const ordenes = expandirOrdenes(borrador, catalogos.campos)

  if (!labor || !proveedor || !cultivo || !campana || usdPorHa == null || ordenes.length === 0) {
    return null
  }

  const soloIdNombre = (x: { id: string; nombre: string }) => ({ id: x.id, nombre: x.nombre })

  return {
    operacion: 'ORDEN_DE_TRABAJO',
    boardOrdenTrabajo: TABLEROS.ordenTrabajo,
    labor: soloIdNombre(labor),
    proveedor: soloIdNombre(proveedor),
    cultivo: soloIdNombre(cultivo),
    campana: soloIdNombre(campana),
    contacto: contacto
      ? { ...soloIdNombre(contacto), telefono: contacto.telefono, email: contacto.email }
      : null,
    usdPorHa,
    ordenes,
  }
}
