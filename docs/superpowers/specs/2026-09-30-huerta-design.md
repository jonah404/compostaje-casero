# Huerta: cultivos con ciclo de vida, catálogo de especies y calendario

Fecha: 2026-09-30
Estado: diseño aprobado, pendiente de plan de implementación.

## Contexto

Es el sub-proyecto 3 de tres (1: calendario con evento diario, hecho; 2: rediseño
mobile, hecho). La pestaña **Huerta** hoy es un aviso "próximamente".

Lo que ya existe y este diseño reutiliza:

- Colección Firestore `plantas` (id numérico), hoja "Plantas" del Sheet (columnas
  A–T) y registros de eventos (`registroPlantas` / hoja "Registro Plantas").
- `estPlanta(p)`: riego, fertilización, plagas y poda a partir del perfil de la
  especie; `aguaEfectiva(p)` cuenta la lluvia ≥ 8 mm como riego en plantas de exterior.
- "Hoy" (`armarTareasHoy`), un toque con Deshacer diferido, hoja de registro
  (`openRegistro` / `fc-*`), ficha de planta (`openPla`) con sección Fitosanitario.
- Apps Script: `guardarPlantaSheet`, `sincronizarPlantasAFirestore`,
  `actualizarFichaPlantas`, `verificarEventosPlantas` y el evento único diario
  ("Tareas de hoy", `EVENTO_UNICO.areas`).

## Objetivo

Registrar los cultivos de la huerta (hortalizas anuales y perennes/aromáticas), que
al agregarlos aparezcan sus condiciones (riego, fertilización, plagas, siembra y
cosecha) y seguirlos como al resto: tareas en "Hoy", evento del calendario, historial.

## Decisiones ya tomadas

1. **Alcance:** hortalizas anuales **y** perennes/aromáticas.
2. **Condiciones de cada especie:** catálogo incluido en la app (24 especies) más una
   **ficha manual** para lo que no esté (sin IA dentro de la app).
3. **Dónde viven los cultivos:** en la **misma colección `plantas`**, con campos nuevos
   (no una colección aparte).
4. **Seguimiento de una anual:** ciclo automático (siembra o trasplante → fase
   calculada → avisos de trasplante y cosecha → cierre con "Cosechado"). Sin cantidad
   cosechada y sin tareas de manejo extra (raleo, tutorado) en esta versión.
5. **Riego:** una sola tarea agrupada "Regar la huerta".
6. **Cómo llega el catálogo al calendario:** **foto del perfil** copiada al cultivo al
   agregarlo; Apps Script lee esas columnas y **no conoce el catálogo**.

## Diseño

### 1. Modelo de datos

Campos nuevos en el documento de la planta (Firestore) y en columnas nuevas de la hoja
"Plantas", a continuación de "Notas" (T):

| Col. | Campo | Contenido |
|---|---|---|
| U | `categoria` | `'huerta'` (vacío en las plantas de siempre) |
| V | `cultivo` | clave del catálogo (`'tomate'`) o `'manual'` |
| W | `ciclo` | `'anual'` o `'perenne'` |
| X | `fechaTrasplante` | `YYYY-MM-DD`, opcional |
| Y | `riegoVerano` | días entre riegos (nov–mar) |
| Z | `riegoInvierno` | días entre riegos (abr–oct) |
| AA | `diasFert` | fertilizar cada N días |
| AB | `diasPlagas` | revisar plagas cada N días |
| AC | `diasATrasplante` | vacío si se siembra directo |
| AD | `diasACosecha` | contados desde la siembra; vacío en perennes |
| AE | `estadoCultivo` | `'activo'` (o vacío), `'cosechado'`, `'terminado'` |
| AF | `fechaCierre` | `YYYY-MM-DD` |

- La **fecha de siembra** es el `fechaP` que ya existe.
- Las columnas Y–AD son la **foto del perfil**: se copian del catálogo (o de la ficha
  manual) al agregar el cultivo y se pueden editar. Un cambio posterior del catálogo
  no modifica los cultivos ya sembrados.
- `estadoCultivo` es distinto del `estado` ("Estado general", texto) que ya existe.
- Las plantas actuales tienen `categoria` vacía y **no cambian de comportamiento**.

**Perfil único.** Una función `perfilDePlanta(p)` devuelve el perfil de cualquier
planta: si `p.categoria === 'huerta'`, arma
`{ tipo:'Exterior', riegoVerano, riegoInvierno, diasFert, fertMesIni:null,
fertMesFin:null, tempMin:null, podaDias:null }` desde su foto; si no, usa
`perfilEspecie(...)` como hoy. `estPlanta` pasa a llamar a `perfilDePlanta`. No se
duplican reglas.

