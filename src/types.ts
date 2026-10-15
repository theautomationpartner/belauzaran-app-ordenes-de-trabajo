/**
 * Estructuras de datos de la app. Son el contrato entre lo que devuelve Monday
 * (`src/services/monday`) y lo que consumen las vistas: los servicios ya normalizan los
 * `column_values` crudos, así que ningún componente parsea JSON de Monday.
 */

/** Operación elegida en la barra superior. */
export type Operacion =
  | 'ORDEN_DE_TRABAJO'
  | 'ASIGNACION_BARBECHO'
  | 'REMITO_FACTURA'
  | 'REGISTRAR_COSECHA'
  | 'HACIENDA'

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
  /** Etiquetas de ✋ Tipo (Contratista / Fletes / Personal interno). */
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
   * Etiqueta oficial del producto, tal como está cargada en su propia columna del tablero
   * (`"<nombre> - <unidad>"`). Es el texto que se muestra en la app y el que se escribe en el
   * dropdown del subitem de la orden.
   */
  etiqueta: string
  /** Etiquetas de 🤚Principio Activo. Vacío si el producto no tiene ninguno cargado. */
  principiosActivos: string[]
}

/** 🛠️🚜 Maquinarias, Herramientas y Rodados (18410927187). */
export interface Maquinaria extends ItemBasico {
  /** TRACTOR, RASTRA, CHIMANGO… (`color_mm34705g`). */
  tipo: string
  /** MAQUINARIA, HERRAMIENTA, RODADO, REPUESTO (`color_mm34wmm9`). */
  clasificacion: string
  marca: string
  patente: string
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
  maquinarias: Maquinaria[]
  /**
   * Opciones de filtro leídas de los `settings` de las columnas al abrir la app, no escritas a
   * mano: si mañana agregan un tipo de producto o de maquinaria en Monday, aparece solo.
   */
  filtros: {
    tiposProducto: string[]
    principiosActivos: string[]
    tiposMaquinaria: string[]
    clasificacionesMaquinaria: string[]
  }
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
  /**
   * Si el contratista puede usar otro producto con el mismo principio activo cuando este no
   * esté. Sólo se ofrece para productos que tienen principio activo; el resto va siempre en NO.
   */
  permitirReemplazo: boolean
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
  /**
   * Etiqueta de `color_mm1ftcaf`: "Contratista" o "Personal de la Empresa". Va primero porque es
   * lo que acota la lista de proveedores.
   */
  realizadoPor: string | null
  laborId: string | null
  proveedorId: string | null
  cultivoId: string | null
  campanaId: string | null
  /** U$/Ha de la labor. Se guarda como texto para no pelear con la coma decimal al tipear. */
  usdPorHa: string
  contactoId: string | null
  /** Productos a aplicar. Los mismos, con la misma dosis, para todos los lotes de la carga. */
  productos: LineaProducto[]
  /** Maquinarias afectadas a la labor. Opcional: puede ir ninguna, una o varias. */
  maquinariaIds: string[]
  bloques: BloqueCampo[]
  /**
   * Lotes cuyas órdenes salen a enviarse apenas se crean. El resto queda cargado sin enviar.
   *
   * Se guarda la excepción y no el estado de cada orden porque el envío es la decisión que hay
   * que tomar a conciencia: lo que no se marca explícitamente, no se manda.
   */
  enviarAhoraLoteIds: string[]
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
  principiosActivos: string[]
  /** Va al subitem como SI / NO en `COL_PRODUCTO_OT.permitirReemplazo`. */
  permitirReemplazo: boolean
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
  /**
   * Etiqueta de `color_mm0xaytt` con la que se crea ESTA orden. Cada una decide por su cuenta:
   * se pueden mandar unas y dejar otras cargadas en la misma tanda.
   */
  estadoEnvio: string
  /** Hectáreas × U$/Ha. `null` si falta alguno de los dos. */
  totalLaborUsd: number | null
  /** Un subitem por producto, con la cantidad ya calculada para las hectáreas de este lote. */
  productos: ProductoDeOrden[]
  /** Suma de los productos de esta orden. `null` si alguno no tiene precio cargado. */
  totalProductosUsd: number | null
  /** Labor + productos. `null` si falta cualquiera de los dos. */
  totalUsd: number | null
}

/**
 * Carga lista para escribirse en Monday: todas las referencias ya resueltas a items concretos.
 * Lo que es común a la carga (labor, proveedor, cultivo…) vive arriba; lo que cambia por orden
 * (campo, lote, hectáreas, productos) vive en `ordenes`.
 */
export interface CargaAEmitir {
  operacion: Operacion
  realizadoPor: string
  labor: ItemBasico
  proveedor: ItemBasico
  cultivo: ItemBasico
  campana: ItemBasico
  /**
   * Contacto elegido. Va sólo como referencia: la columna de la orden es un espejo del proveedor
   * y la API no la deja escribir.
   */
  contacto: (ItemBasico & { telefono: string; email: string }) | null
  maquinarias: ItemBasico[]
  usdPorHa: number
  ordenes: OrdenAGenerar[]
}

/** Resultado de crear una orden en el tablero. */
export interface ResultadoOrden {
  orden: OrdenAGenerar
  itemId: string | null
  subitemsCreados: number
  /** Mensaje del fallo si la orden no se pudo crear. */
  error: string | null
}

/** Avance de la emisión, para que el botón no quede mudo mientras se crean N órdenes. */
export interface AvanceEmision {
  hechas: number
  total: number
  /** Nombre del lote que se está creando en este momento. */
  actual: string
}

/** Totales de toda la carga, para las métricas del resumen. */
export interface TotalesCarga {
  ordenes: number
  hectareas: number | null
  labor: number | null
  productos: number | null
  general: number | null
}

