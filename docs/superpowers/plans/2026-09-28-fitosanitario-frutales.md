# Monitoreo fitosanitario de frutales/cítricos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar fichas de monitoreo fitosanitario (problemas a vigilar + producto/dosis genérico) para las 4 plantas leñosas, con frecuencia de revisión dinámica por mes, una sección nueva de menú, autocompletado en el formulario de registro, y arreglar el bug de sistemas de compostaje fantasma.

**Architecture:** Todo el trabajo es sobre un único archivo HTML/JS del lado del cliente (`public/public/index.html`, app vanilla JS sin build step) más su espejo en Google Apps Script (`codigo.gs`, backend del calendario/Sheets, ES5 sin `const`/arrow functions). No hay framework de tests — este proyecto se verifica manualmente en el navegador (index.html) y en el editor de Apps Script (codigo.gs), siguiendo el mismo patrón que ya usan `diagnosticarPecera()` / `testCalendario()` en el propio repo.

**Tech Stack:** JS vanilla (ES6+) en el cliente, Firebase Firestore como fuente de datos, Google Apps Script (ES5) + Google Sheets + Google Calendar como backend de recordatorios.

**Spec:** [docs/superpowers/specs/2026-09-28-fitosanitario-frutales-design.md](../specs/2026-09-28-fitosanitario-frutales-design.md)

## Global Constraints

- El producto/dosis por problema es guía agronómica genérica (no marca ni dosis de etiqueta específica) — toda entrada de la ficha debe incluir el disclaimer "confirmá contra la etiqueta de tu producto".
- No se agregan campos nuevos al esquema de `registroPlantas` en Firestore — el autocompletado escribe en el campo `producto` ya existente.
- No se toca la vista de detalle de planta existente (`openPla`).
- No se agregan hojas ni columnas nuevas en Google Sheets — los datos de fichas quedan hardcodeados en ambos lados (index.html y codigo.gs), igual que ya está `ESPECIES` hoy.
- `codigo.gs` se escribe en el mismo estilo ES5 (`var`, `function`) que ya usa todo el archivo — no introducir `const`/`let`/arrow functions ahí.

---

## Task 1: Datos — bloque FITOSANITARIO y helpers (index.html)

**Files:**
- Modify: `public/public/index.html:882` (justo después de `mesEnTemporada`, antes de `regEventos`)

**Interfaces:**
- Produces: `FITOSANITARIO` (array), `fichaFito(nombreOEspecie)` → objeto ficha o `null`, `nivelVigilancia(ficha, mes)` → string emoji, `diasVigilancia(ficha, mes)` → number. Usados por Task 2, 3 y 4.

- [ ] **Step 1: Insertar el bloque de datos**

Ubicar en `public/public/index.html` esta línea exacta (línea 882):

```js
const mesEnTemporada = (mes, ini, fin) => !ini || !fin ? true : (ini<=fin ? (mes>=ini && mes<=fin) : (mes>=ini || mes<=fin));
```

Justo después de esa línea (y antes de la línea en blanco que precede a `const regEventos = ...`), insertar:

