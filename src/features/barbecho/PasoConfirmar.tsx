import type { CambioNombre, PlanAsignacion } from '@/types'
import { PasoHeader } from '@/components/ui/PasoHeader'
import { plural } from '@/lib/format'
import { cambiosParaRevisar, esAnulacion, seRenombra, totalesDe } from '@/lib/barbecho'

interface Props {
  planes: PlanAsignacion[]
  onEditar: () => void
}

/**
 * Un renombre: el nombre de hoy arriba, tachado en el cultivo, y el que va a quedar abajo con el
 * cultivo nuevo resaltado. Se ve de un vistazo que lo único que cambia es ese tramo.
 */
function NombreCambio({ cambio }: { cambio: CambioNombre }) {
  if (!seRenombra(cambio)) {
    return (
      <div className="cambio">
        <span className="cambio-nuevo">{cambio.anterior}</span>
        <span className="xs">
          {cambio.via === 'igual'
            ? 'Ya tiene el cultivo nuevo en el nombre.'
            : 'No se encontró el cultivo en el nombre: queda como está.'}
        </span>
      </div>
    )
  }

  const [antes, cultivo, despues] = cambio.partes ?? [cambio.nuevo, '', '']
  /* Del nombre de hoy se tacha sólo el tramo que se reemplaza. Si se rearmó desde columnas no hay
     un tramo que corresponda, y se tacha el nombre entero. */
  const viejo =
    cambio.via === 'cultivo' && cambio.partes
      ? cambio.anterior.slice(antes.length, cambio.anterior.length - despues.length)
      : null

  return (
    <div className="cambio">
      <span className="cambio-viejo">
        {viejo != null ? (
          <>
            {antes}
            <s>{viejo}</s>
            {despues}
          </>
        ) : (
          <s>{cambio.anterior}</s>
        )}
      </span>
      <span className="cambio-nuevo">
        <i className="fas fa-arrow-turn-up fa-rotate-90" aria-hidden />
        {antes}
        <mark>{cultivo}</mark>
        {despues}
      </span>
      {cambio.via === 'columnas' && (
        <span className="chip chip--naranja cambio-aviso">Rearmado desde las columnas</span>
      )}
    </div>
  )
}

interface GrupoProps {
  titulo: string
  icono: string
  cambios: CambioNombre[]
  /** Qué más se escribe además del nombre (la columna de cultivo). */
  nota?: string
  /** Muestra los cambios plegados: los movimientos de stock llegan a ser 14 casi iguales. */
  plegado?: boolean
}

function GrupoCambios({ titulo, icono, cambios, nota, plegado = false }: GrupoProps) {
  if (cambios.length === 0) return null
  const cabeza = (
    <>
      <i className={`fas fa-${icono}`} aria-hidden />
      <span>{titulo}</span>
      <span className="grupo-cuenta">{cambios.length}</span>
      {nota && <span className="grupo-nota">{nota}</span>}
    </>
  )
  const lista = (
    <div className="grupo-lista">
      {cambios.map((c) => (
        <NombreCambio key={c.itemId} cambio={c} />
      ))}
    </div>
  )

  if (plegado) {
    return (
      <details className="grupo">
        <summary className="grupo-tit">
          {cabeza}
          <i className="fas fa-chevron-down grupo-caret" aria-hidden />
        </summary>
        {lista}
      </details>
    )
  }
  return (
    <div className="grupo">
      <div className="grupo-tit">{cabeza}</div>
      {lista}
    </div>
  )
}

