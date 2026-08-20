import { useEffect, type RefObject } from 'react'

/**
 * Cierra un panel flotante al tocar fuera de él. Escucha `pointerdown` —no `click`— para que el
 * cierre ocurra al apoyar el dedo, antes de que el navegador decida si eso fue un tap o un
 * arrastre: con `click` el menú quedaba abierto durante todo el scroll en el celular.
 */
export function useClickAfuera(
  ref: RefObject<HTMLElement>,
  activo: boolean,
  alCerrar: () => void,
): void {
  useEffect(() => {
    if (!activo) return
    const manejar = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) alCerrar()
    }
    document.addEventListener('pointerdown', manejar)
    return () => document.removeEventListener('pointerdown', manejar)
  }, [ref, activo, alCerrar])
}
