# Rediseño mobile: navegación, pantalla "Hoy" y rendimiento

Fecha: 2026-09-30
Estado: diseño aprobado, pendiente de plan de implementación.

## Contexto

La app (`public/public/index.html`, un solo archivo de ~2000 líneas, más `codigo.gs`
en Apps Script) se usa ~97% desde el celular. Una auditoría en vista de 375×812
encontró:

- 8 pestañas en una barra que se desliza horizontalmente (648px de contenido en
  375px): Fitosanitario y Registrar quedan ocultas.
- "Inicio" abre con gráficos de clima; las tareas del día quedan más abajo.
- "Registrar" es una pestaña aparte de ~3.600px de alto.
- Clima mide ~18.700px (~23 pantallas): renderiza todo el historial.
  Revolcadas ~4.100px y Fitosanitario ~5.000px.
- 4 botones de ~25×23px (mínimo cómodo: 44px) y muchos textos de 9–11px.
- ~7.700 estilos inline; Firestore carga sin límite todos los históricos.
- Fuentes de Google e íconos Tabler (CDN) se piden siempre a la red y no están
  en la caché del service worker.

Este documento es el sub-proyecto 2 de tres:

1. Calendario con un evento diario. **Hecho** (mergeado a `main`).
2. **Rediseño de navegación y rendimiento (este documento).**
3. Huerta (hortalizas anuales con ciclo de vida + perennes/aromáticas, catálogo
   de especies con condiciones y ficha personalizada). Se diseña aparte, ya
   dentro de la estructura nueva.

## Objetivo

Que al abrir la app desde el celular se vea lo que hay que hacer hoy, se pueda
marcar como hecho con un toque, y se llegue a cualquier sección sin deslizar la
barra de navegación. De paso, reducir peso de carga y quitar lo que sobra.

## Enfoque elegido

Cambio incremental sobre el `index.html` actual. Sigue siendo un archivo y se
despliega igual en Firebase Hosting. Se descartó partir el archivo antes de
rediseñar (cambio grande sin tests y sin beneficio visible) y reescribir la
interfaz (demasiado riesgo para una app en uso diario). Partir el archivo queda
como un proyecto posible más adelante.

## Diseño

### 1. Pantalla "Hoy"

Es la pantalla inicial. De arriba hacia abajo:

- Encabezado: fecha y botón de sincronizar.
- **Resumen chico** (una fila): temperatura actual, lluvia del día, cantidad de
  sistemas de compost que necesitan algo, cantidad de plantas que necesitan
  atención. Tocar cada dato lleva a su sección.
- **Urgentes** (solo si existen): helada, calor extremo, compost listo.
- **Tareas de hoy · N**, agrupadas en las mismas secciones que el evento del
  calendario: Compost, Plantas, Pecera (Huerta se suma en el sub-proyecto 3).
  Dentro de cada sección, primero lo atrasado y luego lo de hoy.
- **Hechas hoy** (colapsado) y **Próximos 3 días** (colapsado; incluye riego
  pronto y poda cercana).
- Sin pendientes: mensaje "Todo al día" con lo próximo que vence.

Qué cuenta como tarea de hoy: los mismos criterios que ya usa el evento del
calendario, calculados con las funciones existentes del cliente (`estPlanta`,
`proxRev`, `estPecera`), sin duplicar reglas:

- riego cuando `diasSinAgua >= limite`;
- fertilización y plagas vencidas;
- revolcada cuando toca o está atrasada;
- cambio de agua y limpieza de filtro de la pecera.

**Marcar como hecho** (cada fila tiene un botón):

- Riego, revolcada y cambio de agua: **un toque** registra con fecha de hoy y
  muestra "Deshacer" unos segundos.
- Fertilizar, plagas y poda: abren un **mini formulario prellenado** (fecha de
  hoy, planta elegida) para anotar producto, dosis y notas.

Los gráficos de 21 días y los donuts que hoy están en Inicio se mudan a Clima
y a Compost.

### 2. Navegación

**Barra inferior fija de 5 pestañas** (respeta la zona segura de iOS, cada
pestaña con al menos 44px de alto). En escritorio, el menú lateral existente
muestra los mismos 5 ítems.

| Pestaña | Contenido |
|---|---|
| Hoy | Sección 1 |
| Compost | Segmentos `Sistemas · Revolcadas` y gráfico de estados |
| Plantas | Segmentos `Plantas · Pecera`. Tocar una planta abre su ficha; **Fitosanitario pasa a ser una sección de esa ficha** |
| Huerta | Aviso "próximamente" hasta el sub-proyecto 3 |
| Clima | Gráfico de 21 días, donuts, y últimos 14 días de historial con "Ver más" |

