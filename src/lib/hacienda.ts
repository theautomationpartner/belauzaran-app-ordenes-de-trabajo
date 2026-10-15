/**
 * Hacienda: reglas del registro de movimientos (las del formulario original) y los cálculos del
 * dashboard. Todo sale de los items del tablero Movimientos; no hay otro origen de datos.
 */
import { hoyIso } from './cosecha'

/* ===================================================================== */
/* Tipos                                                                  */
/* ===================================================================== */

export type ClaseMovimiento = 'ingreso' | 'egreso' | 'cambio'
export type SubtipoMovimiento = 'Compra' | 'Nacimiento' | 'Venta' | 'Muerte'
export type TipoMovimiento = SubtipoMovimiento | 'Cambio de categoría'

export const TIPOS: TipoMovimiento[] = ['Compra', 'Nacimiento', 'Cambio de categoría', 'Venta', 'Muerte']
export const CAMBIO: TipoMovimiento = 'Cambio de categoría'

/**
 * Color de cada tipo. Es fijo (sigue al tipo, nunca al orden en que aparece) y el orden de
 * apilado Compra · Nacimiento · Cambio · Venta · Muerte está validado contra daltonismo.
 */
export const COLOR_TIPO: Record<TipoMovimiento, string> = {
  Compra: '#2a78d6',
  Nacimiento: '#1baf7a',
  'Cambio de categoría': '#6250d6',
  Venta: '#eda100',
  Muerte: '#e34948',
}
export const COLOR_INGRESO = '#2a78d6'
export const COLOR_EGRESO = '#e34948'

export const esIngreso = (t: string) => t === 'Compra' || t === 'Nacimiento'
export const esEgreso = (t: string) => t === 'Venta' || t === 'Muerte'

/** Movimiento tal como se carga en el formulario. */
export interface BorradorMovimiento {
  clase: ClaseMovimiento | null
  subtipo: SubtipoMovimiento | null
  categoria: string | null
  origen: string | null
  destino: string | null
  campoId: string | null
  /** ISO `AAAA-MM-DD`. */
  fecha: string
  cantidad: string
  responsable: string
  observaciones: string
}

/** Movimiento ya registrado en el tablero. */
export interface Movimiento {
  id: string
  nombre: string
  /** 🤖ID Movimiento (MOV-001…). */
  codigo: string
  tipo: string
  campoId: string | null
  campo: string
  /** Categoría de compra, nacimiento, venta o muerte; vacía en un cambio de categoría. */
  categoria: string
  origen: string
  destino: string
  /** ISO; `null` si el item no tiene fecha. */
  fecha: string | null
  /** Cabezas. */
  cantidad: number
  responsable: string
  observaciones: string
}

/** Etiquetas vigentes de las columnas del tablero, leídas de monday. */
export interface OpcionesHacienda {
  /** Etiquetas del status de tipo (Compra, Venta…). */
  tipos: string[]
  categorias: string[]
  origenes: string[]
  destinos: string[]
}

/* ===================================================================== */
/* Reglas de categorías                                                   */
/* ===================================================================== */

/** Lo único que puede nacer. */
export const NACIMIENTO = ['Terneros', 'Terneras']

/**
 * Recategorizaciones permitidas, origen → destinos. Es el crecimiento de cada animal:
 *   Hembras: Terneras → Vaquillonas 1-2 → Vaquillonas +2 → Vacas → Vacas de refugo
 *   Machos:  Terneros → Novillitos → Novillos
 *            Terneros → Toritos → Toros
 * Las vacas no vuelven atrás ni cambian de rama.
 */
export const TRANSICIONES: Record<string, string[]> = {
  Terneras: ['Vaquillonas 1-2'],
  'Vaquillonas 1-2': ['Vaquillonas 2'],
  'Vaquillonas 2': ['Vacas'],
  Vacas: ['Vacas de refugo'],
  Terneros: ['Novillitos', 'Toritos'],
  Novillitos: ['Novillos'],
  Toritos: ['Toros'],
}

