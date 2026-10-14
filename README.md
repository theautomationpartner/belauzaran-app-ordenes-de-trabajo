# Belaunzaran SA · Operaciones

App de tablero (board view) para Monday, en React + Vite. Abre en una pantalla de inicio
("¿Qué vas a hacer?") sin ninguna operación cargada: se elige con las tarjetas o con el
desplegable de la cabecera, y el botón de la casita vuelve al inicio. Las operaciones:

- **Cargar Orden de Trabajo** — reemplaza la carga por formulario de las órdenes de trabajo por un
  flujo guiado.
- **Asignación de Barbecho** — a las órdenes de producción en barbecho les asigna el cultivo que se
  va a sembrar y propaga el cambio (ver [más abajo](#asignación-de-barbecho)).
- **Registrar Remito/Factura** y **Registrar Cosecha** — ver sus secciones más abajo.

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

En la revisión se marca, **orden por orden**, cuáles salen al contratista apenas se creen. Eso
define su `🤖 Estado de Envio`:

- **NO Enviar por Ahora** — lo que no se marcó. Queda cargado y revisable, sin avisarle a nadie.
- **Crear y Enviar Ahora** — lo que se marcó explícitamente.

Se guarda la excepción y no el estado de cada orden: un envío no se puede deshacer, así que mandar
tiene que ser una decisión deliberada sobre cada orden y no lo que pasa si nadie tocó nada. En una
misma tanda se pueden mandar unas y dejar otras cargadas.

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
| Permitir reemplazo | `color_mm8332q5` → **SI** si se tildó en el paso 2; **NO** en el resto, incluidos los productos sin principio activo |

En el paso 2 se puede filtrar por **Principio Activo** (`dropdown_mm7z94pj` de Productos, varios a la vez). A los productos que tienen uno se les ofrece **Permitir reemplazo** y la lista de equivalentes: los productos activos que comparten algún principio activo. Las etiquetas se leen de `values` del dropdown y no partiendo el texto, porque "2,4-D" lleva una coma.

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

## Asignación de Barbecho

Lista las órdenes de 🤖 Orden de Produccion (`18410927170`) cuyo cultivo (`board_relation_mm0xzwvq`)
es **Barbecho**, con su campo, lote, campaña, fecha de comienzo y los montos de sus órdenes de
trabajo. Se marcan una o varias y se les elige el cultivo: a todas juntas desde la barra de
selección, o uno distinto en cada tarjeta. Antes de escribir nada se muestra cada nombre como queda.

### Qué escribe

| Tablero | Qué cambia |
| --- | --- |
| 🤖 Orden de Produccion | Nombre + `board_relation_mm0xzwvq` (cultivo) |
| ✋ Orden de Trabajo (las de `board_relation_mm0xxrye`) | Nombre + `board_relation_mm38x2ka` (cultivo) |
| 🤖 Confirmacion de Trabajo (las de `board_relation_mm3f3da` de cada OT) | Nombre + `text_mm3acymf` (cultivo como texto) |
| Movimientos de stock (`18410927255`, los de `board_relation_mm13c2p7`) | Sólo el nombre |

Primero se escribe todo lo que cuelga de la orden de producción y **la OP va última**: si algo
falla, la OP sigue en barbecho, vuelve a aparecer en la lista y se puede reintentar. Las
escrituras se pueden repetir sin efecto, así que reintentar no duplica nada.

### Cómo se arma el nombre nuevo

En los cuatro tableros el cultivo va justo antes de la campaña
(`LA BERNARDA-LOTE 3-Barbecho-2026-2027`). La app **reemplaza sólo ese tramo** y deja el resto del
nombre como está, incluido el `ANULAR - ` de los movimientos de stock.

No se rearma el nombre desde las columnas porque hay órdenes cuyo nombre ya no coincide con sus
conexiones (un lote renombrado en Campos, un proveedor cambiado a mano): rearmarlas les cambiaría
más que el cultivo, y los movimientos de stock —que copian el nombre de la OT— dejarían de
coincidir con ella. El rearmado (`Lote-Cultivo-Campaña`, `Labor-Proveedor-Lote-Cultivo-Campaña`,
`Labor-Lote-Cultivo-Campaña`) queda sólo como respaldo cuando el nombre no contiene el cultivo, y la
revisión lo marca.

### Montos

Los montos de la OP (`lookup_mm461ecy`, `lookup_mm46fbqv`, `lookup_mm456wg0`, `lookup_mm46z96c`)
son espejos de fórmulas de la OT, y **la API los devuelve vacíos**. La app los lee de cada OT:
U$ Labor `formula_mm09mxrz`, U$ Total `formula_mm45te4n`, Costo x Ha `formula_mm45hc65`, y U$
Producto como suma de `formula_mm416gx` de sus subelementos.

## Registrar Remito / Factura

Formulario de una pantalla. Primero se elige, obligatoriamente, **REMITO** o **FACTURA**.

| | Remito (`18410927148`) | Factura (`18410927147`) |
| --- | --- | --- |
| Persona | `person` — sólo los suscriptores del tablero (la columna no acepta a otros) | — |
| Destino | `board_relation_mm1ft4eh` (🛖 Destinos, `18411551565`) | — |
| Formato | `color_mm38pr6n`: **PDF** o **JPEG** | siempre PDF |
| Archivo | PDF → `file_mm1fs67h` · JPEG → `file_mm38hc4r` | `file_mm1axdpr` |
| Otros | — | `color_mm7fkx7d` = **MANUAL**, después `color_mm1ajk2x` = **Registrar** |

Se sube **un solo archivo** y tiene que corresponder al formato: con PDF sólo `.pdf`; con JPEG
cualquier foto (`.jpg`, `.jpeg`, `.png`, `.heic`…) pero nunca un PDF. Si se elige otra cosa no se
carga, y la pantalla dice qué se intentó subir y qué se esperaba.

### Subida de archivos

monday recibe los archivos en `/v2/file` como `multipart/form-data`. En desarrollo pasan por el
proxy de Vite (`/monday-api/file`); en el deploy por [`api/archivo.ts`](api/archivo.ts), que
verifica la sesión igual que `api/monday.ts`.

Vercel corta los pedidos de más de ~4,5 MB. Por eso las fotos que pasan de ~3,6 MB se vuelven a
guardar en el navegador como JPEG de hasta 2400 px de lado (el remito se sigue leyendo), y los PDF
de más de 4 MB se rechazan con un aviso.

Orden de las escrituras:

- **Remito:** se crea el item con sus datos y después se sube el archivo. La automatización del
  tablero procesa el remito sólo si tiene archivo (al crearse o cuando cambia la columna), así que
  un remito que quedó sin archivo no dispara nada a medias.
- **Factura:** se crea el item **sin estados**, se sube el PDF, **recién con el PDF arriba** se
  marca el origen `MANUAL` y, al final, 🤖 Estado de Registro pasa a `Registrar`, que es lo que la
  manda a procesar. Cada paso sólo corre si el anterior salió bien.

Si una etapa falla, la pantalla lo dice y ofrece retomar **sobre el mismo item** (no crea otro).
El aviso de éxito aparece sólo cuando terminaron todas. Mientras se carga, o si quedó algo a
medias, la app avisa antes de cerrar o recargar la página y antes de cambiar de operación.

## Registrar Cosecha

Dos caminos, elegidos en tarjetas: **Crear Cosecha** o **Duplicar Cosecha**. Los dos usan el mismo
formulario y las mismas reglas ([`src/lib/cosecha.ts`](src/lib/cosecha.ts)); duplicar sólo
arranca el formulario con los datos de otra cosecha.

| Dato | Columna de ✋ Cosecha (`18410927172`) | Regla |
| --- | --- | --- |
| Cultivo | `board_relation_mm1f8xpb` | obligatorio |
| Campaña | `board_relation_mm1f9j3` | obligatorio (las activas primero) |
| Campo | `board_relation_mm1fqqsa` | obligatorio |
| Lote | `board_relation_mm3bqrjy` | obligatorio, uno o más, **sólo lotes del campo elegido** (subitems del campo) |
| Fecha | `date_mm3b7319` | obligatorio |
| KG | `numeric_mm1fs180` | obligatorio, mayor a cero |
| Destino granos en depósito | `board_relation_mm3cgegw` | obligatorio, **sólo depósitos del cultivo elegido** (`board_relation_mm1fxqbh` del depósito) |
| Tipo de transporte | `color_mm1fbf6v` | obligatorio: Flete Propio o Flete Contratado |
| Maquinaria | `board_relation_mm1fbdsm` | con Flete Propio, una o más (buscador con filtros de Tipo y Clasificación) |
| Proveedor | `board_relation_mm1f9twb` | con Flete Contratado, uno de tipo **Fletes** |
| Carta de porte · KM · CTG | `text_mm1fnckc` · `numeric_mm1fe2f7` · `text_mm3kavqa` | opcionales |

- Cambiar el campo suelta los lotes que no son de ese campo; cambiar el cultivo suelta el depósito
  si no es de ese cultivo. Al duplicar, si la cosecha original trae combinaciones que hoy no valen
  (un proveedor que no es de Fletes, un depósito de otro cultivo), el bloque lo marca en rojo.
- La columna de maquinarias se lee en vivo: si en monday vuelve a quedar en "un solo elemento",
  la app deja elegir una sola.

**Qué se escribe:**

- **Crear:** un item con todas las columnas en **una sola escritura** y **sin estado**: la
  automatización se dispara al crearse el item y tiene que encontrarlo completo.
- **Duplicar:** el item nuevo se crea igual que uno nuevo (completo y sin estado) y, sólo si
  el alta salió bien, la cosecha original pasa a 🤖Estado Duplicado (`color_mm59ytz6`) =
  **Duplicado**. Si esa marca falla, se reintenta sólo la marca, sin crear otra cosecha.

Del transporte se escribe sólo lo del tipo elegido. Make renombra el item después.

**Buscar para duplicar:** no se trae el tablero entero. monday filtra por nombre que contiene el
texto y por Cultivo, Campo, Lote y Campaña combinados, y devuelve las 30 más nuevas.

### Altas al vuelo: proveedor, contacto y destino

Si el proveedor del flete o el destino de granos no existen, se cargan desde el mismo formulario
con **"Agregar … nuevo"**, en una ventana emergente, y quedan elegidos
([`src/features/altas`](src/features/altas)).

**Nada se crea al confirmar la ventana.** Lo cargado queda pendiente, con un id provisorio, y se
muestra como "Nuevo" en el selector. Recién al confirmar la cosecha se crea, en este orden: el
proveedor, sus contactos nuevos, el destino y por último la cosecha, ya conectada a los ids reales.
Sólo se crea lo que la cosecha usa: un proveedor nuevo que quedó cargado pero al final el flete es
propio no se crea. Si la cosecha falla después de crear el proveedor o el destino, esos quedan
como reales y al reintentar no se duplican.

| Alta | Tablero | Obligatorio | Opcional | Nace con |
| --- | --- | --- | --- | --- |
| Proveedor | ✋ Proveedores `18410927151` | Nombre completo (`text_mm84mmvf`, también el nombre del item), CUIT `XX-XXXXXXXX-X` (`text_mm0xdjya`), Tipo (`dropdown_mm39x0j7`, al menos uno; se leen los que haya en monday y Fletes viene marcado) | ubicación (`location_mm33fd1b`), contactos (`board_relation_mm09gcys`) | `status` = Activo |
| Contacto (desde el proveedor) | ✋ Contactos `18410927146` | Nombre/s y WhatsApp **o** email | apellido/s, el otro medio | conectado al proveedor |
| Destino granos en depósito | 🤖 Granos en Deposito `18410927175` | Cultivo (`board_relation_mm1fxqbh`), silo/acopio (`board_relation_mm1fq67c`) | ubicación (`location_mm1fh806`) | `color_mm3fjkvh` = Activo, nombre "Cultivo - Silo" |

- **CUIT:** los guiones se ponen solos; un CUIT ya cargado bloquea (hay que elegir ese proveedor).
  El dígito verificador sólo advierte: 3 de los CUIT ya cargados no lo cumplen.
- **WhatsApp:** se normaliza a `549` + área + número (13 dígitos) aunque lo tipeen con 0, con 15
  o con +54 (`02494 15-600860` → `5492494600860`).
- **Contactos:** los nuevos se crean *después* del proveedor, apuntando a él. La conexión es de
  doble vía, así que el proveedor los muestra solos. Un contacto que falla no deshace el proveedor.
- **Depósito repetido:** se controla por cultivo + silo conectados, no por nombre (hay depósitos
  escritos distinto que su silo).
- **Ubicación:** monday exige coordenadas. Se busca la dirección en Nominatim (OpenStreetMap,
  gratuito, desde el navegador) y se elige una coincidencia; la búsqueda va con botón, no por tecla,
  como pide su política de uso.
- Lo creado se suma a los catálogos de la app: el proveedor nuevo aparece también en las otras
  operaciones sin recargar.
- Si un id provisorio llegara a la escritura de la cosecha, se corta antes de escribir.
