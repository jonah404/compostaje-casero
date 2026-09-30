# Rediseño mobile: navegación, pantalla "Hoy" y rendimiento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las 8 pestañas por una barra inferior de 5, agregar una pantalla "Hoy" con tareas que se marcan con un toque, un botón "＋" para registrar, y acortar/aligerar lo que hoy carga de más.

**Architecture:** Cambio incremental sobre `public/public/index.html` (un solo archivo, JS de módulo ES6) y `public/public/sw.js`. "Hoy" se calcula en el cliente con las funciones que ya existen (`estPlanta`, `proxRev`, `estPecera`). Los formularios de "Registrar" se reutilizan (mismos ids) dentro de una hoja superpuesta. `go()` sigue siendo el enrutador, con alias para los ids viejos. No se toca `codigo.gs`.

**Tech Stack:** HTML/CSS/JS vanilla, Firebase Firestore 10.12 (CDN), Google Apps Script (Sheet sync, solo se llama, no se modifica), Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-09-30-rediseno-mobile-design.md`

## Global Constraints

Copiadas del spec:

- Barra inferior fija de **5 pestañas**: Hoy, Compost, Plantas, Huerta, Clima. En escritorio el menú lateral muestra los mismos 5 ítems.
- **Botón flotante "＋"** siempre visible; abre una hoja desde abajo con botones grandes; reemplaza la pestaña "Registrar".
- Compost = segmentos `Sistemas · Revolcadas`. Plantas = segmentos `Plantas · Pecera`. Huerta = aviso "próximamente". Fitosanitario pasa a ser una sección de la ficha de cada planta.
- Botones y filas de **al menos 44px**; textos secundarios de **12px como mínimo**.
- **Un toque + "Deshacer"** para riego, revolcada y cambio de agua. **Mini formulario prellenado** para fertilizar, plagas y poda.
- **Guardado diferido de 5 segundos** para "Deshacer": no se escribe nada hasta que pasan 5 s; si la app se cierra o pasa a segundo plano antes (`visibilitychange` / `pagehide`), se guarda en ese momento.
- Solo `clima` se limita al cargar de Firestore: **últimos 90 días**. Las demás colecciones se cargan completas.
- Service worker: guardar en caché fuentes de Google y íconos Tabler (actualización en segundo plano) y **subir la versión de la caché**.
- Se conserva la identidad visual (paleta tierra, DM Serif Display / DM Sans, modo oscuro). Sin limpieza masiva de estilos inline: lo que se reescriba usa clases.
- `go()` mantiene alias para los ids viejos (`'sist'`, `'rev'`, `'pec'`, `'fito'`, `'reg'`). Se recuerda la última pestaña abierta.
- **No se modifica `codigo.gs`.**
- Verificación manual en el navegador con vista de celular de 375px. **Nunca escribir en el Firestore real durante las pruebas** (ver "Entorno de verificación").
- Merge a `main` y push **al final**, una vez verificado.

## Desviaciones respecto del spec (descubiertas al leer el código)

1. **"Clima manual" no entra en el menú "＋"**: la app no tiene ningún formulario de clima manual (el clima llega solo de Open-Meteo). Se omite.
2. **Ventanas de "Próximos"**: riego pronto, revolcada, fertilizar y plagas entran a "Próximos" cuando faltan ≤3 días; la **poda** cuando faltan 0–30 días (igual que el aviso "poda se acerca" del calendario, que en Apps Script solo mira 0–30 días; una poda ya vencida no genera tarea).
3. **Frío en plantas de interior** también aparece entre los urgentes de "Hoy" (el spec lo listaba en el calendario, no en "Hoy"; se replica para que ambos coincidan).
4. Se agrega un **modo de prueba `?dry=1`** (las funciones de escritura solo loguean). El spec pedía "reemplazar las funciones de guardado por unas de prueba"; como el código está en un módulo ES, la única forma limpia es una bandera en la URL.
5. `sheetSync` gana `keepalive: true` para que el POST al Sheet sobreviva a un `pagehide`.

## Entorno de verificación

Este repo no tiene framework de tests. Cada tarea termina con verificación manual en el navegador integrado.

- Crear el worktree con la herramienta `EnterWorktree` (nombre `rediseno-mobile`). **Antes**, hacer `git push origin main` desde el checkout principal para que la rama parta de un `main` que ya incluya el spec y este plan.
- Servidor estático, desde la raíz del worktree (usar `run_in_background`, **no** `&`):

```bash
python -m http.server 8791 --directory public/public
```

- Abrir siempre `http://localhost:8791/index.html?dry=1` con `mcp__Claude_Browser__navigate`, y `mcp__Claude_Browser__resize_window` con `preset: "mobile"` (375×812). Al terminar, `preset: "desktop"`.
- Con `?dry=1`, Firestore y el Sheet **no reciben escrituras** (solo se leen datos reales); el `localStorage` del preview es distinto al de tu celular. Limpiar con `localStorage.removeItem('compost_v7')` si querés partir de cero.
- Los archivos usan saltos de línea CRLF (git avisa al agregarlos). Editar con la herramienta Edit; no normalizar.
- Cada tarea termina con **consola sin errores**: `mcp__Claude_Browser__read_console_messages` con `onlyErrors: true` debe devolver vacío.

**Auditoría táctil (pegar con `javascript_tool`):**

```js
(() => {
  const sel = '.bt,.fab,.seg button,.reg-item,.tk-btn,.mclose,.add-btn,.btn-g,.btn-o,.f input,.f select,.del-btn,.chip,.fold summary,.mob-sync';
  const small = [...document.querySelectorAll(sel)]
    .filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
    .map(e => { const r = e.getBoundingClientRect(); return { c: e.className, t: (e.innerText || '').slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter(x => x.h < 44 || x.w < 44);
  return { overflowX: document.documentElement.scrollWidth > innerWidth, small };
})()
```

## Estructura de archivos

| Archivo | Responsabilidad | Tareas |
|---|---|---|
| `public/public/index.html` | Toda la app: CSS, markup, JS de módulo | 1–9 |
| `public/public/sw.js` | Service worker (caché) | 8 |

Sin archivos nuevos: se mantiene el precedente de archivo único.

---

### Task 1: Modo de prueba `?dry=1`

**Files:**
- Modify: `public/public/index.html` (bloque `SHEET_SYNC_URL`, ~línea 660; `fbSave/fbAdd/fbDel`, ~799–801; `sheetSync`, ~826–833)

**Interfaces:**
- Produces: constante `DRY` (boolean). Con `DRY`, `fbSave`, `fbAdd`, `fbDel` y `sheetSync` solo hacen `console.info('[dry] ...')`. `fbAdd` devuelve `null`.

- [ ] **Step 1: Agregar la bandera**

Justo después de la línea `const SHEET_SYNC_URL = "...";` agregar:

```js
// ?dry=1 → las funciones de escritura (Firestore/Sheet) solo loguean; sirve para
// probar la UI en el navegador sin tocar datos reales.
const DRY = new URLSearchParams(location.search).has('dry');
```

- [ ] **Step 2: Proteger las escrituras de Firestore**

Reemplazar las tres constantes `fbSave`, `fbAdd`, `fbDel` por:

```js
const fbSave = async (col, id, data) => { if (DRY) { console.info('[dry] fbSave', col, id); return; } if (!useFirebase) return; try { await setDoc(doc(db,col,String(id)),{...data,_ts:serverTimestamp()}); } catch(e){} };
const fbAdd  = async (col, data) => { if (DRY) { console.info('[dry] fbAdd', col, data); return null; } if (!useFirebase) return null; try { const r=await addDoc(collection(db,col),{...data,_ts:serverTimestamp()}); return r.id; } catch(e){ return null; } };
const fbDel  = async (col, id)   => { if (DRY) { console.info('[dry] fbDel', col, id); return; } if (!useFirebase) return; try { await deleteDoc(doc(db,col,String(id))); } catch(e){} };
```

- [ ] **Step 3: Proteger el Sheet y agregar `keepalive`**

Reemplazar `sheetSync` por:

```js
const sheetSync = (tipo, data) => {
  if (!SHEET_SYNC_URL) return;
  if (DRY) { console.info('[dry] sheetSync', tipo, data); return; }
  fetch(SHEET_SYNC_URL, {
    method: 'POST', mode: 'no-cors', keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ tipo, data })
  }).catch(()=>{});
};
```

- [ ] **Step 4: Verificar**

Levantar el servidor y abrir `http://localhost:8791/index.html?dry=1` en vista mobile. Esperar 3 s y correr:

`read_console_messages` con `pattern: "[dry]"` → **Expected:** líneas `[dry] fbSave clima c-2026-…` (el auto-fetch de clima del día).
`read_network_requests` con `urlPattern: "firestore.googleapis.com"` → **Expected:** no aparece ninguna petición de escritura (`Commit`/`batchWrite`); a lo sumo las de lectura (`Listen`/`runQuery`).
`read_console_messages` con `onlyErrors: true` → **Expected:** vacío.

- [ ] **Step 5: Commit**

```bash
git add public/public/index.html
git commit -m "feat: modo de prueba ?dry=1 (escrituras a Firestore/Sheet solo loguean) y keepalive en sheetSync

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Andamiaje de navegación (barra inferior, segmentos, `go()`)

**Files:**
- Modify: `public/public/index.html` (viewport ~línea 5; CSS `.mob-tabs`/`.mt`/media query ~187–213; markup sidebar ~426–435 y `.mob-tabs` ~458–469; páginas ~471–510; JS de navegación ~1883–1909 y cada `cur===`)

**Interfaces:**
- Produces:
  - `TABS = ['hoy','comp','pla','hue','cli']`.
  - `go(id)`: acepta `'hoy'|'comp'|'pla'|'hue'|'cli'` y los alias `'dash'|'sist'|'rev'|'pec'`. `'fito'` y `'reg'` siguen funcionando como páginas sueltas hasta las Tareas 6 y 3.
  - `setSeg(tab, seg)`: `('comp','sist'|'rev')`, `('pla','pla'|'pec')`.
  - `refresh()`: vuelve a dibujar la pestaña visible.
  - `cur` vale `'hoy'|'comp'|'pla'|'hue'|'cli'|'fito'|'reg'`.
  - Contenedores: `#pg-hoy > #dash-c` (temporal hasta la Tarea 4), `#pane-sist`, `#pane-rev`, `#pane-pla`, `#pane-pec`, `#pg-cli`, `#pg-hue`.

- [ ] **Step 1: Viewport con zona segura**

Reemplazar la meta viewport por:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

