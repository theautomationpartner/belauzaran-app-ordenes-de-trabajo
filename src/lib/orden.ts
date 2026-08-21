/**
 * Reglas de la orden de trabajo: qué contactos se pueden elegir, cuándo un paso está completo
 * y cómo se expanden los bloques campo+lotes a las órdenes que se van a crear.
 *
 * Vive fuera de los componentes a propósito: son decisiones del negocio, no de la pantalla.
 */
import type {
  BorradorOrden,
  Campo,
  Catalogos,
  Contacto,
  LineaProducto,
  CargaAEmitir,
  Maquinaria,
  OrdenAGenerar,
  Producto,
  ProductoDeOrden,
  Proveedor,
  TotalesCarga,
} from '@/types'
import { aNumero } from './format'
import { OT_ESTADO_ENVIO_INICIAL, REALIZADO_POR } from '@/services/monday/columns'

let contador = 0
/** Clave local de un bloque o de una línea. No usa `crypto.randomUUID` para no depender de HTTPS. */
export const nuevoUid = (): string => `b${++contador}`

/** Borrador vacío: un bloque de campo y una línea de producto listos para completar. */
export const borradorInicial = (): BorradorOrden => ({
  realizadoPor: null,
  laborId: null,
  proveedorId: null,
  cultivoId: null,
  campanaId: null,
  usdPorHa: '',
  contactoId: null,
  productos: [],
  maquinariaIds: [],
  bloques: [{ uid: nuevoUid(), campoId: null, loteIds: [] }],
  estadoEnvio: OT_ESTADO_ENVIO_INICIAL,
})

/** Etiquetas disponibles para "Realizado por". */
export const opcionesRealizadoPor = (): string[] => REALIZADO_POR.map((r) => r.etiqueta)

/**
 * Proveedores que pueden ejecutar la labor.
 *
 * Se filtra por dos cosas: que estén activos, y que su tipo se corresponda con quién va a hacer
 * el trabajo (Contratista → "Contratista Labores", Personal de la Empresa → "Personal interno").
 * Sin elegir primero el "realizado por" no se ofrece ninguno: la lista completa mezcla fleteros y
 * proveedores de insumos, que no hacen labores.
 */
export function proveedoresElegibles(
  proveedores: Proveedor[],
  realizadoPor: string | null,
): Proveedor[] {
  const activos = proveedores.filter((p) => p.estado === 'Activo')
  if (!realizadoPor) return []

  const tipoEsperado = REALIZADO_POR.find((r) => r.etiqueta === realizadoPor)?.tipoProveedor
  if (!tipoEsperado) return activos
  return activos.filter((p) => p.tipos.includes(tipoEsperado))
}

/** Maquinarias elegidas, en el orden del catálogo. */
export const maquinariasElegidas = (
  maquinarias: Maquinaria[],
  ids: string[],
): Maquinaria[] => {
  const elegidas = new Set(ids)
  return maquinarias.filter((m) => elegidas.has(m.id))
}

/**
 * Contactos a los que se le puede mandar la orden de un proveedor: SÓLO los que tienen a ese
 * proveedor conectado. La conexión se mira desde los dos lados porque en Monday son dos columnas
 * distintas (`Proveedores.🤖Contactos` y `Contactos.✋ Provedores`) y no siempre se cargan ambas.
 */
export function contactosDeProveedor(
  contactos: Contacto[],
  proveedor: Proveedor | null,
): Contacto[] {
  if (!proveedor) return []
  const desdeProveedor = new Set(proveedor.contactoIds)
  return contactos.filter((c) => desdeProveedor.has(c.id) || c.proveedorIds.includes(proveedor.id))
}

/** Busca por id en cualquier catálogo con forma `{ id }`. */
export const buscar = <T extends { id: string }>(lista: T[], id: string | null): T | null =>
  id ? lista.find((x) => x.id === id) ?? null : null

/**
 * Hectáreas de un lote. Es el dato de la columna `Hect Totales` (`numeric_mm311dwm`), que es la
 * que el tablero tiene efectivamente cargada; la productiva queda como respaldo para los lotes
 * donde exista.
 */
export const hectareasDeLote = (lote: {
  hectareasTotales: number | null
  hectareasProductivas: number | null
}): number | null => lote.hectareasTotales ?? lote.hectareasProductivas

/** Lotes ya tomados por OTROS bloques: un mismo lote no puede repetirse en la misma carga. */
export function lotesTomados(borrador: BorradorOrden, uidActual: string): Set<string> {
  const tomados = new Set<string>()
  for (const b of borrador.bloques) {
    if (b.uid === uidActual) continue
    for (const id of b.loteIds) tomados.add(id)
  }
  return tomados
}