```js

// ════ FITOSANITARIO — frutales/cítricos ════
// Fuente: manejo INTA San Pedro (monitoreo por estado fenológico, no
// pulverización de rutina). Producto/dosis = guía agronómica genérica de
// huerta familiar, NO dosis de etiqueta de marca específica — confirmar
// siempre contra el envase real. Para plagas persistentes o graves,
// conviene diagnóstico dirigido antes de tratar (criterio INTA).
const NIVEL_DIAS = { '🟢':14, '🟠':7, '🔴':5, '🔴🔴':3 };
const NIVEL_LABEL = { '🟢':'Vigilancia baja', '🟠':'Vigilancia normal', '🔴':'Vigilancia alta', '🔴🔴':'Vigilancia muy alta' };

const PROBLEMAS_CITRICOS_COMUN = [
  { nombre:'Minador de los cítricos', sintoma:'Galerías serpenteantes en hojas nuevas; la hoja puede deformarse',
    producto:'Sin tratamiento de rutina', dosis:'Retirar hojas muy afectadas. Si son pocas hojas no amerita tratar todo el árbol — evaluar solo si avanza sobre gran parte de la brotación nueva.' },
  { nombre:'Pulgones', sintoma:'Colonias en brotes tiernos; hojas enrolladas',
    producto:'Jabón potásico', dosis:'5-10ml/L de agua, rociar brotes y envés de hojas. Repetir a los 7 días si persiste.' },
  { nombre:'Cochinillas', sintoma:'Bultitos adheridos a hojas/ramitas, a veces con melaza',
    producto:'Alcohol isopropílico (focos chicos) o aceite mineral/agropecuario (infestación mayor)',
    dosis:'Alcohol: algodón directo sobre cada cochinilla, repetir cada 4-5 días, 2-3 veces. Aceite: 1-2% según etiqueta.' },
  { nombre:'Ácaros', sintoma:'Punteado amarillento/bronceado, pérdida de aspecto saludable',
    producto:'Aceite de neem', dosis:'Según etiqueta, repetir a los 7-10 días. Mejorar aireación de la copa.' },
  { nombre:'Cancrosis', sintoma:'Lesiones/costras en hojas y brotes',
    producto:'Fungicida cúprico (oxicloruro de cobre)', dosis:'Según etiqueta, aplicar durante la brotación tierna cada 15-20 días mientras dure el brote. Desinfectar herramientas de poda entre plantas.' },
];

const FITOSANITARIO = [
  {
    match: 'mandarina',
    problemas: [
      ...PROBLEMAS_CITRICOS_COMUN,
      { nombre:'Hormigas', sintoma:'Frecuentemente acompañan ataques de pulgones o cochinillas',
        producto:'Cebo granulado para hormigas', dosis:'Colocar cerca del hormiguero/tronco, no rociar insecticida directo sobre la planta.' },
    ],
    monitoreo:'Revisar 5-10 hojas nuevas por semana, con énfasis en el envés, brotes tiernos y presencia de hormigas.',
    momentoCritico:'Cada nueva brotación, especialmente primavera y los nuevos crecimientos de verano.',
    calendarioVigilancia: {9:'🟢',10:'🟠',11:'🟠',12:'🟠',1:'🟠',2:'🟢',3:'🟢',4:'🟢'},
  },
  {
    match: 'limon',
    problemas: [
      ...PROBLEMAS_CITRICOS_COMUN,
      { nombre:'Manchas foliares', sintoma:'Manchas que aumentan con humedad',
        producto:'Fungicida cúprico', dosis:'Según etiqueta si las manchas aumentan con humedad. Mejorar ventilación de la copa.' },
    ],
    monitoreo:'Una revisión semanal, con atención a las hojas nuevas (el cítrico puede brotar aunque no tenga fruta).',
    momentoCritico:'Brotación — puede darse aunque el árbol no tenga fruta todavía.',
    calendarioVigilancia: {9:'🟢',10:'🟠',11:'🟠',12:'🟠',1:'🟠',2:'🟠',3:'🟠',4:'🟠'},
  },
  {
    match: 'durazno',
    problemas: [
      { nombre:'Torque', sintoma:'Hojas engrosadas, deformadas, rojizas',
        producto:'Fungicida cúprico o a base de azufre', dosis:'Preventivo, aplicar en la brotación de yemas — difícil de curar una vez instalada. Si aparece, anotar para repetir el preventivo el año próximo.' },
      { nombre:'Cribado / tiro de munición', sintoma:'Manchas pequeñas que terminan dejando agujeros',
        producto:'Fungicida cúprico', dosis:'Según etiqueta, aplicar tras lluvias prolongadas en primavera.' },
      { nombre:'Bacteriosis', sintoma:'Manchas en hojas/frutos y lesiones en ramas',
        producto:'Fungicida/bactericida cúprico', dosis:'Según etiqueta. Retirar y destruir partes muy afectadas (no compostar).' },
      { nombre:'Podredumbre morena', sintoma:'Frutos con manchas marrones que se deterioran rápido',
        producto:'Retiro inmediato + fungicida (captan o azufre) si se repite',
        dosis:'Retirar y destruir INMEDIATAMENTE frutos/flores afectados, no dejarlos bajo el árbol ni compostarlos. Tratamiento químico solo si es recurrente.' },
      { nombre:'Pulgones', sintoma:'Brotes deformados y hojas enrolladas', producto:'Jabón potásico', dosis:'5-10ml/L, rociar brotes y envés. Repetir a los 7 días si persiste.' },
      { nombre:'Gusano del brote', sintoma:'Brotes dañados o secos', producto:'Evaluación específica', dosis:'Si hay varios brotes afectados, identificar antes de tratar — no es de rutina.' },
      { nombre:'Mosca de los frutos', sintoma:'Daño dentro del fruto; caída prematura',
        producto:'Trampas con atrayente (proteína hidrolizada o feromona)', dosis:'Colocar desde que el fruto es pequeño. Recolectar y destruir frutos caídos de inmediato.' },
      { nombre:'Ácaros', sintoma:'Punteado y pérdida de vigor del follaje', producto:'Aceite de neem', dosis:'Según etiqueta, repetir a los 7-10 días.' },
    ],
    monitoreo:'2 controles semanales (fruto en crecimiento): hojas nuevas, frutos, puntas de ramas, lesiones en ramas, frutos caídos. Retirar de inmediato cualquier fruto que caiga enfermo o empiece a pudrirse — no dejarlo bajo el árbol.',
    momentoCritico:'Fruto pequeño → crecimiento → maduración. Monitoreo bastante más frecuente que el de los cítricos durante toda esta etapa.',
    calendarioVigilancia: {9:'🔴🔴',10:'🔴🔴',11:'🔴',12:'🔴',1:'🔴',2:'🟠',3:'🟢',4:'🟢'},
  },
  {
    match: 'ciruela',
    problemas: [
      { nombre:'Pulgones', sintoma:'Colonias en brotes y hojas jóvenes', producto:'Jabón potásico', dosis:'5-10ml/L. Si es una colonia chica y localizada, tratar solo esa zona y seguir observando antes de un tratamiento general.' },
      { nombre:'Cochinillas', sintoma:'Escamas/bultitos sobre ramas', producto:'Alcohol isopropílico (foco chico) o aceite mineral', dosis:'Igual criterio que mandarina/durazno.' },
      { nombre:'Cribado', sintoma:'Manchas en hojas que terminan perforándose', producto:'Fungicida cúprico', dosis:'Según etiqueta, tras lluvias prolongadas.' },
      { nombre:'Bacteriosis', sintoma:'Manchas oscuras en hojas/frutos', producto:'Fungicida/bactericida cúprico', dosis:'Según etiqueta.' },
      { nombre:'Podredumbre morena', sintoma:'Frutos que se manchan y deterioran', producto:'Retiro inmediato', dosis:'Igual criterio que durazno — no dejar frutos afectados bajo el árbol.' },
      { nombre:'Problemas de polinización', sintoma:'Floración abundante pero poca fruta posterior',
        producto:'No es plaga — revisar polinización', dosis:'Reina Claudia puede tener autoincompatibilidad; si se repite, considerar la variedad y un ciruelo compatible cerca.' },
    ],
    monitoreo:'1 revisión semanal, enfocada en brotes nuevos. Buscar especialmente pulgones.',
    momentoCritico:'Floración → cuajado — vigilar si florece bien pero no fructifica (polinización).',
    calendarioVigilancia: {9:'🟠',10:'🔴',11:'🔴',12:'🔴',1:'🔴',2:'🟠',3:'🟢',4:'🟢'},
  },
];

const fichaFito = nombreOEspecie => {
  const buscado = String(nombreOEspecie||'').toLowerCase();
  return FITOSANITARIO.find(f => buscado.includes(f.match)) || null;
};
const nivelVigilancia = (ficha, mes) => (ficha && ficha.calendarioVigilancia[mes]) || '🟢';
const diasVigilancia = (ficha, mes) => NIVEL_DIAS[nivelVigilancia(ficha, mes)];
```

