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
  /** 🤖 Orden de Produccion: Cultivo-Lote-Campaña. Una por lote y campaña. */
  ordenProduccion: '18410927170',
  /** 🤖 Confirmacion de Trabajo Realizado. */
  confirmaciones: '18410927173',
  /**
   * Movimientos de stock: son SUBITEMS de 🤖 Stock en campo, así que viven en este tablero de
   * subelementos y no en el del stock. Renombrarlos se hace contra este id.
   */
  movimientosStock: '18410927255',
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
  /** Confirmaciones de trabajo realizado de esta orden (una o más). */
  confirmaciones: 'board_relation_mm3f3da',
  /** Hectáreas del lote, espejo de 📍 Lotes. */
  hectareasEspejo: 'lookup_mm3862q2',
  /** U$ de la labor: hectáreas × U$/Ha. */
  usdLabor: 'formula_mm09mxrz',
  /** U$ total de la orden: labor + productos. */
  usdTotal: 'formula_mm45te4n',
  /** Costo por hectárea: (labor + productos) / hectáreas. */
  usdPorHaTotal: 'formula_mm45hc65',
} as const

/**
 * 🤖 Orden de Produccion: Cultivo-Lote-Campaña (18410927170).
 *
 * Los montos (`u$ prod`, `Costo u$ x Hct`, `u$ Labor`, `u$ total`) son espejos de fórmulas de la
 * orden de trabajo y la API los devuelve VACÍOS en cualquier versión: monday no resuelve un espejo
 * de una fórmula. Por eso la asignación de barbecho los lee directo de cada OT conectada.
 */
export const COL_OP = {
  estado: 'status',
  campo: 'board_relation_mm0xkka3',
  lote: 'board_relation_mm31d328',
  cultivo: 'board_relation_mm0xzwvq',
  campana: 'board_relation_mm0xj2n8',
  comienzo: 'date4',
  ordenesTrabajo: 'board_relation_mm0xxrye',
  stock: 'board_relation_mm13c2p7',
} as const

/** Subitems de ✋ Orden de Trabajo: importe de cada producto (cantidad × precio). */
export const COL_PRODUCTO_OT_USD = 'formula_mm416gx'

/** 🤖 Confirmacion de Trabajo Realizado (18410927173). */
export const COL_CONFIRMACION = {
  /** El cultivo va como texto suelto, no como conexión: hay que escribirlo con el nombre. */
  cultivo: 'text_mm3acymf',
} as const

/**
 * Nombre del cultivo que marca a una orden de producción "sin cultivo asignado todavía". La
 * operación de asignación busca este item en 🌻🌱 Cultivo por nombre, no por id, para que siga
 * funcionando si algún día lo recrean.
 */
export const CULTIVO_BARBECHO = 'Barbecho'

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
 *
 * Cada uno acepta más de un nombre de etiqueta: en monday "Contratista Labores" pasó a llamarse
 * "Contratista" (14/10/2026) y, buscando sólo el nombre viejo, la carga de OT se quedó sin ningún
 * contratista para elegir. Aceptar los dos evita que un renombre así la vuelva a romper.
 */
export const REALIZADO_POR = [
  { etiqueta: 'Contratista', tiposProveedor: ['Contratista', 'Contratista Labores'] },
  { etiqueta: 'Personal de la Empresa', tiposProveedor: ['Personal interno', 'Personal Interno'] },
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
  /**
   * 🤚Principio Activo. Los productos que comparten uno son equivalentes entre sí: es lo que se
   * ofrece como reemplazo. Ojo: hay etiquetas con coma ("2,4-D"), así que se leen de `values` y no
   * partiendo el `text` (ver `etiquetasDropdown`).
   */
  principioActivo: 'dropdown_mm7z94pj',
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
  /** Permitir Reemplazo: si el contratista puede usar otro producto con el mismo principio activo. */
  permitirReemplazo: 'color_mm8332q5',
} as const

/** Etiquetas de `COL_PRODUCTO_OT.permitirReemplazo`. */
export const REEMPLAZO_SI = 'SI'
export const REEMPLAZO_NO = 'NO'

/* ===== Registrar Remito / Factura ===== */

/** ✋REMITOS- Retiros de Productos en Proveedor. */
export const TABLERO_REMITOS = '18410927148'
/** 🤖 🧾 Comprobantes de Compras (facturas). */
export const TABLERO_FACTURAS = '18410927147'
/** 🛖 Destino de Almacenamiento de Productos (Tandil, Ayacucho, Tres Arroyos). */
export const TABLERO_DESTINOS = '18411551565'

export const COL_REMITO = {
  /**
   * ✋ Persona. Sólo se puede asignar a quien tiene acceso al tablero, así que las opciones son los
   * suscriptores del tablero de remitos y no la lista completa de usuarios de la cuenta.
   */
  persona: 'person',
  destino: 'board_relation_mm1ft4eh',
  /** 🤖 Tipo de Archivo: PDF o JPEG. Define en qué columna va el archivo. */
  formato: 'color_mm38pr6n',
  archivoPdf: 'file_mm1fs67h',
  archivoJpeg: 'file_mm38hc4r',
} as const

export const COL_FACTURA = {
  archivo: 'file_mm1axdpr',
  /** 🤖Origen Factura: las cargadas desde la app van como MANUAL (las otras llegan POR EMAIL). */
  origen: 'color_mm7fkx7d',
} as const

