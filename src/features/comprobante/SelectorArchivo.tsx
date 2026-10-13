import { useRef, useState } from 'react'
import { aceptaDe, motivoRechazo, peso, type FormatoArchivo } from '@/lib/archivos'

interface Props {
  formato: FormatoArchivo
  archivo: File | null
  onCambio: (archivo: File | null) => void
  /** Aviso que viene de afuera (por ejemplo, un archivo quitado al cambiar de formato). */
  aviso?: string | null
}

const TEXTOS: Record<FormatoArchivo, { titulo: string; ayuda: string; icono: string }> = {
  pdf: {
    titulo: 'Subí el archivo PDF',
    ayuda: 'Un solo archivo, con extensión .pdf.',
    icono: 'file-pdf',
  },
  imagen: {
    titulo: 'Subí la foto',
    ayuda: 'Una sola imagen: .jpg, .jpeg, .png u otra foto. No se aceptan PDF.',
    icono: 'file-image',
  },
}

/**
 * Zona para elegir UN archivo, con la validación a la vista.
 *
 * Si lo que se elige no corresponde al formato, NO se carga: se dice qué se intentó subir, qué se
 * esperaba y qué hacer. El selector del sistema ya filtra por tipo (`accept`), pero en el celular
 * y al arrastrar se puede colar cualquier cosa, así que la comprobación de verdad es esta.
 */
export function SelectorArchivo({ formato, archivo, onCambio, aviso }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const t = TEXTOS[formato]

  const recibir = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return
    if (lista.length > 1) {
      setRechazo(`Elegiste ${lista.length} archivos. Se sube uno solo: elegí únicamente el que corresponde.`)
      return
    }
    const f = lista[0]
    const motivo = motivoRechazo(f, formato)
    setRechazo(motivo)
    if (!motivo) onCambio(f)
  }

  const quitar = () => {
    onCambio(null)
    setRechazo(null)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="archivo">
      <input
        ref={input}
        type="file"
        className="archivo-input"
        accept={aceptaDe(formato)}
        onChange={(e) => {
          recibir(e.target.files)
          // Se limpia para que volver a elegir el mismo archivo dispare el cambio.
          e.target.value = ''
        }}
      />

      {archivo ? (
        <div className={`archivo-elegido archivo-elegido--${formato}`}>
          <i className={`fas fa-${t.icono} archivo-elegido-ic`} aria-hidden />
          <span className="archivo-elegido-body">
            <span className="archivo-elegido-nom">{archivo.name}</span>
            <span className="xs">
              {peso(archivo.size)} · <i className="fas fa-circle-check t-green" aria-hidden /> Es{' '}
              {formato === 'pdf' ? 'un PDF' : 'una imagen'}, corresponde al formato elegido
            </span>
          </span>
          <span className="archivo-elegido-acciones">
            <button type="button" className="btn btn-out btn--sm" onClick={() => input.current?.click()}>
              <i className="fas fa-arrow-rotate-right" aria-hidden /> Cambiar
            </button>
            <button type="button" className="btn btn-ghost btn-ghost--rojo btn--sm" onClick={quitar}>
              <i className="fas fa-trash-can" aria-hidden /> Quitar
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          className={`archivo-zona archivo-zona--${formato} ${arrastrando ? 'archivo-zona--sobre' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastrando(false)
            recibir(e.dataTransfer.files)
          }}
        >
          <i className={`fas fa-${t.icono} archivo-zona-ic`} aria-hidden />
          <span className="archivo-zona-tit">{t.titulo}</span>
          <span className="archivo-zona-sub">Tocá para elegirlo{' '}<span className="archivo-zona-pc">o arrastralo acá</span></span>
          <span className="archivo-zona-ayuda">{t.ayuda}</span>
        </button>
      )}

      {(rechazo || aviso) && (
        <div className="aviso aviso--error" style={{ marginTop: 10 }}>
          <i className="fas fa-circle-exclamation" aria-hidden />
          <span>{rechazo ?? aviso}</span>
        </div>
      )}
    </div>
  )
}