/** Las ramas de crecimiento, en orden, para dibujar el ciclo en el dashboard. */
export const RAMAS: { nombre: string; cadena: string[] }[] = [
  { nombre: 'Hembras', cadena: ['Terneras', 'Vaquillonas 1-2', 'Vaquillonas 2', 'Vacas', 'Vacas de refugo'] },
  { nombre: 'Machos · novillos', cadena: ['Terneros', 'Novillitos', 'Novillos'] },
  { nombre: 'Machos · toros', cadena: ['Terneros', 'Toritos', 'Toros'] },
]

/**
 * Clave para comparar nombres de categoría sin importar plural, tildes o cómo esté escrito el
 * rango de edad: "Vaquillonas 1-2 años" = "Vaquillona 1-2", "Vacas de refugio" = "Vaca refugo".
 * Las etiquetas las administran en monday y cambian de texto; las reglas no tienen que romperse.
 */
export function clave(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/refugio/g, 'refugo')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w && !['de', 'a', 'y', 'ano', 'anos'].includes(w))
    .map((w) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w))
    .join('')
}

/** La etiqueta real de monday que corresponde a un nombre de la configuración. */
export const etiquetaDe = (etiquetas: string[], nombre: string): string | null =>
  etiquetas.find((e) => clave(e) === clave(nombre)) ?? null

/** Categorías que se pueden elegir para una compra, venta, muerte o nacimiento. */
export function categoriasPara(op: OpcionesHacienda, subtipo: SubtipoMovimiento | null): string[] {
  if (subtipo === 'Nacimiento') {
    return NACIMIENTO.map((n) => etiquetaDe(op.categorias, n)).filter((x): x is string => Boolean(x))
  }
  return op.categorias
}

/** Categorías de origen que tienen a dónde pasar. */
export const origenesPosibles = (op: OpcionesHacienda): string[] =>
  Object.keys(TRANSICIONES)
    .map((o) => etiquetaDe(op.origenes, o))
    .filter((x): x is string => Boolean(x))

/** A qué categorías puede pasar un origen (etiquetas reales de la columna destino). */
export function destinosPara(op: OpcionesHacienda, origen: string | null): string[] {
  if (!origen) return []
  const k = Object.keys(TRANSICIONES).find((o) => clave(o) === clave(origen))
  return (k ? TRANSICIONES[k] : [])
    .map((d) => etiquetaDe(op.destinos, d))
    .filter((x): x is string => Boolean(x))
}

/** Tipo del movimiento según lo elegido (lo que va al status). */
export function tipoDe(b: BorradorMovimiento): TipoMovimiento | null {
  if (b.clase === 'cambio') return CAMBIO
  return b.subtipo
}

export const movimientoVacio = (responsable = ''): BorradorMovimiento => ({
  clase: null,
  subtipo: null,
  categoria: null,
  origen: null,
  destino: null,
  campoId: null,
  fecha: hoyIso(),
  cantidad: '',
  responsable,
  observaciones: '',
})

/**
 * Aplica un cambio y limpia lo que deja de valer: otra clase borra el subtipo, otro subtipo saca
 * la categoría si no corresponde (un nacimiento sólo admite terneros o terneras) y otro origen
 * resetea el destino (y lo elige solo si hay un único destino posible).
 */
export function cambiarMovimiento(
  prev: BorradorMovimiento,
  parcial: Partial<BorradorMovimiento>,
  op: OpcionesHacienda,
): BorradorMovimiento {
  const b = { ...prev, ...parcial }
  if (parcial.clase !== undefined && parcial.clase !== prev.clase) b.subtipo = null
  if (b.clase !== 'cambio' && b.categoria && !categoriasPara(op, b.subtipo).includes(b.categoria)) {
    b.categoria = null
  }
  if (parcial.origen !== undefined && parcial.origen !== prev.origen) {
    const destinos = destinosPara(op, b.origen)
    b.destino = destinos.length === 1 ? destinos[0] : null
  }
  return b
}

