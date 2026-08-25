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
   y las crea directamente en el tablero.

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
  services/monday/crearOrdenes.ts  creacion de los items y subitems en el tablero
  components/ui/            Stepper, SelectorBuscable, LogoEmpresa, PasoHeader
  features/orden/           las cuatro etapas + la banda de resumen
  styles/                   tokens y componentes (mismo sistema que Operaciones de Venta)
```

## Logo

`public/logo-belaunzaran.png` es el archivo que usa la cabecera. Mientras no esté, se muestra la
reconstrucción vectorial `public/logo-belaunzaran.svg`. Para cambiar la marca alcanza con reemplazar
el archivo: no hay que tocar código.

## Deploy en Vercel

Proyecto de tipo Vite conectado a este repositorio. La única configuración obligatoria es la
variable de entorno:

- `MONDAY_TOKEN` — **sin** el prefijo `VITE_`. Ese prefijo es justamente lo que hace que Vite
  incruste el valor en el bundle del navegador; sin él, el token queda sólo del lado servidor,
  donde lo lee la función `api/monday.ts`.

Si falta esa variable, la app carga pero no trae datos: la función responde 500 y en pantalla se
lee el motivo.

## Qué escribe la app en Monday

Al emitir se crea **un elemento por cada par campo + lote** en ✋ Orden de Trabajo, y debajo de
cada uno **un subelemento por producto**.

Antes de emitir se elige el `🤖 Estado de Envio` con el que nacen:

- **NO Enviar por Ahora** (por defecto) — quedan cargadas y revisables, sin avisarle al contratista.
- **Crear y Enviar Ahora** — se dispara el envío apenas se crean.

El valor por defecto es el conservador a propósito: un envío no se puede deshacer, así que mandar
tiene que ser una decisión explícita y no lo que pasa si nadie tocó nada.

El nombre sigue la convención del tablero: `LABOR-PROVEEDOR-LOTE-CULTIVO-CAMPAÑA`.

### Elemento

| Dato | Columna |
| --- | --- |
| Realizado por | `color_mm1ftcaf` |
| Labor | `board_relation_mm09xk5g` |
| Proveedor | `board_relation_mm09w3bc` |
| Cultivo | `board_relation_mm38x2ka` |
| Campaña | `board_relation_mm3850rb` |
| Campo | `board_relation_mm38qn0k` |
| Lote | `board_relation_mm31x8fe` |
| Pago por hectárea | `numeric_mm09rwxd` |
| Maquinaria | `board_relation_mm3jkkcw` |
| Estado de envío | `color_mm0xaytt` → lo elige el usuario antes de emitir |

### Subelemento (uno por producto)

| Dato | Columna |
| --- | --- |
| Producto | `dropdown_mm3cg47g` (etiqueta de `dropdown_mm3ca3dn` del producto) |
| Cantidad por hectárea | `numeric_mm3869nh` |
| Hectáreas del lote | `numeric_mm3fvr3q` |

### Números

Se tipean en formato local (`1.500,75`) y viajan a Monday como `1500.75`: punto decimal y sin
separador de miles. La conversión está en `aNumero` / `aTextoMonday` (`src/lib/format.ts`).

### Contacto

`lookup_mm3c273r` es una columna **mirror** y la API no permite escribirla: se completa sola con
los contactos del proveedor conectado. El contacto que se elige en la app sirve para validar que
el proveedor tenga a quién avisarle, pero no se puede grabar como valor propio de la orden.

## Seguridad: sólo desde monday

La app está publicada en una URL pública, pero **abrirla desde un navegador no sirve de nada**.

Cada vez que monday carga la app le entrega al frontend un `sessionToken`: un JWT firmado con la
clave secreta de la aplicación, que incluye el usuario y la cuenta. El frontend lo manda en cada
request y [`api/_guard.ts`](api/_guard.ts) verifica la firma antes de que `api/monday.ts` consulte
o escriba nada.

**El portón es el backend, no la interfaz.** La pantalla de "No tenés acceso" es sólo para que
quien entre por el camino equivocado entienda por qué no ve nada; aunque alguien evitara esa
pantalla, la función seguiría rechazando el pedido con un 401.

Qué se comprueba, en orden:

1. Que el algoritmo de firma sea `HS256` — un token con `alg: none` se rechaza antes de mirarlo.
2. Que la **firma** valide contra el secreto de la app. Sin la clave no se puede fabricar un token.
3. Que **no esté vencido** (se tolera un minuto de desfasaje de reloj).
4. Que la **cuenta** sea la habilitada en `MONDAY_ACCOUNT_ID`. Un token válido de otra cuenta que
   tuviera la app instalada no alcanza.

La verificación usa WebCrypto y no una librería de JWT porque la función corre en el runtime edge,
donde no existe el `crypto` de Node del que dependen esas librerías. La comparación de firmas la
hace `crypto.subtle.verify`, no el código: comparar dos firmas con `===` filtra información por el
tiempo que tarda en fallar.

### Sobre los dos secretos

monday documenta el *signing secret*, pero según la app puede ser el *client secret* el que valide
— es la causa más común de "invalid signature". El guardián prueba los dos: ambos son nuestros, así
que aceptar cualquiera no abre ninguna puerta. Los dos están en el Developer Center de monday, en
**Basic Information** de la app.

### En desarrollo

En localhost no hay monday que entregue un token, así que la verificación no corre: el proxy de
Vite pega directo contra la API con `VITE_MONDAY_TOKEN`. La capa de seguridad aplica al deploy,
que es el único expuesto.