**Ayudas de acceso:** `plantasComunes()` (`categoria !== 'huerta'`), `cultivos()`
(`categoria === 'huerta'`) y `cultivosActivos()` (además `estadoCultivo` distinto de
`'cosechado'`/`'terminado'`).

### 2. Catálogo (módulo aparte)

Archivo nuevo `public/public/huerta-catalogo.js` (módulo ES) que exporta el catálogo y
las funciones puras; `index.html` lo importa y el service worker lo guarda en caché.
Motivo del desvío del "todo en un archivo": las 24 fichas con plagas son cientos de
líneas y así la lógica se puede probar en Node.

Forma de cada entrada (los números son solo de **ejemplo**; los valores reales de cada
especie se investigan y cargan en la primera tarea del plan):

```js
{ clave:'tomate', nombre:'Tomate', grupo:'Frutos', ciclo:'anual',
  riegoVerano:2, riegoInvierno:4, diasFert:20, diasPlagas:7,
  diasATrasplante:35,          // null si se siembra directo
  diasACosecha:90,             // null en perennes
  mesesSiembra:[8,9,10],
  ficha:{ problemas:[{nombre,sintoma,producto,dosis}], monitoreo, momentoCritico,
          calendarioVigilancia:{1:'🟠',…,12:'🟢'} } }
```

**Especies (24):**
- Hojas y crucíferas: lechuga, acelga, espinaca, rúcula, repollo, brócoli.
- Frutos: tomate, morrón, berenjena, zapallito, zapallo, pepino, choclo.
- Raíces y bulbos: zanahoria, remolacha, cebolla de verdeo.
- Aromáticas y perennes: albahaca, perejil, cilantro, menta, orégano, romero, tomillo,
  frutilla.

**Fuentes y criterio de los datos.** Manejo INTA (San Pedro, zona pampeana) y guías de
huerta familiar (Pro-Huerta); épocas de siembra y días a cosecha contrastados con
calendarios de huerta de la zona. Productos y dosis son referencia general (mismo
criterio que los frutales: confirmar contra la etiqueta del producto). Los valores se
cargan y verifican en la primera tarea del plan; este documento fija el esquema, la
lista y las reglas de aceptación (ver Verificación).

`ficha` tiene el mismo formato que `FITOSANITARIO`, para que la sección "🐛
Fitosanitario" de la ficha de planta funcione igual; la búsqueda de ficha para un
cultivo usa `p.cultivo` (la clave), no el nombre. Los cultivos `'manual'` no tienen ficha.
`diasPlagas` es el intervalo nominal que usan tanto la app como Apps Script para las
tareas; `calendarioVigilancia` solo informa el nivel de vigilancia del mes (badge).

**Funciones puras exportadas:**
- `faseCultivo(p, hoy)` → `'semillero' | 'por-trasplantar' | 'crecimiento' |
  'cosecha-proxima' | 'cosecha' | 'cerrado'`.
- `diaDeCultivo(p, hoy)` (días desde la siembra) y `progresoCosecha(p, hoy)` (0–1).
- `enEpocaDeSiembra(clave, mes)`.
- `perfilDeCatalogo(clave)` (los campos que se copian al cultivo).

**Fase** (fórmula; `d` = días desde la siembra):
1. `estadoCultivo` `'cosechado'`/`'terminado'` → `cerrado`.
2. Perenne o sin `diasACosecha` → `crecimiento`.
3. Con `diasATrasplante` y sin `fechaTrasplante`: `d < diasATrasplante` → `semillero`;
   si no → `por-trasplantar` (tiene prioridad sobre las fases de cosecha).
4. `d >= diasACosecha` → `cosecha`; `d >= diasACosecha - 7` → `cosecha-proxima`;
   si no → `crecimiento`.

### 3. Pestaña Huerta

Reemplaza el aviso "próximamente".

- **Arriba:** chips "🌱 Cultivos activos · N" y "🧺 Para cosechar · N" (fase
  `cosecha-proxima` o `cosecha`).
- **Lista de cultivos activos**, en tarjetas: nombre y ubicación (cantero), la fase
  como badge, una barra de avance de siembra a cosecha ("día 34 de 90") y la próxima
  acción; ordenadas con lo que necesita atención primero. Perennes: sin barra, solo
  "En crecimiento".
