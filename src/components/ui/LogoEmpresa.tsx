import { useState } from 'react'

/**
 * Logo de Belaunzaran SA, en la esquina superior derecha.
 *
 * Se sirve desde `public/`, que Vite copia tal cual a la raíz del sitio: para cambiar la marca
 * alcanza con reemplazar el archivo, sin tocar código ni recompilar.
 *
 * Prefiere el PNG original. Mientras ese archivo no esté cargado cae en la reconstrucción
 * vectorial (`.svg`), así la cabecera nunca muestra el ícono de imagen rota.
 */
const FUENTES = ['/logo-belaunzaran.png', '/logo-belaunzaran.svg'] as const

export function LogoEmpresa() {
  const [indice, setIndice] = useState(0)
  if (indice >= FUENTES.length) return null

  return (
    <div className="marca">
      <img
        className="marca-logo"
        src={FUENTES[indice]}
        alt="Belaunzaran SA"
        decoding="async"
        draggable={false}
        onError={() => setIndice((i) => i + 1)}
      />
    </div>
  )
}