/** Qué falta para poder registrar el movimiento, en el orden en que aparece en la pantalla. */
export function faltantesMovimiento(b: BorradorMovimiento, op: OpcionesHacienda): string[] {
  const faltan: string[] = []
  if (!b.clase) return ['Elegí el tipo de movimiento.']
  if (b.clase === 'ingreso' && !b.subtipo) return ['Elegí si es compra o nacimiento.']
  if (b.clase === 'egreso' && !b.subtipo) return ['Elegí si es venta o muerte.']

  if (b.clase === 'cambio') {
    if (!b.origen || !origenesPosibles(op).includes(b.origen)) faltan.push('Elegí la categoría de origen.')
    if (!b.destino || !destinosPara(op, b.origen).includes(b.destino)) {
      faltan.push('Elegí la categoría de destino.')
    }
  } else if (!b.categoria || !categoriasPara(op, b.subtipo).includes(b.categoria)) {
    faltan.push(
      b.subtipo === 'Nacimiento' ? 'Elegí la categoría (sólo terneros o terneras).' : 'Elegí la categoría.',
    )
  }

  if (!b.campoId) faltan.push('Elegí el campo.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) faltan.push('Cargá la fecha.')
  else if (b.fecha > hoyIso()) faltan.push('La fecha no puede ser futura.')
  const c = b.cantidad.trim()
  if (!/^\d+$/.test(c) || Number(c) < 1) faltan.push('La cantidad tiene que ser un número entero mayor a 0.')
  if (b.responsable.trim().length < 3) faltan.push('Cargá el nombre del responsable.')
  return faltan
}

/** "14/10/2026" a partir del ISO. */
const fechaAr = (iso: string) => iso.split('-').reverse().join('/')

/**
 * Nombre del item, con la convención del formulario original:
 *   Venta-Vaquillonas +2 años_14/10/2026
 *   Cambio de categoría-Terneras-Vaquillonas 1-2 años_14/10/2026
 */
export function nombreMovimiento(b: BorradorMovimiento): string {
  const tipo = tipoDe(b) ?? ''
  const cats = b.clase === 'cambio' ? `${b.origen}-${b.destino}` : b.categoria ?? ''
  return `${tipo}-${cats}_${fechaAr(b.fecha)}`
}

/* ===================================================================== */
/* Dashboard                                                              */
/* ===================================================================== */

export interface FiltrosHacienda {
  /** ISO inclusive; `null` = sin límite. */
  desde: string | null
  hasta: string | null
  campos: string[]
  categorias: string[]
  tipos: string[]
}

/** En un cambio de categoría cuentan las dos: la de origen y la de destino. */
const categoriasDe = (m: Movimiento) => (m.tipo === CAMBIO ? [m.origen, m.destino] : [m.categoria])

export function filtrar(movs: Movimiento[], f: FiltrosHacienda): Movimiento[] {
  return movs.filter((m) => {
    if (f.desde && (!m.fecha || m.fecha < f.desde)) return false
    if (f.hasta && (!m.fecha || m.fecha > f.hasta)) return false
    if (f.campos.length && !f.campos.includes(m.campo)) return false
    if (f.tipos.length && !f.tipos.includes(m.tipo)) return false
    if (f.categorias.length && !categoriasDe(m).some((c) => f.categorias.includes(c))) return false
    return true
  })
}

export interface Suma {
  movimientos: number
  cabezas: number
}
const vacia = (): Suma => ({ movimientos: 0, cabezas: 0 })
const sumar = (s: Suma, m: Movimiento) => {
  s.movimientos += 1
  s.cabezas += m.cantidad
}

export interface Indicadores {
  porTipo: Record<string, Suma>
  ingresos: Suma
  egresos: Suma
  /** Cabezas que entraron menos las que salieron (las recategorizaciones no cambian el total). */
  neto: number
  total: Suma
}

export function indicadores(movs: Movimiento[]): Indicadores {
  const porTipo: Record<string, Suma> = Object.fromEntries(TIPOS.map((t) => [t, vacia()]))
  const ingresos = vacia()
  const egresos = vacia()
  const total = vacia()
  for (const m of movs) {
    porTipo[m.tipo] ??= vacia()
    sumar(porTipo[m.tipo], m)
    sumar(total, m)
    if (esIngreso(m.tipo)) sumar(ingresos, m)
    if (esEgreso(m.tipo)) sumar(egresos, m)
  }
  return { porTipo, ingresos, egresos, neto: ingresos.cabezas - egresos.cabezas, total }
}

/** "2026-03" de una fecha ISO. */
export const mesDe = (iso: string) => iso.slice(0, 7)

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
/** "Mar 26" a partir de "2026-03". */
export const rotuloMes = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`
export const rotuloMesLargo = (ym: string) => `${MESES_LARGOS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

/** Meses entre dos "AAAA-MM", inclusive. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  let [a, m] = desde.split('-').map(Number)
  const [ah, mh] = hasta.split('-').map(Number)
  while (a < ah || (a === ah && m <= mh)) {
    out.push(`${a}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      a += 1
    }
  }
  return out
}

export interface FilaMes {
  mes: string
  /** Cabezas por tipo. */
  cabezas: Record<string, number>
  movimientos: Movimiento[]
}

/**
 * Cabezas por mes y tipo, para la serie temporal. Los meses sin movimientos aparecen igual (en
 * cero): un hueco en la serie es información, no un mes que no existió.
 */
export function porMes(movs: Movimiento[], desde: string | null, hasta: string | null): FilaMes[] {
  const conFecha = movs.filter((m) => m.fecha)
  if (conFecha.length === 0 && (!desde || !hasta)) return []
  const fechas = conFecha.map((m) => m.fecha as string).sort()
  const ini = mesDe(desde ?? fechas[0])
  const fin = mesDe(hasta ?? fechas[fechas.length - 1])
  const meses = mesesEntre(ini, fin)
  const filas = new Map<string, FilaMes>(
    meses.map((mes) => [mes, { mes, cabezas: Object.fromEntries(TIPOS.map((t) => [t, 0])), movimientos: [] }]),
  )
  for (const m of conFecha) {
    const f = filas.get(mesDe(m.fecha as string))
    if (!f) continue
    f.cabezas[m.tipo] = (f.cabezas[m.tipo] ?? 0) + m.cantidad
    f.movimientos.push(m)
  }
  return [...filas.values()]
}

/** Fila de la planilla de existencias: lo mismo que la planilla de la empresa, por categoría. */
export interface FilaPlanilla {
  categoria: string
  ingresosRecat: number
  compras: number
  nacimientos: number
  totalIngresos: number
  egresosRecat: number
  ventas: number
  muertes: number
  totalEgresos: number
  /** Variación de existencias del período (sin stock inicial). */
  variacion: number
  movimientos: Movimiento[]
}

/**
 * La planilla de existencias por período, armada desde los movimientos: por categoría, los
 * ingresos (recategorización entrante, compras, nacimientos) y los egresos (recategorización
 * saliente, ventas, muertes). Falta sólo el stock inicial, que no surge de los movimientos.
 */
export function planilla(movs: Movimiento[], categorias: string[]): FilaPlanilla[] {
  const filas = new Map<string, FilaPlanilla>()
  const fila = (c: string) => {
    if (!filas.has(c)) {
      filas.set(c, {
        categoria: c,
        ingresosRecat: 0,
        compras: 0,
        nacimientos: 0,
        totalIngresos: 0,
        egresosRecat: 0,
        ventas: 0,
        muertes: 0,
        totalEgresos: 0,
        variacion: 0,
        movimientos: [],
      })
    }
    return filas.get(c) as FilaPlanilla
  }
  for (const m of movs) {
    if (m.tipo === CAMBIO) {
      if (m.origen) {
        const f = fila(m.origen)
        f.egresosRecat += m.cantidad
        f.movimientos.push(m)
      }
      if (m.destino) {
        const f = fila(m.destino)
        f.ingresosRecat += m.cantidad
        f.movimientos.push(m)
      }
      continue
    }
    if (!m.categoria) continue
    const f = fila(m.categoria)
    if (m.tipo === 'Compra') f.compras += m.cantidad
    if (m.tipo === 'Nacimiento') f.nacimientos += m.cantidad
    if (m.tipo === 'Venta') f.ventas += m.cantidad
    if (m.tipo === 'Muerte') f.muertes += m.cantidad
    f.movimientos.push(m)
  }
  for (const f of filas.values()) {
    f.totalIngresos = f.ingresosRecat + f.compras + f.nacimientos
    f.totalEgresos = f.egresosRecat + f.ventas + f.muertes
    f.variacion = f.totalIngresos - f.totalEgresos
  }
  // En el orden del tablero; las que no tienen movimientos no aparecen.
  const orden = (c: string) => {
    const i = categorias.indexOf(c)
    return i < 0 ? 999 : i
  }
  return [...filas.values()].sort((a, b) => orden(a.categoria) - orden(b.categoria))
}

export interface FilaCampo {
  campo: string
  ingresos: number
  egresos: number
  recategorizadas: number
  neto: number
  movimientos: Movimiento[]
}

export function porCampo(movs: Movimiento[]): FilaCampo[] {
  const filas = new Map<string, FilaCampo>()
  for (const m of movs) {
    const c = m.campo || 'Sin campo'
    if (!filas.has(c)) filas.set(c, { campo: c, ingresos: 0, egresos: 0, recategorizadas: 0, neto: 0, movimientos: [] })
    const f = filas.get(c) as FilaCampo
    if (esIngreso(m.tipo)) f.ingresos += m.cantidad
    if (esEgreso(m.tipo)) f.egresos += m.cantidad
    if (m.tipo === CAMBIO) f.recategorizadas += m.cantidad
    f.movimientos.push(m)
  }
  for (const f of filas.values()) f.neto = f.ingresos - f.egresos
  return [...filas.values()].sort((a, b) => b.ingresos + b.egresos + b.recategorizadas - (a.ingresos + a.egresos + a.recategorizadas))
}

/* ----- Cambios de categoría ----- */

export interface Transicion {
  origen: string
  destino: string
  movimientos: number
  cabezas: number
  primera: string | null
  ultima: string | null
  /** Días promedio entre una recategorización y la siguiente de esta misma transición. */
  diasEntreMovimientos: number | null
  campos: string[]
  /**
   * Días promedio que estuvieron los animales en la categoría de origen antes de pasar, estimado
   * por orden de llegada (lo primero que entró a la categoría es lo primero que sale). `null` si
   * no hay ingresos previos registrados de esa categoría en ese campo.
   */
  permanenciaDias: number | null
  /** Qué parte de las cabezas recategorizadas tenía un ingreso previo con el que calcular. */
  coberturaPermanencia: number
  detalle: Movimiento[]
}

const DIA = 86_400_000
const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DIA)

