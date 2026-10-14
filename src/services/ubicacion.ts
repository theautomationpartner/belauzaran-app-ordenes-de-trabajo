/**
 * Búsqueda de direcciones para las columnas `location` de monday, que exigen latitud y longitud:
 * con sólo el texto de la dirección la escritura falla.
 *
 * Usa Nominatim (OpenStreetMap), que es gratuito, no pide clave y acepta pedidos desde el
 * navegador. Su política de uso pide no más de un pedido por segundo y no buscar a cada tecla: por
 * eso la búsqueda se dispara con un botón.
 */
import type { Ubicacion } from '@/lib/altas'

interface ResultadoNominatim {
  display_name: string
  lat: string
  lon: string
}

export interface DireccionEncontrada extends Ubicacion {
  /** Texto completo para elegir entre varias coincidencias. */
  completa: string
}

/** Acorta "442, Colectora Sur…, Partido de Tandil, Buenos Aires, B7000GKN, Argentina". */
function abreviar(display: string): string {
  const partes = display.split(',').map((p) => p.trim())
  // Saca el código postal y el país, que no ayudan a ubicarse y alargan el texto.
  return partes.filter((p) => p !== 'Argentina' && !/^[A-Z]?\d{4}[A-Z]{0,3}$/.test(p)).join(', ')
}

export async function buscarDireccion(texto: string): Promise<DireccionEncontrada[]> {
  const q = texto.trim()
  if (!q) return []
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({ format: 'jsonv2', countrycodes: 'ar', limit: '5', 'accept-language': 'es', q })
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`El buscador de direcciones no respondió (HTTP ${res.status}).`)
  const lista = (await res.json()) as ResultadoNominatim[]
  return lista.map((r) => ({
    lat: r.lat,
    lng: r.lon,
    address: abreviar(r.display_name),
    completa: r.display_name,
  }))
}
