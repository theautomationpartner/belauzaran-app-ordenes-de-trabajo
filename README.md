# Belaunzaran SA · Cargar Orden de Trabajo

App de tablero (board view) para Monday, en React + Vite. Reemplaza la carga por formulario de las
órdenes de trabajo por un flujo guiado en tres pasos.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y completar VITE_MONDAY_TOKEN
npm run dev                        # http://localhost:5181
```

`npm run dev` levanta con `--host` si se quiere abrir desde el celular en la misma red.

### Variables de entorno

| Variable | Dónde | Para qué |
| --- | --- | --- |
| `VITE_MONDAY_TOKEN` | `.env.local` (desarrollo) | Token de la API de Monday de Belaunzaran. |
| `MONDAY_TOKEN` | entorno del deploy | Mismo token, del lado servidor (`api/monday.ts`). |
| `VITE_MAKE_WEBHOOK_URL` | `.env.local` | Webhook de Make que crea los items de la orden. |

**El token nunca se sube al repositorio.** `.env.local` está en `.gitignore`. En desarrollo el token
lo inyecta el proxy de Vite; en producción lo inyecta la función serverless `api/monday.ts`, así que
el bundle que llega al navegador no lo contiene.

## El flujo

1. **Datos de la orden** — labor, proveedor/contratista, cultivo, campaña activa, U$/Ha y el
   contacto al que se le envía. El contacto se filtra por el proveedor elegido.
2. **Productos** — los insumos de la labor con su cantidad por hectárea. La dosis es la misma para
   toda la carga; cada producto termina siendo un subelemento de la orden. El paso admite quedar
   vacío: hay labores puramente mecánicas que no aplican insumos.
3. **Campos y lotes** — un bloque por campo, con los lotes de ese campo. Se pueden agregar tantos
   campos como haga falta; un lote no se puede repetir entre bloques.
4. **Revisar y emitir** — la app expande la carga a **una orden por lote** (el tablero admite un
   campo y un lote por item), recalcula las cantidades de producto con las hectáreas de cada lote
   y manda el payload al webhook de Make.

## Tableros de Monday

| Tablero | ID |
| --- | --- |
| ✋ Orden de Trabajo | `18410927171` |
| 🚜💨 Labores | `18410927179` |
| ✋ Proveedores | `18410927151` |
| 🌻🌱 Cultivo | `18410927181` |
| 📅 Campañas | `18410927177` |
| ✋ Contactos | `18410927146` |
| 📍 Campos y Lotes | `18411611312` (lotes = subitems, `18411611427`) |
| 🧴🧪 Productos | `18410927152` |
| Subelementos de la orden | `18410927290` |

Los IDs de columna están todos en [`src/services/monday/columns.ts`](src/services/monday/columns.ts):
es la única fuente de verdad, ninguna query los escribe sueltos.

## Estructura

```
src/
  types.ts                  estructuras de datos de la app
  lib/orden.ts              reglas del negocio (validaciones, expansión a órdenes, payload)
  lib/format.ts             formato es-AR y lectura de números tipeados
  services/monday/          sdk, ids de columnas, parseo y carga de catálogos
  services/emision.ts       entrega del payload a Make
  components/ui/            Stepper, SelectorBuscable, LogoEmpresa, PasoHeader
  features/orden/           las cuatro etapas + la banda de resumen
  styles/                   tokens y componentes (mismo sistema que Operaciones de Venta)
```

## Logo

`public/logo-belaunzaran.png` es el archivo que usa la cabecera. Mientras no esté, se muestra la
reconstrucción vectorial `public/logo-belaunzaran.svg`. Para cambiar la marca alcanza con reemplazar
el archivo: no hay que tocar código.

## Pendientes conocidos

- **Webhook de Make**: sin `VITE_MAKE_WEBHOOK_URL` el botón de emitir queda deshabilitado. La
  revisión del paso 3 igual muestra las órdenes exactas que se van a crear.

## Deploy en Vercel

Proyecto de tipo Vite conectado a este repositorio. La única configuración obligatoria es la
variable de entorno:

- `MONDAY_TOKEN` — **sin** el prefijo `VITE_`. Ese prefijo es justamente lo que hace que Vite
  incruste el valor en el bundle del navegador; sin él, el token queda sólo del lado servidor,
  donde lo lee la función `api/monday.ts`.

Si falta esa variable, la app carga pero no trae datos: la función responde 500 y en pantalla se
lee el motivo.