/**
 * Tiempo en la categoría por orden de llegada (FIFO), por campo y categoría. Recorre TODO el
 * historial en orden de fecha —no sólo el período filtrado— porque un animal recategorizado en
 * octubre pudo haber nacido en marzo. Devuelve, por id de movimiento de recategorización, cuántas
 * cabezas se pudieron emparejar con un ingreso y cuántos días-cabeza acumularon.
 */
function permanenciasFifo(todos: Movimiento[]): Map<string, { cabezas: number; diasCabeza: number }> {
  const colas = new Map<string, { fecha: string; restante: number }[]>()
  const cola = (campo: string, cat: string) => {
    const k = `${campo}|${clave(cat)}`
    if (!colas.has(k)) colas.set(k, [])
    return colas.get(k) as { fecha: string; restante: number }[]
  }
  const salida = (campo: string, cat: string, fecha: string, cant: number) => {
    const q = cola(campo, cat)
    let falta = cant
    let cabezas = 0
    let diasCabeza = 0
    while (falta > 0 && q.length) {
      const lote = q[0]
      const usa = Math.min(lote.restante, falta)
      cabezas += usa
      diasCabeza += usa * Math.max(0, dias(lote.fecha, fecha))
      lote.restante -= usa
      falta -= usa
      if (lote.restante === 0) q.shift()
    }
    return { cabezas, diasCabeza }
  }

  const res = new Map<string, { cabezas: number; diasCabeza: number }>()
  const orden = todos.filter((m) => m.fecha).sort((a, b) => (a.fecha as string).localeCompare(b.fecha as string))
  for (const m of orden) {
    const f = m.fecha as string
    const campo = m.campo || 'Sin campo'
    if (m.tipo === CAMBIO) {
      res.set(m.id, salida(campo, m.origen, f, m.cantidad))
      cola(campo, m.destino).push({ fecha: f, restante: m.cantidad })
    } else if (esIngreso(m.tipo)) {
      cola(campo, m.categoria).push({ fecha: f, restante: m.cantidad })
    } else if (esEgreso(m.tipo)) {
      salida(campo, m.categoria, f, m.cantidad)
    }
  }
  return res
}

