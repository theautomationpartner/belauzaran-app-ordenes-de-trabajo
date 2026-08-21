import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AvanceEmision, BorradorOrden, Catalogos, ResultadoOrden } from '@/types'
import { LogoEmpresa } from '@/components/ui/LogoEmpresa'
import { Stepper } from '@/components/ui/Stepper'
import { SelectorBuscable } from '@/components/ui/SelectorBuscable'
import { Paso1Datos } from '@/features/orden/Paso1Datos'
import { Paso2Productos } from '@/features/orden/Paso2Productos'
import { Paso3Campos } from '@/features/orden/Paso3Campos'
import { Paso4Emision } from '@/features/orden/Paso4Emision'
import { traerCatalogos } from '@/services/monday/catalogos'
import { mondayHabilitado } from '@/services/monday/sdk'
import { crearOrdenes } from '@/services/monday/crearOrdenes'
import {
  armarCarga,
  borradorInicial,
  expandirOrdenes,
  faltantesCampos,
  faltantesDatos,
  faltantesProductos,
} from '@/lib/orden'

const PASOS = ['Datos de la orden', 'Productos', 'Campos y lotes', 'Revisar y emitir'] as const

/** Única operación que resuelve la app hoy; el selector queda listo para sumar más. */
const OPERACIONES = [{ id: 'ORDEN_DE_TRABAJO', nombre: 'Cargar Orden de Trabajo' }]

type EstadoCarga =
  | { fase: 'cargando' }
  | { fase: 'listo'; catalogos: Catalogos }
  | { fase: 'error'; mensaje: string }

type EstadoEmision =
  | { fase: 'inactivo' }
  | { fase: 'enviando'; avance: AvanceEmision }
  | { fase: 'terminado'; resultados: ResultadoOrden[] }
  | { fase: 'error'; mensaje: string }

