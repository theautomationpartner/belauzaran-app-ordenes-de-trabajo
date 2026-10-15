/**
 * Gráficos del dashboard de hacienda, en SVG propio (sin librería): pocos tipos, todos con tooltip
 * al pasar y clic para ver los movimientos que forman cada barra.
 *
 * Reglas de forma que siguen todos: un solo eje, barras finas con la punta redondeada sobre la
 * línea base, 2px de separación entre segmentos apilados, grilla tenue y el texto siempre en tinta
 * de texto (el color identifica la serie, nunca pinta números ni rótulos).
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { COLOR_EGRESO, COLOR_INGRESO, COLOR_TIPO, rotuloMes, rotuloMesLargo, type FilaMes, type TipoMovimiento } from '@/lib/hacienda'

export const cab = (n: number) => `${n.toLocaleString('es-AR')} cab.`

/** Ancho real del contenedor, para dibujar el SVG a su medida (y re-dibujarlo si cambia). */
export function useAncho<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, ancho]
}

/** Escala "linda" para el eje: 0, 5, 10, 20, 25, 50, 100… */
function tope(max: number): { max: number; paso: number } {
  if (max <= 0) return { max: 4, paso: 1 }
  const crudo = max / 4
  const pot = 10 ** Math.floor(Math.log10(crudo))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= crudo) ?? 10 * pot
  return { max: Math.ceil(max / paso) * paso, paso }
}

/** Rectángulo con las dos esquinas de la punta redondeadas (la que no toca la línea base). */
function barra(x: number, y: number, w: number, h: number, arriba: boolean, r = 4): string {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  if (arriba) {
    return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
  }
  return `M${x},${y} V${y + h - rr} Q${x},${y + h} ${x + rr},${y + h} H${x + w - rr} Q${x + w},${y + h} ${x + w},${y + h - rr} V${y} Z`
}

export function Leyenda({ items }: { items: { color: string; texto: string }[] }) {
  return (
    <div className="hc-leyenda">
      {items.map((i) => (
        <span key={i.texto} className="hc-leyenda-item">
          <span className="hc-punto" style={{ background: i.color }} />
          {i.texto}
        </span>
      ))}
    </div>
  )
}

function Tooltip({ x, y, ancho, children }: { x: number; y: number; ancho: number; children: ReactNode }) {
  // Se da vuelta para no salirse por la derecha.
  const izquierda = x > ancho - 200
  return (
    <div className="hc-tooltip" style={{ left: izquierda ? undefined : x + 12, right: izquierda ? ancho - x + 12 : undefined, top: y }}>
      {children}
    </div>
  )
}

/* ===================================================================== */
/* Evolución mensual: ingresos hacia arriba, egresos hacia abajo          */
/* ===================================================================== */

const ARRIBA: TipoMovimiento[] = ['Compra', 'Nacimiento']
const ABAJO: TipoMovimiento[] = ['Venta', 'Muerte']

/**
 * Barras divergentes por mes: compras y nacimientos apilados hacia arriba, ventas y muertes hacia
 * abajo, sobre la misma línea de cero. Se lee de un vistazo si el rodeo crece o se achica cada
 * mes. Las recategorizaciones no van acá: no cambian la cantidad de cabezas.
 */