- [ ] **Step 2: CSS — reemplazar la barra superior por la inferior**

Borrar las reglas `.mob-tabs`, `.mob-tabs-inner`, `.mt`, `.mt i`, `.mt.on`, `.mt.on i` (~187–205) y reemplazar el bloque `@media (max-width: 767px) { .sidebar ... .pages {...} }` (~207–213) por:

```css
/* segmented control (Compost: Sistemas/Revolcadas · Plantas: Plantas/Pecera) */
.seg { display: flex; gap: 4px; padding: 4px; background: var(--paper2); border-radius: var(--rl); margin-bottom: 14px; position: sticky; top: 0; z-index: 5; }
.seg button { flex: 1; min-height: 44px; border: none; background: none; border-radius: var(--r); font-family: var(--sans); font-size: 14px; font-weight: 600; color: var(--ink3); cursor: pointer; }
.seg button.on { background: var(--paper); color: var(--sage); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.seg-pane { display: none; }
.seg-pane.on { display: block; }

/* barra inferior (mobile) */
.bnav { display: none; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; background: var(--side-bg); border-top: 1px solid var(--rule2); padding-bottom: env(safe-area-inset-bottom); }
.bnav-in { display: grid; grid-template-columns: repeat(5, 1fr); }
.bt { min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: none; background: none; cursor: pointer; font-family: var(--sans); font-size: 12px; font-weight: 600; color: var(--ink3); }
.bt i { font-size: 22px; }
.bt.on { color: var(--side-act); }
.bt.on i { color: var(--side-on); }

@media (max-width: 767px) {
  .sidebar { display: none; }
  .mob-hdr { display: flex; }
  .bnav { display: block; }
  .topbar { display: none; }
  .pages { padding: 14px 14px calc(150px + env(safe-area-inset-bottom)); }
  .toast { bottom: calc(140px + env(safe-area-inset-bottom)); }
}
```

- [ ] **Step 3: Markup — sidebar y barra inferior**

Reemplazar el `<nav class="sb-nav">…</nav>` por:

```html
  <nav class="sb-nav">
    <button class="sn on" data-tab="hoy"  onclick="go('hoy')"><i class="ti ti-home"></i>Hoy</button>
    <button class="sn"    data-tab="comp" onclick="go('comp')"><i class="ti ti-recycle"></i>Compost</button>
    <button class="sn"    data-tab="pla"  onclick="go('pla')"><i class="ti ti-leaf"></i>Plantas</button>
    <button class="sn"    data-tab="hue"  onclick="go('hue')"><i class="ti ti-plant-2"></i>Huerta</button>
    <button class="sn"    data-tab="cli"  onclick="go('cli')"><i class="ti ti-cloud"></i>Clima</button>
  </nav>
```

Borrar el bloque `<div class="mob-tabs">…</div>` completo. Justo antes de `<div class="toast h" id="toast"></div>` agregar:

```html
<nav class="bnav"><div class="bnav-in">
  <button class="bt on" data-tab="hoy"  onclick="go('hoy')"><i class="ti ti-home"></i>Hoy</button>
  <button class="bt"    data-tab="comp" onclick="go('comp')"><i class="ti ti-recycle"></i>Compost</button>
  <button class="bt"    data-tab="pla"  onclick="go('pla')"><i class="ti ti-leaf"></i>Plantas</button>
  <button class="bt"    data-tab="hue"  onclick="go('hue')"><i class="ti ti-plant-2"></i>Huerta</button>
  <button class="bt"    data-tab="cli"  onclick="go('cli')"><i class="ti ti-cloud"></i>Clima</button>
</div></nav>
```

- [ ] **Step 4: Markup — páginas**

Dentro de `<div class="pages" id="pages">`, reemplazar los bloques INICIO, SISTEMAS, REVOLCADAS, CLIMA, PLANTAS, PECERA y FITOSANITARIO (desde `<!-- INICIO -->` hasta antes de `<!-- REGISTRAR -->`) por lo siguiente. **`<!-- REGISTRAR -->` (`#pg-reg`) no se toca** y el bloque FITOSANITARIO se conserva tal cual (se elimina en la Tarea 6):

```html
    <!-- HOY -->
    <div class="pg on" id="pg-hoy"><div id="dash-c"></div></div>

    <!-- COMPOST -->
    <div class="pg" id="pg-comp">
      <div class="seg" id="seg-comp">
        <button class="on" data-s="sist" onclick="setSeg('comp','sist')">Sistemas</button>
        <button data-s="rev" onclick="setSeg('comp','rev')">Revolcadas</button>
      </div>
      <div class="seg-pane on" id="pane-sist">
        <div id="sist-c"></div>
        <button class="add-btn" onclick="addSis()"><i class="ti ti-plus"></i> Agregar sistema</button>
      </div>
      <div class="seg-pane" id="pane-rev">
        <div style="max-width:260px;margin-bottom:14px">
          <div class="f"><select id="hf" onchange="renderRev()">
            <option value="todos">Todos los sistemas</option>
          </select></div>
        </div>
        <div class="tbl-wrap"><div class="tbl-scroll"><div id="rev-c"></div></div></div>
      </div>
    </div>

    <!-- PLANTAS -->
    <div class="pg" id="pg-pla">
      <div class="seg" id="seg-pla">
        <button class="on" data-s="pla" onclick="setSeg('pla','pla')">Plantas</button>
        <button data-s="pec" onclick="setSeg('pla','pec')">Pecera</button>
      </div>
      <div class="seg-pane on" id="pane-pla">
        <div id="pla-c"></div>
        <button class="add-btn" onclick="addPlanta()"><i class="ti ti-plus"></i> Agregar planta</button>
      </div>
      <div class="seg-pane" id="pane-pec"><div id="pec-c"></div></div>
    </div>

    <!-- HUERTA -->
    <div class="pg" id="pg-hue">
      <div class="card" style="text-align:center;padding:40px 20px">
        <div style="font-size:40px">🥬</div>
        <div style="font-family:var(--serif);font-size:20px;margin:8px 0">Huerta</div>
        <div style="font-size:13px;color:var(--ink3)">Próximamente: hortalizas y aromáticas con su seguimiento.</div>
      </div>
    </div>

    <!-- CLIMA -->
    <div class="pg" id="pg-cli">
      <div class="fetch-bar hide" id="fetch-bar"><i class="ti ti-cloud-download"></i> Actualizando clima desde Open-Meteo...</div>
      <div id="cli-c"></div>
    </div>

    <!-- FITOSANITARIO (se elimina en la Tarea 6) -->
    <div class="pg" id="pg-fito">
      <div id="fito-c"></div>
    </div>
```

- [ ] **Step 5: JS — reemplazar la sección `NAVEGACIÓN`**

Reemplazar todo desde `// ════ NAVEGACIÓN ════` hasta el cierre de `window.go` por:

```js
// ════ NAVEGACIÓN ════
let cur = 'hoy';
const TABS   = ['hoy','comp','pla','hue','cli'];
const TITLES = {hoy:'Hoy',comp:'Compost',pla:'Plantas',hue:'Huerta',cli:'Clima',fito:'Fitosanitario',reg:'Registrar'};
// ids viejos → nueva ubicación (openSis/openPla/etc. todavía los usan)
const LEGACY = { dash:{tab:'hoy'}, sist:{tab:'comp',seg:'sist'}, rev:{tab:'comp',seg:'rev'}, pec:{tab:'pla',seg:'pec'} };
const renderTab = t => {
  if (t==='hoy')  renderDash();
  if (t==='comp') { renderSist(); renderRev(); }
  if (t==='pla')  { renderPla(); renderPec(); }
  if (t==='cli')  renderCli();
  if (t==='fito') renderFito();
};
window.refresh = () => renderTab(cur);
window.setSeg = (tab, s) => {
  document.querySelectorAll(`#seg-${tab} button`).forEach(b => b.classList.toggle('on', b.dataset.s === s));
  document.querySelectorAll(`#pg-${tab} .seg-pane`).forEach(p => p.classList.toggle('on', p.id === 'pane-'+s));
  refresh();
};
window.go = t => {
  let seg = null;
  if (LEGACY[t]) { seg = LEGACY[t].seg || null; t = LEGACY[t].tab; }
  cur = t;
  document.querySelectorAll('.sn,.bt').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.getElementById('pg-'+t).classList.add('on');
  document.getElementById('pages').scrollTop = 0;
  const ttEl = document.getElementById('tb-title'); if (ttEl) ttEl.textContent = TITLES[t] || '';
  if (TABS.includes(t)) { try { localStorage.setItem('compost_tab', t); } catch(e) {} }
  if (t === 'reg') {
    loadSis();
    if(!document.getElementById('rf').value) document.getElementById('rf').value=fISO(TODAY);
    if(!document.getElementById('pf').value) document.getElementById('pf').value=fISO(TODAY);
    if(!document.getElementById('kf').value) document.getElementById('kf').value=fISO(TODAY);
    loadPecera();
    actualizarProblemaSel();
  } else if (seg) setSeg(t, seg);
  else refresh();
};
```

- [ ] **Step 6: JS — reemplazar cada `cur===…` por `refresh()`**

Correr `Grep` con patrón `cur===` sobre `index.html`. Reemplazar **cada línea o par de sentencias** que decida qué renderizar según `cur` por una sola llamada `refresh();`. Los puntos esperados (11):

`saveRev`, `savePlanta`, `saveEventoPlanta`, `savePecera`, `saveEventoPecera`, `saveSis`, `delSis` (la línea `if(cur==='dash') renderDash();`), `doSync` (las tres líneas `if(cur==='dash')…`, `cur==='cli'`, `cur==='rev'` → una sola `refresh();`), y en `init` los dos `.then(…)` (auto-fetch y `fbLoad`). Ejemplo, `saveRev` pasa de:

```js
  if(cur==='dash') renderDash(); if(cur==='rev') renderRev();
```
a:
```js
  refresh();
```

Las llamadas directas (`renderPla()`, `renderSist()`, `renderRev()`, `renderPec()` en `addPlanta`, `addSis`, `delSis`, `delRev`, `delEventoPecera`) **se dejan**: los paneles existen aunque estén ocultos.

Al terminar, `Grep` de `cur===` debe dar **0** resultados salvo dentro de `go()`/`renderTab()`.

- [ ] **Step 7: JS — `init` restaura la última pestaña**

En `init`, reemplazar la línea `renderDash();` por:

```js
  let t0 = 'hoy';
  try { const g = localStorage.getItem('compost_tab'); if (TABS.includes(g)) t0 = g; } catch(e) {}
  go(t0);
