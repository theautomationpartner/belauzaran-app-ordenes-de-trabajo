/**
 * Estructuras de datos de la app. Son el contrato entre lo que devuelve Monday
 * (`src/services/monday`) y lo que consumen las vistas: los servicios ya normalizan los
 * `column_values` crudos, así que ningún componente parsea JSON de Monday.
 */

/** Operación elegida en la barra superior. Por ahora la app resuelve una sola. */
export type Operacion = 'ORDEN_DE_TRABAJO'

/** Item genérico de un tablero maestro: lo mínimo para poblar un selector. */
export interface ItemBasico {
  id: string
  nombre: string
}

/** 🚜💨 Labores (18410927179). */
export interface Labor extends ItemBasico {
  /** Código legible que Monday genera en la columna `item_id` (IDLABOR-07, etc.). */
  codigo?: string
}

/** ✋ Proveedores (18410927151). El "contratista" que ejecuta la labor. */
export interface Proveedor extends ItemBasico {
  /** Etiqueta de la columna ✋Status: sólo se ofrecen los `Activo`. */
  estado: string
  cuit: string
  /** Etiquetas de ✋ Tipo (Contratista Labores / Fletes / Personal interno). */
  tipos: string[]
  /** IDs de ✋ Contactos vinculados a este proveedor (columna `board_relation_mm09gcys`). */
  contactoIds: string[]
}

/** 🌻🌱 Cultivo (18410927181). */
export interface Cultivo extends ItemBasico {
  /** Gruesa / Fina / Barbecho / Consumo Hacienda. Se muestra como chip en el selector. */
  tipo: string
}

/** 📅 Campañas (18410927177). La app sólo ofrece las que están `Activa`. */
export interface Campana extends ItemBasico {
  estado: string
  activa: boolean
}

/** ✋ Contactos (18410927146). Destinatario del envío de la orden. */
export interface Contacto extends ItemBasico {
  nombrePila: string
  apellido: string
  telefono: string
  email: string
  /** Etiquetas de ✋Tipo (Comercial / Administrativo / Dueño / Personal Interno). */
  tipos: string[]
  /** IDs de proveedores vinculados (columna `board_relation_mm09g4gq`). */
  proveedorIds: string[]
}

/** Lote: subitem de un campo en 📍 Campos y Lotes (subitems en 18411611427). */
export interface Lote extends ItemBasico {
  /** ID del campo (item padre) al que pertenece. */
  campoId: string
  /** Hectáreas totales del lote (`numeric_mm311dwm`). */
  hectareasTotales: number | null
  /** Hectáreas productivas / sembrables (`numeric_mm31x9es`). */
  hectareasProductivas: number | null
}

/** 📍 Campos y Lotes (18411611312). El campo es el item; los lotes son sus subitems. */
export interface Campo extends ItemBasico {
  lotes: Lote[]
}

/** Catálogos que la app trae de una sola vez al abrir la operación. */
export interface Catalogos {
  labores: Labor[]
  proveedores: Proveedor[]
  cultivos: Cultivo[]
  campanas: Campana[]
  contactos: Contacto[]
  campos: Campo[]
}

/** Un bloque "Campo + lotes de ese campo" del paso 2. Se repite tantas veces como haga falta. */
export interface BloqueCampo {
  /** Clave local del bloque; no viaja a Monday. */
  uid: string
  campoId: string | null
  /** IDs de lotes elegidos. Siempre pertenecen a `campoId`. */
  loteIds: string[]
}

/** Estado del formulario completo de la orden. */
export interface BorradorOrden {
  laborId: string | null
  proveedorId: string | null
  cultivoId: string | null
  campanaId: string | null
  /** U$/Ha de la labor. Se guarda como texto para no pelear con la coma decimal al tipear. */
  usdPorHa: string
  contactoId: string | null
  bloques: BloqueCampo[]
}

/**
 * Una orden concreta a crear: la app expande los bloques a UN campo + UN lote por orden,
 * que es la regla del tablero ✋ Orden de Trabajo.
 */
export interface OrdenAGenerar {
  campoId: string
  campoNombre: string
  loteId: string
  loteNombre: string
  hectareas: number | null
  /** Hectáreas × U$/Ha. `null` si falta alguno de los dos. */
  totalUsd: number | null
}

/** Payload que se le entrega a Make para que cree los items en Monday. */
export interface PayloadEmision {
  operacion: Operacion
  boardOrdenTrabajo: string
  labor: ItemBasico
  proveedor: ItemBasico
  cultivo: ItemBasico
  campana: ItemBasico
  contacto: (ItemBasico & { telefono: string; email: string }) | null
  usdPorHa: number
  ordenes: OrdenAGenerar[]
}