/** Productos ya elegidos en OTRAS líneas: cargar dos veces el mismo insumo sería un error. */
export function productosTomados(borrador: BorradorOrden, uidActual: string): Set<string> {
  const tomados = new Set<string>()
  for (const l of borrador.productos) {
    if (l.uid === uidActual || !l.productoId) continue
    tomados.add(l.productoId)
  }
  return tomados
}

/** Líneas de producto que están realmente cargadas (con producto elegido). */
export const lineasCargadas = (borrador: BorradorOrden): LineaProducto[] =>
  borrador.productos.filter((l) => l.productoId)

/**
 * Motivos por los que el paso de datos todavía no se puede confirmar. Devolver la lista —en vez
 * de un booleano— es lo que permite decirle al usuario QUÉ le falta en lugar de sólo deshabilitar.
 */
export function faltantesDatos(borrador: BorradorOrden, catalogos: Catalogos): string[] {
  const faltan: string[] = []
  if (!borrador.realizadoPor) faltan.push('Indicá quién va a realizar la labor.')
  if (!borrador.laborId) faltan.push('Elegí la labor.')
  if (!borrador.proveedorId) faltan.push('Elegí el proveedor / contratista.')
  if (!borrador.cultivoId) faltan.push('Elegí el cultivo.')
  if (!borrador.campanaId) faltan.push('Elegí una campaña activa.')

  const valor = aNumero(borrador.usdPorHa)
  if (valor == null) faltan.push('Cargá el valor U$/Ha de la labor.')
  else if (valor <= 0) faltan.push('El valor U$/Ha tiene que ser mayor a cero.')

  const proveedor = buscar(catalogos.proveedores, borrador.proveedorId)
  const disponibles = contactosDeProveedor(catalogos.contactos, proveedor)
  if (proveedor && disponibles.length === 0) {
    faltan.push(`"${proveedor.nombre}" todavía no tiene contactos vinculados en Monday.`)
  } else if (!borrador.contactoId) {
    faltan.push('Elegí el contacto al que se le envía la orden.')
  }
  return faltan
}

/**
 * Motivos por los que el paso de productos no se puede confirmar.
 *
 * La lista de productos puede quedar VACÍA a propósito: hay labores puramente mecánicas (disco,
 * corte, rastra) que no aplican ningún insumo. Lo que sí se exige es que todo producto agregado
 * tenga una dosis válida: un subitem con cantidad cero o vacía no sirve para nada.
 */
export function faltantesProductos(borrador: BorradorOrden): string[] {
  const faltan: string[] = []
  const cargadas = lineasCargadas(borrador)

  const sinCantidad = cargadas.filter((l) => {
    const n = aNumero(l.cantPorHa)
    return n == null || n <= 0
  }).length

  if (sinCantidad > 0) {
    faltan.push(
      sinCantidad === 1
        ? 'Hay un producto sin la cantidad por hectárea cargada.'
        : `Hay ${sinCantidad} productos sin la cantidad por hectárea cargada.`,
    )
  }
  return faltan
}

/** Motivos por los que el paso de campos no se puede confirmar. */
export function faltantesCampos(borrador: BorradorOrden): string[] {
  const faltan: string[] = []
  const conCampo = borrador.bloques.filter((b) => b.campoId)
  if (conCampo.length === 0) return ['Agregá al menos un campo con sus lotes.']

  const sinLotes = conCampo.filter((b) => b.loteIds.length === 0).length
  if (sinLotes > 0) {
    faltan.push(
      sinLotes === 1
        ? 'Hay un campo sin lotes seleccionados.'
        : `Hay ${sinLotes} campos sin lotes seleccionados.`,
    )
  }
  if (borrador.bloques.some((b) => !b.campoId)) {
    faltan.push('Hay un bloque sin campo elegido: completalo o quitalo.')
  }
  return faltan
}

/**
 * Resuelve los productos de la carga para un lote de `hectareas`.
 *
 * La dosis por hectárea es la misma en todos los lotes —se elige una sola vez, antes de los
 * campos—; lo que cambia por lote es la cantidad total, que depende de su superficie.
 */
function productosPara(
  borrador: BorradorOrden,
  productos: Producto[],
  hectareas: number | null,
): ProductoDeOrden[] {
  const resueltos: ProductoDeOrden[] = []

  for (const linea of borrador.productos) {
    const producto = buscar(productos, linea.productoId)
    const cantPorHa = aNumero(linea.cantPorHa)
    if (!producto || cantPorHa == null || cantPorHa <= 0) continue

    const cantTotal = hectareas != null ? redondear(cantPorHa * hectareas) : null
    resueltos.push({
      productoId: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidad,
      etiqueta: producto.etiqueta,
      cantPorHa,
      cantTotal,
      precioUnitario: producto.precioUnitario,
      totalUsd:
        cantTotal != null && producto.precioUnitario != null
          ? redondear(cantTotal * producto.precioUnitario)
          : null,
    })
  }
  return resueltos
}

