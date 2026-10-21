# Login con Google e historial de cambios — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entrar con Google (solo dos cuentas), registrar autor en cada escritura, guardar un historial legible con botón Restaurar, y cerrar Firestore.

**Architecture:** La lógica nueva vive en dos módulos ES sin DOM ni Firebase importado (`historial.js` puro, `escritor.js` con el SDK inyectado), importables desde `index.html` y probables con Node. `index.html` reemplaza `fbSave/fbAdd/fbDel` por los del escritor, agrega la puerta de login y la vista de Historial. Reglas de Firestore con lista de correos; `codigo.gs` pasa a autenticar sus llamadas a Firestore.

**Tech Stack:** HTML/JS sin build, Firebase JS SDK 10.12 por CDN (`firebase-auth.js` nuevo), Firestore, Apps Script (ES5), Node 24 para pruebas, Firebase emulator (Java 21 ya instalado) para las reglas.

**Spec:** [docs/superpowers/specs/2026-10-21-login-google-historial-design.md](../specs/2026-10-21-login-google-historial-design.md)

## Global Constraints

- Un solo `public/public/index.html`, SDK Firebase 10.12 por CDN, sin build ni bundler.
- Correos autorizados (exactos): `jonahlalvarez@gmail.com`, `mavidiaz092@gmail.com`; ambos con los mismos permisos.
- Todas las escrituras a Firestore pasan por `fbSave`, `fbAdd`, `fbDel` (hoy `index.html` ~l.889).
- El modo `?dry=1` sigue siendo solo-log y debe saltear el login.
- `historial` es de solo creación desde la app (sin editar ni borrar); la entrada declara `by.uid` igual al usuario logueado.
- El historial guarda el documento completo como valor anterior, sin retención ni diffs.
- Un fallo al escribir el historial no puede bloquear ni perder la acción principal.
- Los datos viejos no reciben autor; en el historial no hay entrada para ellos.
- `sw.js` sube `CACHE` de `compost-tracker-v5` a `compost-tracker-v6`.
- Orden de despliegue: primero la app nueva, después las reglas.
- Código en español, estilo del archivo (comentarios en español, funciones `window.xxx` para handlers).

## Review Focus

1. Una cuenta de Google no autorizada inicia sesión: no ve ningún dato (ni la copia local), ve "sin acceso" y su sesión se cierra. (Task 3)
2. Un fallo del batch (reglas, red) no pierde el cambio: se reintenta solo el documento principal y se avisa "sin historial". (Task 4)
3. Guardar sin cambios reales (el formulario de edición se guarda tal cual) no genera entrada de historial. (Task 1, 4)
4. Borrar una planta borra también sus registros: se muestran como un solo evento y Restaurar los vuelve todos juntos. (Task 4, 5)
5. Restaurar sobre un documento que hoy existe con otro valor pide confirmación; una entrada sin copia anterior (lectura previa falló sin conexión) no ofrece Restaurar. (Task 4, 5)

---

## File Structure

- Create `public/public/historial.js` — funciones puras: lista de correos, resumen en español, armado y agrupado de entradas, filtros, HTML de la lista.
- Create `public/public/escritor.js` — `crearEscritor(deps)`: `fbSave/fbAdd/fbDel/restaurar` con autor e historial, SDK inyectado.
- Modify `public/public/index.html` — imports de Auth, puerta de login, usuario en la barra, vista Historial, uso del escritor, `usuario` en `sheetSync`.
- Modify `public/firestore.rules` — reglas con lista de correos.
- Modify `codigo.gs`, `appscript_backfill_clima.txt`, `appscript_backfill_revolcadas_sistemas.txt` — columna "Cargado por" y llamadas autenticadas a Firestore.
- Modify `public/public/sw.js` — versión de caché y `historial.js`/`escritor.js` en el shell.
- Create `scripts/test-historial.mjs`, `scripts/test-escritor.mjs`, `scripts/test-reglas.mjs`; extend `scripts/test-altas-gs.mjs`.
- Create `package.json` + `.gitignore` en la raíz (solo para las pruebas de reglas), `docs/login-historial-despliegue.md`.

Pruebas existentes: `node scripts/test-altas-gs.mjs` debe seguir pasando en cada task.

---

### Task 1: Módulo puro `historial.js`