export function GraficoMensual({ filas, onMes }: { filas: FilaMes[]; onMes: (f: FilaMes) => void }) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const alto = 260
  const m = { izq: 44, der: 8, arr: 12, aba: 26 }

  const sube = filas.map((f) => ARRIBA.reduce((a, t) => a + (f.cabezas[t] ?? 0), 0))
  const baja = filas.map((f) => ABAJO.reduce((a, t) => a + (f.cabezas[t] ?? 0), 0))
  const escala = tope(Math.max(1, ...sube, ...baja))
  const util = alto - m.arr - m.aba
  const cero = m.arr + util / 2
  const y = (v: number) => (v / escala.max) * (util / 2)

  const w = Math.max(0, ancho - m.izq - m.der)
  const paso = filas.length ? w / filas.length : 0
  const bw = Math.max(4, Math.min(36, paso * 0.6))
  // Rótulos del eje x salteados si no entran.
  const cada = Math.max(1, Math.ceil(filas.length / Math.max(1, Math.floor(w / 46))))
  const ticks = [escala.max, escala.max / 2, 0, -escala.max / 2, -escala.max]

  return (
    <div className="hc-grafico" ref={ref} onMouseLeave={() => setHover(null)}>
      {ancho > 0 && (
        <svg width={ancho} height={alto} role="img" aria-label="Cabezas por mes: ingresos y egresos">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.izq} x2={ancho - m.der} y1={cero - y(t)} y2={cero - y(t)} className={t === 0 ? 'hc-eje' : 'hc-grilla'} />
              <text x={m.izq - 6} y={cero - y(t) + 4} className="hc-tick" textAnchor="end">
                {Math.abs(t).toLocaleString('es-AR')}
              </text>
            </g>
          ))}
          {filas.map((f, i) => {
            const cx = m.izq + paso * i + paso / 2
            const x = cx - bw / 2
            let acum = 0
            const segs: ReactNode[] = []
            ARRIBA.forEach((t, k) => {
              const v = f.cabezas[t] ?? 0
              if (!v) return
              const h = y(v)
              const esUltimo = ARRIBA.slice(k + 1).every((u) => !(f.cabezas[u] ?? 0))
              // 2px de separación entre segmentos: el blanco los distingue además del color.
              const hh = Math.max(1, h - (acum > 0 ? 2 : 0))
              segs.push(
                esUltimo ? (
                  <path key={t} d={barra(x, cero - acum - h, bw, hh, true)} fill={COLOR_TIPO[t]} />
                ) : (
                  <rect key={t} x={x} y={cero - acum - h} width={bw} height={hh} fill={COLOR_TIPO[t]} />
                ),
              )
              acum += h
            })
            acum = 0
            ABAJO.forEach((t, k) => {
              const v = f.cabezas[t] ?? 0
              if (!v) return
              const h = y(v)
              const esUltimo = ABAJO.slice(k + 1).every((u) => !(f.cabezas[u] ?? 0))
              const off = acum > 0 ? 2 : 0
              segs.push(
                esUltimo ? (
                  <path key={t} d={barra(x, cero + acum + off, bw, Math.max(1, h - off), false)} fill={COLOR_TIPO[t]} />
                ) : (
                  <rect key={t} x={x} y={cero + acum + off} width={bw} height={Math.max(1, h - off)} fill={COLOR_TIPO[t]} />
                ),
              )
              acum += h
            })
            return (
              <g key={f.mes}>
                {hover === i && <rect x={cx - paso / 2} y={m.arr} width={paso} height={util} className="hc-hover" />}
                {segs}
                {i % cada === 0 && (
                  <text x={cx} y={alto - 8} className="hc-tick" textAnchor="middle">
                    {rotuloMes(f.mes)}
                  </text>
                )}
                {/* Blanco de toque más grande que la barra: toda la columna del mes. */}
                <rect
                  x={cx - paso / 2}
                  y={m.arr}
                  width={paso}
                  height={util}
                  fill="transparent"
                  style={{ cursor: f.movimientos.length ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => f.movimientos.length && onMes(f)}
                />
              </g>
            )
          })}
        </svg>
      )}
      {hover != null && filas[hover] && (
        <Tooltip x={m.izq + paso * hover + paso / 2} y={20} ancho={ancho}>
          <div className="hc-tooltip-tit">{rotuloMesLargo(filas[hover].mes)}</div>
          {[...ARRIBA, ...ABAJO].map((t) => (
            <div className="hc-tooltip-fila" key={t}>
              <span className="hc-punto" style={{ background: COLOR_TIPO[t] }} />
              <span>{t}</span>
              <strong>{cab(filas[hover].cabezas[t] ?? 0)}</strong>
            </div>
          ))}
          <div className="hc-tooltip-fila hc-tooltip-total">
            <span>Variación</span>
            <strong>
              {sube[hover] - baja[hover] > 0 ? '+' : ''}
              {cab(sube[hover] - baja[hover])}
            </strong>
          </div>
          {filas[hover].movimientos.length > 0 && <div className="hc-tooltip-nota">Clic para ver los movimientos</div>}
        </Tooltip>
      )}
    </div>
  )
}