export function App() {
  const [operacion, setOperacion] = useState<string | null>('ORDEN_DE_TRABAJO')
  const [carga, setCarga] = useState<EstadoCarga>({ fase: 'cargando' })
  const [borrador, setBorrador] = useState<BorradorOrden>(borradorInicial)
  const [paso, setPaso] = useState(0)
  const [maxAlcanzado, setMaxAlcanzado] = useState(0)
  const [emision, setEmision] = useState<EstadoEmision>({ fase: 'inactivo' })
  /* Los faltantes se muestran recién cuando el usuario intenta avanzar: señalar errores antes de
     que llegue a completar el formulario es ruido, no ayuda. */
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false)

  const cargar = useCallback(() => {
    setCarga({ fase: 'cargando' })
    traerCatalogos()
      .then((catalogos) => setCarga({ fase: 'listo', catalogos }))
      .catch((e: unknown) =>
        setCarga({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) }),
      )
  }, [])

  useEffect(() => {
    if (!mondayHabilitado()) {
      setCarga({
        fase: 'error',
        mensaje:
          'No hay token de Monday configurado. Cargá VITE_MONDAY_TOKEN en .env.local y reiniciá el servidor de Vite.',
      })
      return
    }
    cargar()
  }, [cargar])

  const catalogos = carga.fase === 'listo' ? carga.catalogos : null

  /**
   * Aplica un cambio y limpia lo que ese cambio invalida.
   *
   * Los campos del paso 1 están encadenados: "realizado por" acota los proveedores y el proveedor
   * acota los contactos. Si cambia uno de arriba, lo de abajo deja de corresponder, y arrastrar el
   * valor viejo escribiría en Monday una combinación que el usuario nunca eligió.
   */
  const actualizar = (parcial: Partial<BorradorOrden>) => {
    setBorrador((prev) => {
      const proximo = { ...prev, ...parcial }
      if (parcial.realizadoPor !== undefined && parcial.realizadoPor !== prev.realizadoPor) {
        proximo.proveedorId = null
        proximo.contactoId = null
      }
      if (parcial.proveedorId !== undefined && parcial.proveedorId !== prev.proveedorId) {
        proximo.contactoId = null
      }
      return proximo
    })
    setEmision({ fase: 'inactivo' })
  }

  const faltantes = useMemo(() => {
    if (!catalogos) return []
    if (paso === 0) return faltantesDatos(borrador, catalogos)
    if (paso === 1) return faltantesProductos(borrador)
    if (paso === 2) return faltantesCampos(borrador)
    return []
  }, [paso, borrador, catalogos])

  const ordenes = useMemo(
    () => (catalogos ? expandirOrdenes(borrador, catalogos) : []),
    [borrador, catalogos],
  )

  const irA = (destino: number) => {
    setPaso(destino)
    setMaxAlcanzado((m) => Math.max(m, destino))
    setMostrarFaltantes(false)
  }

  const avanzar = () => {
    if (faltantes.length > 0) {
      setMostrarFaltantes(true)
      return
    }
    irA(Math.min(paso + 1, PASOS.length - 1))
  }

  const emitir = async () => {
    if (!catalogos) return
    const carga = armarCarga(borrador, catalogos)
    if (!carga) {
      setEmision({ fase: 'error', mensaje: 'La carga está incompleta.' })
      return
    }

    setEmision({
      fase: 'enviando',
      avance: { hechas: 0, total: carga.ordenes.length, actual: '' },
    })
    try {
      const resultados = await crearOrdenes(carga, (avance) =>
        setEmision({ fase: 'enviando', avance }),
      )
      setEmision({ fase: 'terminado', resultados })
    } catch (e: unknown) {
      setEmision({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) })
    }
  }

  const empezarDeNuevo = () => {
    setBorrador(borradorInicial())
    setPaso(0)
    setMaxAlcanzado(0)
    setEmision({ fase: 'inactivo' })
    setMostrarFaltantes(false)
  }

  const cabecera = (
    <header className="topbar">
      <div className="topbar-in">
        <div className="topbar-ctx">
          <div className="topsel-item">
            <span className="topsel-lbl">Seleccionar tipo de operación:</span>
            <div style={{ width: 260, maxWidth: '100%' }}>
              <SelectorBuscable
                opciones={OPERACIONES}
                valor={operacion}
                onCambio={(id) => setOperacion(id ?? 'ORDEN_DE_TRABAJO')}
                placeholder="Elegí la operación…"
                umbralBusqueda={99}
              />
            </div>
          </div>
        </div>
        <div className="topbar-marca">
          <LogoEmpresa />
        </div>
        {catalogos && (
          <div className="topbar-steps">
            <Stepper pasos={PASOS} actual={paso} maxAlcanzado={maxAlcanzado} onPaso={irA} />
          </div>
        )}
      </div>
    </header>
  )

  if (carga.fase !== 'listo') {
    return (
      <div className="app">
        {cabecera}
        <div className="pantalla-estado">
          {carga.fase === 'cargando' ? (
            <>
              <div className="spinner" />
              <h2>Cargando datos de Monday…</h2>
              <p>Labores, proveedores, cultivos, campañas, contactos, campos y productos.</p>
            </>
          ) : (
            <>
              <i className="fas fa-plug-circle-xmark" style={{ fontSize: 30, color: '#b42318' }} aria-hidden />
              <h2>No se pudieron traer los datos</h2>
              <p>{carga.mensaje}</p>
              <button type="button" className="btn btn-primary" onClick={cargar}>
                <i className="fas fa-rotate-right" aria-hidden /> Reintentar
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  /* Emisión terminada. Se detalla orden por orden en vez de dar un "listo" global: como los
     fallos no cortan el lote, puede haber órdenes creadas y otras no, y el usuario necesita
     saber exactamente cuáles rehacer. */
  if (emision.fase === 'terminado') {
    const creadas = emision.resultados.filter((r) => r.itemId)
    const fallidas = emision.resultados.filter((r) => !r.itemId)
    const subitems = creadas.reduce((acc, r) => acc + r.subitemsCreados, 0)

    return (
      <div className="app">
        {cabecera}
        <main className="scroll">
          <div className="view">
            <div className={`card ${fallidas.length === 0 ? 'card--summary' : 'card--data'}`}>
              <div className="ctitle">
                <i
                  className={`fas fa-${fallidas.length === 0 ? 'circle-check' : 'triangle-exclamation'}`}
                  style={{ color: fallidas.length === 0 ? '#00874d' : '#b25e09' }}
                  aria-hidden
                />
                {creadas.length} orden{creadas.length === 1 ? '' : 'es'} de trabajo creada
                {creadas.length === 1 ? '' : 's'}
                {fallidas.length > 0 && ` · ${fallidas.length} con error`}
              </div>
              <div className="csub">
                {subitems > 0 && `${subitems} producto${subitems === 1 ? '' : 's'} cargado${subitems === 1 ? '' : 's'} como subelementos. `}
                Todas quedaron en estado <strong>NO Enviar por Ahora</strong>.
              </div>

              <div className="resultados-lista">
                {emision.resultados.map((r) => (
                  <div
                    className={`resultado-orden ${r.itemId ? '' : 'resultado-orden--error'}`}
                    key={r.orden.loteId}
                  >
                    <i
                      className={`fas fa-${r.itemId ? 'circle-check' : 'circle-xmark'}`}
                      aria-hidden
                    />
                    <span className="resultado-orden-body">
                      <span className="font-b">{r.orden.loteNombre}</span>
                      <span className="xs">
                        {r.itemId
                          ? `${r.orden.campoNombre}${r.subitemsCreados > 0 ? ` · ${r.subitemsCreados} producto${r.subitemsCreados === 1 ? '' : 's'}` : ''}`
                          : r.error}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="acciones-bloque">
                <button type="button" className="btn btn-primary" onClick={empezarDeNuevo}>
                  <i className="fas fa-plus" aria-hidden /> Cargar otra orden
                </button>
                <a
                  className="btn btn-out"
                  href="https://belauzaransa.monday.com/boards/18410927171"
                  target="_blank"
                  rel="noreferrer"
                >
                  <i className="fas fa-arrow-up-right-from-square" aria-hidden /> Ver el tablero
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const enUltimoPaso = paso === PASOS.length - 1
  const bloqueado = faltantes.length > 0
  /* Después del guard de arriba `carga` ya está en la variante `listo`; se relee de ahí porque
     `catalogos` se derivó antes de esa comprobación y sigue admitiendo `null` para el tipador. */
  const datos = carga.catalogos

  return (
    <div className="app">
      {cabecera}

      <main className="scroll">
        {paso === 0 && (
          <Paso1Datos catalogos={datos} borrador={borrador} onCambio={actualizar} />
        )}
        {paso === 1 && (
          <Paso2Productos
            catalogos={datos}
            borrador={borrador}
            onCambio={actualizar}
            onEditarDatos={() => irA(0)}
          />
        )}
        {paso === 2 && (
          <Paso3Campos
            catalogos={datos}
            borrador={borrador}
            onCambio={actualizar}
            onEditarDatos={() => irA(0)}
          />
        )}
        {paso === 3 && (
          <Paso4Emision
            catalogos={datos}
            borrador={borrador}
            onCambio={actualizar}
            onEditarDatos={() => irA(0)}
            onEditarProductos={() => irA(1)}
            onEditarCampos={() => irA(2)}
          />
        )}

        {mostrarFaltantes && bloqueado && (
          <div className="aviso aviso--error view" style={{ marginTop: 16 }}>
            <i className="fas fa-circle-exclamation" aria-hidden />
            <span>
              Para continuar falta:
              <ul style={{ margin: '6px 0 0 18px' }}>
                {faltantes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </span>
          </div>
        )}

        {emision.fase === 'error' && (
          <div className="aviso aviso--error view" style={{ marginTop: 16 }}>
            <i className="fas fa-circle-exclamation" aria-hidden />
            <span>No se pudo emitir: {emision.mensaje}</span>
          </div>
        )}
      </main>

      <footer className="footbar">
        <div className="footbar-in">
          {/* Qué build está corriendo. Sin esto, saber si un deploy tomó el último commit
              obliga a adivinar mirando la pantalla. */}
          <span className="version" title="Versión desplegada">
            {__COMMIT__}
          </span>
          <span className={`footbar-msg ${bloqueado ? 'footbar-msg--bloqueo' : ''}`}>
            <i className={`fas fa-${bloqueado ? 'circle-exclamation' : 'arrow-turn-down'}`} aria-hidden />
            {bloqueado
              ? faltantes[0]
              : enUltimoPaso
                ? `Se ${ordenes.length === 1 ? 'va' : 'van'} a crear ${ordenes.length} orden${ordenes.length === 1 ? '' : 'es'} en estado «${borrador.estadoEnvio}».`
                : `Siguiente: ${PASOS[paso + 1]}`}
          </span>

          <div className="footbar-acciones">
            {paso > 0 && (
              <button type="button" className="btn btn-out" onClick={() => irA(paso - 1)}>
                <i className="fas fa-arrow-left" aria-hidden /> Volver
              </button>
            )}
            {enUltimoPaso ? (
              <button
                type="button"
                className="btn btn-green"
                disabled={bloqueado || emision.fase === 'enviando'}
                onClick={emitir}
              >
                {emision.fase === 'enviando' ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin" aria-hidden /> Creando{' '}
                    {emision.avance.hechas + 1} de {emision.avance.total}…
                  </>
                ) : (
                  <>
                    <i className="fas fa-cloud-arrow-up" aria-hidden /> Crear{' '}
                    {ordenes.length === 1 ? 'la orden' : `las ${ordenes.length} órdenes`}
                  </>
                )}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={avanzar}>
                Continuar <i className="fas fa-arrow-right" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