**Files:**
- Create: `public/public/historial.js`
- Test: `scripts/test-historial.mjs` (mismo estilo que `test-altas-gs.mjs`: helper `t(nombre, fn)`, `node:assert/strict`, `process.exitCode = 1` si falla)

**Interfaces:**
- Produces (todo exportado):
  - `CORREOS_AUTORIZADOS: string[]`
  - `esAutorizado(email: string): boolean` — sin distinguir mayúsculas; falso para vacío/undefined.
  - `nombreCorto(usuario: {nombre?: string, email: string}): string` — primer nombre; si no hay, parte local del correo.
  - `refDe(col: string, doc: object): {tipo: 'sistema'|'planta'|'pecera', id: string|number} | null` — sistemas→`{sistema, doc.id}`, revolcadas→`{sistema, doc.sistema}`, plantas→`{planta, doc.id}`, registroPlantas→`{planta, doc.planta}`, pecera/registroPecera→`{pecera, 'main'}`, clima→`null`.
  - `camposCambiados(previo: object|null, nuevo: object): string[]` — ignora `_ts`, `_by`, `_pend`; con `previo` nulo devuelve todos los campos de `nuevo`.
  - `resumir(e: {accion, col, datos, previo, usuario}, ctx: {plantaNombre(id): string, sistemaLabel(id): string}): string`
  - `armarEntrada(e: {accion: 'alta'|'edicion'|'baja'|'restauracion', col, docId, datos, previo, usuario: {uid,email,nombre}, grupo?: string|null, ahora: Date}, ctx): Entrada`
  - `agruparEntradas(entradas: Entrada[]): Array<Entrada[]>` — las que comparten `grupo` van juntas, en el lugar de la primera; sin `grupo` van solas.
  - `filtrarEntradas(entradas, f: {persona?: string, accion?: string, ref?: {tipo, id}}): Entrada[]`
  - `htmlGrupo(grupo: Entrada[], opc: {puedeRestaurar: boolean}): string` — todo texto del usuario escapado.
- `Entrada` = `{accion, col, docId, ref, resumen, previo, campos, by:{uid,email,nombre}, grupo, fechaLocal: string ISO}` (el `_ts` lo agrega el escritor).

- [ ] **Step 1: Escribir las pruebas que fallan**, con estos casos y aserciones exactas:
  - `esAutorizado('JonahLAlvarez@gmail.com') === true`, `esAutorizado('otro@gmail.com') === false`, `esAutorizado('') === false`.
  - `refDe('registroPlantas', {planta: 7}).id === 7`, `refDe('revolcadas', {sistema: 2}).tipo === 'sistema'`, `refDe('clima', {}) === null`.
  - `camposCambiados({a:1,_ts:1}, {a:1,_ts:2,_by:{}})` es `[]`; `camposCambiados({a:1}, {a:2,b:3})` es `['a','b']`.
  - `resumir` con usuario `{nombre:'Maria Diaz'}`: alta de `registroPlantas` `{tipo:'Riego', planta:3}` con `plantaNombre(3)='Limonero'` → exactamente `'Maria registró «Riego» en Limonero'`; baja de `plantas` → `'Maria eliminó Limonero'`; edición de `sistemas` con campos cambiados `notas` → `'Maria editó Sistema 2 (notas)'`; restauración de `plantas` → `'Maria restauró Limonero'`.
  - `armarEntrada` de edición: `previo` sin `_ts`, `campos` poblado, `fechaLocal === ahora.toISOString()`, `grupo === null` por defecto.
  - `agruparEntradas` con tres entradas (dos con `grupo:'g1'`, una sin) devuelve 2 grupos.
  - `htmlGrupo([{resumen: '<img onerror=x>', ...}], {puedeRestaurar:false})` no contiene `<img`; con `puedeRestaurar:true` y `previo` no nulo contiene el atributo `data-restaurar`; con `previo: null` no lo contiene; una `alta` nunca lo contiene.
- [ ] **Step 2:** `node scripts/test-historial.mjs` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `historial.js`** con las firmas de arriba. `htmlGrupo` muestra fecha local (`es-AR`), el resumen, y para grupos de más de una entrada "y N registros más"; el botón lleva `data-restaurar="<índice o docId>"` según lo que necesite Task 5 (decidirlo ahí y mantener esta función como única fuente del marcado).
- [ ] **Step 4:** `node scripts/test-historial.mjs` → todas `ok`.
- [ ] **Step 5: Commit** `feat: módulo puro de historial` (con la línea Co-Authored-By de la sesión).

