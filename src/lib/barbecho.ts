/**
 * Reglas de la asignación de cultivo a las órdenes de producción en barbecho.
 *
 * Cambiar el cultivo de una orden de producción arrastra a todo lo que cuelga de ella: sus órdenes
 * de trabajo, las confirmaciones de esas órdenes y los movimientos de stock. En los cuatro tableros
 * el cultivo forma parte del NOMBRE del item, y siempre va justo antes de la campaña:
 *
 *   OP     LA BERNARDA-LOTE 3-Barbecho-2026-2027
 *   OT     PULVERIZAR-Contratista-GOMEZ MAURICIO GABRIEL-LA BERNARDA-LOTE 3-Barbecho-2026-2027
 *   Conf.  PULVERIZAR-LA BERNARDA-LOTE 3-Barbecho-2026-2027
 *   Stock  [ANULAR - ]<nombre de la OT o de la confirmación>
 *
 * El nombre nuevo se obtiene reemplazando SÓLO ese segmento. Rearmar el nombre entero desde las
 * columnas daría lo mismo cuando el item sigue la convención, pero hay órdenes cuyo nombre quedó
 * distinto de sus conexiones (un lote renombrado, un proveedor cambiado a mano): rearmarlas les
 * cambiaría más que el cultivo, y los movimientos de stock —que copian el nombre de la OT— dejarían
 * de coincidir con ella. El rearmado desde columnas queda como respaldo para cuando el nombre
 * actual no tiene el cultivo.
 */
import type {
  CambioNombre,
  ItemBasico,
  OrdenProduccion,
  PlanAsignacion,
  TotalesAsignacion,
} from '@/types'

/** Cómo se busca el cultivo dentro de un nombre: lo que se encontró y dónde empieza. */
interface Hallazgo {
  /** Posición del primer carácter del cultivo dentro del nombre. */
  inicio: number
  largo: number
}

/**
 * Ubica el cultivo `cultivo` dentro de `nombre`, de lo más seguro a lo más laxo:
 * 1. `-<cultivo>-<campaña>` al final, que es la convención de los cuatro tableros.
 * 2. La última aparición de `-<cultivo>-` (por si la campaña está escrita distinto).
 * 3. `-<cultivo>` al final (nombre sin campaña).
 *
 * La comparación no distingue mayúsculas: "BARBECHO" y "Barbecho" son el mismo cultivo.
 */
function ubicarCultivo(nombre: string, cultivo: string, campana: string): Hallazgo | null {
  if (!cultivo) return null
  const n = nombre.toLowerCase()
  const c = cultivo.toLowerCase()

  if (campana) {
    const sufijo = `-${c}-${campana.toLowerCase()}`
    if (n.endsWith(sufijo)) return { inicio: n.length - sufijo.length + 1, largo: c.length }
  }
  const medio = n.lastIndexOf(`-${c}-`)
  if (medio >= 0) return { inicio: medio + 1, largo: c.length }
  if (n.endsWith(`-${c}`)) return { inicio: n.length - c.length, largo: c.length }
  return null
}

/**
 * Nombre nuevo de un item: el actual con el cultivo reemplazado.
 *
 * `anteriores` admite más de un nombre de cultivo porque cada tablero lo guarda a su manera (la OP
 * y la OT por conexión, la confirmación como texto) y no siempre coinciden. `rearmar` es el nombre
 * armado desde las columnas, para cuando el actual no contiene el cultivo.
 */
export function renombrar(
  itemId: string,
  nombre: string,
  anteriores: string[],
  nuevo: string,
  campana: string,
  rearmar?: () => string,
): CambioNombre {
  const actual = nombre.trim()

  for (const anterior of new Set(anteriores.filter(Boolean))) {
    // Si el cultivo viejo y el nuevo son el mismo no hay nada que reemplazar.
    if (anterior.toLowerCase() === nuevo.toLowerCase()) continue
    const h = ubicarCultivo(actual, anterior, campana)
    if (!h) continue
    const antes = actual.slice(0, h.inicio)
    const despues = actual.slice(h.inicio + h.largo)
    return {
      itemId,
      anterior: actual,
      nuevo: `${antes}${nuevo}${despues}`,
      via: 'cultivo',
      partes: [antes, nuevo, despues],
    }
  }

  // Una asignación anterior que quedó a medias ya le puso el cultivo nuevo: no se vuelve a escribir.
  const yaNuevo = ubicarCultivo(actual, nuevo, campana)
  if (yaNuevo) {
    return {
      itemId,
      anterior: actual,
      nuevo: actual,
      via: 'igual',
      partes: [
        actual.slice(0, yaNuevo.inicio),
        actual.slice(yaNuevo.inicio, yaNuevo.inicio + yaNuevo.largo),
        actual.slice(yaNuevo.inicio + yaNuevo.largo),
      ],
    }
  }

  const rearmado = rearmar?.().trim()
  if (rearmado) {
    const h = ubicarCultivo(rearmado, nuevo, campana)
    return {
      itemId,
      anterior: actual,
      nuevo: rearmado,
      via: 'columnas',
      partes: h
        ? [
            rearmado.slice(0, h.inicio),
            rearmado.slice(h.inicio, h.inicio + h.largo),
            rearmado.slice(h.inicio + h.largo),
          ]
        : null,
    }
  }

  return { itemId, anterior: actual, nuevo: actual, via: 'no-reconocido', partes: null }
}