/**
 * Cada transición (origen → destino) del período: cuántas veces y cuántas cabezas, entre qué
 * fechas, cada cuánto se recategoriza y cuánto tiempo estuvieron en la categoría de origen.
 */
export function transiciones(filtrados: Movimiento[], todos: Movimiento[]): Transicion[] {
  const fifo = permanenciasFifo(todos)
  const grupos = new Map<string, Movimiento[]>()
  for (const m of filtrados) {
    if (m.tipo !== CAMBIO || !m.origen || !m.destino) continue
    const k = `${m.origen}→${m.destino}`
    if (!grupos.has(k)) grupos.set(k, [])
    ;(grupos.get(k) as Movimiento[]).push(m)
  }
  return [...grupos.values()]
    .map((lista) => {
      const fechas = lista.map((m) => m.fecha).filter((f): f is string => Boolean(f)).sort()
      const gaps = fechas.slice(1).map((f, i) => dias(fechas[i], f))
      let cab = 0
      let dc = 0
      for (const m of lista) {
        const p = fifo.get(m.id)
        if (p) {
          cab += p.cabezas
          dc += p.diasCabeza
        }
      }
      const cabezas = lista.reduce((a, m) => a + m.cantidad, 0)
      return {
        origen: lista[0].origen,
        destino: lista[0].destino,
        movimientos: lista.length,
        cabezas,
        primera: fechas[0] ?? null,
        ultima: fechas[fechas.length - 1] ?? null,
        diasEntreMovimientos: gaps.length ? Math.round(gaps.reduce((a, d) => a + d, 0) / gaps.length) : null,
        campos: [...new Set(lista.map((m) => m.campo).filter(Boolean))],
        permanenciaDias: cab > 0 ? Math.round(dc / cab) : null,
        coberturaPermanencia: cabezas > 0 ? cab / cabezas : 0,
        detalle: lista,
      }
    })
    .sort((a, b) => b.cabezas - a.cabezas)
}