- **Historial** colapsado (`<details>`), con los cultivos cosechados y terminados.
- Botón **"＋ Agregar cultivo"** (además de la entrada en la hoja "＋" de registro).
- En la pestaña **Plantas** se excluyen los cultivos (`plantasComunes()`); también de
  su resumen (donut de riego, "Plantas al día") y del selector "Editar planta". El
  selector de eventos de planta (`#pv`) sí incluye los cultivos, para poder
  registrarles eventos.

**Agregar / editar cultivo** (nuevo formulario `fc-huertaCultivo` en la hoja de registro):
1. Cultivo: lista agrupada por `grupo`, u "Otro (ficha manual)" (con campo nombre).
2. Fecha de siembra (hoy por defecto), fecha de trasplante (opcional), ubicación, notas.
3. Perfil autocompletado, **editable**: riego verano/invierno, fertilizar cada, revisar
   plagas cada, días a trasplante, días a cosecha. En "Otro" vienen vacíos.
4. Aviso amarillo, **no bloqueante**, si el mes actual queda fuera de `mesesSiembra`.
5. Guardar: `id` nuevo (máximo + 1, como `addPlanta`), `categoria:'huerta'`,
   `estadoCultivo:'activo'`; se guarda con `fbSave('plantas', …)` y `sheetSync('planta', …)`.

**Ficha del cultivo** (extiende `openPla`): fase, cosecha estimada (siembra +
`diasACosecha`), historial de eventos, sección Fitosanitario y botones:
- **Cosechado:** `estadoCultivo='cosechado'`, `fechaCierre=hoy` y registra el evento
  `🍂 Cosecha` de hoy.
- **Terminar:** `estadoCultivo='terminado'`, `fechaCierre=hoy` (sin evento).
- **Editar cultivo** (abre `fc-huertaCultivo`) y **Registrar evento**.

### 4. Tareas en "Hoy"

Sección nueva **🥬 Huerta** en `AREAS_HOY`, entre Plantas y Pecera. Los cultivos
cerrados no generan tareas (tampoco alerta de helada).

| Tarea (id) | Aparece cuando | Toque |
|---|---|---|
| **Regar la huerta** (`riego-huerta`) | algún cultivo activo `riegoUrg`; lista los que tocan; "Próximos" si solo hay `riegoProx` | ✓ un toque: registra `💧 Riego` de hoy en **cada** cultivo listado (una entrada por cultivo) |
| **Trasplantar** (`trasplante-<id>`) | fase `por-trasplantar` | ✓ un toque: `fechaTrasplante = hoy` (`fbSave` + `sheetSync('planta')`) y evento `🌱 Trasplante` |
| **Fertilizar** (`fert-<id>`) | pasaron `diasFert` desde la última fertilización (sin temporada) | › mini formulario `🌿 Fertilización` |
| **Revisar plagas** (`plagas-<id>`) | pasaron `diasPlagas` desde la última revisión | › mini formulario `🐛 Revisión plagas` |
| **Cosechar** (`cosecha-<id>`) | fase `cosecha` (a `cosecha-proxima` va a "Próximos"); solo anuales | › confirmación "Cosechado" |

- La tarea de cosecha se **silencia 3 días** si hay un evento `🍂 Cosecha` registrado
  en los últimos 3 días (cosechas parciales de tomate, albahaca, etc.).
- El riego agrupado usa la lógica existente de `estPlanta`/`aguaEfectiva` sobre la
  foto del perfil (la lluvia ≥ 8 mm cuenta como riego).
- El toque de riego agrupado y el de trasplante usan el mismo guardado diferido de 5
  segundos con Deshacer que ya existe; la tarea lleva `refs: [ids]` (riego) y el
  commit registra un evento por cultivo.
- "Hechas hoy" incluye los eventos de los cultivos.

### 5. Apps Script (`codigo.gs`)

1. `guardarPlantaSheet(d)` escribe las columnas U–AF (`categoria` … `fechaCierre`).
2. `sincronizarPlantasAFirestore()` agrega esos campos a `updateMask` (números como
   `doubleValue`, vacíos como `nullValue`; la app trata `null` como vacío).
3. `agregarColumnasHuerta()` (nueva, se corre **una vez**) crea los encabezados U–AF.
4. `actualizarFichaPlantas()`: para filas `huerta` usa la foto del perfil (Y–AD) en
   lugar de `perfilEspecie` y **saltea** las cerradas (AE).
5. `verificarEventosPlantas()`: las filas `huerta` **solo** participan en la alerta de
   helada (como plantas de exterior); se saltean en riego, fertilización, plagas y
   poda; las cerradas se saltean del todo.
