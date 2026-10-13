/**
 * Proxy server-side para SUBIR archivos a monday en el deploy.
 *
 * Es el gemelo de `api/monday.ts` para el endpoint `/v2/file`, que recibe `multipart/form-data` y
 * no JSON. Hace lo mismo: verifica el `sessionToken` de monday antes de nada, cambia la
 * autorización por el token de la cuenta (`MONDAY_TOKEN`, que el navegador nunca ve) y reenvía
 * el cuerpo tal cual, con su `Content-Type` original (lleva el `boundary` del multipart).
 *
 * Vercel corta los pedidos de más de ~4,5 MB antes de que lleguen acá: por eso la app achica las
 * fotos pesadas y rechaza los PDF de más de 4 MB antes de mandarlos.
 */
import { MalConfigurado, NoAutorizado, verificarSesion } from './_guard'

const API_ARCHIVOS = 'https://api.monday.com/v2/file'
const API_VERSION = '2024-10'

/** Ver `api/monday.ts`: sin esto Vercel usa el runtime de Node y la firma del handler no sirve. */
export const config = { runtime: 'edge' }

const error = (status: number, message: string): Response =>
  new Response(JSON.stringify({ errors: [{ message }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return error(405, 'Método no permitido.')

  try {
    await verificarSesion(req.headers.get('authorization'))
  } catch (e: unknown) {
    if (e instanceof NoAutorizado) return error(401, e.message)
    if (e instanceof MalConfigurado) return error(500, e.message)
    return error(401, 'No se pudo validar la sesión de monday.')
  }

  const token = process.env.MONDAY_TOKEN
  if (!token) return error(500, 'Falta MONDAY_TOKEN en el entorno.')

  const tipo = req.headers.get('content-type') ?? ''
  if (!tipo.startsWith('multipart/form-data')) return error(400, 'Se esperaba un archivo.')

  const res = await fetch(API_ARCHIVOS, {
    method: 'POST',
    headers: { 'Content-Type': tipo, Authorization: token, 'API-Version': API_VERSION },
    body: await req.arrayBuffer(),
  })

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
