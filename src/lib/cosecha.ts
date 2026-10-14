/**
 * Reglas de la cosecha: qué lotes y qué depósitos se pueden elegir, qué falta para crearla y qué
 * se escribe en el tablero. Son las mismas para una cosecha nueva y para una duplicada: duplicar
 * sólo cambia con qué datos arranca el formulario.
 */
import type {
  BorradorCosecha,
  Catalogos,
  Cultivo,
  Deposito,
  Lote,
  Proveedor,
} from '@/types'
import { aNumero, aTextoMonday, normalizar } from './format'
import { buscar } from './orden'
import {
  COL_COSECHA,
  PROVEEDOR_TIPO_FLETES,
  TRANSPORTE_CONTRATADO,
  TRANSPORTE_PROPIO,
} from '@/services/monday/columns'

/** Fecha de hoy en ISO local (no UTC: a la noche `toISOString` ya da el día siguiente). */
export function hoyIso(): string {
  const d = new Date()
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

export const borradorCosechaVacio = (): BorradorCosecha => ({
  cultivoId: null,
  campanaId: null,
  campoId: null,
  loteIds: [],
  fecha: hoyIso(),
  kg: '',
  depositoId: null,
  transporte: null,
  maquinariaIds: [],
  proveedorId: null,
  cartaPorte: '',
  km: '',
  ctg: '',
})

/**
 * Lotes de un campo: los subitems de ese campo en 📍 Campos y Lotes. El nombre de cada lote
 * arranca con el del campo ("LA BERNARDA-LOTE 3"), pero la pertenencia la da ser subitem, que es
 * lo que trae el catálogo.
 */
export function lotesDeCampo(catalogos: Catalogos, campoId: string | null): Lote[] {
  return buscar(catalogos.campos, campoId)?.lotes ?? []
}

/**
 * Depósitos que pueden recibir un cultivo.
 *
 * La regla es la conexión `🤚 Cultivo` del depósito. El nombre ("Girasol - Rural Ceres SA")
 * arranca con el mismo cultivo y se usa como respaldo para los depósitos que todavía no tienen la
 * conexión cargada.
 */
export function depositosAptos(depositos: Deposito[], cultivo: Cultivo | null): Deposito[] {
  if (!cultivo) return []
  const prefijo = normalizar(cultivo.nombre)
  return depositos.filter((d) =>
    d.cultivoIds.length > 0
      ? d.cultivoIds.includes(cultivo.id)
      : normalizar(d.nombre).startsWith(prefijo),
  )
}

/** Proveedores que pueden hacer un flete contratado: los de tipo "Fletes". */
export const proveedoresFlete = (proveedores: Proveedor[]): Proveedor[] =>
  proveedores.filter((p) => p.tipos.includes(PROVEEDOR_TIPO_FLETES))

/** Lo que el formulario necesita además de los catálogos de siempre. */
export interface ContextoCosecha {
  catalogos: Catalogos
  depositos: Deposito[]
  /** La columna de maquinarias admite más de una (se lee de su configuración en monday). */
  maquinariaMultiple: boolean
}

/**
 * Aplica un cambio y limpia lo que deja de corresponder: otro campo invalida el lote, otro
 * cultivo invalida el depósito. Arrastrar el valor viejo dejaría elegido algo que ya no se puede
 * elegir y que la pantalla ni siquiera muestra en la lista.
 */
export function cambiarBorrador(
  prev: BorradorCosecha,
  parcial: Partial<BorradorCosecha>,
  ctx: ContextoCosecha,
): BorradorCosecha {
  const proximo = { ...prev, ...parcial }
  if (parcial.campoId !== undefined && parcial.campoId !== prev.campoId) {
    const lotes = new Set(lotesDeCampo(ctx.catalogos, proximo.campoId).map((l) => l.id))
    proximo.loteIds = proximo.loteIds.filter((id) => lotes.has(id))
  }
  if (parcial.cultivoId !== undefined && parcial.cultivoId !== prev.cultivoId) {
    const cultivo = buscar(ctx.catalogos.cultivos, proximo.cultivoId)
    if (!depositosAptos(ctx.depositos, cultivo).some((d) => d.id === proximo.depositoId)) {
      proximo.depositoId = null
    }
  }
  return proximo
}

/**
 * Qué falta para poder crear la cosecha. Devuelve la lista y no un booleano para decirle al
 * usuario QUÉ completar. Además de lo vacío, controla las combinaciones: un lote de otro campo o
 * un depósito que no recibe ese cultivo (pasa al duplicar una cosecha con datos viejos).
 */
export function faltantesCosecha(b: BorradorCosecha, ctx: ContextoCosecha): string[] {
  const { catalogos } = ctx
  const faltan: string[] = []
  const cultivo = buscar(catalogos.cultivos, b.cultivoId)

  if (!cultivo) faltan.push('Elegí el cultivo.')
  if (!buscar(catalogos.campanas, b.campanaId)) faltan.push('Elegí la campaña.')

  const campo = buscar(catalogos.campos, b.campoId)
  if (!campo) faltan.push('Elegí el campo.')
  if (b.loteIds.length === 0) faltan.push(campo ? 'Elegí el lote.' : 'Elegí el campo y después el lote.')
  else if (campo) {
    const ajenos = b.loteIds.filter((id) => !campo.lotes.some((l) => l.id === id)).length
    if (ajenos > 0) {
      faltan.push(
        ajenos === 1
          ? `Hay un lote que no pertenece a ${campo.nombre}: quitalo o elegí uno de ese campo.`
          : `Hay ${ajenos} lotes que no pertenecen a ${campo.nombre}: quitalos o elegí lotes de ese campo.`,
      )
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) faltan.push('Cargá la fecha.')

  const kg = aNumero(b.kg)
  if (kg == null) faltan.push('Cargá los KG.')
  else if (kg <= 0) faltan.push('Los KG tienen que ser mayores a cero.')

  if (!b.depositoId) {
    faltan.push(cultivo ? 'Elegí el destino de granos en depósito.' : 'Elegí el cultivo y después el destino.')
  } else if (cultivo && !depositosAptos(ctx.depositos, cultivo).some((d) => d.id === b.depositoId)) {
    const dep = buscar(ctx.depositos, b.depositoId)
    faltan.push(
      `El destino "${dep?.nombre ?? 'elegido'}" no recibe ${cultivo.nombre}: elegí un depósito de ${cultivo.nombre}.`,
    )
  }

  if (!b.transporte) faltan.push('Elegí el tipo de transporte.')
  if (b.transporte === TRANSPORTE_PROPIO) {
    if (b.maquinariaIds.length === 0) faltan.push('Con Flete Propio, elegí la maquinaria utilizada.')
    else if (!ctx.maquinariaMultiple && b.maquinariaIds.length > 1) {
      faltan.push('Por ahora la cosecha admite una sola maquinaria: dejá sólo una.')
    }
  }
  if (b.transporte === TRANSPORTE_CONTRATADO) {
    const prov = buscar(catalogos.proveedores, b.proveedorId)
    if (!prov) faltan.push('Con Flete Contratado, elegí el proveedor del flete.')
    else if (!prov.tipos.includes(PROVEEDOR_TIPO_FLETES)) {
      faltan.push(`"${prov.nombre}" no es un proveedor de Fletes: elegí uno que lo sea.`)
    }
  }

  if (b.km.trim()) {
    const km = aNumero(b.km)
    if (km == null || km < 0) faltan.push('Los KM tienen que ser un número (o dejalos vacíos).')
  }
  return faltan
}

const conexion = (...ids: (string | null)[]) => ({
  item_ids: ids.filter((id): id is string => Boolean(id)).map(Number),
})

/**
 * Columnas de la cosecha nueva. Van TODAS en el alta, en una sola escritura: la automatización
 * del tablero se dispara al crearse el item y tiene que encontrarlo completo.
 *
 * Del transporte se escribe sólo lo que corresponde al tipo elegido (maquinarias o proveedor),
 * aunque el borrador conserve lo del otro por si el usuario cambió de idea. Los opcionales vacíos
 * no se mandan.
 */
export function columnasCosecha(b: BorradorCosecha): Record<string, unknown> {
  const columnas: Record<string, unknown> = {
    [COL_COSECHA.cultivo]: conexion(b.cultivoId),
    [COL_COSECHA.campana]: conexion(b.campanaId),
    [COL_COSECHA.campo]: conexion(b.campoId),
    [COL_COSECHA.lote]: conexion(...b.loteIds),
    [COL_COSECHA.fecha]: { date: b.fecha },
    [COL_COSECHA.kg]: aTextoMonday(aNumero(b.kg) ?? 0),
    [COL_COSECHA.deposito]: conexion(b.depositoId),
    [COL_COSECHA.transporte]: { label: b.transporte },
  }
  if (b.transporte === TRANSPORTE_PROPIO) columnas[COL_COSECHA.maquinarias] = conexion(...b.maquinariaIds)
  if (b.transporte === TRANSPORTE_CONTRATADO) columnas[COL_COSECHA.proveedor] = conexion(b.proveedorId)

  if (b.cartaPorte.trim()) columnas[COL_COSECHA.cartaPorte] = b.cartaPorte.trim()
  const km = aNumero(b.km)
  if (b.km.trim() && km != null) columnas[COL_COSECHA.km] = aTextoMonday(km)
  if (b.ctg.trim()) columnas[COL_COSECHA.ctg] = b.ctg.trim()
  return columnas
}

/**
 * Nombre del item con la convención del tablero ("Soja-2025-2026-Fecha 02-07-2026"). Make lo
 * renombra después igual; esto es para que no nazca con un nombre suelto.
 */
export function nombreCosecha(b: BorradorCosecha, catalogos: Catalogos): string {
  const cultivo = buscar(catalogos.cultivos, b.cultivoId)?.nombre ?? 'Cosecha'
  const campana = buscar(catalogos.campanas, b.campanaId)?.nombre ?? ''
  const [a, m, d] = b.fecha.split('-')
  return [cultivo, campana, d && m && a ? `Fecha ${d}-${m}-${a}` : ''].filter(Boolean).join('-')
}
