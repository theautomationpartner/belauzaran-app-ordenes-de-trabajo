/**
 * Entrega del payload a Make, que es quien crea los items en ✋ Orden de Trabajo (uno por lote).
 *
 * La app no escribe en el tablero por su cuenta: el board tiene automatizaciones colgadas del
 * alta del item, y dispararlas desde dos lados distintos es la forma más rápida de terminar con
 * órdenes duplicadas.
 */
import type { PayloadEmision } from '@/types'

const WEBHOOK = (import.meta.env.VITE_MAKE_WEBHOOK_URL as string | undefined)?.trim() || undefined

/** `true` cuando hay un webhook configurado en `.env.local`. */
export const emisionHabilitada = (): boolean => Boolean(WEBHOOK)

export interface ResultadoEmision {
  ok: boolean
  /** Respuesta cruda de Make, útil para diagnosticar cuando el escenario devuelve un error. */
  detalle: string
}

/** Manda el payload al webhook. Lanza si no hay webhook configurado. */
export async function emitirOrdenes(payload: PayloadEmision): Promise<ResultadoEmision> {
  if (!WEBHOOK) {
    throw new Error(
      'No hay webhook de Make configurado. Cargá VITE_MAKE_WEBHOOK_URL en .env.local.',
    )
  }

  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const detalle = await res.text()
  if (!res.ok) throw new Error(`Make respondió HTTP ${res.status}. ${detalle}`.trim())
  return { ok: true, detalle }
}
