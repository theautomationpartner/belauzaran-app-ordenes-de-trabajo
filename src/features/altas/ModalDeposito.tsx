import { useState } from 'react'
import type { Cultivo, Deposito } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { SelectorBuscable, type OpcionSelector } from '@/components/ui/SelectorBuscable'
import { SelectorUbicacion } from '@/components/ui/SelectorUbicacion'
import type { BorradorDeposito, DepositoPendiente, Silo } from '@/services/monday/altas'

interface Props {
  cultivos: Cultivo[]
  /** El cultivo de la carga: el depósito se propone para ese cultivo. */
  cultivoInicial: string | null
  silos: Silo[]
  depositos: Deposito[]
  /** Depósito nuevo ya cargado antes, para editarlo. */
  inicial?: BorradorDeposito | null
  /** Datos validados. No se crea nada: se crea al confirmar la cosecha que lo usa. */
  onListo: (d: DepositoPendiente) => void
  onCerrar: () => void
}

/**
 * Datos de un destino de granos en depósito que no existe. Esta ventana NO crea nada: el depósito
 * (Activo, "Cultivo - Silo") se crea recién al confirmar la cosecha que lo usa.
 */
export function ModalDeposito({ cultivos, cultivoInicial, silos, depositos, inicial, onListo, onCerrar }: Props) {
  const [d, setD] = useState<BorradorDeposito>(
    () => inicial ?? { cultivoId: cultivoInicial, siloId: null, ubicacion: null },
  )
  const [mostrar, setMostrar] = useState(false)

  const cultivo = cultivos.find((c) => c.id === d.cultivoId) ?? null
  const silo = silos.find((s) => s.id === d.siloId) ?? null
  const nombre = cultivo && silo ? `${cultivo.nombre} - ${silo.nombre}` : null
  /* Repetido = mismo cultivo y mismo silo conectados. No se compara el nombre: hay depósitos
     escritos distinto que su silo ("Rural Ceres SA" vs "RURAL CERES S.A.") y se colarían. */
  const repetido =
    cultivo && silo
      ? depositos.find((x) => x.cultivoIds.includes(cultivo.id) && x.siloIds.includes(silo.id)) ?? null
      : null

  const faltan = [
    ...(!cultivo ? ['Elegí el cultivo.'] : []),
    ...(!silo ? ['Elegí el silo, silo bolsa, acopio o corredor.'] : []),
    ...(repetido ? [`Ya existe "${repetido.nombre}": elegilo de la lista en vez de crearlo.`] : []),
  ]

  const listo = () => {
    if (faltan.length > 0 || !cultivo || !silo) {
      setMostrar(true)
      return
    }
    onListo({ borrador: d, cultivo: { id: cultivo.id, nombre: cultivo.nombre }, silo: { id: silo.id, nombre: silo.nombre } })
  }

  const opCultivos: OpcionSelector[] = cultivos.map((c) => ({ id: c.id, nombre: c.nombre, chip: c.tipo || undefined, chipClase: 'chip--campo' }))
  const opSilos: OpcionSelector[] = silos.map((s) => ({ id: s.id, nombre: s.nombre, chip: s.tipo || undefined, chipClase: 'chip--ambar' }))

  return (
    <Modal
      ancho
      titulo={
        <>
          <i className="fas fa-warehouse" style={{ color: '#0e7c86' }} aria-hidden /> Agregar destino granos en depósito
        </>
      }
      subtitulo="Queda asignado ya, pero se crea en 🤖 Granos en Deposito (Activo) recién cuando confirmes la cosecha."
      onCerrar={onCerrar}
      textoCerrar="Cancelar"
      pie={
        <button type="button" className="btn btn-green" onClick={listo}>
          <i className="fas fa-check" aria-hidden /> Usar este destino
        </button>
      }
    >
      <div className="grid-campos">
        <div className="ig">
          <span className="ig-lbl ig-req">Cultivo</span>
          <SelectorBuscable
            opciones={opCultivos}
            valor={d.cultivoId}
            onCambio={(id) => setD((x) => ({ ...x, cultivoId: id }))}
            placeholder="Elegí el cultivo…"
          />
          {cultivoInicial && d.cultivoId !== cultivoInicial && (
            <span className="ig-hint" style={{ color: '#93370d' }}>
              No es el cultivo de la cosecha: así no se va a poder asignar a esta carga.
            </span>
          )}
        </div>
        <div className="ig">
          <span className="ig-lbl ig-req">Silo Bolsa - Silos - Acopio - Corredores</span>
          <SelectorBuscable
            opciones={opSilos}
            valor={d.siloId}
            onCambio={(id) => setD((x) => ({ ...x, siloId: id }))}
            placeholder="Elegí uno…"
          />
        </div>
      </div>

      <div className="ig" style={{ marginTop: 16 }}>
        <span className="ig-lbl">
          Ubicación <span className="chip chip--opcional">Opcional</span>
        </span>
        <SelectorUbicacion valor={d.ubicacion} onCambio={(u) => setD((x) => ({ ...x, ubicacion: u }))} />
      </div>

      {nombre && !repetido && (
        <div className="aviso aviso--info" style={{ marginTop: 14 }}>
          <i className="fas fa-tag" aria-hidden />
          <span>
            Se va a llamar <strong>{nombre}</strong>.
          </span>
        </div>
      )}
      {mostrar && faltan.length > 0 && (
        <div className="aviso aviso--error" style={{ marginTop: 12 }}>
          <i className="fas fa-circle-exclamation" aria-hidden />
          <span>
            Para continuar falta:
            <ul style={{ margin: '6px 0 0 18px' }}>
              {faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </span>
        </div>
      )}
      {repetido && !mostrar && (
        <div className="aviso aviso--warn" style={{ marginTop: 12 }}>
          <i className="fas fa-triangle-exclamation" aria-hidden />
          <span>Ya existe "{repetido.nombre}": elegilo de la lista en vez de crearlo.</span>
        </div>
      )}
    </Modal>
  )
}