/* ===== Asignación de barbecho ===== */

/** Item conectado que la asignación sólo renombra. */
export interface ItemVinculado {
  id: string
  nombre: string
}

/** 🤖 Confirmacion de Trabajo Realizado conectada a una orden de trabajo. */
export interface ConfirmacionVinculada extends ItemVinculado {
  /** Cultivo tal como está escrito en `text_mm3acymf` (no es una conexión). */
  cultivo: string
}

/**
 * ✋ Orden de Trabajo conectada a una orden de producción. Los nombres de labor, proveedor, lote,
 * cultivo y campaña son los que muestran sus conexiones: sirven para rearmar el nombre si el
 * actual no sigue la convención.
 */
export interface OrdenTrabajoVinculada extends ItemVinculado {
  labor: string
  proveedor: string
  lote: string
  cultivo: string
  campana: string
  hectareas: number | null
  usdLabor: number | null
  /** Suma de los importes de sus productos (subelementos). */
  usdProductos: number | null
  usdTotal: number | null
  usdPorHa: number | null
  estadoEnvio: string
  confirmaciones: ConfirmacionVinculada[]
}

/** 🤖 Orden de Produccion: Cultivo-Lote-Campaña. */
export interface OrdenProduccion extends ItemBasico {
  estado: string
  campo: string
  lote: string
  campana: string
  cultivo: string
  /** Fecha de comienzo (`date4`) en formato ISO `AAAA-MM-DD`, o `null` si está vacía. */
  comienzo: string | null
  ordenesTrabajo: OrdenTrabajoVinculada[]
  /** Movimientos de 🤖 Stock en campo conectados (subelementos del stock). */
  stock: ItemVinculado[]
}

/**
 * Cómo se resolvió el nombre nuevo de un item:
 * - `cultivo`: se reemplazó el cultivo dentro del nombre actual, sin tocar el resto.
 * - `columnas`: el nombre actual no tenía el cultivo y se rearmó desde las conexiones del item.
 * - `igual`: el nombre ya tenía el cultivo nuevo (una asignación anterior que quedó a medias).
 * - `no-reconocido`: no se encontró el cultivo y no hay cómo rearmarlo; el nombre queda como está.
 */
export type ViaCambio = 'cultivo' | 'columnas' | 'igual' | 'no-reconocido'

/** Renombre de un item, con el nombre nuevo partido para poder resaltar el cultivo. */
export interface CambioNombre {
  itemId: string
  anterior: string
  nuevo: string
  via: ViaCambio
  /** `[antes, cultivo, después]` del nombre nuevo. `null` si no se pudo ubicar el cultivo. */
  partes: [string, string, string] | null
}

/** Todo lo que se va a escribir en Monday para una orden de producción. */
export interface PlanAsignacion {
  op: OrdenProduccion
  cultivo: ItemBasico
  nombreOp: CambioNombre
  ordenesTrabajo: CambioNombre[]
  confirmaciones: CambioNombre[]
  stock: CambioNombre[]
}

/** Resultado de aplicar el plan de una orden de producción. */
export interface ResultadoAsignacion {
  plan: PlanAsignacion
  /** Items efectivamente escritos, por tablero. */
  ordenesTrabajo: number
  confirmaciones: number
  stock: number
  /** La orden de producción quedó con el cultivo nuevo. */
  opActualizada: boolean
  error: string | null
}

/** Cuántos items toca una tanda de asignaciones, por tablero. */
export interface TotalesAsignacion {
  ordenesProduccion: number
  ordenesTrabajo: number
  confirmaciones: number
  stock: number
}

/* ===== Registrar Cosecha ===== */

/** Etiquetas de 🤚Tipo de Transporte. */
export type TipoTransporte = 'Flete Propio' | 'Flete Contratado'

/**
 * Datos de una cosecha tal como se cargan en el formulario. Es el mismo para crear una nueva y
 * para duplicar una existente: duplicar es arrancar el formulario con los datos de otra.
 * Los números van como texto por la coma decimal, igual que en la orden de trabajo.
 */
export interface BorradorCosecha {
  cultivoId: string | null
  campanaId: string | null
  campoId: string | null
  /**
   * Lotes de ese campo. Son varios porque una cosecha puede juntar el grano de más de un lote
   * (pasa en el tablero: "LOTE 68, LOTE 65, LOTE 70"); todos tienen que ser del campo elegido.
   */
  loteIds: string[]
  /** ISO `AAAA-MM-DD`, que es lo que maneja el `<input type="date">`. */
  fecha: string
  kg: string
  depositoId: string | null
  transporte: TipoTransporte | null
  /** Sólo se escriben con Flete Propio. */
  maquinariaIds: string[]
  /** Sólo se escribe con Flete Contratado. */
  proveedorId: string | null
  cartaPorte: string
  km: string
  ctg: string
}

/** 🤖 Granos en Deposito. */
export interface Deposito extends ItemBasico {
  /** Cultivos conectados en `board_relation_mm1fxqbh`: los que ese depósito puede recibir. */
  cultivoIds: string[]
  /** Silo, silo bolsa, acopio o corredor conectado: junto con el cultivo, define el depósito. */
  siloIds: string[]
  estado: string
}

/** Cosecha ya cargada en el tablero, lista para mostrarse y duplicarse. */
export interface CosechaExistente extends ItemBasico {
  /** 🤖ID Cosecha (COS-001…). */
  codigo: string
  borrador: BorradorCosecha
  /** Textos de sus conexiones, para mostrarla aunque algún item ya no esté en los catálogos. */
  textos: {
    cultivo: string
    campana: string
    campo: string
    lote: string
    deposito: string
    proveedor: string
    maquinarias: string
  }
  estadoRegistro: string
  estadoDuplicado: string
}
