/**
 * Reglas de las altas que se hacen al vuelo desde un formulario (proveedor, contacto, depósito):
 * formato del CUIT y del WhatsApp, y qué falta para poder crear cada uno.
 */
import type { Contacto, Proveedor } from '@/types'
import { normalizar } from './format'

/** Ubicación lista para una columna `location` de monday: sin lat/lng monday la rechaza. */
export interface Ubicacion {
  lat: string
  lng: string
  address: string
}

/* ===== CUIT ===== */

const soloDigitos = (s: string) => s.replace(/\D/g, '')

/**
 * Formatea mientras se tipea: `20123456786` → `20-12345678-6`. Acepta que peguen el CUIT con o
 * sin guiones, con puntos o espacios; se queda con los primeros 11 dígitos.
 */
export function formatearCuit(entrada: string): string {
  const d = soloDigitos(entrada).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

export const cuitCompleto = (cuit: string): boolean => /^\d{2}-\d{8}-\d$/.test(cuit)

/**
 * Dígito verificador del CUIT (módulo 11). Un CUIT con el formato bien pero mal tipeado lo pasa
 * el formato y no esto. Se usa como advertencia, no como bloqueo: hay CUIT viejos que no cumplen
 * y no es la app quien decide que no existen.
 */
export function cuitVerifica(cuit: string): boolean {
  const d = soloDigitos(cuit)
  if (d.length !== 11) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0)
  const resto = 11 - (suma % 11)
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto
  return verificador === Number(d[10])
}

/** Proveedor ya cargado con ese CUIT, comparando sólo los dígitos. */
export const proveedorConCuit = (proveedores: Proveedor[], cuit: string): Proveedor | null => {
  const d = soloDigitos(cuit)
  if (d.length !== 11) return null
  return proveedores.find((p) => soloDigitos(p.cuit) === d) ?? null
}

/* ===== WhatsApp ===== */

/**
 * Normaliza un celular argentino al formato de WhatsApp: `549` + código de área + número, 13
 * dígitos (`5492494600860`). Devuelve `null` si no se puede llegar a eso.
 *
 * Contempla lo que se tipea de verdad: con o sin +54 / 9, con el 0 del código de área, con el 15
 * de los celulares (`02494 15-600860`), con espacios, guiones o paréntesis. Si quedan 10 dígitos
 * (área + número) se completa con 549.
 */
export function normalizarWhatsapp(entrada: string): string | null {
  let d = soloDigitos(entrada)
  if (!d) return null

  if (d.startsWith('549') && d.length === 13) return d
  // 54 sin el 9 de celular (como varios contactos cargados): se agrega.
  if (d.startsWith('54') && d.length === 12) return `549${d.slice(2)}`
  if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  if (d.startsWith('0')) d = d.slice(1)

  // Con el 15: área (2 a 4 dígitos) + 15 + número = 12 dígitos. Se saca el 15.
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === '15') {
        d = d.slice(0, area) + d.slice(area + 2)
        break
      }
    }
  }
  return d.length === 10 ? `549${d}` : null
}

/** `5492494600860` → `+54 9 2494 60-0860`, sólo para mostrar. */
export function mostrarWhatsapp(n: string): string {
  if (n.length !== 13) return n
  const resto = n.slice(3)
  return `+54 9 ${resto.slice(0, 4)} ${resto.slice(4, 6)}-${resto.slice(6)}`
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* ===== Contacto ===== */

export interface BorradorContacto {
  /** Clave local mientras no existe en monday. */
  uid: string
  nombre: string
  apellido: string
  whatsapp: string
  email: string
}

export const contactoVacio = (uid: string): BorradorContacto => ({
  uid,
  nombre: '',
  apellido: '',
  whatsapp: '',
  email: '',
})

/** Qué falta para el contacto: nombre, apellido y al menos un medio (WhatsApp o email). */
export function faltantesContacto(c: BorradorContacto): string[] {
  const faltan: string[] = []
  if (!c.nombre.trim()) faltan.push('Cargá el nombre.')
  if (!c.apellido.trim()) faltan.push('Cargá el apellido.')
  const hayTel = c.whatsapp.trim() !== ''
  const hayMail = c.email.trim() !== ''
  if (!hayTel && !hayMail) faltan.push('Cargá el WhatsApp, el email o los dos.')
  if (hayTel && !normalizarWhatsapp(c.whatsapp)) {
    faltan.push('El WhatsApp no es un celular argentino válido (código de área + número, ej.: 2494 600860).')
  }
  if (hayMail && !EMAIL.test(c.email.trim())) faltan.push('El email no tiene un formato válido.')
  return faltan
}

/* ===== Proveedor ===== */

export interface BorradorProveedor {
  nombreCompleto: string
  tipos: string[]
  cuit: string
  ubicacion: Ubicacion | null
  /** Contactos que ya existen en ✋ Contactos. */
  contactoIds: string[]
  /** Contactos nuevos: se crean junto con el proveedor, ya conectados a él. */
  contactosNuevos: BorradorContacto[]
}

export function faltantesProveedor(p: BorradorProveedor, proveedores: Proveedor[]): string[] {
  const faltan: string[] = []
  if (!p.nombreCompleto.trim()) faltan.push('Cargá el nombre completo.')
  if (!p.cuit) faltan.push('Cargá el CUIT.')
  else if (!cuitCompleto(p.cuit)) faltan.push('El CUIT tiene que tener 11 dígitos: XX-XXXXXXXX-X.')
  else {
    const existente = proveedorConCuit(proveedores, p.cuit)
    if (existente) faltan.push(`Ya existe un proveedor con ese CUIT: "${existente.nombre}". Elegilo de la lista.`)
  }
  return faltan
}

/** Proveedores con un nombre parecido: no bloquea, pero conviene verlo antes de duplicar uno. */
export function proveedoresParecidos(proveedores: Proveedor[], nombre: string): Proveedor[] {
  const q = normalizar(nombre.trim())
  if (q.length < 4) return []
  return proveedores.filter((p) => normalizar(p.nombre).includes(q)).slice(0, 3)
}

/** Nombre del contacto en el tablero: "Nombre Apellido". */
export const nombreContacto = (c: { nombre: string; apellido: string }) =>
  `${c.nombre.trim()} ${c.apellido.trim()}`.replace(/\s+/g, ' ')

/** Contacto del catálogo para mostrar en un selector: nombre y cómo ubicarlo. */
export const detalleContacto = (c: Contacto): string =>
  [c.telefono && `WhatsApp ${c.telefono}`, c.email].filter(Boolean).join(' · ')
