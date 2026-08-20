/**
 * Normalización de `column_values`. Monday devuelve cada columna con un `text` legible y un
 * `value` JSON con la estructura cruda; qué campo sirve depende del tipo de columna, y esa
 * decisión vive acá y en ningún otro lado.
 */

export interface ColumnaCruda {
  id: string
  text: string | null
  value: string | null
  /**
   * Sólo llega en columnas `board_relation`, pedido con el fragmento tipado
   * `... on BoardRelationValue`. Ver `idsConectados` para por qué es la única lectura confiable.
   */
  linked_item_ids?: string[] | null
}

/** Indexa las columnas de un item por id, para leerlas sin recorrer el arreglo cada vez. */
export function porId(columnas: ColumnaCruda[] | null | undefined): Map<string, ColumnaCruda> {
  const mapa = new Map<string, ColumnaCruda>()
  for (const c of columnas ?? []) mapa.set(c.id, c)
  return mapa
}

/** Texto plano de una columna; `''` si está vacía. */
export function texto(cols: Map<string, ColumnaCruda>, id: string): string {
  return cols.get(id)?.text?.trim() ?? ''
}

/** Parsea el `value` JSON de una columna. `null` si está vacío o mal formado. */
function valorJson<T>(cols: Map<string, ColumnaCruda>, id: string): T | null {
  const crudo = cols.get(id)?.value
  if (!crudo) return null
  try {
    return JSON.parse(crudo) as T
  } catch {
    return null
  }
}

/**
 * IDs de items conectados por una columna `board_relation`.
 *
 * Se leen de `linked_item_ids`, que llega con el fragmento `... on BoardRelationValue`, y NO de
 * `text`/`value`: en esta cuenta esos dos campos vuelven `null` para las columnas de conexión
 * aunque los vínculos existan, así que confiar en ellos daba "sin contactos" en todos los
 * proveedores. Igual se deja el `value` como respaldo por si un board devuelve el formato viejo.
 */
export function idsConectados(cols: Map<string, ColumnaCruda>, id: string): string[] {
  const directos = cols.get(id)?.linked_item_ids
  if (directos?.length) return directos.map(String)

  const v = valorJson<{ linkedPulseIds?: { linkedPulseId: number }[] }>(cols, id)
  return (v?.linkedPulseIds ?? []).map((l) => String(l.linkedPulseId))
}

/**
 * Etiquetas de una columna `dropdown`. Se leen del `text` (viene como "A, B") porque el `value`
 * sólo trae los ids numéricos, que no significan nada fuera del `settings_str` de la columna.
 */
export function etiquetas(cols: Map<string, ColumnaCruda>, id: string): string[] {
  const t = texto(cols, id)
  return t ? t.split(',').map((s) => s.trim()).filter(Boolean) : []
}

/**
 * Número de una columna `numbers`. Monday la devuelve como texto; `null` distingue "vacío" de
 * un 0 legítimo, que en hectáreas no es lo mismo.
 */
export function numero(cols: Map<string, ColumnaCruda>, id: string): number | null {
  const t = texto(cols, id)
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