---

### Task 2: Reglas de Firestore y su prueba

**Files:**
- Modify: `public/firestore.rules`
- Create: `package.json` (raíz, `"private": true`, `"type": "module"`, devDependencies `@firebase/rules-unit-testing` y `firebase` en versiones compatibles con firebase 10.x; verificar en npm), `.gitignore` (raíz: `node_modules/`)
- Test: `scripts/test-reglas.mjs`

**Interfaces:**
- Consumes: `CORREOS_AUTORIZADOS` de Task 1 (la prueba compara contra el texto de las reglas para que ambas listas no se desincronicen).
- Produces: reglas con `function autorizado()` = sesión iniciada, `email_verified == true` y correo en la lista; colecciones `sistemas, revolcadas, plantas, registroPlantas, pecera, registroPecera, clima`: leer si `autorizado()`; crear/actualizar si `autorizado()` y `request.resource.data._by.uid == request.auth.uid`; borrar si `autorizado()`. `historial`: leer si `autorizado()`; crear si `autorizado()` y `request.resource.data.by.uid == request.auth.uid`; `update, delete: false`. Todo lo demás denegado.

- [ ] **Step 1: Escribir `scripts/test-reglas.mjs`** (emulador, `initializeTestEnvironment` con las reglas del archivo) con estos casos, usando `testEnv.authenticatedContext(uid, {email, email_verified:true})`:
  - sin sesión: leer `sistemas/1` → `assertFails`.
  - sesión con `otro@gmail.com`: leer y escribir `sistemas/1` → `assertFails`.
  - sesión autorizada con `_by.uid` propio: escribir `sistemas/1` → `assertSucceeds`; con `_by.uid` ajeno → `assertFails`.
  - autorizada: crear `historial/h1` con `by.uid` propio → `assertSucceeds`; `updateDoc` y `deleteDoc` sobre `historial/h1` → `assertFails`.
  - autorizada: escribir en una colección no listada (`secreto/x`) → `assertFails`.
  - correo autorizado pero `email_verified:false` → `assertFails`.
  - el texto de `firestore.rules` contiene cada correo de `CORREOS_AUTORIZADOS` y ningún otro `@gmail.com`.
- [ ] **Step 2:** `npm install` y `npx firebase emulators:exec --only firestore --project compostaje-casero "node scripts/test-reglas.mjs"` desde la raíz (ajustar para que use `public/firebase.json`, p. ej. `--config public/firebase.json`) → FAIL con las reglas abiertas actuales.
- [ ] **Step 3: Reescribir `public/firestore.rules`** según Produces.
- [ ] **Step 4:** el mismo comando → todo `ok`.
- [ ] **Step 5: Commit** `feat: reglas de Firestore con lista de correos` — **no desplegar las reglas** (eso es el último paso del runbook, Task 7).

---

### Task 3: Puerta de login en `index.html`

**Files:**
- Modify: `public/public/index.html` (imports ~l.728; `init()` y su llamada ~l.2311–2330; barra superior/lateral ~l.493 y ~l.720 para el usuario)

**Interfaces:**
- Consumes: `esAutorizado`, `nombreCorto` de Task 1 (import `./historial.js` en el script inline).
- Produces: `window.usuarioActual(): {uid, email, nombre} | null` (en `?dry=1` devuelve un usuario falso `{uid:'dry', email:'dry@local', nombre:'Dry'}`); `window.salir()`; pantallas `#pg-login` ("Entrar con Google") y `#pg-sinacceso`; la app (`init()`) se ejecuta **una sola vez**, solo cuando hay un usuario autorizado.

