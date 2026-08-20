/**
 * IDs reales de tableros y columnas de la cuenta de Belaunzaran SA (34845072).
 * Relevados con `boards { columns { id title type } }`: son la ÚNICA fuente de verdad de
 * los identificadores, así que ninguna query los escribe sueltos.
 */

export const TABLEROS = {
  ordenTrabajo: '18410927171',
  labores: '18410927179',
  proveedores: '18410927151',
  cultivos: '18410927181',
  campanas: '18410927177',
  contactos: '18410927146',
  campos: '18411611312',
  /** Tablero de subitems de Campos: ahí viven los lotes. */
  lotes: '18411611427',
} as const

/** ✋ Orden de Trabajo (18410927171) — columnas que completa esta app. */
export const COL_OT = {
  labor: 'board_relation_mm09xk5g',
  proveedor: 'board_relation_mm09w3bc',
  cultivo: 'board_relation_mm38x2ka',
  campana: 'board_relation_mm3850rb',
  campo: 'board_relation_mm38qn0k',
  lote: 'board_relation_mm31x8fe',
  usdPorHa: 'numeric_mm09rwxd',
  realizadoPor: 'color_mm1ftcaf',
  estadoEnvio: 'color_mm0xaytt',
} as const

/** ✋ Proveedores (18410927151). */
export const COL_PROVEEDOR = {
  estado: 'status',
  cuit: 'text_mm0xdjya',
  tipo: 'dropdown_mm39x0j7',
  contactos: 'board_relation_mm09gcys',
} as const

/** ✋ Contactos (18410927146). */
export const COL_CONTACTO = {
  nombre: 'text_mm0xwjp9',
  apellido: 'text_mm0xqhqm',
  telefono: 'phone_mkw8mf8b',
  email: 'email_mkw8zvjs',
  proveedores: 'board_relation_mm09g4gq',
  tipo: 'dropdown_mm1fdhz6',
} as const

/** 🌻🌱 Cultivo (18410927181). */
export const COL_CULTIVO = { tipo: 'color_mm0xy930' } as const

/** 📅 Campañas (18410927177). Sólo se ofrecen las que tienen el status en `Activa`. */
export const COL_CAMPANA = { estado: 'status' } as const
export const CAMPANA_ACTIVA = 'Activa'

/** 🚜💨 Labores (18410927179). */
export const COL_LABOR = { codigo: 'pulse_id_mm0974qw' } as const

/** Lotes = subitems de 📍 Campos y Lotes (18411611427). */
export const COL_LOTE = {
  hectareasTotales: 'numeric_mm311dwm',
  hectareasProductivas: 'numeric_mm31x9es',
} as const
