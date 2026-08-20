/** Formateo en convención argentina: punto de miles, coma decimal. */

const NUM = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const NUM0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

export const usd = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? '—' : `U$S ${NUM.format(n)}`

export const hectareas = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? '—' : `${NUM0.format(n)} ha`

/**
 * Cantidad de producto con su unidad (litros, kilos, plantas…). La unidad va al lado del número
 * porque una dosis sin unidad no se puede interpretar: "2,5" es medio bidón o dos bolsas y media.
 */
export const cantidad = (n: number | null | undefined, unidad: string): string =>
  n == null || !Number.isFinite(n) ? '—' : `${NUM0.format(n)}${unidad ? ` ${unidad}` : ''}`

/**
 * Lee un número tipeado por el usuario aceptando coma o punto como separador decimal: en el
 * teclado del celular la coma es lo natural, y `Number('12,5')` daría `NaN`.
 */
export function aNumero(entrada: string): number | null {
  const limpio = entrada.trim().replace(/\./g, '').replace(',', '.')
  if (!limpio) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

/** Normaliza texto para buscar sin acentos ni mayúsculas. */
export const normalizar = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