- [ ] **Step 1:** Agregar imports de `firebase-auth.js` 10.12.0 (`getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut`). Persistencia por defecto (queda abierta, abre sin conexión).
- [ ] **Step 2:** Reemplazar la llamada directa `init()` por un `onAuthStateChanged`: sin usuario → mostrar `#pg-login` y ocultar el resto de la app; usuario con `esAutorizado(email)` falso → `signOut` y mostrar `#pg-sinacceso` con el correo rechazado y botón "Probar con otra cuenta"; autorizado → ocultar pantallas de acceso y llamar `init()` (guardar contra llamadas repetidas). En `DRY` se llama `init()` directo sin Auth.
- [ ] **Step 3:** Botón "Entrar con Google": `signInWithPopup` y, si falla con `auth/popup-blocked` o `auth/operation-not-supported-in-this-environment`, `signInWithRedirect`. Errores de red se muestran con `toast`.
- [ ] **Step 4:** Mostrar nombre y botón "Salir" del usuario en la barra (escritorio y móvil, mismo estilo que los botones existentes).
- [ ] **Step 5: Verificar en el navegador** (`preview_start` con la entrada de `.claude/launch.json`): sin `?dry=1` aparece `#pg-login` y no se renderiza ninguna pestaña ni dato; con `?dry=1` la app abre normal; la consola sin errores. (El login real con Google se prueba a mano con las dos cuentas en el runbook; no se automatiza.)
- [ ] **Step 6: Commit** `feat: login con Google y bloqueo de cuentas no autorizadas`.

---

### Task 4: Escritor con autor e historial

**Files:**
- Create: `public/public/escritor.js`
- Test: `scripts/test-escritor.mjs`
- Modify: `public/public/index.html` (definición de `fbSave/fbAdd/fbDel` ~l.889–891, sus llamadas ~l.884, 1974, 2014, 2022, 2032, 2060, 2078, 2090, 2101, 2106, 2115, 2124, `sheetSync` ~l.937)

**Interfaces:**
- Consumes: `armarEntrada`, `camposCambiados`, `refDe` (Task 1); `window.usuarioActual` (Task 3).
- Produces `crearEscritor(deps: {db, sdk: {doc, collection, getDoc, writeBatch, serverTimestamp}, getUsuario: () => usuario|null, ctx, dry: boolean, habilitado: () => boolean, ahora?: () => Date}): {fbSave, fbAdd, fbDel, restaurar}`:
  - `fbSave(col, id, data, opts?: {grupo?: string, sinHistorial?: boolean}): Promise<void>`
  - `fbAdd(col, data, opts?): Promise<string|null>` (devuelve el id del documento o `null`)
  - `fbDel(col, id, opts?): Promise<void>`
  - `restaurar(entrada: Entrada, opc?: {confirmarPisar: () => Promise<boolean>}): Promise<boolean>` — vuelve a escribir `entrada.previo` en `entrada.docId` y registra una entrada `restauracion`; `false` si no hay `previo` o el usuario no confirma el pisado.
- Comportamiento común: `dry` o `!habilitado()` o sin usuario → no escribe (en `dry` hace `console.info('[dry] …')` como hoy). Cada documento escrito lleva `_by: {uid,email,nombre}` y `_ts: serverTimestamp()`. El valor anterior se lee con `getDoc` antes de escribir; si esa lectura falla, `previo = null`. Documento y entrada de `historial` van en un mismo `writeBatch`; si el `commit` falla, se reintenta solo el documento principal y el resultado queda marcado sin historial (`console.warn` y el llamador puede avisar con toast). Los errores nunca se propagan (mismo contrato que hoy: `try/catch` silencioso).

- [ ] **Step 1: Escribir `scripts/test-escritor.mjs`** con un SDK falso (en memoria: `doc/collection` devuelven refs `{col,id}`, `getDoc` lee de un Map, `writeBatch` acumula `set/delete` y aplica en `commit`, con interruptor para hacer fallar el commit) y estos casos:
  - `fbSave` de un documento nuevo → 2 escrituras en el batch: el doc con `_by.uid` del usuario y una entrada `historial` con `accion:'alta'`.
  - `fbSave` de uno existente con un campo cambiado → entrada `edicion` con `previo` igual al documento anterior y `campos` con el campo cambiado.
  - `fbSave` con datos idénticos a los guardados → escribe el documento pero **no** crea entrada.
  - `fbSave('clima', …, {sinHistorial:true})` → ninguna entrada.
  - `fbDel` de un existente → entrada `baja` con `previo` completo; de uno inexistente → sin entrada.
  - `fbDel` de dos documentos con el mismo `opts.grupo` → ambas entradas con ese `grupo`.
  - `fbAdd` → devuelve el id generado y la entrada lleva ese `docId`.
  - commit del batch falla → el documento principal igual queda escrito y la función no lanza.
  - `getDoc` falla → la entrada se crea con `previo: null`.
  - `dry:true` → no hay escrituras en el SDK falso.
  - `restaurar` de una `baja` → reescribe el documento con el `previo` (sin `_ts`/`_by` viejos, con `_by` actual) y crea una entrada `restauracion`; si el documento existe con otro valor y `confirmarPisar` devuelve `false` → no escribe y devuelve `false`; con `previo: null` → `false`.