/** Cabezas recategorizadas de una categoría a otra (para las flechas del ciclo). */
export function cabezasEntre(trans: Transicion[], origen: string, destino: string): Transicion | null {
  return trans.find((t) => clave(t.origen) === clave(origen) && clave(t.destino) === clave(destino)) ?? null
}

/* ----- Comparativa entre períodos ----- */

/** Cabezas por tipo de un año (y opcionalmente un mes, 1-12). */
export function totalesDe(movs: Movimiento[], anio: number, mes: number | null): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(TIPOS.map((t) => [t, 0]))
  for (const m of movs) {
    if (!m.fecha) continue
    if (Number(m.fecha.slice(0, 4)) !== anio) continue
    if (mes && Number(m.fecha.slice(5, 7)) !== mes) continue
    out[m.tipo] = (out[m.tipo] ?? 0) + m.cantidad
  }
  return out
}

export const aniosDe = (movs: Movimiento[]): number[] =>
  [...new Set(movs.map((m) => m.fecha && Number(m.fecha.slice(0, 4))).filter((a): a is number => Boolean(a)))].sort()

/** Rango de fechas de un período predefinido del filtro. */
export type Periodo = 'mes' | '3m' | 'anio' | '12m' | 'todo' | 'personalizado'
export function rangoDe(p: Periodo, hoy = hoyIso()): { desde: string | null; hasta: string | null } {
  const [a, m] = hoy.split('-').map(Number)
  const primero = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}-01`
  const atras = (meses: number) => {
    let aa = a
    let mm = m - meses
    while (mm < 1) {
      mm += 12
      aa -= 1
    }
    return primero(aa, mm)
  }
  if (p === 'mes') return { desde: primero(a, m), hasta: hoy }
  if (p === '3m') return { desde: atras(2), hasta: hoy }
  if (p === '12m') return { desde: atras(11), hasta: hoy }
  if (p === 'anio') return { desde: `${a}-01-01`, hasta: hoy }
  return { desde: null, hasta: null }
}