- [ ] **Step 2: Verificar en el navegador**

Abrir `public/public/index.html` en el navegador (o el preview local), abrir la consola de DevTools y ejecutar:

```js
fichaFito('Durazno amarillo').match // "durazno"
diasVigilancia(fichaFito('Durazno amarillo'), 9) // 3
diasVigilancia(fichaFito('Mandarina Criolla'), 9) // 14
diasVigilancia(fichaFito('Ciruela Reina Claudia'), 10) // 5
fichaFito('Monstera') // null
```

Expected: los 5 resultados coinciden con lo indicado en el comentario. Ningún error en consola al cargar la página (confirma que no hay un error de sintaxis en el bloque insertado).

- [ ] **Step 3: Commit**

```bash
git add public/public/index.html
git commit -m "feat: agrega datos de fichas fitosanitarias para frutales/citricos"
```

---

## Task 2: Frecuencia de monitoreo dinámica en `estPlanta()` (index.html)

**Files:**
- Modify: `public/public/index.html:924-934` (función `estPlanta`)

**Interfaces:**
- Consumes: `fichaFito(nombreOEspecie)`, `diasVigilancia(ficha, mes)` (Task 1)
- Produces: sin cambios en la forma del objeto que devuelve `estPlanta()` — mismo shape que hoy, solo cambia cómo se calcula `plagas`.

- [ ] **Step 1: Reemplazar el cálculo de `plagas`**

Ubicar en `public/public/index.html` (dentro de `const estPlanta = p => { ... }`):

```js
  const plagas = proxCalc(p, 'plagas',   'ultimaPlagas', 'proximaPlagas', CFG_PLA.diasPlagas);
```

Reemplazar por:

```js
  const fichaFitoP = fichaFito(p.especie || p.nombre);
  const plagas = proxCalc(p, 'plagas', 'ultimaPlagas', 'proximaPlagas', fichaFitoP ? diasVigilancia(fichaFitoP, mes) : CFG_PLA.diasPlagas);
```

(`mes` ya está definido más arriba en la misma función, línea 925: `const hoy = TODAY, mes = hoy.getMonth()+1;` — no hace falta redeclararlo.)

- [ ] **Step 2: Verificar en el navegador**

En la consola de DevTools, con la app cargada:

```js
estPlanta(S.plantas.find(p=>p.nombre.includes('Durazno'))).diasParaPlagas
estPlanta(S.plantas.find(p=>p.nombre.includes('Mandarina'))).diasParaPlagas
```

Expected: si ambas plantas no tienen ningún evento "Revisión plagas" registrado todavía, `diasParaPlagas` debería ser un número negativo grande y similar entre ambas (calculado desde `fechaP`) — lo importante es confirmar que **no tira error** y que el objeto devuelto sigue teniendo todas las claves de antes (`riegoUrg`, `fertUrg`, `plagasUrg`, etc.). Para confirmar que el intervalo realmente cambió, registrar un evento "🐛 Revisión plagas" hoy para cada una (desde la pantalla Registrar) y volver a correr el mismo chequeo: `proximaPlagas` del durazno debería caer ~3 días después de hoy, y el de mandarina ~14 días después.

- [ ] **Step 3: Commit**

```bash
git add public/public/index.html
git commit -m "feat: frecuencia de revision de plagas variable por mes segun ficha fitosanitaria"
```

---

## Task 3: Sección "Fitosanitario" en el menú (index.html)

**Files:**
- Modify: `public/public/index.html:427-433` (nav sidebar)
- Modify: `public/public/index.html:457-464` (nav mobile)
- Modify: `public/public/index.html:501-504` (páginas — agregar `pg-fito` después de `pg-pec`)
- Modify: `public/public/index.html:1738-1752` (`NAVT`, `TITLES`, `go()`)
- Modify: `public/public/index.html:1455` (agregar `renderFito` después de `renderPec`)

**Interfaces:**
- Consumes: `FITOSANITARIO`/`fichaFito`/`nivelVigilancia`/`NIVEL_LABEL` (Task 1), `S.plantas`, `pLbl(p)`, `openPla(id)` (ya existentes)
- Produces: `window.renderFito()`, página `#pg-fito`, nav item `fito`

- [ ] **Step 1: Agregar el botón al sidebar**

En `public/public/index.html`, ubicar:

```html
    <button class="sn"     onclick="go('pec')"> <i class="ti ti-fish"></i>Pecera</button>
    <button class="sn"     onclick="go('reg')"> <i class="ti ti-circle-plus"></i>Registrar</button>
```

Reemplazar por:

```html
    <button class="sn"     onclick="go('pec')"> <i class="ti ti-fish"></i>Pecera</button>
    <button class="sn"     onclick="go('fito')"><i class="ti ti-bug"></i>Fitosanitario</button>
    <button class="sn"     onclick="go('reg')"> <i class="ti ti-circle-plus"></i>Registrar</button>
```

- [ ] **Step 2: Agregar el botón al tab bar mobile**

Ubicar:

```html
      <button class="mt"    onclick="go('pec')"> <i class="ti ti-fish"></i>Pecera</button>
      <button class="mt"    onclick="go('reg')"> <i class="ti ti-circle-plus"></i>Registrar</button>
```

Reemplazar por:

```html
      <button class="mt"    onclick="go('pec')"> <i class="ti ti-fish"></i>Pecera</button>
      <button class="mt"    onclick="go('fito')"><i class="ti ti-bug"></i>Fitosanitario</button>
      <button class="mt"    onclick="go('reg')"> <i class="ti ti-circle-plus"></i>Registrar</button>
```

- [ ] **Step 3: Agregar la página**

Ubicar:

```html
    <!-- PECERA -->
    <div class="pg" id="pg-pec">
      <div id="pec-c"></div>
    </div>

    <!-- REGISTRAR -->
```

Reemplazar por:

```html
    <!-- PECERA -->
    <div class="pg" id="pg-pec">
      <div id="pec-c"></div>
    </div>

    <!-- FITOSANITARIO -->
    <div class="pg" id="pg-fito">
      <div id="fito-c"></div>
    </div>

    <!-- REGISTRAR -->
```

- [ ] **Step 4: Actualizar `NAVT`, `TITLES` y `go()`**

Ubicar:

```js
const NAVT = ['dash','sist','rev','cli','pla','pec','reg'];
const TITLES = {dash:'Inicio',sist:'Sistemas',rev:'Revolcadas',cli:'Clima',pla:'Plantas',pec:'Pecera',reg:'Registrar'};
```

Reemplazar por:

```js
const NAVT = ['dash','sist','rev','cli','pla','pec','fito','reg'];
const TITLES = {dash:'Inicio',sist:'Sistemas',rev:'Revolcadas',cli:'Clima',pla:'Plantas',pec:'Pecera',fito:'Fitosanitario',reg:'Registrar'};
```

Ubicar dentro de `window.go = t => { ... }`:

```js
  if(t==='pec')  renderPec();
```

Agregar debajo:

```js
  if(t==='pec')  renderPec();
  if(t==='fito') renderFito();
```

- [ ] **Step 5: Implementar `renderFito()`**

Ubicar:

```js
};
window.renderPec = renderPec;
```

Agregar justo después:

```js

// ════ RENDER FITOSANITARIO ════
const renderFito = () => {
  const mes = TODAY.getMonth()+1;
  const cards = S.plantas.map(p => {
    const ficha = fichaFito(p.especie || p.nombre);
    if (!ficha) return '';
    const nivel = nivelVigilancia(ficha, mes);
    const rows = ficha.problemas.map(pr => `<tr>
        <td>${pr.nombre}</td>
        <td style="font-size:12px;color:var(--ink3)">${pr.sintoma}</td>
        <td style="font-size:12px"><b>${pr.producto}</b><br><span style="color:var(--ink3)">${pr.dosis}</span></td>
      </tr>`).join('');
    return `<div class="fc" style="margin-bottom:16px">
      <h3><i class="ti ti-bug"></i>${pLbl(p)}
        <span class="badge" style="background:var(--sky-bg);color:var(--sky);margin-left:8px">${nivel} ${NIVEL_LABEL[nivel]}</span>
      </h3>
      <div style="font-size:12px;color:var(--ink3);margin-bottom:10px"><b>Momento crítico:</b> ${ficha.momentoCritico}</div>
      <div style="font-size:12px;color:var(--ink3);margin-bottom:14px"><b>Qué monitorear:</b> ${ficha.monitoreo}</div>
      <div class="tbl-wrap"><div class="tbl-scroll"><table class="rtbl">
        <thead><tr><th>Problema</th><th>Qué vas a ver</th><th>Producto / Dosis</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>
      <div style="font-size:11px;color:var(--ink3);font-style:italic;margin-top:10px">Referencia general — confirmá contra la etiqueta de tu producto, las concentraciones varían entre marcas. Para plagas persistentes o graves, conviene un diagnóstico específico antes de tratar.</div>
      <button class="btn-o" style="margin-top:12px" onclick="openPla(${p.id})">Ver planta</button>
    </div>`;
  }).filter(Boolean).join('');
  document.getElementById('fito-c').innerHTML = cards || `<div style="font-size:13px;color:var(--ink3);padding:24px;text-align:center">Sin fichas fitosanitarias cargadas</div>`;
};
window.renderFito = renderFito;
```

- [ ] **Step 6: Verificar en el navegador**

Cargar la app, click en "Fitosanitario" en el menú (desktop y, si es posible, con `resize_window` a mobile). Confirmar:
- Aparecen 4 tarjetas (Mandarina, Limonero, Ciruela, Durazno), cada una con su badge de nivel de vigilancia correcto para el mes actual (septiembre 2026 → Mandarina 🟢, Limonero 🟢, Ciruela 🟠, Durazno 🔴🔴).
- La tabla de problemas de cada una lista todas las entradas esperadas (durazno: 8 filas; mandarina/limón: 5-6 filas; ciruela: 6 filas).
- El botón "Ver planta" abre el modal de detalle existente de esa planta.
- No hay errores en consola.

- [ ] **Step 7: Commit**

```bash
git add public/public/index.html
git commit -m "feat: agrega seccion Fitosanitario con fichas de monitoreo por planta"
```

---

## Task 4: Autocompletado de producto/dosis en el registro (index.html)

**Files:**
- Modify: `public/public/index.html:544-553` (formulario "Nueva actividad de planta")
- Modify: `public/public/index.html:1585` (botón "Registrar evento" del modal de planta)
- Modify: `public/public/index.html:1753-1759` (bloque `t==='reg'` de `go()`)
- Modify: `public/public/index.html:1788-1794` (`poblarSels`)

**Interfaces:**
- Consumes: `fichaFito(nombreOEspecie)` (Task 1), `S.plantas`
- Produces: `window.actualizarProblemaSel()`, `window.aplicarProblema()`

- [ ] **Step 1: Agregar el select "Problema detectado" y los `onchange`**

Ubicar:

```html
            <div class="f"><label>Planta</label><select id="pv"></select></div>
            <div class="f"><label>Tipo de evento</label>
              <select id="pt">
                <option value="💧 Riego">💧 Riego</option>
                <option value="🌿 Fertilización">🌿 Fertilización</option>
                <option value="✂️ Poda">✂️ Poda</option>
                <option value="🐛 Revisión plagas">🐛 Revisión plagas</option>
                <option value="🍂 Cosecha">🍂 Cosecha</option>
                <option value="📝 Observación">📝 Observación</option>
              </select>
            </div>
            <div class="f"><label>Fecha</label><input type="date" id="pf"></div>
```

Reemplazar por:

```html
            <div class="f"><label>Planta</label><select id="pv" onchange="actualizarProblemaSel()"></select></div>
            <div class="f"><label>Tipo de evento</label>
              <select id="pt" onchange="actualizarProblemaSel()">
                <option value="💧 Riego">💧 Riego</option>
                <option value="🌿 Fertilización">🌿 Fertilización</option>
                <option value="✂️ Poda">✂️ Poda</option>
                <option value="🐛 Revisión plagas">🐛 Revisión plagas</option>
                <option value="🍂 Cosecha">🍂 Cosecha</option>
                <option value="📝 Observación">📝 Observación</option>
              </select>
            </div>
            <div class="f" id="pb-wrap" style="display:none">
              <label>Problema detectado</label>
              <select id="pb" onchange="aplicarProblema()"></select>
            </div>
            <div class="f"><label>Fecha</label><input type="date" id="pf"></div>
```

- [ ] **Step 2: Implementar `actualizarProblemaSel()` y `aplicarProblema()`**

Ubicar (después del bloque insertado en Task 1, justo antes de `const regEventos = ...`, o en cualquier punto posterior a la definición de `fichaFito` — se sugiere agregarlo junto a `poblarSels`):

```js
const poblarSels = () => {
  const opts = S.sistemas.map(s=>`<option value="${s.id}">${sLbl(s)}</option>`).join('');
  ['rs','es'].forEach(id=>{const el=document.getElementById(id);const c=el.value;el.innerHTML=opts;if(c)el.value=c;});
  document.getElementById('hf').innerHTML = '<option value="todos">Todos los sistemas</option>'+opts;
  const poptsPla = S.plantas.map(p=>`<option value="${p.id}">${pLbl(p)}</option>`).join('');
  ['pv','epv'].forEach(id=>{const el=document.getElementById(id);const c=el.value;el.innerHTML=poptsPla;if(c)el.value=c;});
};
```

Reemplazar por:

```js
const poblarSels = () => {
  const opts = S.sistemas.map(s=>`<option value="${s.id}">${sLbl(s)}</option>`).join('');
  ['rs','es'].forEach(id=>{const el=document.getElementById(id);const c=el.value;el.innerHTML=opts;if(c)el.value=c;});
  document.getElementById('hf').innerHTML = '<option value="todos">Todos los sistemas</option>'+opts;
  const poptsPla = S.plantas.map(p=>`<option value="${p.id}">${pLbl(p)}</option>`).join('');
  ['pv','epv'].forEach(id=>{const el=document.getElementById(id);const c=el.value;el.innerHTML=poptsPla;if(c)el.value=c;});
  actualizarProblemaSel();
};
window.actualizarProblemaSel = () => {
  const wrap = document.getElementById('pb-wrap');
  const pid = +document.getElementById('pv').value;
  const tipo = document.getElementById('pt').value;
  const p = S.plantas.find(x=>x.id===pid);
  const ficha = p ? fichaFito(p.especie || p.nombre) : null;
  if (tipo !== '🐛 Revisión plagas' || !ficha) {
    wrap.style.display = 'none';
    document.getElementById('pb').innerHTML = '';
    return;
  }
  wrap.style.display = '';
  document.getElementById('pb').innerHTML = '<option value="">Ninguno / solo monitoreo</option>' +
    ficha.problemas.map((pr,i)=>`<option value="${i}">${pr.nombre}</option>`).join('');
};
window.aplicarProblema = () => {
  const pid = +document.getElementById('pv').value;
  const p = S.plantas.find(x=>x.id===pid);
  const ficha = p ? fichaFito(p.especie || p.nombre) : null;
  const idx = document.getElementById('pb').value;
  if (!ficha || idx==='') return;
  const pr = ficha.problemas[+idx];
  document.getElementById('pp').value = `${pr.producto} — ${pr.dosis}`;
};
```

- [ ] **Step 3: Inicializar el select al entrar a Registrar y al abrir "Registrar evento" desde una planta**

Ubicar dentro de `window.go`:

```js
  if(t==='reg')  {
    loadSis();
    if(!document.getElementById('rf').value) document.getElementById('rf').value=fISO(TODAY);
    if(!document.getElementById('pf').value) document.getElementById('pf').value=fISO(TODAY);
    if(!document.getElementById('kf').value) document.getElementById('kf').value=fISO(TODAY);
    loadPecera();
  }
```

Reemplazar por:

```js
  if(t==='reg')  {
    loadSis();
    if(!document.getElementById('rf').value) document.getElementById('rf').value=fISO(TODAY);
    if(!document.getElementById('pf').value) document.getElementById('pf').value=fISO(TODAY);
    if(!document.getElementById('kf').value) document.getElementById('kf').value=fISO(TODAY);
    loadPecera();
    actualizarProblemaSel();
  }
```

Ubicar:

```js
    <button class="btn-g" onclick="closeMod();go('reg');document.getElementById('pv').value=${id}">Registrar evento</button>
```

Reemplazar por:

```js
    <button class="btn-g" onclick="closeMod();go('reg');document.getElementById('pv').value=${id};actualizarProblemaSel()">Registrar evento</button>
```

- [ ] **Step 4: Verificar en el navegador**

Ir a Registrar → sección "Nueva actividad de planta". Confirmar:
- Con tipo "💧 Riego" el select "Problema detectado" está oculto.
- Al cambiar el tipo a "🐛 Revisión plagas" y elegir la planta "Durazno amarillo", el select aparece con "Ninguno / solo monitoreo" + las 8 opciones de problema.
- Al elegir "Podredumbre morena", el campo "Producto / Dosis" se autocompleta con el texto correcto y sigue siendo editable.
- Al cambiar la planta a "Mandarina Criolla" (tipo sigue en Revisión plagas), el select se repuebla con las opciones de mandarina (6 problemas).
- Al cambiar el tipo a "✂️ Poda", el select vuelve a ocultarse.
- Abrir el detalle de una planta desde "Plantas" y usar el botón "Registrar evento": el select se muestra/oculta correctamente según el tipo por defecto.

- [ ] **Step 5: Commit**

```bash
git add public/public/index.html
git commit -m "feat: autocompleta producto/dosis segun problema detectado al registrar revision de plagas"
```

---

## Task 5: Fix de sistemas fantasma (index.html)