- [ ] **Step 2:** `node scripts/test-escritor.mjs` → FAIL.
- [ ] **Step 3: Implementar `crearEscritor`** en `escritor.js`.
- [ ] **Step 4:** `node scripts/test-escritor.mjs` → todas `ok`.
- [ ] **Step 5: Integrar en `index.html`:** importar `writeBatch, getDoc` de Firestore y `./escritor.js`; reemplazar las tres funciones por las del escritor construido con `ctx.plantaNombre`/`ctx.sistemaLabel` leyendo de `S` (reusar `pLbl` y `sLbl`); `autoFetch` usa `{sinHistorial:true}` para `clima`; `delPlanta` genera un `grupo` compartido para la planta y sus registros; si el escritor reporta "sin historial", mostrar `toast`. `sheetSync` agrega `usuario: usuarioActual()?.email` al cuerpo, a nivel de `{tipo, data, usuario}`.
- [ ] **Step 6: Verificar en el navegador con `?dry=1`:** guardar un sistema, una planta y una revolcada muestra en consola los `[dry]` correspondientes, la UI se comporta como antes y no hay errores.
- [ ] **Step 7: Commit** `feat: escrituras con autor e historial`.

---

### Task 5: Vista Historial con Restaurar

**Files:**
- Modify: `public/public/index.html` (nueva página `#pg-his`, `TABS`/`go`/`LEGACY` ~l.2134–2160, acceso desde el usuario de la barra de Task 3, estilos del archivo)
- Modify: `public/public/historial.js` si el marcado necesita ajustes (la prueba de Task 1 sigue siendo la fuente)

**Interfaces:**
- Consumes: `agruparEntradas`, `filtrarEntradas`, `htmlGrupo` (Task 1); `restaurar` (Task 4); `appConfirm` (existente).
- Produces: `window.abrirHistorial()`, `window.cargarMasHistorial()`, `window.restaurarEntrada(clave)`; la página no se agrega a la barra inferior (queda accesible desde el usuario de la barra, para no saturar las 4 pestañas del móvil).

- [ ] **Step 1:** Cargar `historial` con `query(collection(db,'historial'), orderBy('_ts','desc'), limit(50))` y "Ver más" con `startAfter` (mismo patrón que clima, ~l.1815). Mostrar agrupado y filtrable por persona, acción y planta/sistema (listas armadas desde lo cargado).
- [ ] **Step 2:** `restaurarEntrada` llama a `restaurar` con `confirmarPisar` apoyado en `appConfirm`; los registros de un `grupo` se restauran todos, en el orden inverso al borrado; al terminar `await fbLoad(); poblarSels(); refresh();` y `toast`. Estado vacío "Todavía no hay cambios registrados".
- [ ] **Step 3: Verificar en el navegador con `?dry=1`:** la página abre desde la barra, muestra el estado vacío, filtros presentes, sin errores de consola, y se ve bien en móvil (`resize_window` mobile). La lista con datos reales y Restaurar se verifican a mano con las cuentas reales (runbook).
- [ ] **Step 4: Commit** `feat: vista de historial con restaurar`.

---

### Task 6: Google Sheet y Apps Script

**Files:**
- Modify: `codigo.gs` (`doPost` ~l.1346, `guardar*Sheet`, y las llamadas `UrlFetchApp.fetch` a `firestore.googleapis.com` ~l.1551, 2667, 2689, 2720, 2775), `appscript_backfill_clima.txt`, `appscript_backfill_revolcadas_sistemas.txt`
- Test: `scripts/test-altas-gs.mjs` (extender con los casos de abajo)

