import { useMemo, useState, type CSSProperties } from 'react'
import type { Campo } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { SelectorMultiple } from '@/components/ui/SelectorMultiple'
import { fecha, plural } from '@/lib/format'
import {
  COLOR_EGRESO,
  COLOR_INGRESO,
  COLOR_TIPO,
  MESES_LARGOS,
  RAMAS,
  TIPOS,
  aniosDe,
  cabezasEntre,
  esEgreso,
  esIngreso,
  etiquetaDe,
  filtrar,
  indicadores,
  planilla,
  porCampo,
  porMes,
  rangoDe,
  rotuloMesLargo,
  totalesDe,
  transiciones,
  type FiltrosHacienda,
  type Movimiento,
  type OpcionesHacienda,
  type Periodo,
} from '@/lib/hacienda'
import { BarrasPares, GraficoMensual, Leyenda, SERIE_EGRESOS, SERIE_INGRESOS, cab } from './graficos'
import { ListaMovimientos } from './ListaMovimientos'

interface Props {
  movimientos: Movimiento[]
  opciones: OpcionesHacienda
  campos: Campo[]
  onRecargar: () => void
  cargando: boolean
}

const PERIODOS: { id: Periodo; texto: string }[] = [
  { id: 'mes', texto: 'Este mes' },
  { id: '3m', texto: 'Últimos 3 meses' },
  { id: 'anio', texto: 'Este año' },
  { id: '12m', texto: 'Últimos 12 meses' },
  { id: 'todo', texto: 'Todo' },
  { id: 'personalizado', texto: 'Personalizado' },
]

/** Detalle abierto en la ventana emergente: un título y los movimientos que lo forman. */
interface Detalle {
  titulo: string
  subtitulo?: string
  movs: Movimiento[]
}

