/**
 * Hacienda: etiquetas del tablero Movimientos, lectura de los movimientos para el dashboard y
 * alta de un movimiento.
 */
import {
  CAMBIO,
  etiquetaDe,
  nombreMovimiento,
  tipoDe,
  type BorradorMovimiento,
  type Movimiento,
  type OpcionesHacienda,
} from '@/lib/hacienda'
import { mondayApi } from './sdk'
import { traerItems } from './catalogos'
import { COL_MOVIMIENTO, TABLERO_MOVIMIENTOS } from './columns'
import { etiquetasDropdown, idsConectados, mostrado, numero, porId, texto } from './parse'

interface Columna {
  id: string
  settings_str: string | null
}

/**
 * Etiquetas de una columna, sin las desactivadas. Status guarda `labels` como objeto; dropdown,
 * como arreglo. Se leen de monday y no se escriben en el código: si suman una categoría, aparece.
 */
function etiquetasDe(col: Columna | undefined, excluir: string[] = []): string[] {
  if (!col?.settings_str) return []
  try {
    const s = JSON.parse(col.settings_str) as {
      labels?: Record<string, string> | { id: number; name: string }[]
      deactivated_labels?: (number | { id: number })[]
    }
    const inactivas = new Set((s.deactivated_labels ?? []).map((x) => String(typeof x === 'object' ? x.id : x)))
    const lista = Array.isArray(s.labels)
      ? s.labels.filter((l) => !inactivas.has(String(l.id))).map((l) => l.name)
      : Object.values(s.labels ?? {})
    return lista.filter((l) => l && !excluir.includes(l))
  } catch {
    return []
  }
}

export async function traerOpcionesHacienda(): Promise<OpcionesHacienda> {
  const data = await mondayApi<{ boards: { columns: Columna[] }[] }>(
    `query { boards(ids: ${TABLERO_MOVIMIENTOS}) { columns(ids: ${JSON.stringify([
      COL_MOVIMIENTO.tipo,
      COL_MOVIMIENTO.categoria,
      COL_MOVIMIENTO.origen,
      COL_MOVIMIENTO.destino,
    ])}) { id settings_str } } }`,
  )
  const cols = data.boards[0]?.columns ?? []
  const de = (id: string) => cols.find((c) => c.id === id)
  return {
    // "Listo" es una etiqueta del status que no es un tipo de movimiento.
    tipos: etiquetasDe(de(COL_MOVIMIENTO.tipo), ['Listo']),
    categorias: etiquetasDe(de(COL_MOVIMIENTO.categoria)),
    origenes: etiquetasDe(de(COL_MOVIMIENTO.origen)),
    destinos: etiquetasDe(de(COL_MOVIMIENTO.destino)),
  }
}

const CAMPOS = `id text value
  ... on BoardRelationValue { linked_item_ids display_value }
  ... on DropdownValue { values { label } }`

/** Todos los movimientos. Son pocos (uno por evento de hacienda): se traen enteros y se filtran acá. */
export async function traerMovimientos(): Promise<Movimiento[]> {
  const ids = Object.values(COL_MOVIMIENTO)
  const items = await traerItems(
    TABLERO_MOVIMIENTOS,
    `column_values(ids: ${JSON.stringify(ids)}) { ${CAMPOS} }`,
    500,
  )
  return items.map((it) => {
    const cols = porId(it.column_values)
    const primera = (id: string) => etiquetasDropdown(cols, id)[0] ?? ''
    return {
      id: it.id,
      nombre: it.name.trim(),
      codigo: texto(cols, COL_MOVIMIENTO.codigo),
      tipo: texto(cols, COL_MOVIMIENTO.tipo),
      campoId: idsConectados(cols, COL_MOVIMIENTO.campo)[0] ?? null,
      campo: mostrado(cols, COL_MOVIMIENTO.campo),
      categoria: primera(COL_MOVIMIENTO.categoria),
      origen: primera(COL_MOVIMIENTO.origen),
      destino: primera(COL_MOVIMIENTO.destino),
      fecha: texto(cols, COL_MOVIMIENTO.fecha) || null,
      cantidad: numero(cols, COL_MOVIMIENTO.cantidad) ?? 0,
      responsable: texto(cols, COL_MOVIMIENTO.responsable),
      observaciones: texto(cols, COL_MOVIMIENTO.observaciones),
    }
  })
}

/** Columnas del movimiento nuevo: todo en una sola escritura. */
export function columnasMovimiento(b: BorradorMovimiento, op: OpcionesHacienda): Record<string, unknown> {
  const tipo = tipoDe(b)
  if (!tipo) throw new Error('Falta el tipo de movimiento.')
  // El status se escribe con su etiqueta real de monday (por si cambia una tilde o mayúscula).
  const etiquetaTipo = etiquetaDe(op.tipos, tipo) ?? tipo
  const columnas: Record<string, unknown> = {
    [COL_MOVIMIENTO.tipo]: { label: etiquetaTipo },
    [COL_MOVIMIENTO.campo]: { item_ids: [Number(b.campoId)] },
    [COL_MOVIMIENTO.fecha]: { date: b.fecha },
    [COL_MOVIMIENTO.cantidad]: String(Number(b.cantidad.trim())),
    [COL_MOVIMIENTO.responsable]: b.responsable.trim(),
  }
  if (tipo === CAMBIO) {
    columnas[COL_MOVIMIENTO.origen] = { labels: [b.origen] }
    columnas[COL_MOVIMIENTO.destino] = { labels: [b.destino] }
  } else {
    columnas[COL_MOVIMIENTO.categoria] = { labels: [b.categoria] }
  }
  if (b.observaciones.trim()) columnas[COL_MOVIMIENTO.observaciones] = { text: b.observaciones.trim() }
  return columnas
}

/** Registra el movimiento y devuelve el id del item. */
export async function crearMovimiento(b: BorradorMovimiento, op: OpcionesHacienda): Promise<string> {
  const data = await mondayApi<{ create_item: { id: string } | null }>(
    `mutation ($n: String!, $c: JSON!) {
      create_item(board_id: ${TABLERO_MOVIMIENTOS}, item_name: $n, column_values: $c, create_labels_if_missing: false) { id }
    }`,
    { n: nombreMovimiento(b), c: JSON.stringify(columnasMovimiento(b, op)) },
  )
  const id = data.create_item?.id
  if (!id) throw new Error('monday no devolvió el id del movimiento creado.')
  return id
}