**Interfaces:**
- Produces: `doPost` lee `body.usuario` (correo) y los `guardar*Sheet(d, usuario)` lo escriben en una columna nueva "Cargado por" de cada hoja: revolcadas col. 6 (F), registro de plantas col. 11 (K), registro de pecera col. 5 (E), sistemas col. 11 (K), plantas col. 21 (U, "Editado por"), pecera fila 2 col. 4 (D). **Verificar antes en cada hoja que esa columna esté libre** (encabezado vacío) y, si no, usar la siguiente libre; escribir el encabezado si falta. `function fsFetch_(url, opciones)`: envuelve `UrlFetchApp.fetch` agregando `Authorization: 'Bearer ' + ScriptApp.getOAuthToken()`; todas las llamadas a Firestore pasan por ella.

- [ ] **Step 1: Escribir las pruebas que fallan** en `test-altas-gs.mjs`: un POST de `revolcada` con `usuario:'a@b.c'` deja ese correo en la columna 6 de la fila nueva; sin `usuario` deja la celda vacía sin romper; el stub de `UrlFetchApp.fetch` recibe el header `Authorization: 'Bearer <token del stub>'` en las llamadas a Firestore.
- [ ] **Step 2:** `node scripts/test-altas-gs.mjs` → FAIL en lo nuevo, lo previo sigue `ok`.
- [ ] **Step 3: Implementar** `fsFetch_` y la columna en cada `guardar*Sheet`; aplicar `fsFetch_` también a los dos `.txt` de backfill.
- [ ] **Step 4:** `node scripts/test-altas-gs.mjs` → todo `ok`.
- [ ] **Step 5: Commit** `feat: Sheet con "Cargado por" y llamadas autenticadas a Firestore`. (El scope y la reautorización son manuales: ver Task 7.)

---

### Task 7: Service worker y runbook de despliegue

**Files:**
- Modify: `public/public/sw.js` (`CACHE` → `'compost-tracker-v6'`, `APP_SHELL` suma `/historial.js` y `/escritor.js`)
- Create: `docs/login-historial-despliegue.md`

- [ ] **Step 1:** Editar `sw.js` y verificar en el navegador que el service worker activa `v6` y que, sin conexión, la app sigue abriendo con la sesión iniciada.
- [ ] **Step 2: Escribir el runbook**, pasos en este orden, marcando cuáles ejecuta Jonah en consolas externas:
  1. Consola de Firebase → Authentication → habilitar proveedor Google.
  2. `firebase deploy --only hosting` (app nueva primero). Abrir la app, entrar con cada una de las dos cuentas y probar guardar un cambio, ver el Historial y Restaurar un borrado de prueba; probar con una tercera cuenta (debe ver "sin acceso").
  3. Apps Script: en la configuración del proyecto mostrar `appsscript.json` y agregar `https://www.googleapis.com/auth/datastore` a `oauthScopes`; ejecutar una función cualquiera para reautorizar; publicar nueva versión del Web App (la URL de `SHEET_SYNC_URL` no cambia si se redespliega la misma implementación). La cuenta dueña del script necesita rol de Cloud Datastore/Firestore en el proyecto `compostaje-casero`.
  4. Re-ejecutar `sincronizarPlantasAFirestore()` (aún con reglas abiertas) para confirmar que el token funciona.
  5. `firebase deploy --only firestore:rules` (último). Repetir el guardado de prueba y la sincronización del script; confirmar que una escritura sin sesión falla.
  6. Reversa: reponer la regla `allow read, write: if true` solo si algo crítico falla.
- [ ] **Step 3: Commit** `chore: sw v6 y runbook de despliegue`.

---

## Self-Review

- **Cobertura del spec:** login y bloqueo → T3; reglas con lista y `_by`/`by.uid` → T2; autor en cada documento + historial con previo → T4; vista, filtros y Restaurar → T5; Sheet "Cargado por" + autenticación de scripts → T6; orden de despliegue y caché v6 → T7; datos viejos sin autor → sin tarea (no se toca), pre-login no aparece en historial; offline/`dry` → T4. Clima automático excluido del historial (decisión mía de este plan: no son acciones de una persona y llenarían el registro), pero sí lleva autor.
- **Tipos:** `Entrada`, `usuario`, `ctx` y las firmas de `fbSave/fbAdd/fbDel/restaurar` son las mismas en T1, T4 y T5; `usuarioActual()` (T3) es lo que consume T4.
- **Proporción:** el plan prescribe interfaces y pruebas; los cuerpos los escribe quien implementa.
