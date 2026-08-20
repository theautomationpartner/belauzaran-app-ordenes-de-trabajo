/**
 * Proxy server-side hacia la API de Monday para el deploy.
 *
 * Existe por una sola razón: el token NO puede viajar en el bundle del navegador. En desarrollo
 * lo resuelve el proxy de Vite con `VITE_MONDAY_TOKEN` (archivo local, fuera del repositorio);
 * en producción lo resuelve esta función con `MONDAY_TOKEN`, una variable de entorno del deploy
 * que el cliente nunca ve.
 */
const API = 'https://api.monday.com/v2'
const API_VERSION = '2024-10'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const token = process.env.MONDAY_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ errors: [{ message: 'Falta MONDAY_TOKEN en el entorno.' }] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': API_VERSION,
    },
    body: await req.text(),
  })

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