/* ===================================================================== */
/* Barras horizontales de dos series (comparativa, campos)                */
/* ===================================================================== */

export interface FilaBarras {
  rotulo: string
  a: number
  b: number
  /** Texto extra en el tooltip. */
  nota?: string
  onClick?: () => void
}

/**
 * Pares de barras horizontales por fila (dos series, mismo eje desde cero). Se usa para comparar
 * un período contra otro y para ingresos contra egresos por campo. El valor va escrito al final
 * de cada barra en tinta de texto.
 */
export function BarrasPares({
  filas,
  serieA,
  serieB,
}: {
  filas: FilaBarras[]
  serieA: { nombre: string; color: string }
  serieB: { nombre: string; color: string }
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const rotuloAncho = Math.min(150, Math.max(90, ancho * 0.28))
  const valorAncho = 64
  const bh = 10
  const fila = 2 * bh + 2 + 16
  const alto = filas.length * fila + 4
  const escala = tope(Math.max(1, ...filas.flatMap((f) => [f.a, f.b])))
  const w = Math.max(0, ancho - rotuloAncho - valorAncho)
  const x = (v: number) => (v / escala.max) * w

  return (
    <div className="hc-grafico" ref={ref} onMouseLeave={() => setHover(null)}>
      {ancho > 0 && (
        <svg width={ancho} height={alto} role="img" aria-label={`${serieA.nombre} y ${serieB.nombre}`}>
          {filas.map((f, i) => {
            const y0 = i * fila + 4
            return (
              <g key={f.rotulo}>
                {hover === i && <rect x={0} y={y0 - 4} width={ancho} height={fila} className="hc-hover" />}
                <text x={rotuloAncho - 8} y={y0 + bh + 4} className="hc-rotulo" textAnchor="end">
                  {f.rotulo.length > 22 ? `${f.rotulo.slice(0, 21)}…` : f.rotulo}
                </text>
                <path d={barraH(rotuloAncho, y0, x(f.a), bh)} fill={serieA.color} />
                <text x={rotuloAncho + x(f.a) + 6} y={y0 + bh - 1} className="hc-valor">
                  {f.a.toLocaleString('es-AR')}
                </text>
                <path d={barraH(rotuloAncho, y0 + bh + 2, x(f.b), bh)} fill={serieB.color} />
                <text x={rotuloAncho + x(f.b) + 6} y={y0 + 2 * bh + 1} className="hc-valor">
                  {f.b.toLocaleString('es-AR')}
                </text>
                <rect
                  x={0}
                  y={y0 - 4}
                  width={ancho}
                  height={fila}
                  fill="transparent"
                  style={{ cursor: f.onClick ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHover(i)}
                  onClick={f.onClick}
                />
              </g>
            )
          })}
        </svg>
      )}
      {hover != null && filas[hover] && (
        <Tooltip x={rotuloAncho + Math.max(x(filas[hover].a), x(filas[hover].b))} y={hover * fila} ancho={ancho}>
          <div className="hc-tooltip-tit">{filas[hover].rotulo}</div>
          <div className="hc-tooltip-fila">
            <span className="hc-punto" style={{ background: serieA.color }} />
            <span>{serieA.nombre}</span>
            <strong>{cab(filas[hover].a)}</strong>
          </div>
          <div className="hc-tooltip-fila">
            <span className="hc-punto" style={{ background: serieB.color }} />
            <span>{serieB.nombre}</span>
            <strong>{cab(filas[hover].b)}</strong>
          </div>
          {filas[hover].nota && <div className="hc-tooltip-nota">{filas[hover].nota}</div>}
          {filas[hover].onClick && <div className="hc-tooltip-nota">Clic para ver los movimientos</div>}
        </Tooltip>
      )}
    </div>
  )
}

/** Barra horizontal con la punta derecha redondeada. */
function barraH(x: number, y: number, w: number, h: number, r = 4): string {
  if (w <= 0) return `M${x},${y} H${x + 1} V${y + h} H${x} Z`
  const rr = Math.min(r, h / 2, w)
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`
}

export const SERIE_INGRESOS = { nombre: 'Ingresos', color: COLOR_INGRESO }
export const SERIE_EGRESOS = { nombre: 'Egresos', color: COLOR_EGRESO }