/** Lo que pasa con una orden de producción: su cultivo y todos los renombres que arrastra. */
function TarjetaPlan({ plan }: { plan: PlanAsignacion }) {
  const anulaciones = plan.stock.filter((c) => esAnulacion(c.anterior)).length
  const stockNota =
    anulaciones > 0 ? `${plural(anulaciones, 'anulación', 'anulaciones')} incluida${anulaciones === 1 ? '' : 's'}` : undefined

  return (
    <div className="plan-card">
      <div className="plan-head">
        <span className="plan-nombre">{plan.op.lote || plan.op.nombre}</span>
        <span className="plan-cambio">
          <span className="chip chip--ambar">{plan.op.cultivo}</span>
          <i className="fas fa-arrow-right" aria-hidden />
          <span className="chip chip--campo">{plan.cultivo.nombre}</span>
        </span>
      </div>
      <div className="plan-body">
        <GrupoCambios
          titulo="Orden de producción"
          icono="seedling"
          cambios={[plan.nombreOp]}
          nota={`🤚 Cultivo → ${plan.cultivo.nombre}`}
        />
        <GrupoCambios
          titulo="Órdenes de trabajo"
          icono="file-lines"
          cambios={plan.ordenesTrabajo}
          nota={`✋ Cultivo → ${plan.cultivo.nombre}`}
        />
        <GrupoCambios
          titulo="Confirmaciones de trabajo"
          icono="clipboard-check"
          cambios={plan.confirmaciones}
          nota={`🤖Cultivo → ${plan.cultivo.nombre}`}
        />
        <GrupoCambios
          titulo="Movimientos de stock"
          icono="boxes-stacked"
          cambios={plan.stock}
          nota={stockNota}
          plegado={plan.stock.length > 3}
        />
      </div>
    </div>
  )
}

/**
 * Paso 2 — Lo que se va a escribir, item por item, antes de tocar nada.
 *
 * Se muestran los nombres exactos que van a quedar, no una descripción: si alguno sale raro, se
 * ve acá y no después en el tablero.
 */
export function PasoConfirmar({ planes, onEditar }: Props) {
  const totales = totalesDe(planes)
  const revisar = planes.flatMap(cambiosParaRevisar)

  return (
    <div className="view">
      <PasoHeader
        numero={2}
        titulo="Confirmar cambios"
        descripcion="Así van a quedar los nombres en monday. Nada se escribe hasta que confirmes."
      />

      <div className="metricas">
        <div className="metrica">
          <div className="metrica-ic metrica-ic--campo">
            <i className="fas fa-seedling" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Órdenes de producción</div>
            <div className="metrica-val">{totales.ordenesProduccion}</div>
          </div>
        </div>
        <div className="metrica">
          <div className="metrica-ic">
            <i className="fas fa-file-lines" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Órdenes de trabajo</div>
            <div className="metrica-val">{totales.ordenesTrabajo}</div>
          </div>
        </div>
        <div className="metrica">
          <div className="metrica-ic metrica-ic--violeta">
            <i className="fas fa-clipboard-check" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Confirmaciones</div>
            <div className="metrica-val">{totales.confirmaciones}</div>
          </div>
        </div>
        <div className="metrica">
          <div className="metrica-ic metrica-ic--naranja">
            <i className="fas fa-boxes-stacked" aria-hidden />
          </div>
          <div className="metrica-body">
            <div className="metrica-lbl">Movimientos de stock</div>
            <div className="metrica-val">{totales.stock}</div>
          </div>
        </div>
      </div>

      {revisar.length > 0 && (
        <div className="aviso aviso--warn" style={{ marginBottom: 16 }}>
          <i className="fas fa-triangle-exclamation" aria-hidden />
          <span>
            {plural(revisar.length, 'nombre no tiene', 'nombres no tienen')} el cultivo donde
            corresponde. Los que tienen columnas para hacerlo se rearman con ellas; el resto queda
            como está. Están marcados abajo.
          </span>
        </div>
      )}

      <div className="card card--summary">
        <div className="ctitle" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <i className="fas fa-list-check" style={{ color: '#00874d' }} aria-hidden />
            Cambios a aplicar
          </span>
          <button type="button" className="btn btn-ghost" onClick={onEditar}>
            <i className="fas fa-pen" aria-hidden /> Editar selección
          </button>
        </div>
        <div className="csub">
          Además del nombre, a cada orden de producción y de trabajo se le conecta el cultivo nuevo,
          y en las confirmaciones se escribe en la columna 🤖Cultivo.
        </div>

        <div className="plan-lista">
          {planes.map((p) => (
            <TarjetaPlan key={p.op.id} plan={p} />
          ))}
        </div>
      </div>

      <div className="aviso aviso--info">
        <i className="fas fa-circle-info" aria-hidden />
        <span>
          Se van a modificar {plural(totales.ordenesProduccion, 'orden de producción', 'órdenes de producción')},{' '}
          {plural(totales.ordenesTrabajo, 'orden de trabajo', 'órdenes de trabajo')},{' '}
          {plural(totales.confirmaciones, 'confirmación', 'confirmaciones')} y se renombran{' '}
          {plural(totales.stock, 'movimiento de stock', 'movimientos de stock')}.
        </span>
      </div>
    </div>
  )
}
