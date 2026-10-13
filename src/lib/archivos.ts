/**
 * Reglas de los archivos que se suben con un remito o una factura: qué extensiones vale cada
 * formato, qué se le dice al usuario cuando sube otra cosa y cuánto puede pesar.
 */

/** Lo que se espera recibir: un PDF, o una foto (el formato "JPEG" del tablero acepta cualquiera). */
export type FormatoArchivo = 'pdf' | 'imagen'

/** Extensiones que se aceptan como foto. Las de iPhone (HEIC/HEIF) también. */
const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff']

/**
 * Peso máximo que llega a monday. Vercel corta los pedidos de más de ~4,5 MB, y el multipart suma
 * algo encima del archivo: 4 MB deja margen.
 */
export const PESO_MAXIMO = 4 * 1024 * 1024

/** Extensión en minúscula y sin punto (`"foto.JPG"` → `"jpg"`). */
export const extension = (nombre: string): string => {
  const i = nombre.lastIndexOf('.')
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : ''
}

export const esPdf = (f: File): boolean =>
  extension(f.name) === 'pdf' || f.type === 'application/pdf'

export const esImagen = (f: File): boolean =>
  EXT_IMAGEN.includes(extension(f.name)) || f.type.startsWith('image/')

/** "2,4 MB" / "830 KB". */
export function peso(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Atributo `accept` del selector: el sistema ya muestra sólo lo que corresponde. */
export const aceptaDe = (formato: FormatoArchivo): string =>
  formato === 'pdf' ? '.pdf,application/pdf' : 'image/*,' + EXT_IMAGEN.map((e) => `.${e}`).join(',')

/**
 * Motivo por el que `archivo` no sirve para `formato`, escrito para quien lo está subiendo:
 * qué subió, qué se esperaba y qué tiene que hacer. `null` si el archivo está bien.
 *
 * El peso NO se mira acá: una foto pesada se achica antes de subirla (ver `prepararArchivo`).
 */
export function motivoRechazo(archivo: File, formato: FormatoArchivo): string | null {
  const ext = extension(archivo.name)
  const queEs = esPdf(archivo)
    ? 'un PDF'
    : esImagen(archivo)
      ? 'una imagen'
      : ext
        ? `un archivo .${ext}`
        : 'un archivo sin extensión'

  if (formato === 'pdf') {
    if (esPdf(archivo)) return null
    return (
      `"${archivo.name}" es ${queEs}, no un PDF. Elegiste PDF: asegurate de subir el remito o la ` +
      'factura guardado como .pdf.' +
      (esImagen(archivo) ? ' Si lo que tenés es una foto, elegí el formato JPEG.' : '')
    )
  }

  // Formato imagen: el PDF se rechaza explícitamente, aunque el navegador lo deje elegir.
  if (esPdf(archivo)) {
    return (
      `"${archivo.name}" es un PDF. Elegiste JPEG: acá va una foto del remito (.jpg, .jpeg, .png…). ` +
      'Si el remito está en PDF, cambiá el formato a PDF.'
    )
  }
  if (esImagen(archivo)) return null
  return `"${archivo.name}" es ${queEs}, no una foto. Subí una imagen del remito (.jpg, .jpeg, .png…).`
}

/** Un PDF que supera el máximo no se puede achicar acá: se avisa con el peso de cada lado. */
export function motivoPeso(archivo: File): string | null {
  if (archivo.size <= PESO_MAXIMO) return null
  return (
    `"${archivo.name}" pesa ${peso(archivo.size)} y el máximo es ${peso(PESO_MAXIMO)}. ` +
    'Probá exportarlo de nuevo con menor calidad o dividirlo.'
  )
}

/** Carga una imagen del archivo para dibujarla en un canvas. */
function leerImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolver(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rechazar(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })
}

/** Lado más largo con el que se guarda una foto achicada: el remito se sigue leyendo bien. */
const LADO_MAXIMO = 2400

/**
 * Deja el archivo listo para subir.
 *
 * Una foto de celular pasa seguido los 4 MB. En vez de rechazarla, se vuelve a guardar como JPEG
 * de hasta 2400 px de lado: el texto del remito se sigue leyendo y queda muy por debajo del
 * límite. Las fotos livianas y los PDF se suben tal cual.
 */
export async function prepararArchivo(archivo: File, formato: FormatoArchivo): Promise<File> {
  if (formato === 'pdf' || archivo.size <= PESO_MAXIMO * 0.9) return archivo

  let img: HTMLImageElement
  try {
    img = await leerImagen(archivo)
  } catch {
    throw new Error(
      `"${archivo.name}" pesa ${peso(archivo.size)} y no se pudo achicar en este navegador. ` +
        'Sacá la foto en JPG o con menor resolución.',
    )
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * escala)
  canvas.height = Math.round(img.naturalHeight * escala)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar la imagen.')
  // Fondo blanco: un PNG con transparencia pasado a JPEG quedaría negro.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  for (const calidad of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', calidad))
    if (blob && blob.size <= PESO_MAXIMO * 0.95) {
      const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg'
      return new File([blob], nombre, { type: 'image/jpeg' })
    }
  }
  throw new Error(`"${archivo.name}" sigue pesando demasiado aun achicada. Probá con otra foto.`)
}