```

- [ ] **Step 8: Verificar**

Abrir `?dry=1` en 375px.

`read_page` con `filter: "interactive"` → **Expected:** 5 botones `.bt` (Hoy, Compost, Plantas, Huerta, Clima) visibles abajo.
`javascript_tool`: `document.documentElement.scrollWidth <= innerWidth` → **Expected:** `true` (sin scroll horizontal).
`javascript_tool` con la secuencia `['comp','pla','hue','cli','hoy'].map(t => { go(t); return document.querySelector('.pg.on').id; })` → **Expected:** `["pg-comp","pg-pla","pg-hue","pg-cli","pg-hoy"]`.
`javascript_tool`: `go('sist'); [document.querySelector('.pg.on').id, document.querySelector('#pg-comp .seg-pane.on').id]` → **Expected:** `["pg-comp","pane-sist"]`; y con `go('pec')` → `["pg-pla","pane-pec"]`; con `go('rev')` → `["pg-comp","pane-rev"]`.
Tocar "Compost" y recargar la página → **Expected:** vuelve a abrir en Compost.
Consola sin errores. Screenshot en 375px y otro en modo oscuro (`resize_window` con `colorScheme: "dark"`).

- [ ] **Step 9: Commit**

```bash
git add public/public/index.html
git commit -m "feat: barra inferior de 5 pestanas, segmentos Compost/Plantas y refresh() central

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hoja de registro y botón flotante "＋"

**Files:**
- Modify: `public/public/index.html` (CSS; markup de `#pg-reg` ~línea 513; JS `go()`, `addSis`, `addPlanta`, `openSis`, `openPla`, y las funciones `save*`)

**Interfaces:**
- Consumes: `refresh()`, `cur` (Tarea 2).
- Produces:
  - `openRegistro(fc?, pre?)`: `fc` ∈ `'fc-rev'|'fc-sisEdit'|'fc-plaEvt'|'fc-plaEdit'|'fc-pecEvt'|'fc-pecData'` (sin `fc` → muestra el menú). `pre` admite `{sistema, planta, tipo}`; `tipo` es el texto exacto de una opción del `<select>` (`#pt` para plantas, `#kt` para pecera).
  - `closeRegistro()`.
  - Los `save*` cierran la hoja al guardar.
  - `go('reg')` **deja de existir** (se elimina la rama `reg` de `go()` y de `TITLES`).

- [ ] **Step 1: CSS de la hoja y del botón**

Agregar al final del bloque `<style>` (antes de `</style>`):

```css
/* hoja de registro + botón flotante */
.regsheet { position: fixed; inset: 0; z-index: 60; background: var(--cream); overflow-y: auto; padding: 0 14px calc(24px + env(safe-area-inset-bottom)); }
.regsheet > * { max-width: 560px; margin-left: auto; margin-right: auto; }
.regsheet .form-row { display: block; margin-top: 0 !important; }
.regsheet .fc { display: none; }
.regsheet .fc.on { display: block; }
.reg-hdr { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 14px 0; background: var(--cream); }
.reg-hdr h2 { flex: 1; font-family: var(--serif); font-size: 20px; color: var(--ink); }
.reg-hdr .mclose { width: 44px; height: 44px; font-size: 18px; }
.reg-grp { font-size: 12px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--ink3); margin: 18px 0 8px; }
.reg-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.reg-item { min-height: 72px; border: 1px solid var(--rule2); background: var(--paper); border-radius: var(--rl); font-family: var(--sans); font-size: 14px; font-weight: 600; color: var(--ink); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.reg-item span { font-size: 24px; }
.fab { position: fixed; right: 18px; bottom: 24px; width: 56px; height: 56px; border-radius: 50%; border: none; background: var(--sage); color: #fff; font-size: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.3); z-index: 41; }
.fab:active { transform: scale(.94); }
@media (max-width: 767px) { .fab { bottom: calc(56px + env(safe-area-inset-bottom) + 16px); } }
```

- [ ] **Step 2: Markup — clase, encabezado y menú de `#pg-reg`**

Cambiar `<div class="pg" id="pg-reg">` por:

```html
    <div class="pg regsheet" id="pg-reg">
      <div class="reg-hdr">
        <button class="mclose" id="reg-back" onclick="openRegistro()" aria-label="Volver">‹</button>
        <h2 id="reg-title">Registrar</h2>
        <button class="mclose" onclick="closeRegistro()" aria-label="Cerrar">✕</button>
      </div>
      <div id="reg-menu">
        <div class="reg-grp">Registrar</div>
        <div class="reg-grid">
          <button class="reg-item" data-ctx="pla"  onclick="openRegistro('fc-plaEvt',{tipo:'💧 Riego'})"><span>💧</span>Regar</button>
          <button class="reg-item" data-ctx="pla"  onclick="openRegistro('fc-plaEvt',{tipo:'🌿 Fertilización'})"><span>🌿</span>Fertilizar</button>
          <button class="reg-item" data-ctx="pla"  onclick="openRegistro('fc-plaEvt',{tipo:'🐛 Revisión plagas'})"><span>🐛</span>Plagas</button>
          <button class="reg-item" data-ctx="pla"  onclick="openRegistro('fc-plaEvt',{tipo:'✂️ Poda'})"><span>✂️</span>Poda</button>
          <button class="reg-item" data-ctx="pla"  onclick="openRegistro('fc-plaEvt',{tipo:'🍂 Cosecha'})"><span>🍂</span>Cosecha</button>
          <button class="reg-item" data-ctx="comp" onclick="openRegistro('fc-rev')"><span>🔄</span>Revolcada</button>
          <button class="reg-item" data-ctx="pla"  onclick="openRegistro('fc-pecEvt',{tipo:'💧 Cambio de agua parcial'})"><span>🐟</span>Cambio de agua</button>
          <button class="reg-item" data-ctx="pla"  onclick="openRegistro('fc-pecEvt')"><span>🐠</span>Otro de pecera</button>
        </div>
        <div class="reg-grp">Editar</div>
        <div class="reg-grid">
          <button class="reg-item" data-ctx="comp" onclick="openRegistro('fc-sisEdit')"><span>⚙️</span>Sistema</button>
          <button class="reg-item" data-ctx="pla"  onclick="openRegistro('fc-plaEdit')"><span>⚙️</span>Planta</button>
          <button class="reg-item" data-ctx="pla"  onclick="openRegistro('fc-pecData')"><span>⚙️</span>Datos de pecera</button>
        </div>
      </div>
```

(El resto del bloque —los `.form-row` con los formularios— queda igual.)

- [ ] **Step 3: Ids en los seis formularios**

Con Edit, agregar `id` a cada `<div class="fc">` según su `<h3>`:

| `<h3>` contiene | id |
|---|---|
| `Nueva revolcada` | `fc-rev` |
| `Editar sistema` | `fc-sisEdit` |
| `Nueva actividad de planta` | `fc-plaEvt` |
| `Editar planta` | `fc-plaEdit` |
| `Nuevo evento de pecera` | `fc-pecEvt` |
| `Datos de la pecera` | `fc-pecData` |

Ejemplo: `<div class="fc">` + `<h3><i class="ti ti-refresh"></i>Nueva revolcada</h3>` pasa a `<div class="fc" id="fc-rev">`.

- [ ] **Step 4: Botón flotante**

Justo antes de `<nav class="bnav">` agregar:

```html
<button class="fab" onclick="openRegistro()" aria-label="Registrar"><i class="ti ti-plus"></i></button>
```

- [ ] **Step 5: JS — `openRegistro`/`closeRegistro`**

En la sección `NAVEGACIÓN`, **borrar** en `go()` el bloque `if (t === 'reg') { … } else if (seg)` dejándolo como `if (seg) setSeg(t, seg); else refresh();`, y quitar `reg:'Registrar'` de `TITLES`. Después de `window.go` agregar:

```js
// ════ HOJA DE REGISTRO ════
const REG_TITLES = { 'fc-rev':'Nueva revolcada', 'fc-sisEdit':'Editar sistema', 'fc-plaEvt':'Actividad de planta', 'fc-plaEdit':'Editar planta', 'fc-pecEvt':'Evento de pecera', 'fc-pecData':'Datos de la pecera' };
window.openRegistro = (fc, pre = {}) => {
  const hoy = fISO(TODAY);
  ['rf','pf','kf'].forEach(id => { document.getElementById(id).value = hoy; });
  if (fc === 'fc-rev' && pre.sistema) document.getElementById('rs').value = pre.sistema;
  if (fc === 'fc-sisEdit') { if (pre.sistema) document.getElementById('es').value = pre.sistema; loadSis(); }
  if (fc === 'fc-plaEvt' && pre.planta) document.getElementById('pv').value = pre.planta;
  if (fc === 'fc-plaEvt' && pre.tipo) document.getElementById('pt').value = pre.tipo;
  if (fc === 'fc-plaEdit') { if (pre.planta) document.getElementById('epv').value = pre.planta; loadPlanta(); }
  if (fc === 'fc-pecEvt' && pre.tipo) document.getElementById('kt').value = pre.tipo;
  if (fc === 'fc-pecData') loadPecera();
  actualizarProblemaSel();
  document.getElementById('reg-menu').style.display = fc ? 'none' : '';
  Object.keys(REG_TITLES).forEach(id => document.getElementById(id).classList.toggle('on', id === fc));
  document.getElementById('reg-title').textContent = fc ? REG_TITLES[fc] : 'Registrar';
  document.getElementById('reg-back').style.visibility = fc ? 'visible' : 'hidden';
  // Sugerir primero lo de la pestaña actual (Compost → revolcada, Plantas → plantas)
  document.querySelectorAll('.reg-item').forEach(b => { b.style.order = b.dataset.ctx === cur ? '-1' : '0'; });
  const sheet = document.getElementById('pg-reg');
  sheet.classList.add('on'); sheet.scrollTop = 0;
};
window.closeRegistro = () => document.getElementById('pg-reg').classList.remove('on');
```

- [ ] **Step 6: Callers que usaban `go('reg')`**

Con `Grep` de `go('reg')` (esperados: `addSis`, `addPlanta`, y 4 botones dentro de `openSis`/`openPla`):