**Botón flotante "＋"**, siempre visible sobre la barra. Abre una hoja desde
abajo con botones grandes: regar, fertilizar, plagas, poda, revolcada, cambio de
agua, clima manual. Al elegir uno se muestra solo ese formulario. Es contextual:
en Compost sugiere primero "revolcada"; en Plantas, las acciones de plantas.
Reemplaza la pestaña y pantalla "Registrar".

**Compatibilidad:** `go()` sigue siendo el enrutador. Los ids viejos (`'sist'`,
`'rev'`, `'pec'`, `'fito'`, `'reg'`) se redirigen a su nueva ubicación para no
romper llamadas internas. Se recuerda la última pestaña abierta.

**Accesibilidad táctil:** botones y filas de al menos 44px; textos secundarios
de 12px como mínimo.

### 3. Rendimiento y limpieza

- **Carga de Firestore:** solo `clima` se limita, a los últimos 90 días, con
  "Ver más" para traer lo anterior. Es la colección más grande y 90 días cubren
  todos los cálculos (el intervalo de riego más largo es de 35 días). `plantas`,
  `registroPlantas`, `sistemas`, `revolcadas`, `pecera` y `registroPecera` se
  cargan completos, porque el último riego, poda o revolcada puede ser de hace
  meses. Métricas que hoy cuentan el total de registros de clima (p. ej.
  "Registros: 66 días") se reemplazan por otra que siga siendo veraz.
- **Service worker:** guardar en caché (actualización en segundo plano) las
  fuentes de Google y los íconos Tabler; subir la versión de la caché.
- **Estilos inline:** sin limpieza masiva. Todo lo que se reescriba usa clases;
  el resto no se toca.
- **Se eliminan:** las pantallas Registrar y Fitosanitario, las secciones del
  dashboard que se mudan, y el código que quede sin uso.

### 4. Aspecto

Se conserva la identidad actual: paleta tierra, DM Serif Display y DM Sans,
modo oscuro. Cambia la consistencia: tarjetas con el mismo espaciado, formularios
en hojas desde abajo, controles segmentados fijos arriba, esqueleto de carga en
vez de pantalla vacía, y mensajes claros cuando no hay datos.

### 5. Datos, errores y "Deshacer"

- Si Firestore falla, la app sigue funcionando con `localStorage`, como hoy.
- Los registros de un toque usan las funciones de guardado existentes
  (Firestore y Sheet); no se agregan caminos de escritura nuevos.
- **Deshacer con guardado diferido.** El Sheet se sincroniza hacia Firestore
  cada día, y esa sincronización puede resucitar documentos borrados en la app
  si su fila sigue en el Sheet (ya causó el bug de "sistemas fantasma"). Por eso
  no se escribe y después se borra: la tarea se marca hecha al instante en
  pantalla, pero **el guardado real se demora 5 segundos**. Si se toca
  "Deshacer" en ese lapso, nunca se escribe nada. Si la app se cierra o pasa a
  segundo plano antes, el guardado se ejecuta en ese momento
  (`visibilitychange` / `pagehide`).

## Fuera de alcance

- Partir `index.html` en módulos.
- Reescribir la interfaz desde cero.
- Cambios en `codigo.gs` (el evento diario ya quedó hecho; "Hoy" se calcula en
  el cliente).
- Contenido de la pestaña Huerta (sub-proyecto 3).
- Limpieza masiva de estilos inline.

## Verificación

El repo no tiene framework de tests. La verificación es manual en el navegador,
con vista de celular de 375px, pestaña por pestaña:

- sin scroll horizontal;
- sin errores en consola;
- el chequeo de tamaño de botones usado en la auditoría debe dar 0 elementos
  interactivos por debajo de 44px en la barra, la hoja "＋" y las filas de "Hoy";
- para los registros de un toque **no se escribe en el Firestore real**: en la
  prueba se reemplazan las funciones de guardado por unas de prueba, y después
  el usuario confirma con un registro real desde su celular.

## Orden de trabajo

En una rama aislada (worktree), un commit verificable por paso:

1. Barra inferior, botón "＋" y hoja de registro.
2. Pantalla "Hoy".
3. Compost, Plantas con Pecera y Fitosanitario en la ficha, Clima acortado.
4. Rendimiento (carga limitada de clima y caché del service worker).
5. Pulido visual y limpieza de código muerto.

El merge a `main` y el push se hacen al final, una vez verificado.