**Files:**
- Modify: `public/public/index.html:1051-1068` (`sysHTML`)
- Modify: `public/public/index.html:1717-1727` (después de `addSis`)

**Interfaces:**
- Consumes: `fbDel(col, id)` (ya existente), `S.sistemas`, `poblarSels()`, `renderSist()`, `renderDash()`, `sv()`, `toast()`, `cur` (todas ya existentes)
- Produces: `window.delSis(id, e)`

- [ ] **Step 1: Agregar el botón de eliminar a la tarjeta de sistema**

Ubicar:

```js
  return `<div class="sysc" onclick="openSis(${s.id})">
    <div class="sysc-top">
      <span class="sysc-name">${sLbl(s)}</span>
      <span class="badge ${e.cls}">${e.label}${e.d?' · '+e.d+'d':''}</span>
    </div>
```

Reemplazar por:

```js
  return `<div class="sysc" onclick="openSis(${s.id})">
    <div class="sysc-top">
      <span class="sysc-name">${sLbl(s)}</span>
      <span style="display:flex;align-items:center;gap:6px">
        <span class="badge ${e.cls}">${e.label}${e.d?' · '+e.d+'d':''}</span>
        <button class="del-btn" onclick="delSis(${s.id},event)" title="Eliminar sistema"><i class="ti ti-trash"></i></button>
      </span>
    </div>
```

(`.sysc-top` ya es `display:flex; justify-content:space-between` con exactamente 2 hijos — agrupar badge+botón en un `<span>` extra mantiene ese layout de 2 columnas en vez de repartir 3 elementos.)

- [ ] **Step 2: Implementar `delSis`**

Ubicar:

```js
window.addSis = async () => {
  const nid = Math.max(...S.sistemas.map(s=>s.id)) + 1;
  const s = {id:nid, nombre:'', inicioC:'', finC:'', inicioE:'', notas:''};
  S.sistemas.push(s); sv(); await fbSave('sistemas',nid,s);
  poblarSels(); renderSist();
  // Cambiar al formulario de edición del nuevo sistema
  go('reg');
  document.getElementById('es').value = nid;
  loadSis();
  toast(`Sistema ${nid} agregado — completá sus datos`);
};
```

Agregar debajo:

```js
window.delSis = async (id, e) => {
  e.stopPropagation();
  if(!confirm(`¿Eliminar Sistema ${id}? Esta acción no se puede deshacer.`)) return;
  await fbDel('sistemas', id);
  S.sistemas = S.sistemas.filter(s=>s.id!=id); sv();
  poblarSels(); renderSist();
  if(cur==='dash') renderDash();
  toast(`Sistema ${id} eliminado`);
};
```

- [ ] **Step 3: Verificar en el navegador**

Ir a Sistemas → "Agregar sistema" (crea, por ejemplo, Sistema 11). Confirmar que aparece con badge "Sin datos" y el botón de eliminar (ícono tacho) al lado del badge, sin romper el layout de la tarjeta. Click en eliminar → confirmar el diálogo → la tarjeta desaparece de la lista y no reaparece al recargar la página (confirma que se borró también de Firestore, no solo del estado local).

- [ ] **Step 4: Commit**

```bash
git add public/public/index.html
git commit -m "fix: agrega boton para eliminar sistemas de compostaje (no solo resetear)"
```

---

## Task 6: Mirror de datos y frecuencia dinámica en Apps Script (codigo.gs)

**Files:**
- Modify: `codigo.gs:1605` (después de `mesEnTemporada_`, antes de `obtenerUltimoEventoPlanta_`)
- Modify: `codigo.gs:1820` (`actualizarFichaPlantas`)

**Interfaces:**
- Consumes: nada nuevo — usa `especie`, `mes`, `CFG_PLANTAS.diasRevisionPlagas` ya presentes en `actualizarFichaPlantas()`.
- Produces: `FITOSANITARIO` (array), `fichaFito(nombreOEspecie)`, `diasVigilancia(ficha, mes)`, `testFitosanitario()`. Consumidos por Task 7.

**Nota:** Este mirror en Apps Script solo necesita `match`, `monitoreo` y `calendarioVigilancia` por ficha — el catálogo de `problemas` (producto/dosis) solo se usa del lado de la app (Task 1, 3, 4) para la sección Fitosanitario y el autocompletado del formulario; el calendario de Google solo necesita el texto de `monitoreo`, no la tabla completa de productos (ver spec, sección 4). Por eso este bloque es más chico que el de `index.html`.

- [ ] **Step 1: Insertar el bloque de datos y helpers**

Ubicar en `codigo.gs`:

```js
function mesEnTemporada_(mes, inicio, fin) {
  if (!inicio || !fin) return true;
  if (inicio <= fin) return mes >= inicio && mes <= fin;
  return mes >= inicio || mes <= fin; // rango que cruza fin de año (ej: 9 a 4)
}

// Devuelve la fecha del evento más reciente de un tipo (Fertiliz/Poda/plagas)
```

Reemplazar por:

```js
function mesEnTemporada_(mes, inicio, fin) {
  if (!inicio || !fin) return true;
  if (inicio <= fin) return mes >= inicio && mes <= fin;
  return mes >= inicio || mes <= fin; // rango que cruza fin de año (ej: 9 a 4)
}

// ====================================================================
//  FITOSANITARIO — mismo criterio de vigilancia por mes que index.html
//  (ver FITOSANITARIO ahí para la tabla completa de problemas/producto/
//  dosis — acá solo hace falta el texto de monitoreo para el calendario).
// ====================================================================
var NIVEL_DIAS_FITO = { '🟢':14, '🟠':7, '🔴':5, '🔴🔴':3 };

var FITOSANITARIO = [
  { match:'mandarina', monitoreo:'Revisar 5-10 hojas nuevas por semana, envés, brotes tiernos y hormigas.',
    calendarioVigilancia: {9:'🟢',10:'🟠',11:'🟠',12:'🟠',1:'🟠',2:'🟢',3:'🟢',4:'🟢'} },
  { match:'limon', monitoreo:'Una revisión semanal, atención a hojas nuevas (puede brotar sin tener fruta).',
    calendarioVigilancia: {9:'🟢',10:'🟠',11:'🟠',12:'🟠',1:'🟠',2:'🟠',3:'🟠',4:'🟠'} },
  { match:'durazno', monitoreo:'2 controles semanales: hojas nuevas, frutos, puntas de ramas, lesiones, frutos caidos. Retirar de inmediato los frutos caidos enfermos.',
    calendarioVigilancia: {9:'🔴🔴',10:'🔴🔴',11:'🔴',12:'🔴',1:'🔴',2:'🟠',3:'🟢',4:'🟢'} },
  { match:'ciruela', monitoreo:'1 revision semanal, enfocada en brotes nuevos y pulgones.',
    calendarioVigilancia: {9:'🟠',10:'🔴',11:'🔴',12:'🔴',1:'🔴',2:'🟠',3:'🟢',4:'🟢'} },
];

function fichaFito(nombreOEspecie) {
  var buscado = String(nombreOEspecie || '').toLowerCase();
  for (var i = 0; i < FITOSANITARIO.length; i++) {
    if (buscado.indexOf(FITOSANITARIO[i].match) >= 0) return FITOSANITARIO[i];
  }
  return null;
}
function diasVigilancia(ficha, mes) {
  var nivel = (ficha && ficha.calendarioVigilancia[mes]) || '🟢';
  return NIVEL_DIAS_FITO[nivel];
}

// Diagnóstico manual — ejecutar desde el editor de Apps Script (▶) y mirar
// Ver → Registros de ejecución. No se llama desde ningún trigger.
function testFitosanitario() {
  var mesActual = new Date().getMonth() + 1;
  ['Mandarina Criolla','Limonero 4 Estaciones','Ciruela Reina Claudia','Durazno amarillo'].forEach(function (n) {
    var f = fichaFito(n);
    Logger.log(n + ' | mes ' + mesActual + ' | nivel ' + (f ? f.calendarioVigilancia[mesActual] : '(sin ficha)') +
      ' | intervalo ' + (f ? diasVigilancia(f, mesActual) : CFG_PLANTAS.diasRevisionPlagas) + ' dias');
  });
}

// Devuelve la fecha del evento más reciente de un tipo (Fertiliz/Poda/plagas)
```

- [ ] **Step 2: Usar el intervalo dinámico en `actualizarFichaPlantas()`**

Ubicar dentro de `function actualizarFichaPlantas()`:

```js
    actualizarProximoEvento_(shP, fila, idPlanta, 'Fertiliz', 11, 12, perfil ? perfil.diasFert : CFG_PLANTAS.diasFertilizante);
    actualizarProximoEvento_(shP, fila, idPlanta, 'Poda', 13, 14, perfil && perfil.podaDias ? perfil.podaDias : CFG_PLANTAS.diasPoda);
    actualizarProximoEvento_(shP, fila, idPlanta, 'plagas', 15, 16, CFG_PLANTAS.diasRevisionPlagas);
```

Reemplazar por:

```js
    actualizarProximoEvento_(shP, fila, idPlanta, 'Fertiliz', 11, 12, perfil ? perfil.diasFert : CFG_PLANTAS.diasFertilizante);
    actualizarProximoEvento_(shP, fila, idPlanta, 'Poda', 13, 14, perfil && perfil.podaDias ? perfil.podaDias : CFG_PLANTAS.diasPoda);
    var fichaFitoP = fichaFito(especie);
    var intervaloPlagas = fichaFitoP ? diasVigilancia(fichaFitoP, mes) : CFG_PLANTAS.diasRevisionPlagas;
    actualizarProximoEvento_(shP, fila, idPlanta, 'plagas', 15, 16, intervaloPlagas);
```

(`especie` y `mes` ya están definidos más arriba en el mismo bucle `for` de `actualizarFichaPlantas()` — líneas 1780 y 1790.)

- [ ] **Step 3: Verificar en el editor de Apps Script**

Pegar los cambios en el proyecto de Apps Script real (Extensiones → Apps Script desde la hoja de cálculo). Seleccionar la función `testFitosanitario` en el desplegable de funciones del editor y ejecutar (▶). Abrir Ver → Registros de ejecución. Expected: 4 líneas, una por planta, con el nivel/intervalo esperado para el mes actual (ej. en septiembre: Durazno → 🔴🔴 / 3 dias, Mandarina → 🟢 / 14 dias). Ningún error de sintaxis al guardar el proyecto (Apps Script marca errores de sintaxis en rojo apenas se guarda).

- [ ] **Step 4: Commit**

```bash
git add codigo.gs
git commit -m "feat: mirror de fichas fitosanitarias y frecuencia dinamica en Apps Script"
```

---

## Task 7: Descripción del evento de calendario por planta (codigo.gs)

**Files:**
- Modify: `codigo.gs:1942` (push a `grupos.plagas` dentro de `verificarEventosPlantas`)
- Modify: `codigo.gs:2034-2044` (construcción del evento de calendario de plagas)

**Interfaces:**
- Consumes: `fichaFito(nombreOEspecie)` (Task 6), `especie`/`nombre` ya en scope dentro del `forEach` de `verificarEventosPlantas`, `CHULETA_PLAGAS` (ya existente)

- [ ] **Step 1: Empujar la ficha junto con el nombre**

Ubicar:

```js
    // ── REVISIÓN DE PLAGAS ─────────────────────────────────────────
    var proxPlagas = p[15] ? new Date(p[15]) : null;
    if (proxPlagas) {
      proxPlagas.setHours(0, 0, 0, 0);
      var diasParaPlagas = Math.floor((proxPlagas - hoy) / 86400000);
      if (diasParaPlagas <= 0) grupos.plagas.push(nombre);
    }
```

Reemplazar por:

```js
    // ── REVISIÓN DE PLAGAS ─────────────────────────────────────────
    var proxPlagas = p[15] ? new Date(p[15]) : null;
    if (proxPlagas) {
      proxPlagas.setHours(0, 0, 0, 0);
      var diasParaPlagas = Math.floor((proxPlagas - hoy) / 86400000);
      if (diasParaPlagas <= 0) grupos.plagas.push({ nombre: nombre, ficha: fichaFito(especie) });
    }
```