- `addSis`: reemplazar `go('reg'); document.getElementById('es').value = nid; loadSis();` por `openRegistro('fc-sisEdit', {sistema:nid});`
- `addPlanta`: reemplazar `go('reg'); document.getElementById('epv').value = nid; loadPlanta();` por `openRegistro('fc-plaEdit', {planta:nid});`
- `openSis`: `closeMod();go('reg');document.getElementById('rs').value=${id}` → `closeMod();openRegistro('fc-rev',{sistema:${id}})`; y `closeMod();go('reg');document.getElementById('es').value=${id};loadSis()` → `closeMod();openRegistro('fc-sisEdit',{sistema:${id}})`.
- `openPla`: `closeMod();go('reg');document.getElementById('pv').value=${id};actualizarProblemaSel()` → `closeMod();openRegistro('fc-plaEvt',{planta:${id}})`; y `closeMod();go('reg');document.getElementById('epv').value=${id};loadPlanta()` → `closeMod();openRegistro('fc-plaEdit',{planta:${id}})`.

- [ ] **Step 7: Los `save*` cierran la hoja**

En `saveRev`, `saveSis`, `savePlanta`, `saveEventoPlanta`, `savePecera` y `saveEventoPecera`, agregar `closeRegistro();` inmediatamente antes de la línea `toast(…)` de éxito.

- [ ] **Step 8: Verificar**

En 375px, con `?dry=1`:

`Grep` de `go('reg')` → **Expected:** 0 resultados.
`computer` click en el botón "＋" → **Expected:** se abre la hoja con "Registrar" y los botones en grilla de 2 columnas.
Con `go('comp')` y luego abrir "＋" → **Expected:** "Revolcada" y "Sistema" aparecen primero (`.reg-item` con `order:-1`).
`javascript_tool`: `openRegistro('fc-plaEvt',{tipo:'💧 Riego'}); [document.getElementById('pt').value, document.querySelector('.fc.on').id, document.getElementById('pf').value === new Date().toISOString().split('T')[0]]` → **Expected:** `["💧 Riego","fc-plaEvt",true]`.
Tocar "Guardar evento" → **Expected:** la hoja se cierra, toast "✅ Evento guardado", consola con `[dry] fbAdd registroPlantas` y `[dry] sheetSync plantaEvento`.
En Plantas, abrir una planta → "Registrar evento" → **Expected:** abre la hoja con esa planta elegida.
Auditoría táctil → **Expected:** `.bt`, `.fab`, `.reg-item` y `.seg button` sin fallas.

- [ ] **Step 9: Commit**

```bash
git add public/public/index.html
git commit -m "feat: boton flotante + y hoja de registro (reemplaza la pestana Registrar)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pantalla "Hoy"

**Files:**
- Modify: `public/public/index.html` (CSS; `#pg-hoy`; `estPlanta` ~1028; nueva sección JS `HOY` después de `renderDash`; `renderTab`)

**Interfaces:**
- Consumes: `estPlanta(p)`, `proxRev(s)`, `estPecera()`, `cdDia`, `perfilEspecie`, `est(s)`, `sLbl`, `pLbl`, `dd`, `fISO`, `TODAY`, `n1`, `CFG_PEC`, `refresh()`, `openRegistro()` (Tareas 2–3).
- Produces:
  - `estPlanta(p)` devuelve además `fertEnTemporada: boolean`.
  - `armarTareasHoy() → { hoy: Tarea[], prox: Tarea[] }` con
    `Tarea = { id, area:'compost'|'plantas'|'pecera', tipo:'revolcada'|'riego'|'fert'|'plagas'|'poda'|'cambio-agua'|'filtro', ref:number|null, titulo:string, detalle:string, atraso:number, modo:'uno'|'form' }`.
  - `diferidos`: `Map<string, {timer, commit}>` (vacío hasta la Tarea 5).
  - `renderHoy()`, `tareaTap(id)` (esqueleto; se completa en la Tarea 5), `window.armarTareasHoy` expuesta para depurar.

- [ ] **Step 1: `estPlanta` expone la temporada de fertilización**

En el `return` de `estPlanta`, cambiar la línea `proximaFert: fert.proxima, diasParaFert: fert.dias, fertUrg: …` por:

```js
    proximaFert: fert.proxima, diasParaFert: fert.dias, fertEnTemporada: !fueraDeTemporadaFert, fertUrg: !fueraDeTemporadaFert && fert.dias!=null && fert.dias<=0,
```

- [ ] **Step 2: CSS de "Hoy"**

Agregar al final del bloque `<style>`:

```css
/* HOY */
.hoy-date { font-family: var(--serif); font-size: 22px; color: var(--ink); text-transform: capitalize; margin-bottom: 10px; }
.chips { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 14px; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chip { flex: 0 0 auto; min-height: 44px; padding: 0 14px; border: 1px solid var(--rule2); background: var(--paper); color: var(--ink); border-radius: 22px; font-family: var(--sans); font-size: 13px; font-weight: 600; cursor: pointer; }
.tk-grp { font-size: 12px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--ink3); margin: 16px 0 6px; }
.tk { display: flex; align-items: center; gap: 10px; min-height: 56px; padding: 8px 8px 8px 14px; margin-bottom: 8px; background: var(--paper); border: 1px solid var(--rule); border-left: 3px solid var(--umber-mid); border-radius: var(--r); }
.tk-late { border-left-color: var(--rust-mid); }
.tk-body { flex: 1; min-width: 0; }
.tk-t { font-size: 14px; font-weight: 600; color: var(--ink); }
.tk-d { font-size: 12px; color: var(--ink3); margin-top: 2px; }
.tk-btn { flex: 0 0 auto; min-width: 48px; min-height: 48px; border: none; border-radius: var(--r); background: var(--sage); color: #fff; font-size: 20px; font-weight: 700; font-family: var(--sans); cursor: pointer; }
.tk-undo { background: var(--paper2); color: var(--ink); font-size: 13px; padding: 0 14px; }
.tk-done { opacity: .75; border-left-color: var(--sage-mid); }
.tk-done .tk-t { text-decoration: line-through; }
.tk-empty { text-align: center; font-family: var(--serif); font-size: 18px; padding: 24px 16px; }
.fold { margin-top: 12px; }
.fold summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--ink2); }
```

- [ ] **Step 2b: Contenedor**

Cambiar `<div class="pg on" id="pg-hoy"><div id="dash-c"></div></div>` por `<div class="pg on" id="pg-hoy"><div id="hoy-c"></div></div>`.

- [ ] **Step 3: JS — construir las tareas**

Agregar justo después de `renderDash` (antes de `// ════ RENDER SISTEMAS ════`):

```js
// ════ HOY ════
// Une lo que ya calculan estPlanta/proxRev/estPecera en una lista de tareas.
// Mismos criterios que el evento "Tareas de hoy" del calendario (codigo.gs).
const ETQ      = { riego:'regar', fert:'fertilizar', plagas:'revisar plagas', poda:'poda', revolcada:'revolver' };
const TIPO_EVT = { riego:'💧 Riego', fert:'🌿 Fertilización', plagas:'🐛 Revisión plagas', poda:'✂️ Poda' };
const AREAS_HOY = [ {id:'compost', t:'🌱 Compost'}, {id:'plantas', t:'🪴 Plantas'}, {id:'pecera', t:'🐠 Pecera'} ];
const TEMP_CALOR = 38, TEMP_HELADA = 2, TEMP_HELADA_SEVERA = -2;
const diferidos = new Map();   // id de tarea → { timer, commit } (ver "marcar hecho")
let TAREAS = new Map();

const armarTareasHoy = () => {
  const hoy = [], prox = [];
  S.sistemas.forEach(s => {
    const p = proxRev(s); if (!p) return;
    const d = dd(TODAY, p);
    const base = { id:`revolcada-${s.id}`, area:'compost', tipo:'revolcada', ref:s.id, titulo:`${sLbl(s)} · revolver`, modo:'uno' };
    if (d <= 0) hoy.push({ ...base, detalle: d < 0 ? `atrasado ${-d} d` : 'toca hoy', atraso: -d });
    else if (d <= 3) prox.push({ ...base, detalle:`en ${d} d`, atraso: -d });
  });
  S.plantas.forEach(p => {
    const e = estPlanta(p);
    const base = (tipo, modo) => ({ id:`${tipo}-${p.id}`, area:'plantas', tipo, ref:p.id, titulo:`${pLbl(p)} · ${ETQ[tipo]}`, modo });
    if (e.riegoUrg) hoy.push({ ...base('riego','uno'), detalle:`${e.diasSinAgua} días sin agua (límite ${e.limite})`, atraso: e.diasSinAgua - e.limite });
    else if (e.riegoProx) prox.push({ ...base('riego','uno'), detalle:`${e.diasSinAgua} días sin agua`, atraso: 0 });
    [ { tipo:'fert', dias:e.diasParaFert, activo:e.fertEnTemporada }, { tipo:'plagas', dias:e.diasParaPlagas, activo:true } ].forEach(c => {
      if (!c.activo || c.dias == null) return;
      if (c.dias <= 0) hoy.push({ ...base(c.tipo,'form'), detalle: c.dias < 0 ? `${-c.dias} días de atraso` : 'toca hoy', atraso: -c.dias });
      else if (c.dias <= 3) prox.push({ ...base(c.tipo,'form'), detalle:`en ${c.dias} d`, atraso: -c.dias });
    });
    // Igual que "poda se acerca" del calendario: solo de 0 a 30 días antes.
    if (e.diasParaPoda != null && e.diasParaPoda >= 0 && e.diasParaPoda <= 30) {
      prox.push({ ...base('poda','form'), detalle: e.diasParaPoda === 0 ? 'toca hoy' : `en ${e.diasParaPoda} d`, atraso: -e.diasParaPoda });
    }
  });
  const ep = estPecera();
  const pec = (tipo, titulo, modo) => ({ id:`pec-${tipo}`, area:'pecera', tipo, ref:null, titulo, modo });
  if (ep.cambioUrg) hoy.push({ ...pec('cambio-agua','Cambio de agua','uno'), detalle:`${ep.diasSinCambio} días sin cambio (objetivo cada ${ep.limiteCambio} d)`, atraso: ep.diasSinCambio - ep.limiteCambio });
  else if (ep.diasSinCambio != null && ep.limiteCambio - ep.diasSinCambio <= 3) prox.push({ ...pec('cambio-agua','Cambio de agua','uno'), detalle:`en ${ep.limiteCambio - ep.diasSinCambio} d`, atraso: 0 });
  if (ep.limpiezaUrg) hoy.push({ ...pec('filtro','Limpiar filtro/esponja','form'), detalle:`${ep.diasSinLimpieza} días sin limpiar`, atraso: ep.diasSinLimpieza - CFG_PEC.diasLimpiezaFiltro });
  return { hoy, prox };
};
window.armarTareasHoy = armarTareasHoy;

// Lo ya registrado hoy (de los mismos tipos que generan tareas).
const hechasHoy = () => {
  const hoyISO = fISO(TODAY), out = [];
  S.revolcadas.filter(r => r.fecha === hoyISO).forEach(r => {
    const s = S.sistemas.find(x => x.id === r.sistema);
    out.push({ titulo:`${s ? sLbl(s) : 'Sistema '+r.sistema} · revolcada` });
  });
  S.registroPlantas.filter(r => r.fecha === hoyISO && /Riego|Fertiliz|plagas|Poda/.test(r.tipo)).forEach(r => {
    const p = S.plantas.find(x => x.id === r.planta);
    out.push({ titulo:`${p ? pLbl(p) : 'Planta'} · ${r.tipo.replace(/^\S+\s/, '')}` });
  });
  S.registroPecera.filter(r => r.fecha === hoyISO && /Cambio de agua|Limpieza/.test(r.tipo)).forEach(r => {
    out.push({ titulo:`Pecera · ${r.tipo.replace(/^\S+\s/, '')}` });
  });
  return out;
};

// Urgentes: helada, frío en interior, calor extremo, compost listo (mismos umbrales que codigo.gs).
const urgentesHoy = () => {
  const out = [];
  const ult = [...S.clima].sort((a,b) => a.fecha > b.fecha ? -1 : 1)[0];
  const esInt = p => { const pf = perfilEspecie(p.especie || p.nombre); return !!(pf && pf.tipo === 'Interior'); };
  if (ult && ult.tmin != null && ult.tmin !== '') {
    const tmin = +ult.tmin;
    if (S.plantas.some(p => !esInt(p)) && tmin <= TEMP_HELADA) {
      const sev = tmin <= TEMP_HELADA_SEVERA;
      out.push({ c: sev ? 'al-r' : 'al-w', t: (sev ? '🧊 Helada severa' : '❄️ Helada') + ' — proteger plantas de exterior', b:`Mínima registrada: ${n1(tmin)}°C` });
    }
    const frias = S.plantas.filter(p => { const pf = esInt(p) && perfilEspecie(p.especie || p.nombre); return pf && pf.tempMin != null && tmin <= pf.tempMin + 2; });
    if (frias.length) out.push({ c:'al-w', t:'🥶 Frío — alejar de la ventana', b: frias.map(pLbl).join(', ') });
  }
  if (ult && ult.tmax != null && ult.tmax !== '' && +ult.tmax >= TEMP_CALOR) out.push({ c:'al-r', t:'🔥 Calor extremo — revisar humedad del compost', b:`Máxima registrada: ${n1(ult.tmax)}°C` });
  S.sistemas.filter(s => est(s).fase === 'l').forEach(s => out.push({ c:'al-ok', t:`🎉 ${sLbl(s)} — listo para cosechar`, b:'Más de 180 días en estanque' }));
  return out;
};
```

