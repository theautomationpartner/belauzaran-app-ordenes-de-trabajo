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
 * Lee un número tipeado por el usuario.
 *
 * El punto en español es ambiguo: en `1.500` separa miles y en `0.7` es el decimal. Se resuelve
 * con dos reglas, en este orden:
 *
 * 1. Si hay coma, la coma manda como decimal y todos los puntos son separadores de miles
 *    (`1.500,75` → `1500.75`).
 * 2. Sin coma, un punto sólo se toma como separador de miles si el texto tiene la forma exacta
 *    de miles agrupados de a tres (`1.500`, `1.234.567`). En cualquier otro caso es el decimal
 *    (`0.7` → `0.7`, `1500.75` → `1500.75`).
 *
 * Devuelve un `number`, que es lo que después viaja a Monday serializado con punto decimal y
 * sin separador de miles.
 */
export function aNumero(entrada: string): number | null {
  const texto = entrada.trim().replace(/\s/g, '')
  if (!texto) return null

  let normalizado: string
  if (texto.includes(',')) {
    normalizado = texto.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(texto)) {
    normalizado = texto.replace(/\./g, '')
  } else {
    normalizado = texto
  }

  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

/**
 * Serializa un número para las columnas `numbers` de Monday: punto decimal, sin separador de
 * miles y sin notación científica. `String(1500.75)` ya da `"1500.75"`, pero pasar por acá deja
 * la intención explícita en el único lugar donde se arman los valores que se escriben.
 */
export const aTextoMonday = (n: number): string => {
  if (!Number.isFinite(n)) return ''
  // `toFixed(6)` evita la notación exponencial de los números muy chicos (1e-7 → "0.000000").
  const fijo = Math.abs(n) < 1e-6 && n !== 0 ? n.toFixed(6) : String(n)
  return fijo.includes('e') ? n.toFixed(6) : fijo
}

/** Normaliza texto para buscar sin acentos ni mayúsculas. */
export const normalizar = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
