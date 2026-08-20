/**
 * Acceso a la API GraphQL de Monday por HTTP.
 *
 * - En desarrollo pega contra `/monday-api`, el proxy de Vite hacia api.monday.com. Sin el proxy
 *   el navegador bloquea la request por CORS. El token sale de `.env.local`
 *   (`VITE_MONDAY_TOKEN`), archivo que está en `.gitignore` y nunca llega al repositorio.
 * - En producción pega contra `/api/monday`, una función serverless que inyecta el token del lado
 *   del servidor (`MONDAY_TOKEN`), para que el secreto no quede incrustado en el bundle.
 */
const TOKEN = (import.meta.env.VITE_MONDAY_TOKEN as string | undefined)?.trim() || undefined

const ENDPOINT = import.meta.env.DEV ? '/monday-api' : '/api/monday'
const API_VERSION = '2024-10'

/**
 * En desarrollo hay acceso real sólo si hay token local. En producción el proxy server-side
 * resuelve la autenticación, así que se asume habilitado.
 */
export const mondayHabilitado = (): boolean => (import.meta.env.DEV ? Boolean(TOKEN) : true)

interface ApiError {
  message: string
}

interface Respuesta<T> {
  data?: T
  errors?: ApiError[]
}

/**
 * Saca el motivo real de una respuesta fallida.
 *
 * Antes se lanzaba `HTTP ${status}` sin mirar el cuerpo, y eso escondía justamente los errores
 * más útiles: cuando falta la variable de entorno del token, el proxy contesta 500 con el motivo
 * escrito en el JSON, y en pantalla se leía un "HTTP 500" que no decía nada.
 */
async function motivoDelFallo(res: Response): Promise<string> {
  const cuerpo = await res.text().catch(() => '')
  try {
    const json = JSON.parse(cuerpo) as Respuesta<unknown>
    const mensajes = json.errors?.map((e) => e.message).filter(Boolean)
    if (mensajes?.length) return mensajes.join(' · ')
  } catch {
    // Cuerpo que no es JSON (una página de error del hosting, por ejemplo): se usa tal cual.
  }
  const recorte = cuerpo.trim().slice(0, 200)
  return recorte ? `HTTP ${res.status} · ${recorte}` : `HTTP ${res.status}`
}

/** Ejecuta una query/mutation y devuelve `data`; lanza con el mensaje de Monday si falla. */
export async function mondayApi<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: TOKEN ?? '',
      'API-Version': API_VERSION,
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  })
  if (!res.ok) throw new Error(await motivoDelFallo(res))

  const json = (await res.json()) as Respuesta<T>
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(' · '))
  if (!json.data) throw new Error('Monday no devolvió datos.')
  return json.data
}