- [ ] **Step 4: JS — dibujar la pantalla**

Debajo de lo anterior:

```js
const filaTarea = (t, enEspera = false) => `<div class="tk ${enEspera ? 'tk-done' : (t.atraso > 0 ? 'tk-late' : '')}">
  <div class="tk-body"><div class="tk-t">${t.titulo}</div><div class="tk-d">${enEspera ? 'Registrado — se guarda en unos segundos' : t.detalle}</div></div>
  ${enEspera
    ? `<button class="tk-btn tk-undo" onclick="deshacerTarea('${t.id}')">Deshacer</button>`
    : `<button class="tk-btn" aria-label="${t.modo === 'uno' ? 'Marcar hecha' : 'Registrar'}" onclick="tareaTap('${t.id}')">${t.modo === 'uno' ? '✓' : '›'}</button>`}
</div>`;

const renderHoy = () => {
  const { hoy, prox } = armarTareasHoy();
  TAREAS = new Map([...hoy, ...prox].map(t => [t.id, t]));
  const pend  = hoy.filter(t => !diferidos.has(t.id));
  const hechas = hechasHoy();
  const urg   = urgentesHoy();
  const ch    = cdDia(fISO(TODAY)) || [...S.clima].sort((a,b) => a.fecha > b.fecha ? -1 : 1)[0];
  const nC = pend.filter(t => t.area === 'compost').length, nP = pend.filter(t => t.area === 'plantas').length;
  const seccion = a => {
    const l = hoy.filter(t => t.area === a.id).sort((x,y) => y.atraso - x.atraso);
    return l.length ? `<div class="tk-grp">${a.t}</div>${l.map(t => filaTarea(t, diferidos.has(t.id))).join('')}` : '';
  };
  document.getElementById('hoy-c').innerHTML = `
    <div class="hoy-date">${TODAY.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</div>
    <div class="chips">
      <button class="chip" onclick="go('cli')">${ch ? `🌡 ${n1(ch.temp)}°${+ch.mm > 0 ? ` · ☔ ${n1(ch.mm)} mm` : ''}` : '🌡 —'}</button>
      <button class="chip" onclick="go('comp')">🌱 Compost · ${nC}</button>
      <button class="chip" onclick="go('pla')">🪴 Plantas · ${nP}</button>
    </div>
    ${urg.map(a => `<div class="al ${a.c}"><div class="al-t">${a.t}</div>${a.b ? `<div class="al-b">${a.b}</div>` : ''}</div>`).join('')}
    <div class="sh">Tareas de hoy <span class="sh-sub">${pend.length}</span></div>
    ${hoy.length
      ? AREAS_HOY.map(seccion).join('')
      : `<div class="card tk-empty">Todo al día 🌿${prox[0] ? `<div class="tk-d" style="font-family:var(--sans)">Próximo: ${prox[0].titulo} — ${prox[0].detalle}</div>` : ''}</div>`}
    ${hechas.length ? `<details class="fold"><summary>Hechas hoy · ${hechas.length}</summary>${hechas.map(h => `<div class="tk tk-done"><div class="tk-body"><div class="tk-t">${h.titulo}</div></div></div>`).join('')}</details>` : ''}
    ${prox.length ? `<details class="fold"><summary>Próximos · ${prox.length}</summary>${prox.map(t => `<div class="tk"><div class="tk-body"><div class="tk-t">${t.titulo}</div><div class="tk-d">${t.detalle}</div></div></div>`).join('')}</details>` : ''}`;
};
window.renderHoy = renderHoy;

// Se completa en la Tarea 5.
window.tareaTap = id => { const t = TAREAS.get(id); if (t) toast(`${t.titulo} (pendiente de conectar)`); };
window.deshacerTarea = () => {};
```

- [ ] **Step 5: `renderTab` usa `renderHoy`**

En `renderTab`, cambiar `if (t==='hoy')  renderDash();` por `if (t==='hoy')  renderHoy();`.

- [ ] **Step 6: Verificar**

En 375px con `?dry=1`, tab "Hoy":

`javascript_tool`: `JSON.stringify(armarTareasHoy().hoy.map(t => t.id))` → **Expected:** lista de ids con el formato `riego-1`, `revolcada-1`, `pec-cambio-agua`, etc.
Comparar con la realidad: **Expected:** cada tarea de "Hoy" tiene su equivalente en el evento "🌿 Tareas de hoy" del calendario de hoy y/o en las insignias de la pestaña Plantas (💧 Regar, 🌿 Fertilizar, 🐛 Revisar plagas). Si hay diferencias, revisar el criterio (excepciones documentadas arriba: poda solo 0–30 días y en "Próximos").
`read_page` → **Expected:** fecha, 3 chips, alertas urgentes (si corresponden), "Tareas de hoy N", secciones por área, y `<details>` "Hechas hoy" / "Próximos".
Tocar un chip → **Expected:** navega a la pestaña correspondiente.
Consola sin errores. Screenshot en claro y oscuro.

- [ ] **Step 7: Commit**

```bash
git add public/public/index.html
git commit -m "feat: pantalla Hoy con tareas por area, urgentes, hechas y proximos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Marcar como hecho (un toque, "Deshacer" y mini formulario)

**Files:**
- Modify: `public/public/index.html` (funciones `saveRev`, `saveEventoPlanta`, `saveEventoPecera`; sección `HOY`)

**Interfaces:**
- Consumes: `armarTareasHoy`, `TAREAS`, `diferidos`, `renderHoy`, `TIPO_EVT` (Tarea 4); `openRegistro`, `closeRegistro` (Tarea 3).
- Produces:
  - `registrarRevolcada(sistema, fecha, obs?) → Promise<r>`
  - `registrarEventoPlanta(planta, fecha, tipo, detalle?, producto?, resultado?) → Promise<r>`
  - `registrarEventoPecera(fecha, tipo, detalle?, resultado?) → Promise<r>`
  - `tareaTap(id)`, `deshacerTarea(id)`, `DEMORA_DESHACER = 5000`.

- [ ] **Step 1: Extraer las funciones de registro**

Agregar en la sección `ACCIONES`, antes de `window.saveRev`:

```js
// Escritura compartida entre los formularios y los toques de "Hoy".
const registrarRevolcada = async (sistema, fecha, obs = '') => {
  const r = { id:Date.now().toString(), sistema, fecha, obs };
  S.revolcadas.push(r); sv();
  const fbId = await fbAdd('revolcadas', r); if (fbId) { r.id = fbId; sv(); }
  sheetSync('revolcada', r);
  return r;
};
const registrarEventoPlanta = async (planta, fecha, tipo, detalle = '', producto = '', resultado = '') => {
  const r = { id:'ev'+Date.now(), planta, fecha, tipo, detalle, producto, resultado };
  S.registroPlantas.push(r); sv();
  const fbId = await fbAdd('registroPlantas', r); if (fbId) { r.id = fbId; sv(); }
  sheetSync('plantaEvento', r);
  return r;
};
const registrarEventoPecera = async (fecha, tipo, detalle = '', resultado = '') => {
  const r = { id:'kv'+Date.now(), fecha, tipo, detalle, resultado };
  S.registroPecera.push(r); sv();
  const fbId = await fbAdd('registroPecera', r); if (fbId) { r.id = fbId; sv(); }
  sheetSync('peceraEvento', r);
  return r;
};
```

- [ ] **Step 2: Los formularios usan las funciones nuevas**

Reemplazar `saveRev`, `saveEventoPlanta` y `saveEventoPecera` por:

```js
window.saveRev = async () => {
  const f = document.getElementById('rf').value, si = +document.getElementById('rs').value;
  if (!f) { toast('Completá la fecha'); return; }
  await registrarRevolcada(si, f, document.getElementById('ro').value);
  document.getElementById('ro').value = '';
  closeRegistro();
  toast(`✅ Revolcada guardada — Sistema ${si}`);
  refresh();
};
window.saveEventoPlanta = async () => {
  const pid = +document.getElementById('pv').value, f = document.getElementById('pf').value;
  if (!f) { toast('Completá la fecha'); return; }
  await registrarEventoPlanta(pid, f, document.getElementById('pt').value, document.getElementById('pd').value, document.getElementById('pp').value, document.getElementById('pr').value);
  ['pd','pp','pr'].forEach(x => document.getElementById(x).value = '');
  closeRegistro();
  toast(`✅ Evento guardado — ${pLbl(S.plantas.find(p => p.id === pid))}`);
  refresh();
};
window.saveEventoPecera = async () => {
  const f = document.getElementById('kf').value;
  if (!f) { toast('Completá la fecha'); return; }
  const tipo = document.getElementById('kt').value;
  await registrarEventoPecera(f, tipo, document.getElementById('kd').value, document.getElementById('kr').value);
  ['kd','kr'].forEach(x => document.getElementById(x).value = '');
  closeRegistro();
  toast(`✅ Evento de pecera guardado — ${tipo}`);
  refresh();
};
```

- [ ] **Step 3: Guardado diferido**

En la sección `HOY`, **reemplazar** las dos últimas líneas de la Tarea 4 (`window.tareaTap = …` y `window.deshacerTarea = …`) por:

```js
// ── Marcar como hecho ────────────────────────────────────────────────
// El guardado real se demora DEMORA_DESHACER ms: si se toca "Deshacer" antes,
// nunca se escribe nada. No se escribe-y-luego-borra porque la sincronización
// diaria del Sheet puede resucitar documentos borrados de Firestore.
const DEMORA_DESHACER = 5000;
const ejecutarTarea = t => {
  const hoy = fISO(TODAY);
  if (t.tipo === 'revolcada')   return registrarRevolcada(t.ref, hoy);
  if (t.tipo === 'riego')       return registrarEventoPlanta(t.ref, hoy, TIPO_EVT.riego);
  if (t.tipo === 'cambio-agua') return registrarEventoPecera(hoy, '💧 Cambio de agua parcial');
};
const marcarHecha = t => {
  if (diferidos.has(t.id)) return;
  const commit = async () => {
    const d = diferidos.get(t.id); if (!d) return;
    clearTimeout(d.timer); diferidos.delete(t.id);
    await ejecutarTarea(t);
    toast(`✅ Registrado — ${t.titulo}`);
    refresh();
  };
  diferidos.set(t.id, { timer: setTimeout(commit, DEMORA_DESHACER), commit });
  renderHoy();
};
window.deshacerTarea = id => {
  const d = diferidos.get(id); if (!d) return;
  clearTimeout(d.timer); diferidos.delete(id);
  renderHoy();
};
// Si la app se cierra o pasa a segundo plano dentro de la demora, se guarda ya.
const vaciarDiferidos = () => [...diferidos.values()].forEach(d => d.commit());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') vaciarDiferidos(); });
window.addEventListener('pagehide', vaciarDiferidos);

window.tareaTap = id => {
  const t = TAREAS.get(id); if (!t) return;
  if (t.modo === 'uno') { marcarHecha(t); return; }
  if (t.tipo === 'filtro') openRegistro('fc-pecEvt', { tipo:'🧽 Limpieza de filtro/esponja' });
  else openRegistro('fc-plaEvt', { planta:t.ref, tipo:TIPO_EVT[t.tipo] });
};
```

- [ ] **Step 4: Verificar**

En 375px con `?dry=1`, tab "Hoy" (si no hay tareas de riego/revolcada/cambio de agua, forzar una de prueba: `localStorage.setItem` no sirve; en su lugar abrir Plantas → una planta → "Editar planta" y poner una fecha de plantación antigua, o usar cualquier tarea que exista):

1. Tocar **✓** de una tarea de un toque → **Expected:** la fila pasa a estilo "hecha" con botón **Deshacer** y el contador baja.
2. Tocar **Deshacer** dentro de 5 s → **Expected:** la fila vuelve a normal; `read_console_messages` con `pattern: "[dry]"` **no** muestra ningún `fbAdd`/`sheetSync` nuevo.
3. Tocar **✓** y esperar 6 s → **Expected:** toast "✅ Registrado — …", la tarea desaparece de "Tareas de hoy" y aparece en "Hechas hoy"; consola con `[dry] fbAdd …` y `[dry] sheetSync …`.
4. Tocar **✓** y disparar `window.dispatchEvent(new Event('pagehide'))` de inmediato → **Expected:** el `[dry] fbAdd` aparece al instante (sin esperar los 5 s).
5. Tocar **›** de una tarea de fertilizar/plagas → **Expected:** se abre la hoja con "Actividad de planta", la planta y el tipo (`#pt`) ya elegidos y la fecha de hoy; guardar → hoja cerrada, tarea fuera de "Tareas de hoy".
6. Consola sin errores.

Limpiar el `localStorage` del preview al terminar: `localStorage.removeItem('compost_v7')`.

- [ ] **Step 5: Commit**

```bash
git add public/public/index.html
git commit -m "feat: marcar tareas de Hoy con un toque + Deshacer (guardado diferido) y mini formulario

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Reubicar contenido (Compost, Plantas, Clima) y Fitosanitario en la ficha

**Files:**
- Modify: `public/public/index.html` (`renderDash` se elimina; nuevas `renderCompostResumen`, `renderPlaResumen`, `climaHeadHTML`; `renderCli`; `openPla`; `renderFito` y `#pg-fito` se eliminan; `renderTab`)

**Interfaces:**
- Consumes: `analisis()`, `analisisExtra()`, `donutSVG`, `ringSVG`, `hbarSVG`, `climaSparkSVG`, `est`, `estPlanta`, `sysHTML`, `fichaFito`, `nivelVigilancia`, `NIVEL_LABEL`.
- Produces: `renderCompostResumen()` (`#comp-resumen`), `renderPlaResumen()` (`#pla-resumen`), `climaHeadHTML()`, `fitoHTML(p)`. Se **eliminan** `renderDash`, `renderFito`, `#pg-fito`, `#dash-c`.

- [ ] **Step 1: Contenedores**

En `#pane-sist`, antes de `<div id="sist-c"></div>` agregar `<div id="comp-resumen"></div>`. En `#pane-pla`, antes de `<div id="pla-c"></div>` agregar `<div id="pla-resumen"></div>`. Borrar el bloque `<!-- FITOSANITARIO … -->` (`#pg-fito`).

- [ ] **Step 2: Resumen de Compost**

Agregar después de `renderSist`:

```js
// ════ RESUMEN DE COMPOST (antes en Inicio) ════
const renderCompostResumen = () => {
  const an = analisis(), ax = analisisExtra();
  const cnt = f => S.sistemas.filter(s => s.inicioC && est(s).fase === f).length;
  const n = { c:cnt('c'), s:cnt('s'), q:cnt('q'), l:cnt('l') };
  const donut = donutSVG([
    {value:n.c, color:'var(--chart-1)'}, {value:n.s, color:'var(--chart-2)'},
    {value:n.q, color:'var(--chart-3)'}, {value:n.l, color:'var(--chart-5)'},
  ]);
  const legend = [
    {n:'En carga', v:n.c, c:'var(--chart-1)'}, {n:'En estanque', v:n.s, c:'var(--chart-2)'},
    {n:'Casi listo', v:n.q, c:'var(--chart-3)'}, {n:'Listo', v:n.l, c:'var(--chart-5)'},
  ];
  const revBarMax = Math.max(1, ...S.sistemas.map(s => S.revolcadas.filter(r => r.sistema === s.id).length));
  const colorPct = p => p == null ? 'var(--ink3)' : p >= 80 ? 'var(--chart-1)' : p >= 50 ? 'var(--chart-3)' : 'var(--chart-4)';
  document.getElementById('comp-resumen').innerHTML = `
    <div class="card">
      <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:10px">Estado de sistemas</div>
      <div class="donut-wrap">
        ${donut}
        <div class="donut-legend">
          ${legend.map(l => `<div class="donut-legend-item"><span style="display:flex;align-items:center;gap:7px"><span class="donut-dot" style="background:${l.c}"></span>${l.n}</span><b>${l.v}</b></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="ring-row">
      <div class="ring-tile">
        ${ringSVG(ax.pctRevolcadas, colorPct(ax.pctRevolcadas))}
        <div class="ring-tile-l">Revolcadas en tiempo</div>
        <div class="ring-tile-s">${ax.totalPares ? ax.totalPares+' intervalos' : 'sin datos'}</div>
      </div>
    </div>
    <div class="card">
      <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:10px">Revolcadas por sistema</div>
      ${S.sistemas.some(s => s.inicioC) ? hbarSVG(
        S.sistemas.filter(s => s.inicioC).map((s,i) => ({
          label: sLbl(s),
          value: S.revolcadas.filter(r => r.sistema === s.id).length,
          color: ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-5)','var(--chart-4)'][i%5]
        })), revBarMax
      ) : `<div style="font-size:13px;color:var(--ink3)">Sin sistemas activos.</div>`}
    </div>
    <div class="cond">
      <div class="cond-hdr"><span class="cond-t">Índice de condición</span><span class="cond-s" style="color:${an.ic}">${an.idx}/100</span></div>
      <div class="cond-bar"><div class="cond-f" style="width:${an.idx}%;background:${an.ic}"></div></div>
      <div style="font-size:13px;color:${an.ic};font-weight:700;margin-bottom:10px">${an.il2}</div>
      <div class="pills">
        <span class="pill" style="background:${an.cr?'var(--sage-bg)':'var(--umber-bg)'};color:${an.cr?'var(--sage)':'var(--umber)'}">🔄 ${an.cr?'Conviene revolver':'Esperar para revolver'}</span>
        <span class="pill" style="background:${an.nr?'var(--umber-bg)':'var(--sage-bg)'};color:${an.nr?'var(--umber)':'var(--sage)'}">💧 ${an.nr?'Necesita riego':'Riego OK'}</span>
        ${an.df ? `<span class="pill" style="background:var(--sky-bg);color:var(--sky)">❄️ ${an.df}d de frío</span>` : ''}
      </div>
    </div>
    <div class="sh">Sistemas</div>`;
};
```

- [ ] **Step 3: Resumen de Plantas**

Agregar después de `renderPla`:

```js
// ════ RESUMEN DE PLANTAS (antes en Inicio) ════
const renderPlaResumen = () => {
  const ax = analisisExtra();
  const ests = S.plantas.map(estPlanta);
  const nUrg = ests.filter(e => e.riegoUrg).length;
  const nProx = ests.filter(e => e.riegoProx).length;
  const nOk = ests.length - nUrg - nProx;
  const donut = donutSVG([
    {value:nOk, color:'var(--chart-1)'}, {value:nProx, color:'var(--chart-3)'}, {value:nUrg, color:'var(--chart-4)'},
  ], 112, 15, 'plantas');
  const legend = [ {n:'Al día', v:nOk, c:'var(--chart-1)'}, {n:'Riego pronto', v:nProx, c:'var(--chart-3)'}, {n:'Regar ahora', v:nUrg, c:'var(--chart-4)'} ];
  document.getElementById('pla-resumen').innerHTML = S.plantas.length ? `
    <div class="card">
      <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:10px">Riego de plantas</div>
      <div class="donut-wrap">
        ${donut}
        <div class="donut-legend">
          ${legend.map(l => `<div class="donut-legend-item"><span style="display:flex;align-items:center;gap:7px"><span class="donut-dot" style="background:${l.c}"></span>${l.n}</span><b>${l.v}</b></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="ring-row">
      <div class="ring-tile">
        ${ringSVG(ax.pctPlantas, ax.pctPlantas == null ? 'var(--ink3)' : ax.pctPlantas >= 80 ? 'var(--chart-1)' : ax.pctPlantas >= 50 ? 'var(--chart-3)' : 'var(--chart-4)')}
        <div class="ring-tile-l">Plantas al día</div>
        <div class="ring-tile-s">${ax.totalPlantas} plantas</div>
      </div>
    </div>
    <div class="sh">Plantas</div>` : '';
};
```

- [ ] **Step 4: Cabecera de Clima**

Agregar antes de `renderCli`:

```js
// ════ CABECERA DE CLIMA (antes en Inicio): gráfico de 21 días + clima reciente ════
const climaHeadHTML = () => {
  const ch = cdDia(fISO(TODAY)) || [...S.clima].sort((a,b) => a.fecha > b.fecha ? -1 : 1)[0];
  return `<div class="card">
    <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:8px">Temperatura y lluvia — últimos 21 días</div>
    ${climaSparkSVG(21)}
    <div class="sep"></div>
    <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:10px">Clima reciente <span class="sh-sub">${ch ? fmt(ch.fecha) : ''}</span></div>
    ${ch ? `<div>
      <div class="clh-row">
        <div><div class="clh-temp">${n1(ch.temp)}°</div><div class="clh-sub">${ch.lluvia==='si' ? '☔ Llovió' : 'Sin lluvia'}${+ch.mm>0 ? ' — '+n1(ch.mm)+' mm' : ''}</div></div>
        <div class="clh-right"><div class="clh-hum">${n0(ch.hum)}<span>%</span></div><div class="clh-mini">humedad relativa</div></div>
      </div>
      <div class="clg">
        <div class="cli"><div class="cli-l">Máx</div><div class="cli-v">${n1(ch.tmax)}<span class="cli-u">°C</span></div></div>
        <div class="cli"><div class="cli-l">Mín</div><div class="cli-v">${n1(ch.tmin)}<span class="cli-u">°C</span></div></div>
        <div class="cli"><div class="cli-l">Viento</div><div class="cli-v">${n1(ch.viento)}<span class="cli-u"> km/h</span></div></div>
        <div class="cli"><div class="cli-l">Evapo</div><div class="cli-v">${n1(ch.evapo)}<span class="cli-u"> mm</span></div></div>
      </div>
    </div>` : `<div style="font-size:13px;color:var(--ink3)">Sin datos. Pulsá Sincronizar.</div>`}
  </div>`;
};
```

En `renderCli`, cambiar el bloque final para anteponerla:

```js
  document.getElementById('cli-c').innerHTML =
    climaHeadHTML() +
    `<div class="sh">Resumen <span class="sh-sub">análisis climatico</span></div>${statsHTML}` +
    `<div class="sh">Historial <span class="sh-sub">${sorted.length} días — colores por valor</span></div>` +
    tableHTML;
```

- [ ] **Step 5: Fitosanitario dentro de la ficha de la planta**

Reemplazar `renderFito` (y su `window.renderFito = renderFito;`) por:

```js
// ════ FITOSANITARIO (sección de la ficha de cada planta) ════
const fitoHTML = p => {
  const ficha = fichaFito(p.nombre); // por nombre, no por especie (ver nota en Task 2 del plan fitosanitario)
  if (!ficha) return '';
  const nivel = nivelVigilancia(ficha, TODAY.getMonth()+1);
  const rows = ficha.problemas.map(pr => `<tr>
      <td>${pr.nombre}</td>
      <td style="font-size:12px;color:var(--ink3)">${pr.sintoma}</td>
      <td style="font-size:12px"><b>${pr.producto}</b><br><span style="color:var(--ink3)">${pr.dosis}</span></td>
    </tr>`).join('');
  return `<details class="fold" open>
    <summary>🐛 Fitosanitario · ${nivel} ${NIVEL_LABEL[nivel]}</summary>
    <div style="font-size:12px;color:var(--ink3);margin:6px 0"><b>Momento crítico:</b> ${ficha.momentoCritico}</div>
    <div style="font-size:12px;color:var(--ink3);margin-bottom:10px"><b>Qué monitorear:</b> ${ficha.monitoreo}</div>
    <div style="overflow-x:auto"><table class="rtbl" style="width:100%">
      <thead><tr><th>Problema</th><th>Qué vas a ver</th><th>Producto / Dosis</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div style="font-size:12px;color:var(--ink3);font-style:italic;margin-top:10px">Referencia general — confirmá contra la etiqueta de tu producto, las concentraciones varían entre marcas. Para plagas persistentes o graves, conviene un diagnóstico específico antes de tratar.</div>
  </details>`;
};
```

En `openPla`, justo antes de la línea `<div style="font-family:var(--serif);font-size:17px;color:var(--ink);margin:18px 0 10px">Historial</div>` agregar `${fitoHTML(p)}` (dentro de la plantilla).

- [ ] **Step 6: Actualizar `renderTab`, `TITLES`, `LEGACY`**

```js
const renderTab = t => {
  if (t==='hoy')  renderHoy();
  if (t==='comp') { renderCompostResumen(); renderSist(); renderRev(); }
  if (t==='pla')  { renderPlaResumen(); renderPla(); renderPec(); }
  if (t==='cli')  renderCli();
};
```

Quitar `fito:'Fitosanitario'` de `TITLES` y agregar `fito:{tab:'pla',seg:'pla'}` a `LEGACY`.

- [ ] **Step 7: Eliminar `renderDash`**

Borrar la función `renderDash` completa (desde `const renderDash = () => {` hasta su `};` de cierre, ~líneas 1291–1456) y las variables solo usadas por ella si quedan sin referencias (`Grep` de `statTile(` debe seguir dando resultados solo si otra función lo usa; si da 0, borrar `statTile`).

- [ ] **Step 8: Verificar**

`Grep` de `renderDash|renderFito|dash-c|pg-fito` → **Expected:** 0 resultados.
En 375px con `?dry=1`:
- Compost/Sistemas → **Expected:** donut de estados, anillo de revolcadas, barras por sistema, índice de condición y luego la lista de sistemas.
- Plantas → **Expected:** donut de riego y anillo "Plantas al día" arriba de la lista.
- Tocar una planta con ficha (mandarina, limonero, ciruela, durazno) → **Expected:** en el modal aparece "🐛 Fitosanitario" con la tabla; una planta de interior no muestra esa sección.
- Clima → **Expected:** el gráfico de 21 días y "Clima reciente" arriba.
- `go('fito')` → **Expected:** abre Plantas (alias) sin error.
Consola sin errores.

- [ ] **Step 9: Commit**

```bash
git add public/public/index.html
git commit -m "refactor: mover analisis a Compost/Plantas/Clima y Fitosanitario a la ficha de la planta

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Clima acortado y carga limitada de Firestore

**Files:**
- Modify: `public/public/index.html` (import de Firestore ~644; `fbLoad` ~809; `renderCli`)

**Interfaces:**
- Produces: `climaMas()` (async, expuesta en `window`), `CLIMA_DIAS_INICIAL = 14`, `CLIMA_DIAS_FIRESTORE = 90`.

- [ ] **Step 1: Importar `limit` y `startAfter`**

Cambiar el import de Firestore por:

```js
import {
  getFirestore, collection, doc,
  setDoc, getDocs, addDoc, deleteDoc,
  query, orderBy, limit, startAfter, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
```

- [ ] **Step 2: Constantes y carga limitada**

Junto a `SHEET_SYNC_URL` agregar:

```js
const CLIMA_DIAS_FIRESTORE = 90;  // solo el clima se limita al cargar; el resto se trae completo
const CLIMA_DIAS_INICIAL = 14;    // filas que muestra el historial hasta tocar "Ver más"
```

En `fbLoad`, reemplazar la línea `const cd = await getDocs(query(collection(db,'clima'),orderBy('fecha','desc')));` por:

```js
    const cd = await getDocs(query(collection(db,'clima'),orderBy('fecha','desc'),limit(CLIMA_DIAS_FIRESTORE)));
```

- [ ] **Step 3: "Ver más" y tabla acortada**

Antes de `renderCli` agregar:

```js
let climaVerTodo = false;
// Muestra todo lo que hay en el dispositivo y, si Firestore tiene días anteriores, trae otro bloque.
window.climaMas = async () => {
  climaVerTodo = true;
  const viejo = [...S.clima].sort((a,b) => a.fecha < b.fecha ? -1 : 1)[0];
  if (useFirebase && viejo) {
    try {
      const cd = await getDocs(query(collection(db,'clima'),orderBy('fecha','desc'),startAfter(viejo.fecha),limit(CLIMA_DIAS_FIRESTORE)));
      if (cd.docs.length) { upsertCli(cd.docs.map(d => ({id:d.id,...d.data()}))); sv(); }
    } catch(e) {}
  }
  renderCli();
};
```

En `renderCli`, cambiar `const sorted = [...S.clima].sort(...)` para separar lo mostrado:

```js
  const sorted = [...S.clima].sort((a,b)=>a.fecha>b.fecha?-1:1);
  const shown = climaVerTodo ? sorted : sorted.slice(0, CLIMA_DIAS_INICIAL);
```

Reemplazar `sorted.map(c => {` dentro de `tableHTML` por `shown.map(c => {`, y `sorted.length ? \`` por `shown.length ? \`` (la condición del ternario). Cambiar el bloque final a:

```js
  document.getElementById('cli-c').innerHTML =
    climaHeadHTML() +
    `<div class="sh">Resumen <span class="sh-sub">análisis climatico</span></div>${statsHTML}` +
    `<div class="sh">Historial <span class="sh-sub">${shown.length} de ${sorted.length} días — colores por valor</span></div>` +
    tableHTML +
    (!climaVerTodo ? `<button class="btn-o" style="margin-top:6px" onclick="climaMas()">Ver más días</button>` : '');
```

- [ ] **Step 4: Verificar**

Con `?dry=1` y `localStorage.removeItem('compost_v7')` + recarga, esperar 5 s:

`javascript_tool`: `JSON.parse(localStorage.getItem('compost_v7')).clima.length` → **Expected:** notablemente **menor** que la cantidad total de días de la colección `clima` de Firestore (≈ 28 de la semilla + ~35 del auto-fetch + hasta 90 de Firestore, con solapamiento). Anotar el número.
Ir a Clima → **Expected:** el historial muestra `14 de N días` y el botón "Ver más días".
Tocar "Ver más días" → **Expected:** el encabezado pasa a `N de N días` (o más, si Firestore tenía días anteriores), y el botón desaparece.
`read_page` de la pestaña Clima → **Expected:** la altura de la página en la primera vista es de unas pocas pantallas, no ~23.
Consola sin errores.

- [ ] **Step 5: Commit**

```bash
git add public/public/index.html
git commit -m "perf: clima limitado a 90 dias al cargar, historial de 14 dias con Ver mas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Service worker — fuentes e íconos en caché

**Files:**
- Modify: `public/public/sw.js`

**Interfaces:**
- Produces: caché `compost-tracker-v2`; recursos de `fonts.googleapis.com`, `fonts.gstatic.com` y `cdn.jsdelivr.net` con estrategia stale-while-revalidate.

- [ ] **Step 1: Subir la versión y agregar la lista de hosts externos**

Cambiar la primera línea a `const CACHE = 'compost-tracker-v2';` y agregar debajo de `APP_SHELL`:

```js
// Fuentes de Google e íconos Tabler: se sirven de la caché y se refrescan en segundo plano.
const EXTERNAL_CACHE = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
```

- [ ] **Step 2: Manejar esos hosts en `fetch`**

Reemplazar la línea `if (url.origin !== self.location.origin) return; // Firebase/Open-Meteo/fuentes: siempre a la red` por:

```js
  if (url.origin !== self.location.origin) {
    // Firebase/Open-Meteo: siempre a la red. Solo fuentes e íconos van por caché.
    if (EXTERNAL_CACHE.includes(url.hostname)) {
      event.respondWith(
        caches.open(CACHE).then(cache => cache.match(req).then(cached => {
          const red = fetch(req).then(res => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || red;
        }))
      );
    }
    return;
  }
```

- [ ] **Step 3: Verificar**

Abrir `?dry=1`, recargar **dos veces** (la primera instala el SW, la segunda ya lo usa) y esperar 3 s:

`javascript_tool`: `(async () => (await caches.keys()))()` → **Expected:** `["compost-tracker-v2"]` (la v1 vieja se borra al activar).
`javascript_tool`: `(async () => (await (await caches.open('compost-tracker-v2')).keys()).map(r => new URL(r.url).hostname))()` → **Expected:** incluye `fonts.googleapis.com`, `fonts.gstatic.com` y `cdn.jsdelivr.net`.
Con `mcp__Claude_Browser__javascript_tool`, simular offline no es posible; alcanza con la comprobación de caché. Consola sin errores.

- [ ] **Step 4: Commit**

```bash
git add public/public/sw.js
git commit -m "perf: service worker guarda fuentes e iconos en cache (v2, stale-while-revalidate)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Pulido visual, tamaños táctiles y limpieza

**Files:**
- Modify: `public/public/index.html` (CSS, `#hoy-c` inicial, barrido de tamaños de fuente, código muerto)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: auditoría táctil sin fallas; ningún texto de interfaz por debajo de 11px (12px salvo cabeceras de tabla).

- [ ] **Step 1: Texto mínimo de 12px (hacerlo ANTES de agregar CSS nuevo)**

Con comandos simples desde la raíz del worktree. El primero cubre todo el bloque `<style>`; el segundo, los estilos inline dentro de las plantillas JS (sin espacio tras los dos puntos):

```bash
sed -i '/<style>/,/<\/style>/s/font-size: *\(9\|10\|11\)px/font-size: 12px/g' public/public/index.html
```
```bash
sed -i 's/font-size:\(9\|10\|11\)px/font-size:12px/g' public/public/index.html
```

Este paso va primero a propósito: la regla que mantiene 11px en las cabeceras de tabla se agrega en el Step 2, y si se agregara antes, el `sed` la volvería a 12px.

- [ ] **Step 2: Tamaños táctiles y excepción de tablas**

Agregar al final del bloque `<style>`:

```css
/* objetivos táctiles ≥ 44px */
.f input, .f select { min-height: 44px; }
.btn-g, .btn-o { min-height: 44px; }
.mclose { width: 44px; height: 44px; font-size: 18px; }
.mob-sync { min-width: 44px; min-height: 44px; justify-content: center; }
.del-btn { min-width: 44px; min-height: 44px; }
.add-btn { min-height: 48px; }
/* cabeceras de tablas densas: 11px (excepción a los 12px) */
.ctbl th, .rtbl th { font-size: 11px; }
```

- [ ] **Step 3: Esqueleto de carga en "Hoy"**

El módulo de Firebase se importa desde la red, y hasta que llega la pantalla queda en blanco. Agregar CSS:

```css
.skel { height: 56px; border-radius: var(--r); background: linear-gradient(90deg, var(--paper2), var(--paper), var(--paper2)); background-size: 200% 100%; animation: shim 1.2s linear infinite; margin-bottom: 8px; }
@keyframes shim { to { background-position: -200% 0; } }
```

y cambiar `<div id="hoy-c"></div>` por:

```html
<div id="hoy-c"><div class="skel" style="height:28px;width:60%"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>
```

(`renderHoy` reemplaza todo el contenido en el primer dibujo.)

- [ ] **Step 4: Código muerto**

`Grep` de cada nombre; los que den 0 usos fuera de su definición, borrarlos: `NAVT`, `.mob-tabs`, `.mt` (CSS), `statTile`, `.dash-grid` (si ya nada lo usa), `renderDash`, `renderFito`. Conservar `.card`, `.al*`, `.ring-*`, `.donut-*`, `.cond*`, `.pills`, `.sysc` (los usan las pantallas nuevas).

- [ ] **Step 5: Auditoría final**

En 375px con `?dry=1`, en **cada** pestaña (Hoy, Compost·Sistemas, Compost·Revolcadas, Plantas, Plantas·Pecera, Huerta, Clima) y con la hoja "＋" abierta:

1. Pegar la **auditoría táctil** → **Expected:** `{ overflowX: false, small: [] }`.
2. `javascript_tool`: `[...document.querySelectorAll('body *')].filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).length` → **Expected:** `0`.
3. `read_console_messages` con `onlyErrors: true` → **Expected:** vacío.
4. Screenshot de cada pestaña en modo claro y oscuro (`resize_window` con `colorScheme`).

Al terminar: `resize_window` con `preset: "desktop"` y revisar Hoy en escritorio (sidebar de 5 ítems, botón "＋" abajo a la derecha, hoja centrada).

- [ ] **Step 6: Commit**

```bash
git add public/public/index.html
git commit -m "style: objetivos tactiles de 44px, texto minimo de 12px, esqueleto de carga y limpieza de codigo muerto

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Integración

**Files:** ninguno (git).

- [ ] **Step 1: Revisión final del diff**

```bash
git diff main --stat
```

**Expected:** solo `public/public/index.html` y `public/public/sw.js`.

- [ ] **Step 2: Pruebas con datos reales (a cargo del usuario)**

Pedir al usuario que, **después del merge y del deploy**, desde su celular: (a) abra la app, (b) toque ✓ en una tarea real de un toque y confirme que a los 5 s aparece en "Hechas hoy", (c) confirme en el Sheet/Firestore que se creó **un solo** registro, (d) pruebe "Deshacer" en otra y confirme que no se creó nada.

- [ ] **Step 3: Merge, push y deploy**

Salir del worktree con `ExitWorktree` (`action: "keep"`), y desde el checkout principal:

```bash
git merge --no-ff worktree-rediseno-mobile -m "Merge: rediseno mobile (barra inferior, Hoy, registro con + y rendimiento)"
```
```bash
git push origin main
```

El deploy a Firebase Hosting se hace según el flujo habitual del repo (`firebase deploy --only hosting` desde `public/`), que **el usuario** confirma antes de ejecutarlo.

---

## Auto-revisión del plan contra el spec

- **1. Pantalla "Hoy"** → Tareas 4 (armado, resumen, urgentes, hechas, próximos, vacío) y 5 (toques).
- **2. Navegación** → Tarea 2 (barra inferior, sidebar, segmentos, alias, última pestaña) y Tarea 3 (＋, hoja, contextual).
- **3. Rendimiento y limpieza** → Tarea 7 (clima 90 días + 14 filas + "Ver más"), Tarea 8 (SW), Tarea 9 (limpieza, sin limpieza masiva de inline), Tarea 6 (eliminación de Registrar/Fitosanitario/dashboard).
- **4. Aspecto** → Tarea 9 (objetivos táctiles, 12px, esqueleto de carga); estados vacíos ya presentes ("Todo al día", "Sin plantas registradas").
- **5. Datos, errores y "Deshacer"** → Tarea 5 (guardado diferido de 5 s, `visibilitychange`/`pagehide`), Tarea 1 (`keepalive`).
- **Verificación sin escribir en Firestore real** → Tarea 1 (`?dry=1`).
- **Consistencia de nombres:** `openRegistro`/`closeRegistro`, `refresh`, `setSeg`, `armarTareasHoy`, `renderHoy`, `diferidos`, `tareaTap`, `deshacerTarea`, `marcarHecha`, `registrarRevolcada/EventoPlanta/EventoPecera`, `climaMas`, `fitoHTML`, `climaHeadHTML`, `renderCompostResumen`, `renderPlaResumen` se definen antes de usarse en tareas posteriores y se usan con la misma firma.
- **Limitación conocida (no introducida por este plan):** si `fbAdd` falla (sin conexión) el registro queda solo en el dispositivo y el próximo `fbLoad` lo pisa con lo que hay en Firestore. En un `pagehide` el POST al Sheet sobrevive (`keepalive`), pero la escritura a Firestore puede no completarse.