6. `verificarEventosHuerta()` (nueva) devuelve eventos con `area:'huerta'`: "Regar la
   huerta · N cultivos" (lista), trasplantar, cosechar, fertilizar y revisar plagas
   (recordatorio general, sin la guía de cada cultivo). Se concatena en
   `verificarYCrearEventos` y `EVENTO_UNICO.areas` suma `{ id:'huerta', encabezado:'🥬
   HUERTA' }` después de plantas.
7. `testHuerta()` (nueva): arma y muestra en el registro los eventos de la huerta que se
   crearían, **sin** tocar el calendario.

Código ES5 (sin `const`/`let`/flechas), como el resto de `codigo.gs`.

### 6. Service worker

`huerta-catalogo.js` se agrega a `APP_SHELL` y se sube la versión de caché
(`compost-tracker-v3`).

## Compatibilidad

- Las plantas existentes (interior, frutales) no tienen `categoria`: mismo perfil, mismas
  tareas, mismos eventos de calendario.
- Un cultivo cargado con la app nueva mientras `codigo.gs` sigue siendo el viejo se
  trataría como una especie desconocida (perfil genérico, avisos individuales
  erróneos). Por eso el **orden de despliegue** es: pegar `codigo.gs` y correr
  `agregarColumnasHuerta()`, y **recién después** publicar la app.

## Fuera de alcance

Cantidad cosechada y totales por temporada, tareas de manejo (raleo, tutorado,
aporque), rotación de cultivos, siembras sucesivas, catálogo editable desde el Sheet,
fotos, y cualquier IA dentro de la app.

## Verificación

- **Pruebas en Node** (`scripts/test-huerta.mjs`, `node scripts/test-huerta.mjs`, con
  `node:assert`, sin frameworks):
  - Catálogo: exactamente las 24 claves del listado, sin duplicados; cada entrada con
    `nombre`, `grupo`, `ciclo`, `riegoVerano`, `riegoInvierno`, `diasFert`, `diasPlagas`
    numéricos y positivos con `riegoVerano <= riegoInvierno`; `mesesSiembra` con meses
    de 1 a 12; anuales con `diasACosecha` numérico y, si hay `diasATrasplante`,
    `diasACosecha > diasATrasplante`; perennes con `diasACosecha` nulo; `ficha` con al
    menos 2 problemas (cada uno con `nombre`, `sintoma`, `producto`, `dosis`),
    `monitoreo`, `momentoCritico` y `calendarioVigilancia` con los 12 meses y valores
    válidos (`🟢`, `🟠`, `🔴`, `🔴🔴`).
  - `faseCultivo`: las cinco fases y `cerrado`, con fechas de ejemplo, incluidos los
    bordes (día exacto de trasplante, día de cosecha, 7 días antes, prioridad de
    `por-trasplantar`, perennes).
  - `perfilDePlanta`: huerta lee la foto; una planta común sigue usando `perfilEspecie`.
- **Navegador**, con `?dry=1` y vista de celular (375px), sin escrituras a datos reales:
  agregar un cultivo del catálogo y uno manual; fase y barra; tareas en "Hoy"; riego
  agrupado con un toque (un evento por cultivo, con Deshacer); trasplante; "Cosechado"
  y "Terminar"; el historial; que Plantas no muestre los cultivos.
- **Sin regresión:** con los mismos datos, `armarTareasHoy()` de las plantas de siempre
  devuelve exactamente los mismos ids antes y después del cambio.
- **Auditoría táctil** (44px) y de texto (12px) sobre las pantallas nuevas.
- **Apps Script:** `testHuerta()` (lo corre el usuario en el editor) y una corrida de
  `verificarYCrearEventos` para ver el área "🥬 HUERTA" en el evento único.

## Orden de trabajo

En una rama aislada, un commit verificable por paso:

1. Catálogo de 24 especies (investigación de datos), funciones puras y
   `scripts/test-huerta.mjs`.
2. Modelo: `perfilDePlanta`, ayudas `plantasComunes`/`cultivos`/`cultivosActivos`,
   filtros de Plantas y exclusión de cerrados.
3. Pestaña Huerta: lista, fases, historial, `fc-huertaCultivo`, y "Cosechado"/"Terminar"
   en la ficha.
4. Sección Huerta en "Hoy" (riego agrupado, trasplante, fertilizar, plagas, cosecha).
5. Apps Script (`codigo.gs`): columnas, sync, ficha, `verificarEventosHuerta`, evento
   único y `testHuerta`.
6. Service worker, pulido, auditorías y revisión final.

Merge a `main` y push al final; el deploy de la app se hace **después** de que el
usuario pegue `codigo.gs` y corra `agregarColumnasHuerta()`.