/** Indicador clickeable: abre los movimientos que suma. */
function Indicador({
  titulo,
  valor,
  detalle,
  color,
  icono,
  onClick,
  fuerte,
}: {
  titulo: string
  valor: string
  detalle: string
  color?: string
  icono: string
  onClick?: () => void
  fuerte?: boolean
}) {
  return (
    <button
      type="button"
      className={`hc-kpi ${fuerte ? 'hc-kpi--fuerte' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      style={color ? ({ '--kpi': color } as CSSProperties) : undefined}
    >
      <span className="hc-kpi-ic">
        <i className={`fas fa-${icono}`} aria-hidden />
      </span>
      <span className="hc-kpi-body">
        <span className="hc-kpi-tit">{titulo}</span>
        <span className="hc-kpi-val">{valor}</span>
        <span className="hc-kpi-det">{detalle}</span>
      </span>
      {onClick && <i className="fas fa-chevron-right hc-kpi-flecha" aria-hidden />}
    </button>
  )
}

const ICONO: Record<string, string> = {
  Compra: 'cart-shopping',
  Nacimiento: 'baby',
  'Cambio de categoría': 'arrows-rotate',
  Venta: 'hand-holding-dollar',
  Muerte: 'skull-crossbones',
}

const signo = (n: number) => (n > 0 ? `+${n.toLocaleString('es-AR')}` : n.toLocaleString('es-AR'))

/**
 * Dashboard de hacienda: indicadores, evolución mensual, comparativa entre períodos, la planilla
 * de existencias, los cambios de categoría y el detalle por campo, todo filtrable por período,
 * campo, categoría y tipo de movimiento. Cada número que se puede tocar abre los movimientos que
 * lo forman.
 */
export function Dashboard({ movimientos, opciones, campos, onRecargar, cargando }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('anio')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [fCampos, setFCampos] = useState<string[]>([])
  const [fCategorias, setFCategorias] = useState<string[]>([])
  const [fTipos, setFTipos] = useState<string[]>([])
  const [detalle, setDetalle] = useState<Detalle | null>(null)

  const rango = periodo === 'personalizado' ? { desde: desde || null, hasta: hasta || null } : rangoDe(periodo)
  const filtros: FiltrosHacienda = { ...rango, campos: fCampos, categorias: fCategorias, tipos: fTipos }
  /* Los filtros se arman en cada render; la clave de texto evita refiltrar si no cambió nada. */
  const claveFiltros = JSON.stringify(filtros)
  const lista = useMemo(() => filtrar(movimientos, JSON.parse(claveFiltros) as FiltrosHacienda), [movimientos, claveFiltros])
  const ind = indicadores(lista)
  const meses = porMes(lista, rango.desde, rango.hasta)
  const filasPlanilla = planilla(lista, opciones.categorias)
  const filasCampo = porCampo(lista)
  const trans = transiciones(lista, movimientos)

  /* Comparativa: filtra igual por campo, categoría y tipo, pero el período lo eligen acá. */
  const sinPeriodo = useMemo(
    () => filtrar(movimientos, { desde: null, hasta: null, campos: fCampos, categorias: fCategorias, tipos: fTipos }),
    [movimientos, fCampos, fCategorias, fTipos],
  )
  const anios = aniosDe(movimientos)
  const anioActual = new Date().getFullYear()
  const [mesComp, setMesComp] = useState<number | null>(null)
  const [anioA, setAnioA] = useState<number>(anioActual - 1)
  const [anioB, setAnioB] = useState<number>(anioActual)
  const opcionesAnio = [...new Set([...anios, anioActual - 1, anioActual])].sort()
  const compA = totalesDe(sinPeriodo, anioA, mesComp)
  const compB = totalesDe(sinPeriodo, anioB, mesComp)
  const rotuloComp = (a: number) => (mesComp ? `${MESES_LARGOS[mesComp - 1]} ${a}` : String(a))

  const opCampos = useMemo(() => {
    const usados = new Set(movimientos.map((m) => m.campo).filter(Boolean))
    return campos
      .map((c) => c.nombre)
      .filter((n) => usados.has(n))
      .map((n) => ({ id: n, nombre: n, detalle: plural(movimientos.filter((m) => m.campo === n).length, 'movimiento', 'movimientos') }))
  }, [movimientos, campos])
  const opCategorias = opciones.categorias.map((c) => ({ id: c, nombre: c }))

  const hayFiltro = fCampos.length + fCategorias.length + fTipos.length > 0 || periodo !== 'anio'
  const limpiar = () => {
    setPeriodo('anio')
    setDesde('')
    setHasta('')
    setFCampos([])
    setFCategorias([])
    setFTipos([])
  }
  const textoPeriodo =
    rango.desde || rango.hasta ? `${rango.desde ? fecha(rango.desde) : 'el inicio'} al ${rango.hasta ? fecha(rango.hasta) : 'hoy'}` : 'todo el historial'

  const abrir = (titulo: string, movs: Movimiento[], subtitulo?: string) =>
    movs.length > 0 && setDetalle({ titulo, movs, subtitulo })

  return (
    <div className="view hacienda">
      {/* ===== Filtros ===== */}
      <div className="card card--input hc-filtros">
        <div className="hc-filtros-fila">
          <div className="ig" style={{ flex: '1 1 100%' }}>
            <span className="ig-lbl">Período</span>
            <div className="hc-segmentos" role="radiogroup" aria-label="Período">
              {PERIODOS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  role="radio"
                  aria-checked={periodo === p.id}
                  className={`hc-segmento ${periodo === p.id ? 'hc-segmento--activo' : ''}`}
                  onClick={() => setPeriodo(p.id)}
                >
                  {p.texto}
                </button>
              ))}
            </div>
            {periodo === 'personalizado' && (
              <div className="hc-fechas">
                <label className="ig">
                  <span className="ig-hint">Desde</span>
                  <input className="fc" type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
                </label>
                <label className="ig">
                  <span className="ig-hint">Hasta</span>
                  <input className="fc" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="hc-filtros-grid">
          <div className="ig">
            <span className="ig-lbl">Campo</span>
            <SelectorMultiple opciones={opCampos} valores={fCampos} onCambio={setFCampos} placeholder="Todos los campos" vacio="Todavía no hay movimientos con campo." />
          </div>
          <div className="ig">
            <span className="ig-lbl">Categoría</span>
            <SelectorMultiple opciones={opCategorias} valores={fCategorias} onCambio={setFCategorias} placeholder="Todas las categorías" />
          </div>
          <div className="ig">
            <span className="ig-lbl">Tipo de movimiento</span>
            <div className="hc-tipos">
              {TIPOS.map((t) => {
                const activo = fTipos.includes(t)
                return (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={activo}
                    className={`hc-tipo ${activo ? 'hc-tipo--activo' : ''}`}
                    onClick={() => setFTipos(activo ? fTipos.filter((x) => x !== t) : [...fTipos, t])}
                  >
                    <span className="hc-punto" style={{ background: COLOR_TIPO[t] }} />
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="hc-filtros-pie">
          <span className="muted">
            {plural(lista.length, 'movimiento', 'movimientos')} · del {textoPeriodo}
          </span>
          <span style={{ display: 'inline-flex', gap: 6 }}>
            {hayFiltro && (
              <button type="button" className="btn btn-ghost btn--sm" onClick={limpiar}>
                <i className="fas fa-xmark" aria-hidden /> Limpiar filtros
              </button>
            )}
            <button type="button" className="btn btn-ghost btn--sm" onClick={onRecargar} disabled={cargando}>
              <i className={`fas fa-rotate-right ${cargando ? 'fa-spin' : ''}`} aria-hidden /> Actualizar datos
            </button>
          </span>
        </div>
      </div>

      {/* ===== Indicadores ===== */}
      <div className="hc-kpis hc-kpis--principales">
        <Indicador
          fuerte
          titulo="Ingresos"
          valor={cab(ind.ingresos.cabezas)}
          detalle={`Compras y nacimientos · ${plural(ind.ingresos.movimientos, 'movimiento', 'movimientos')}`}
          color={COLOR_INGRESO}
          icono="arrow-trend-up"
          onClick={() => abrir('Ingresos', lista.filter((m) => esIngreso(m.tipo)), 'Compras y nacimientos del período')}
        />
        <Indicador
          fuerte
          titulo="Egresos"
          valor={cab(ind.egresos.cabezas)}
          detalle={`Ventas y muertes · ${plural(ind.egresos.movimientos, 'movimiento', 'movimientos')}`}
          color={COLOR_EGRESO}
          icono="arrow-trend-down"
          onClick={() => abrir('Egresos', lista.filter((m) => esEgreso(m.tipo)), 'Ventas y muertes del período')}
        />
        <Indicador
          fuerte
          titulo="Variación del rodeo"
          valor={`${signo(ind.neto)} cab.`}
          detalle="Ingresos menos egresos (las recategorizaciones no cambian el total)"
          icono="scale-balanced"
        />
      </div>
      <div className="hc-kpis">
        {TIPOS.map((t) => {
          const s = ind.porTipo[t]
          return (
            <Indicador
              key={t}
              titulo={t}
              valor={cab(s.cabezas)}
              detalle={plural(s.movimientos, 'movimiento', 'movimientos')}
              color={COLOR_TIPO[t]}
              icono={ICONO[t]}
              onClick={s.movimientos ? () => abrir(t, lista.filter((m) => m.tipo === t)) : undefined}
            />
          )
        })}
      </div>

      {lista.length === 0 ? (
        <div className="card card--data" style={{ textAlign: 'center' }}>
          <i className="fas fa-filter-circle-xmark" style={{ fontSize: 26, color: '#98a2b3' }} aria-hidden />
          <p className="muted" style={{ marginTop: 8 }}>
            No hay movimientos con estos filtros. Probá con otro período (por ejemplo, "Todo").
          </p>
        </div>
      ) : (
        <>
          {/* ===== Evolución mensual ===== */}
          <section className="card hc-card">
            <div className="hc-card-head">
              <div>
                <div className="ctitle">Evolución mensual del rodeo</div>
                <div className="csub">Cabezas que ingresan (arriba) y egresan (abajo) cada mes. Tocá un mes para ver sus movimientos.</div>
              </div>
              <Leyenda items={['Compra', 'Nacimiento', 'Venta', 'Muerte'].map((t) => ({ color: COLOR_TIPO[t as 'Compra'], texto: t }))} />
            </div>
            <GraficoMensual filas={meses} onMes={(f) => abrir(rotuloMesLargo(f.mes), f.movimientos)} />
          </section>

          {/* ===== Planilla de existencias ===== */}
          <section className="card hc-card">
            <div className="ctitle">Planilla de existencias del período</div>
            <div className="csub">
              Por categoría, como la planilla de existencias: ingresos (recategorización, compras, nacimientos) y egresos
              (recategorización, ventas, muertes). La variación es lo que cambió cada categoría; el stock inicial no surge de
              los movimientos. Tocá una fila para ver sus movimientos.
            </div>
            <div className="tabla-wrap">
              <div className="tabla-scroll">
                <table className="tabla tabla--compacta hc-planilla hc-tabla-fija">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th className="num">Ingr. recat.</th>
                      <th className="num">Compras</th>
                      <th className="num">Nacim.</th>
                      <th className="num hc-col-total">Total ingresos</th>
                      <th className="num">Egr. recat.</th>
                      <th className="num">Ventas</th>
                      <th className="num">Muertes</th>
                      <th className="num hc-col-total">Total egresos</th>
                      <th className="num">Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasPlanilla.map((f) => (
                      <tr key={f.categoria} className="hc-fila" onClick={() => abrir(f.categoria, f.movimientos, 'Movimientos de la categoría en el período')}>
                        <td data-lbl="Categoría" className="font-b">{f.categoria}</td>
                        <td data-lbl="Ingr. recat." className="num">{f.ingresosRecat || '—'}</td>
                        <td data-lbl="Compras" className="num">{f.compras || '—'}</td>
                        <td data-lbl="Nacim." className="num">{f.nacimientos || '—'}</td>
                        <td data-lbl="Total ingresos" className="num font-b hc-col-total">{f.totalIngresos}</td>
                        <td data-lbl="Egr. recat." className="num">{f.egresosRecat || '—'}</td>
                        <td data-lbl="Ventas" className="num">{f.ventas || '—'}</td>
                        <td data-lbl="Muertes" className="num">{f.muertes || '—'}</td>
                        <td data-lbl="Total egresos" className="num font-b hc-col-total">{f.totalEgresos}</td>
                        <td data-lbl="Variación" className={`num font-b ${f.variacion > 0 ? 't-green' : f.variacion < 0 ? 't-red' : ''}`}>
                          {signo(f.variacion)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const s = (k: 'ingresosRecat' | 'compras' | 'nacimientos' | 'totalIngresos' | 'egresosRecat' | 'ventas' | 'muertes' | 'totalEgresos' | 'variacion') =>
                        filasPlanilla.reduce((a, f) => a + f[k], 0)
                      return (
                        <tr>
                          <td>Total</td>
                          <td className="num">{s('ingresosRecat')}</td>
                          <td className="num">{s('compras')}</td>
                          <td className="num">{s('nacimientos')}</td>
                          <td className="num hc-col-total">{s('totalIngresos')}</td>
                          <td className="num">{s('egresosRecat')}</td>
                          <td className="num">{s('ventas')}</td>
                          <td className="num">{s('muertes')}</td>
                          <td className="num hc-col-total">{s('totalEgresos')}</td>
                          <td className="num">{signo(s('variacion'))}</td>
                        </tr>
                      )
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          </section>

          {/* ===== Cambios de categoría ===== */}
          <section className="card hc-card">
            <div className="ctitle">Cambios de categoría</div>
            <div className="csub">
              El ciclo de cada rama con las cabezas recategorizadas en el período. Tocá una flecha o una fila para ver los
              movimientos.
            </div>
            <div className="hc-ramas">
              {RAMAS.map((r) => (
                <div className="hc-rama" key={r.nombre}>
                  <span className="hc-rama-tit">{r.nombre}</span>
                  <div className="hc-cadena">
                    {r.cadena.map((c, i) => {
                      const etiqueta = etiquetaDe(opciones.categorias, c) ?? c
                      const sig = r.cadena[i + 1]
                      const t = sig ? cabezasEntre(trans, c, sig) : null
                      return (
                        <span className="hc-eslabon" key={c}>
                          <span className="hc-nodo">{etiqueta}</span>
                          {sig && (
                            <button
                              type="button"
                              className={`hc-flecha ${t ? 'hc-flecha--activa' : ''}`}
                              disabled={!t}
                              onClick={() => t && abrir(`${t.origen} → ${t.destino}`, t.detalle, 'Recategorizaciones del período')}
                              title={t ? `${cab(t.cabezas)} en ${plural(t.movimientos, 'movimiento', 'movimientos')}` : 'Sin recategorizaciones en el período'}
                            >
                              <span className="hc-flecha-val">{t ? t.cabezas.toLocaleString('es-AR') : '0'}</span>
                              <i className="fas fa-arrow-right" aria-hidden />
                            </button>
                          )}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {trans.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>No hay cambios de categoría en el período.</p>
            ) : (
              <div className="tabla-wrap" style={{ marginTop: 14 }}>
                <div className="tabla-scroll">
                  <table className="tabla tabla--compacta hc-tabla-fija">
                    <thead>
                      <tr>
                        <th>Cambio</th>
                        <th className="num">Movimientos</th>
                        <th className="num">Cabezas</th>
                        <th>Primero · Último</th>
                        <th className="num">Cada cuánto</th>
                        <th className="num">Tiempo en la categoría</th>
                        <th>Campos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trans.map((t) => (
                        <tr key={`${t.origen}→${t.destino}`} className="hc-fila" onClick={() => abrir(`${t.origen} → ${t.destino}`, t.detalle, 'Recategorizaciones del período')}>
                          <td data-lbl="Cambio" className="font-b">
                            {t.origen} → {t.destino}
                          </td>
                          <td data-lbl="Movimientos" className="num">{t.movimientos}</td>
                          <td data-lbl="Cabezas" className="num font-b">{t.cabezas.toLocaleString('es-AR')}</td>
                          <td data-lbl="Primero · Último">
                            {fecha(t.primera)}
                            {t.ultima !== t.primera && ` · ${fecha(t.ultima)}`}
                          </td>
                          <td data-lbl="Cada cuánto" className="num">
                            {t.diasEntreMovimientos != null ? `cada ${t.diasEntreMovimientos} días` : '—'}
                          </td>
                          <td data-lbl="Tiempo en la categoría" className="num">
                            {t.permanenciaDias != null ? (
                              <>
                                {t.permanenciaDias} días
                                {t.coberturaPermanencia < 0.999 && (
                                  <span className="xs" style={{ display: 'block' }}>
                                    sobre el {Math.round(t.coberturaPermanencia * 100)}% de las cabezas
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="muted">Sin ingreso previo</span>
                            )}
                          </td>
                          <td data-lbl="Campos">{t.campos.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="ig-hint" style={{ marginTop: 8 }}>
              <strong>Cada cuánto</strong>: días promedio entre una recategorización y la siguiente. <strong>Tiempo en la
              categoría</strong>: estimado por orden de llegada (lo primero que entró a la categoría en ese campo es lo primero
              que pasa), desde su nacimiento, compra o recategorización anterior.
            </p>
          </section>

          {/* ===== Comparativa ===== */}
          <section className="card hc-card">
            <div className="hc-card-head">
              <div>
                <div className="ctitle">Comparativa entre períodos</div>
                <div className="csub">Mismo mes (o año completo) de dos años distintos, por tipo de movimiento. Respeta los filtros de campo, categoría y tipo.</div>
              </div>
              <div className="hc-comp-sel">
                <select className="fc" value={mesComp ?? ''} onChange={(e) => setMesComp(e.target.value ? Number(e.target.value) : null)} aria-label="Mes">
                  <option value="">Año completo</option>
                  {MESES_LARGOS.map((mm, i) => (
                    <option key={mm} value={i + 1}>{mm}</option>
                  ))}
                </select>
                <select className="fc" value={anioA} onChange={(e) => setAnioA(Number(e.target.value))} aria-label="Primer año">
                  {opcionesAnio.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <span className="muted">vs</span>
                <select className="fc" value={anioB} onChange={(e) => setAnioB(Number(e.target.value))} aria-label="Segundo año">
                  {opcionesAnio.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <Leyenda items={[{ color: '#2a78d6', texto: rotuloComp(anioA) }, { color: '#eb6834', texto: rotuloComp(anioB) }]} />
            <BarrasPares
              serieA={{ nombre: rotuloComp(anioA), color: '#2a78d6' }}
              serieB={{ nombre: rotuloComp(anioB), color: '#eb6834' }}
              filas={TIPOS.map((t) => {
                const a = compA[t] ?? 0
                const b = compB[t] ?? 0
                const dif = a ? Math.round(((b - a) / a) * 100) : null
                return {
                  rotulo: t,
                  a,
                  b,
                  nota: dif == null ? (b ? 'Sin datos en el primer período' : undefined) : `Diferencia: ${dif > 0 ? '+' : ''}${dif}%`,
                }
              })}
            />
          </section>

          {/* ===== Por campo ===== */}
          <section className="card hc-card">
            <div className="hc-card-head">
              <div>
                <div className="ctitle">Por campo</div>
                <div className="csub">Ingresos y egresos de cabezas de cada campo. Tocá un campo para ver sus movimientos.</div>
              </div>
              <Leyenda items={[{ color: COLOR_INGRESO, texto: 'Ingresos' }, { color: COLOR_EGRESO, texto: 'Egresos' }]} />
            </div>
            <BarrasPares
              serieA={SERIE_INGRESOS}
              serieB={SERIE_EGRESOS}
              filas={filasCampo.map((f) => ({
                rotulo: f.campo,
                a: f.ingresos,
                b: f.egresos,
                nota: `Variación ${signo(f.neto)} · ${f.recategorizadas} cab. recategorizadas`,
                onClick: () => abrir(f.campo, f.movimientos, 'Movimientos del campo en el período'),
              }))}
            />
          </section>

          {/* ===== Movimientos ===== */}
          <section className="card hc-card">
            <div className="ctitle">Movimientos del período</div>
            <div className="csub">Tocá un movimiento para ver el responsable y las observaciones.</div>
            <ListaMovimientos movs={lista} buscador />
          </section>
        </>
      )}

      {detalle && (
        <Modal
          ancho
          titulo={detalle.titulo}
          subtitulo={
            <>
              {detalle.subtitulo ? `${detalle.subtitulo} · ` : ''}
              {plural(detalle.movs.length, 'movimiento', 'movimientos')} · {cab(detalle.movs.reduce((a, m) => a + m.cantidad, 0))}
            </>
          }
          onCerrar={() => setDetalle(null)}
        >
          <ListaMovimientos movs={detalle.movs} />
        </Modal>
      )}
    </div>
  )
}