/** Redondeo a dos decimales, para que los totales no arrastren coletazos de coma flotante. */
const redondear = (n: number): number => Math.round(n * 100) / 100

/**
 * Suma una lista de valores que pueden faltar. Devuelve `null` si ALGUNO falta: un total
 * incompleto presentado como si estuviera completo es peor que no mostrar total.
 */
function sumarExacto(valores: (number | null)[]): number | null {
  if (valores.length === 0) return 0
  if (valores.some((v) => v == null)) return null
  return redondear(valores.reduce<number>((acc, v) => acc + (v ?? 0), 0))
}

/**
 * Expande los bloques a las órdenes concretas. El tablero admite UN campo y UN lote por orden,
 * así que un bloque con 3 lotes produce 3 órdenes idénticas salvo por el lote conectado y por
 * las cantidades de producto, que se recalculan con las hectáreas de cada lote.
 */
export function expandirOrdenes(borrador: BorradorOrden, catalogos: Catalogos): OrdenAGenerar[] {
  const usdHa = aNumero(borrador.usdPorHa)
  const ordenes: OrdenAGenerar[] = []

  for (const bloque of borrador.bloques) {
    const campo: Campo | null = buscar(catalogos.campos, bloque.campoId)
    if (!campo) continue

    for (const loteId of bloque.loteIds) {
      const lote = campo.lotes.find((l) => l.id === loteId)
      if (!lote) continue

      const hectareas = hectareasDeLote(lote)
      const productos = productosPara(borrador, catalogos.productos, hectareas)
      const totalLaborUsd =
        hectareas != null && usdHa != null ? redondear(hectareas * usdHa) : null
      const totalProductosUsd = sumarExacto(productos.map((p) => p.totalUsd))

      ordenes.push({
        campoId: campo.id,
        campoNombre: campo.nombre,
        loteId: lote.id,
        loteNombre: lote.nombre,
        hectareas,
        totalLaborUsd,
        productos,
        totalProductosUsd,
        totalUsd:
          totalLaborUsd != null && totalProductosUsd != null
            ? redondear(totalLaborUsd + totalProductosUsd)
            : null,
      })
    }
  }
  return ordenes
}

/** Totales de toda la carga, para las métricas del resumen. */
export function totalesDe(ordenes: OrdenAGenerar[]): TotalesCarga {
  return {
    ordenes: ordenes.length,
    hectareas: sumarExacto(ordenes.map((o) => o.hectareas)),
    labor: sumarExacto(ordenes.map((o) => o.totalLaborUsd)),
    productos: sumarExacto(ordenes.map((o) => o.totalProductosUsd)),
    general: sumarExacto(ordenes.map((o) => o.totalUsd)),
  }
}

/**
 * Resuelve el borrador a una carga lista para escribirse en Monday.
 * Devuelve `null` si falta algo: emitir a medias crearía órdenes rotas en el tablero.
 */
export function armarCarga(borrador: BorradorOrden, catalogos: Catalogos): CargaAEmitir | null {
  const labor = buscar(catalogos.labores, borrador.laborId)
  const proveedor = buscar(catalogos.proveedores, borrador.proveedorId)
  const cultivo = buscar(catalogos.cultivos, borrador.cultivoId)
  const campana = buscar(catalogos.campanas, borrador.campanaId)
  const contacto = buscar(catalogos.contactos, borrador.contactoId)
  const usdPorHa = aNumero(borrador.usdPorHa)
  const ordenes = expandirOrdenes(borrador, catalogos)

  if (
    !borrador.realizadoPor ||
    !labor ||
    !proveedor ||
    !cultivo ||
    !campana ||
    usdPorHa == null ||
    ordenes.length === 0
  ) {
    return null
  }

  const soloIdNombre = (x: { id: string; nombre: string }) => ({ id: x.id, nombre: x.nombre })

  return {
    operacion: 'ORDEN_DE_TRABAJO',
    realizadoPor: borrador.realizadoPor,
    labor: soloIdNombre(labor),
    proveedor: soloIdNombre(proveedor),
    cultivo: soloIdNombre(cultivo),
    campana: soloIdNombre(campana),
    contacto: contacto
      ? { ...soloIdNombre(contacto), telefono: contacto.telefono, email: contacto.email }
      : null,
    maquinarias: maquinariasElegidas(catalogos.maquinarias, borrador.maquinariaIds).map(
      soloIdNombre,
    ),
    usdPorHa,
    estadoEnvio: borrador.estadoEnvio,
    ordenes,
  }
}