export const FACTURA_ORIGEN_MANUAL = 'MANUAL'

/**
 * 🤖 Estado de Registro (`color_mm1ajk2x`) de la factura. "Registrar" es lo que la manda a
 * procesar; la app lo pone al final, con el PDF subido y el origen ya en MANUAL.
 */
export const COL_FACTURA_ESTADO = 'color_mm1ajk2x'
export const FACTURA_ESTADO_REGISTRAR = 'Registrar'

/* ===== Registrar Cosecha ===== */

/** ✋ Cosecha. */
export const TABLERO_COSECHA = '18410927172'
/** 🤖 Granos en Deposito: destinos posibles del grano cosechado. */
export const TABLERO_DEPOSITOS = '18410927175'

export const COL_COSECHA = {
  cultivo: 'board_relation_mm1f8xpb',
  campana: 'board_relation_mm1f9j3',
  campo: 'board_relation_mm1fqqsa',
  lote: 'board_relation_mm3bqrjy',
  fecha: 'date_mm3b7319',
  kg: 'numeric_mm1fs180',
  deposito: 'board_relation_mm3cgegw',
  transporte: 'color_mm1fbf6v',
  /** Sólo con Flete Propio: una o más maquinarias (según lo permita la columna, ver `traerDatosCosecha`). */
  maquinarias: 'board_relation_mm1fbdsm',
  /** Sólo con Flete Contratado: un proveedor de tipo Fletes. */
  proveedor: 'board_relation_mm1f9twb',
  cartaPorte: 'text_mm1fnckc',
  km: 'numeric_mm1fe2f7',
  ctg: 'text_mm3kavqa',
  /** 🤖 Estado de Registro. La app no lo escribe: tanto el alta como la duplicada nacen sin estado. */
  estadoRegistro: 'color_mm444rn8',
  /** 🤖Estado Duplicado. La cosecha de la que se copiaron los datos queda en "Duplicado". */
  estadoDuplicado: 'color_mm59ytz6',
  /** 🤖ID Cosecha (COS-001…): sirve para distinguir cosechas con el mismo nombre. */
  idCosecha: 'pulse_id_mm41rdrf',
} as const

export const TRANSPORTE_PROPIO = 'Flete Propio'
export const TRANSPORTE_CONTRATADO = 'Flete Contratado'
export const COSECHA_DUPLICADO = 'Duplicado'

/** Tipo de proveedor (`COL_PROVEEDOR.tipo`) que puede hacer un flete contratado. */
export const PROVEEDOR_TIPO_FLETES = 'Fletes'

/** 🤖 Granos en Deposito: el cultivo que admite cada depósito. */
export const COL_DEPOSITO = {
  cultivo: 'board_relation_mm1fxqbh',
  estado: 'color_mm3fjkvh',
} as const

/* ===== Altas al vuelo (proveedor, contacto, depósito) ===== */

/** Columnas que completa el alta de un proveedor desde la app. */
export const COL_PROVEEDOR_ALTA = {
  nombreCompleto: 'text_mm84mmvf',
  ubicacion: 'location_mm33fd1b',
} as const

/** Estado con el que nace un proveedor creado desde la app (`COL_PROVEEDOR.estado`). */
export const PROVEEDOR_ACTIVO = 'Activo'

/** Columnas de ✋ Contactos que completa el alta de un contacto. */
export const COL_CONTACTO_ALTA = {
  nombre: 'text_mm0xwjp9',
  apellido: 'text_mm0xqhqm',
  whatsapp: 'phone_mkw8mf8b',
  email: 'email_mkw8zvjs',
  /** Conexión de doble vía con 🤖Contactos del proveedor: completar un lado completa el otro. */
  proveedores: 'board_relation_mm09g4gq',
} as const

/** 🛖Destino Depositos de Granos: silos, silo bolsas, acopios y corredores. */
export const TABLERO_SILOS = '18410927183'
export const COL_SILO = { tipo: 'color_mm1fa82m' } as const

/** Columnas de 🤖 Granos en Deposito que completa el alta de un depósito. */
export const COL_DEPOSITO_ALTA = {
  silo: 'board_relation_mm1fq67c',
  ubicacion: 'location_mm1fh806',
} as const
export const DEPOSITO_ACTIVO = 'Activo'

/* ===== Hacienda ===== */

/** Movimientos (workspace Productor Agropecuario): un item por movimiento de hacienda. */
export const TABLERO_MOVIMIENTOS = '18427921086'

export const COL_MOVIMIENTO = {
  /** Status: Compra, Nacimiento, Venta, Muerte, Cambio de categoría. */
  tipo: 'color_mm6hkxdz',
  campo: 'board_relation_mm6hcmsa',
  /** Categoría de una compra, nacimiento, venta o muerte. */
  categoria: 'dropdown_mm6he6mf',
  /** Cambio de categoría: de qué categoría pasan… */
  origen: 'dropdown_mm84phck',
  /** …y a cuál. */
  destino: 'dropdown_mm6h5qtz',
  observaciones: 'long_text_mm6hp8cm',
  fecha: 'date_mm6hngt9',
  cantidad: 'numeric_mm6hzs94',
  responsable: 'text_mm84dcnt',
  /** 🤖ID Movimiento (MOV-001…). */
  codigo: 'pulse_id_mm846ga1',
} as const
