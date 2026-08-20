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

/** 🧴🧪 Productos (18410927152). Insumos que se aplican durante la labor. */
export interface Producto extends ItemBasico {
  estado: string
  /** Litros, Kilos, CM3, Plantas… Define en qué se expresa la cantidad por hectárea. */
  unidad: string
  /** Herbicida, Semilla, Fertilizante… */
  tipo: string
  /** Cantidad por hectárea de referencia del tablero. Se propone al agregar el producto. */
  cantPorHaSugerida: number | null
  precioUnitario: number | null
  /**
   * Etiqueta exacta del dropdown de subitems de la orden (`"<nombre> - <unidad>"`). Se arma acá
   * porque es el valor que Make necesita para completar la columna del subitem.
   */
  etiquetaDropdown: string
}

/** Catálogos que la app trae de una sola vez al abrir la operación. */
export interface Catalogos {
  labores: Labor[]
  proveedores: Proveedor[]
  cultivos: Cultivo[]
  campanas: Campana[]
  contactos: Contacto[]
  campos: Campo[]
  productos: Producto[]
}

/**
 * Un producto agregado a la orden con su dosis. La cantidad es texto por el mismo motivo que
 * `usdPorHa`: no pelear con la coma decimal mientras se tipea.
 */
export interface LineaProducto {
  /** Clave local de la línea; no viaja a Monday. */
  uid: string
  productoId: string | null
  cantPorHa: string
}

/** Un bloque "Campo + lotes de ese campo". Se repite tantas veces como haga falta. */
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
  /** Productos a aplicar. Los mismos, con la misma dosis, para todos los lotes de la carga. */
  productos: LineaProducto[]
  bloques: BloqueCampo[]
}

/**
 * Un producto ya resuelto para un lote concreto: es lo que va a ser un subitem de la orden.
 * La dosis es la misma en todos los lotes; lo que cambia es la cantidad total, que depende de
 * las hectáreas de cada uno.
 */
export interface ProductoDeOrden {
  productoId: string
  nombre: string
  unidad: string
  /** Etiqueta para el dropdown del subitem (`COL_PRODUCTO_OT.producto`). */
  etiqueta: string
  cantPorHa: number
  /** Cantidad por hectárea × hectáreas del lote. `null` si el lote no tiene hectáreas. */
  cantTotal: number | null
  precioUnitario: number | null
  /** Cantidad total × precio unitario. `null` si falta cualquiera de los dos. */
  totalUsd: number | null
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
  totalLaborUsd: number | null
  /** Un subitem por producto, con la cantidad ya calculada para las hectáreas de este lote. */
  productos: ProductoDeOrden[]
  /** Suma de los productos de esta orden. `null` si alguno no tiene precio cargado. */
  totalProductosUsd: number | null
  /** Labor + productos. `null` si falta cualquiera de los dos. */
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

/** Totales de toda la carga, para las métricas del resumen. */
export interface TotalesCarga {
  ordenes: number
  hectareas: number | null
  labor: number | null
  productos: number | null
  general: number | null
}
