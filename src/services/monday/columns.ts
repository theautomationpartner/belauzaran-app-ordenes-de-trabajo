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
  productos: '18410927152',
  /** Subitems de la orden: cada producto usado es uno de estos. */
  productosOT: '18410927290',
  maquinarias: '18410927187',
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
  maquinarias: 'board_relation_mm3jkkcw',
  /**
   * Contacto. Es una columna MIRROR: refleja los contactos del proveedor conectado y la API de
   * Monday no permite escribirla. Queda documentada para que se entienda por qué la app no la
   * completa aunque el usuario elija un contacto puntual (ver `crearOrdenes.ts`).
   */
  contactoEspejo: 'lookup_mm3c273r',
} as const

/**
 * Estados de envío con los que la app puede crear una orden (`color_mm0xaytt`).
 *
 * Son los dos extremos de la decisión: dejarla cargada para revisarla, o largarla al circuito de
 * envío en el acto. El resto de las etiquetas de la columna las maneja la automatización del
 * tablero (Enviando, Enviado, Error…) y no tiene sentido que las escriba la app.
 */
export const OT_ESTADOS_ENVIO = [
  {
    etiqueta: 'NO Enviar por Ahora',
    titulo: 'Dejar cargada sin enviar',
    detalle: 'La orden queda en el tablero para revisarla. No se le manda nada al contratista.',
  },
  {
    etiqueta: 'Crear y Enviar Ahora',
    titulo: 'Crear y enviar en el momento',
    detalle: 'Se dispara el envío al contacto del proveedor apenas se crea la orden.',
  },
] as const

/**
 * Estado por defecto. Es el conservador a propósito: el envío no se puede deshacer, así que
 * mandar tiene que ser una decisión explícita y no lo que pasa si nadie tocó nada.
 */
export const OT_ESTADO_ENVIO_INICIAL: string = OT_ESTADOS_ENVIO[0].etiqueta

/** Estado de las órdenes que el usuario marcó para que salgan apenas se crean. */
export const OT_ESTADO_ENVIAR_AHORA: string = OT_ESTADOS_ENVIO[1].etiqueta

/**
 * Quién ejecuta la labor (`color_mm1ftcaf`) y con qué tipo de proveedor se corresponde
 * (`dropdown_mm39x0j7` del tablero de Proveedores). Elegir esto primero es lo que reduce la
 * lista de proveedores a los que realmente pueden hacer ese trabajo.
 */
export const REALIZADO_POR = [
  { etiqueta: 'Contratista', tipoProveedor: 'Contratista Labores' },
  { etiqueta: 'Personal de la Empresa', tipoProveedor: 'Personal interno' },
] as const

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

/** 🧴🧪 Productos (18410927152). */
export const COL_PRODUCTO = {
  estado: 'color_mm3c4b2t',
  unidad: 'dropdown_mm1f1sdt',
  tipo: 'dropdown_mm48bjb0',
  /** Cantidad por hectárea de referencia; se propone como valor inicial al agregar el producto. */
  cantPorHa: 'numeric_mm12vxqy',
  precioUnitario: 'numeric_mm3589e9',
  /**
   * Etiqueta oficial del producto (`"<nombre> - <unidad>"`). Es el MISMO texto que usa el dropdown
   * del subitem, así que se lee de acá en vez de componerlo: los 215 productos activos la tienen
   * cargada y coincide 1 a 1 con las opciones del subitem.
   */
  etiqueta: 'dropdown_mm3ca3dn',
} as const

/** 🛠️🚜 Maquinarias, Herramientas y Rodados (18410927187). */
export const COL_MAQUINARIA = {
  tipo: 'color_mm34705g',
  clasificacion: 'color_mm34wmm9',
  marca: 'text_mm34jp2t',
  patente: 'text_mm345g3d',
} as const

/** Productos que no se ofrecen para cargar: sólo entran los activos o los recién dados de alta. */
export const PRODUCTO_ESTADOS_VALIDOS = ['Activo', 'Nuevo!']

/**
 * Subitems de ✋ Orden de Trabajo (18410927290): un subitem por producto usado.
 *
 * El producto NO se guarda como conexión sino como etiqueta de un `dropdown`, con el formato
 * `"<nombre del producto> - <unidad>"`. Por eso la app arrastra esa etiqueta armada junto al id:
 * es lo que Make necesita para completar la columna.
 */
export const COL_PRODUCTO_OT = {
  producto: 'dropdown_mm3cg47g',
  cantPorHa: 'numeric_mm3869nh',
  hectareas: 'numeric_mm3fvr3q',
  precioUnitario: 'numeric_mm415mdz',
} as const
