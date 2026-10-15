/**
 * Usuario de monday que está usando la App.
 *
 * Dentro de monday sale del `sessionToken`, que monday firma con el usuario logueado: es el mismo
 * token que verifica el servidor, así que no se puede hacer pasar por otro desde el navegador.
 * NO se pregunta `me` a la API en el deploy, porque ahí la API responde con el token de la cuenta
 * y devolvería siempre el mismo usuario. En local no hay sesión de monday: `me` es el dueño del
 * token de desarrollo, que alcanza para probar.
 */
import { mondayApi } from './sdk'
import { obtenerDatosSesion } from './sesion'

export interface UsuarioActual {
  id: string
  nombre: string
}

let cache: Promise<UsuarioActual | null> | null = null

async function leer(): Promise<UsuarioActual | null> {
  try {
    if (import.meta.env.DEV) {
      const d = await mondayApi<{ me: { id: string; name: string } | null }>('query { me { id name } }')
      return d.me ? { id: String(d.me.id), nombre: d.me.name.trim() } : null
    }
    const sesion = await obtenerDatosSesion()
    if (!sesion.userId) return null
    const d = await mondayApi<{ users: { id: string; name: string }[] }>(
      `query { users(ids: [${Number(sesion.userId)}]) { id name } }`,
    )
    const u = d.users[0]
    return { id: String(sesion.userId), nombre: u?.name.trim() ?? '' }
  } catch {
    // Sin saber quién es, lo que dependa de esto se completa a mano: no impide trabajar.
    return null
  }
}

/** Se pide una sola vez por sesión de la App. */
export const usuarioActual = (): Promise<UsuarioActual | null> => (cache ??= leer())