- [ ] **Step 2: Construir la descripción separando frutales/cítricos de otras plantas**

Ubicar:

```js
  if (grupos.plagas.length) {
    eventos.push({
      titulo: '🐛 REVISIÓN PLAGAS: ' + grupos.plagas.length + ' planta(s)',
      desc: 'Revisión mensual de plagas y enfermedades:\n\n' +
        grupos.plagas.map(function (n) { return '• ' + n; }).join('\n') + '\n\n' +
        'Qué revisar: hojas (manchas, decoloración), envés (cochinillas, pulgones, ácaros), tallos.\n\n' +
        CHULETA_PLAGAS + '\n\n' +
        'Acción: registrar hallazgos en \'Registro Plantas\'.',
      color: CalendarApp.EventColor.YELLOW
    });
  }
```

Reemplazar por:

```js
  if (grupos.plagas.length) {
    var conFicha = grupos.plagas.filter(function (x) { return x.ficha; });
    var sinFicha = grupos.plagas.filter(function (x) { return !x.ficha; });
    var partes = ['Revisión de plagas y enfermedades:'];
    if (conFicha.length) {
      partes.push('');
      partes.push('🌳 Frutales/cítricos:');
      conFicha.forEach(function (x) { partes.push('• ' + x.nombre + ' — ' + x.ficha.monitoreo); });
    }
    if (sinFicha.length) {
      partes.push('');
      partes.push('🪴 Otras plantas:');
      sinFicha.forEach(function (x) { partes.push('• ' + x.nombre); });
      partes.push('');
      partes.push('Qué revisar: hojas (manchas, decoloración), envés (cochinillas, pulgones, ácaros), tallos.');
      partes.push('');
      partes.push(CHULETA_PLAGAS);
    }
    partes.push('');
    partes.push('Acción: registrar hallazgos en \'Registro Plantas\'.');
    eventos.push({
      titulo: '🐛 REVISIÓN PLAGAS: ' + grupos.plagas.length + ' planta(s)',
      desc: partes.join('\n'),
      color: CalendarApp.EventColor.YELLOW
    });
  }
```

- [ ] **Step 3: Verificar en el editor de Apps Script**

Con los cambios pegados en el proyecto real, agregar temporalmente (o reusar) una función de prueba que llame a `verificarEventosPlantas(null, null)` y loguee el resultado:

```js
function testEventosPlagas() {
  var eventos = verificarEventosPlantas(null, null);
  eventos.forEach(function (e) {
    if (e.titulo.indexOf('PLAGAS') >= 0) Logger.log(e.titulo + '\n' + e.desc);
  });
}
```

Ejecutar `testEventosPlagas` desde el editor (▶) y revisar Ver → Registros de ejecución. Expected: si hay al menos una planta con `proximaPlagas` vencida hoy (columna 15 de la hoja "Plantas" — se puede forzar poniendo una fecha pasada ahí para la prueba), el log muestra el título del evento y una descripción con la sección "🌳 Frutales/cítricos" listando esa planta junto con su texto de `monitoreo` específico (no el `CHULETA_PLAGAS` genérico, salvo que también haya una planta de interior vencida en el mismo grupo). Borrar `testEventosPlagas` después de verificar si no se quiere dejar como función permanente (a diferencia de `testFitosanitario`, esta depende de tener datos vencidos en la hoja para dar un resultado útil, así que no es tan reutilizable).

- [ ] **Step 4: Commit**

```bash
git add codigo.gs
git commit -m "feat: evento de calendario de plagas usa guia especifica por planta cuando existe ficha"
```

---

## Task 8: Deploy y verificación final

**Files:** ninguno (push + verificación manual)

- [ ] **Step 1: Push a GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Verificar el deploy en producción**

Abrir `https://compostaje-casero.web.app` en el navegador (Firebase Hosting sirve directo desde `public/public/` — confirmar si el deploy es automático vía GitHub Actions revisando si hay un workflow en `.github/workflows/`; si no lo hay, correr `firebase deploy --only hosting` manualmente desde la carpeta del proyecto). Recargar forzado (Ctrl+Shift+R) para evitar caché. Confirmar:
- La sección "Fitosanitario" aparece en el menú y muestra las 4 fichas con datos reales (no `SEED_*`, sino lo que haya en Firestore).
- El registro de un evento de prueba de "Revisión plagas" con producto autocompletado se guarda y aparece en el historial de esa planta.

- [ ] **Step 3: Limpiar los sistemas fantasma**

Desde la pantalla "Sistemas" de la app en producción, usar el nuevo botón de eliminar (Task 5) para borrar los sistemas 4, 5, 6, 7, 8, 9 y 10 (los que muestran "Sin datos"). Confirmar que después de recargar la página siguen sin aparecer — si reaparece alguno, no se guardó el fix de `delSis` correctamente o ese sistema en particular tiene un documento en Firestore con un id distinto al que muestra la tarjeta (revisar consola de Firebase).

- [ ] **Step 4: Pegar los cambios de `codigo.gs` en el proyecto de Apps Script real**

Este repo no tiene forma de desplegar Apps Script directamente — copiar el contenido actualizado de `codigo.gs` al editor de Apps Script vinculado a la hoja de cálculo real (Extensiones → Apps Script), guardar, y confirmar que no marca errores de sintaxis. No hace falta reconfigurar triggers (las funciones modificadas ya estaban enganchadas a `verificarYCrearEventos()` / `actualizarFichaPlantas()`, que corren con los triggers diarios existentes).

- [ ] **Step 5: Avisar al usuario**

Confirmar por chat que: deploy hecho, sistemas fantasma eliminados (o instrucciones si algo no se pudo borrar), y que el archivo `codigo.gs` está listo para pegar en el editor de Apps Script real (con el paso exacto: Extensiones → Apps Script → pegar → Guardar).