/** Une las partes de un nombre con guiones, salteando las vacías. */
const unir = (...partes: string[]): string =>
  partes
    .map((p) => p.trim())
    .filter(Boolean)
    .join('-')

/**
 * Todo lo que se escribe en Monday al pasar una orden de producción al cultivo `cultivo`.
 *
 * Se arma antes de confirmar, con los nombres exactos que van a quedar, para que el usuario vea el
 * resultado y no una descripción de lo que la app "va a hacer".
 */
export function planDe(op: OrdenProduccion, cultivo: ItemBasico): PlanAsignacion {
  const nuevo = cultivo.nombre

  const nombreOp = renombrar(op.id, op.nombre, [op.cultivo], nuevo, op.campana, () =>
    unir(op.lote, nuevo, op.campana),
  )

  const ordenesTrabajo = op.ordenesTrabajo.map((ot) =>
    renombrar(ot.id, ot.nombre, [ot.cultivo, op.cultivo], nuevo, ot.campana || op.campana, () =>
      unir(ot.labor, ot.proveedor, ot.lote, nuevo, ot.campana || op.campana),
    ),
  )

  // Una misma confirmación podría colgar de dos OT; se escribe una sola vez.
  const vistas = new Set<string>()
  const confirmaciones: CambioNombre[] = []
  for (const ot of op.ordenesTrabajo) {
    for (const conf of ot.confirmaciones) {
      if (vistas.has(conf.id)) continue
      vistas.add(conf.id)
      confirmaciones.push(
        renombrar(
          conf.id,
          conf.nombre,
          [conf.cultivo, ot.cultivo, op.cultivo],
          nuevo,
          ot.campana || op.campana,
          () => unir(ot.labor, ot.lote, nuevo, ot.campana || op.campana),
        ),
      )
    }
  }

  // El stock no tiene columnas propias de donde rearmar el nombre: si no se reconoce el cultivo,
  // el movimiento queda como está y se avisa.
  const stock = op.stock.map((mov) =>
    renombrar(mov.id, mov.nombre, [op.cultivo], nuevo, op.campana),
  )

  return { op, cultivo, nombreOp, ordenesTrabajo, confirmaciones, stock }
}

/**
 * Items que toca una tanda. Las OT y las confirmaciones cuentan aunque el nombre no cambie,
 * porque igual se les escribe el cultivo; los movimientos de stock, sólo si se renombran.
 */
export function totalesDe(planes: PlanAsignacion[]): TotalesAsignacion {
  return planes.reduce<TotalesAsignacion>(
    (acc, p) => ({
      ordenesProduccion: acc.ordenesProduccion + 1,
      ordenesTrabajo: acc.ordenesTrabajo + p.ordenesTrabajo.length,
      confirmaciones: acc.confirmaciones + p.confirmaciones.length,
      stock: acc.stock + p.stock.filter(seRenombra).length,
    }),
    { ordenesProduccion: 0, ordenesTrabajo: 0, confirmaciones: 0, stock: 0 },
  )
}

/** El nombre del item efectivamente cambia. */
export const seRenombra = (c: CambioNombre): boolean => c.nuevo !== c.anterior

/** Cambios que no se resolvieron reemplazando el cultivo y conviene mirar antes de confirmar. */
export const cambiosParaRevisar = (plan: PlanAsignacion): CambioNombre[] =>
  [plan.nombreOp, ...plan.ordenesTrabajo, ...plan.confirmaciones, ...plan.stock].filter(
    (c) => c.via === 'columnas' || c.via === 'no-reconocido',
  )

/** Suma los montos presentes; `null` si no hay ninguno. */
export function sumar(valores: (number | null)[]): number | null {
  const presentes = valores.filter((v): v is number => v != null)
  if (presentes.length === 0) return null
  return Math.round(presentes.reduce((a, v) => a + v, 0) * 100) / 100
}

/**
 * Montos de una orden de producción, sumando sus órdenes de trabajo.
 *
 * El costo por hectárea también se suma: todas las OT de una misma orden de producción trabajan el
 * mismo lote, así que el costo por hectárea del lote es la suma del de cada labor.
 */
export function montosDe(op: OrdenProduccion) {
  const ots = op.ordenesTrabajo
  return {
    productos: sumar(ots.map((o) => o.usdProductos)),
    labor: sumar(ots.map((o) => o.usdLabor)),
    total: sumar(ots.map((o) => o.usdTotal)),
    porHa: sumar(ots.map((o) => o.usdPorHa)),
  }
}

/** Movimientos de stock que empiezan con "ANULAR - ": se muestran aparte en el detalle. */
export const esAnulacion = (nombre: string): boolean => /^anular\s*-\s*/i.test(nombre)
