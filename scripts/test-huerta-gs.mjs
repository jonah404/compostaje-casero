// Prueba la lógica de la huerta en codigo.gs (Apps Script, ES5) con stubs de los
// servicios de Google. Correr: node scripts/test-huerta-gs.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(fileURLToPath(new URL('../codigo.gs', import.meta.url)), 'utf8');

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};

// ── Hojas falsas ─────────────────────────────────────────────────────
const hoja = rows => ({
  rows,
  getLastRow: () => rows.length,
  getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }),
  getRange: (r, c, nr = 1, nc = 1) => ({
    getValue: () => { const v = (rows[r - 1] || [])[c - 1]; return v === undefined ? '' : v; },
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const v = (rows[r - 1 + i] || [])[c - 1 + j]; return v === undefined ? '' : v; })),
    setValue(v) { (rows[r - 1] = rows[r - 1] || [])[c - 1] = v; return this; },
    setValues(vs) { vs.forEach((fila, i) => fila.forEach((v, j) => { (rows[r - 1 + i] = rows[r - 1 + i] || [])[c - 1 + j] = v; })); return this; },
    clearContent() { (rows[r - 1] = rows[r - 1] || [])[c - 1] = ''; return this; },
    setNumberFormat() { return this; }, setBackground() { return this; }, setFontColor() { return this; },
    setFontWeight() { return this; }, setFontSize() { return this; }, setFontFamily() { return this; },
    setHorizontalAlignment() { return this; }, setVerticalAlignment() { return this; }, setWrap() { return this; },
  }),
  setColumnWidth() {},
});

// Carga codigo.gs en un contexto nuevo con los servicios de Google simulados.
const cargar = (hojas, extra = {}) => {
  const ctx = {
    Logger: { log() {} },
    Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
    CalendarApp: { EventColor: new Proxy({}, { get: (_, k) => String(k) }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => hojas[n] || null }) },
    UrlFetchApp: extra.UrlFetchApp || { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '' }) },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: s => ({ texto: s, setMimeType() { return this; } }),
    },
    LockService: extra.LockService || { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
};

const HOY = new Date(); HOY.setHours(0, 0, 0, 0);
const hace = n => { const x = new Date(HOY); x.setDate(x.getDate() - n); return x; };
const iso = d => d.toISOString().slice(0, 10);

// Fila de la hoja "Plantas" (A–AF).
const fila = (o) => {
  const r = new Array(32).fill('');
  r[0] = o.id; r[1] = o.nombre; r[3] = o.nombre; r[4] = o.siembra || '';
  r[16] = o.ultimoRiego || ''; r[11] = o.proxFert || ''; r[15] = o.proxPlagas || '';
  r[20] = o.categoria || ''; r[21] = o.cultivo || ''; r[22] = o.ciclo || '';
  r[23] = o.fechaTrasplante || '';
  r[24] = o.rv ?? ''; r[25] = o.ri ?? ''; r[26] = o.fert ?? ''; r[27] = o.plagas ?? '';
  r[28] = o.dt ?? ''; r[29] = o.dc ?? ''; r[30] = o.estado || ''; r[31] = o.cierre || '';
  return r;
};
const ENC = new Array(32).fill('h');

console.log('perfil y utilidades de fila');
{
  const g = cargar({});
  t('perfilHuertaFila_ con datos', () => {
    const p = g.perfilHuertaFila_(fila({ id: 1, nombre: 'Tomate', categoria: 'huerta', rv: 2, ri: 4, fert: 20, plagas: 7 }));
    assert.deepEqual([p.tipo, p.riegoVerano, p.riegoInvierno, p.diasFert, p.diasPlagas, p.fertMesIni, p.podaDias], ['Exterior', 2, 4, 20, 7, null, null]);
  });
  t('perfilHuertaFila_ con defaults (3/5/30/7)', () => {
    const p = g.perfilHuertaFila_(fila({ id: 1, nombre: 'X', categoria: 'huerta' }));
    assert.deepEqual([p.riegoVerano, p.riegoInvierno, p.diasFert, p.diasPlagas], [3, 5, 30, 7]);
  });
  t('esHuertaFila_ / huertaCerradaFila_', () => {
    assert.equal(g.esHuertaFila_(fila({ id: 1, nombre: 'a', categoria: 'huerta' })), true);
    assert.equal(g.esHuertaFila_(fila({ id: 2, nombre: 'b' })), false);
    assert.equal(g.huertaCerradaFila_(fila({ id: 1, nombre: 'a', estado: 'cosechado' })), true);
    assert.equal(g.huertaCerradaFila_(fila({ id: 1, nombre: 'a', estado: 'terminado' })), true);
    assert.equal(g.huertaCerradaFila_(fila({ id: 1, nombre: 'a', estado: 'activo' })), false);
    assert.equal(g.huertaCerradaFila_(fila({ id: 1, nombre: 'a' })), false);
  });
  t('numOVacio_', () => { assert.equal(g.numOVacio_(''), ''); assert.equal(g.numOVacio_(null), ''); assert.equal(g.numOVacio_('x'), ''); assert.equal(g.numOVacio_('7'), 7); assert.equal(g.numOVacio_(0), 0); });
}

console.log('verificarEventosHuerta');
{
  const filas = [ENC,
    fila({ id: 1, nombre: 'Tomate', categoria: 'huerta', cultivo: 'tomate', ciclo: 'anual', siembra: hace(45), ultimoRiego: hace(1), proxFert: hace(10), proxPlagas: hace(10), rv: 2, ri: 4, fert: 20, plagas: 7, dt: 40, dc: 100 }),
    fila({ id: 2, nombre: 'Lechuga', categoria: 'huerta', cultivo: 'lechuga', ciclo: 'anual', siembra: hace(70), fechaTrasplante: hace(40), ultimoRiego: hace(1), proxFert: hace(10), proxPlagas: hace(10), rv: 2, ri: 4, fert: 20, plagas: 7, dt: 25, dc: 60 }),
    fila({ id: 3, nombre: 'Romero', categoria: 'huerta', cultivo: 'romero', ciclo: 'perenne', siembra: hace(400), ultimoRiego: hace(30), proxFert: hace(10), proxPlagas: hace(10), rv: 7, ri: 12, fert: 90, plagas: 14 }),
    fila({ id: 4, nombre: 'Zanahoria', categoria: 'huerta', cultivo: 'zanahoria', ciclo: 'anual', siembra: hace(120), ultimoRiego: hace(1), proxFert: hace(10), proxPlagas: hace(10), rv: 3, ri: 5, fert: 30, plagas: 10, dc: 100, estado: 'cosechado', cierre: hace(2) }),
    fila({ id: 5, nombre: 'Mandarina', siembra: hace(90), ultimoRiego: hace(30), proxFert: hace(10), proxPlagas: hace(10) }),
    fila({ id: 6, nombre: 'Albahaca', categoria: 'huerta', cultivo: 'albahaca', ciclo: 'anual', siembra: hace(12), ultimoRiego: hace(1), proxFert: hace(-5), proxPlagas: hace(-5), rv: 2, ri: 4, fert: 25, plagas: 10, dt: 30, dc: 45 }),
  ];
  const g = cargar({ Plantas: hoja(filas) });
  const evs = g.verificarEventosHuerta();
  const buscar = pref => evs.find(e => e.titulo.indexOf(pref) >= 0);
  t('riego agrupado: solo cultivos vencidos (romero: 30 d, límite 7/12)', () => {
    const e = buscar('Regar la huerta'); assert.ok(e, 'evento de riego');
    assert.match(e.titulo, /1 cultivo/); assert.match(e.desc, /Romero/); assert.doesNotMatch(e.desc, /Tomate|Lechuga|Albahaca|Zanahoria|Mandarina/);
  });
  t('trasplante: el tomate (día 45 ≥ 40, sin trasplante)', () => {
    const e = buscar('Trasplantar'); assert.ok(e); assert.match(e.desc, /Tomate/); assert.doesNotMatch(e.desc, /Lechuga/);
  });
  t('cosecha: la lechuga (día 70 ≥ 60); no la zanahoria cerrada ni el romero perenne', () => {
    const e = buscar('Cosechar'); assert.ok(e); assert.match(e.desc, /Lechuga/); assert.doesNotMatch(e.desc, /Zanahoria|Romero/);
  });
  t('fertilizar y plagas: solo los vencidos (no la albahaca con fechas futuras, ni cerrados, ni plantas comunes)', () => {
    const f = buscar('Fertilizar'), p = buscar('Revisar plagas');
    [f, p].forEach(e => { assert.ok(e); assert.match(e.desc, /Lechuga/); assert.match(e.desc, /Romero/); assert.doesNotMatch(e.desc, /Albahaca|Zanahoria|Mandarina/); });
    assert.match(p.desc, /Tomate/);   // las plagas se revisan también en el almácigo
  });
  t('fertilizar: el tomate sin trasplantar (en vivero) NO lleva aviso aunque su "Próxima fertilización" esté vencida', () => {
    assert.doesNotMatch(buscar('Fertilizar').desc, /Tomate/);
  });
  t('no hay eventos de plantas comunes ni de cerrados', () => assert.ok(evs.every(e => !/Mandarina|Zanahoria/.test(e.desc))));
  t('la cosecha se silencia 3 días tras un evento de cosecha', () => {
    const reg = hoja([['id', 'n', 'fecha', 'tipo'], [2, 'Lechuga', hace(1), '🍂 Cosecha']]);
    const g2 = cargar({ Plantas: hoja(filas), 'Registro Plantas': reg });
    assert.equal(g2.verificarEventosHuerta().find(e => e.titulo.indexOf('Cosechar') >= 0), undefined);
  });
}

console.log('verificarEventosHuerta: compuertas de fase (espejo de faseCultivo)');
{
  const base = { categoria: 'huerta', cultivo: 'tomate', ciclo: 'anual', ultimoRiego: hace(1), proxFert: hace(-5), proxPlagas: hace(-5), rv: 2, ri: 4, fert: 20, plagas: 7 };
  const evs = filas => cargar({ Plantas: hoja([ENC, ...filas]) }).verificarEventosHuerta();
  const tiene = (e, pref) => e.some(x => x.titulo.indexOf(pref) >= 0);
  t('(a) tomate sin trasplantar pasado de diasACosecha: Trasplantar y NO Cosechar', () => {
    const e = evs([fila({ ...base, id: 1, nombre: 'Tomate', siembra: hace(120), dt: 40, dc: 100 })]);
    assert.ok(tiene(e, 'Trasplantar')); assert.ok(!tiene(e, 'Cosechar'));
  });
  t('(b) perenne con diasATrasplante: sin Trasplantar', () => {
    const e = evs([fila({ ...base, id: 1, nombre: 'Romero', ciclo: 'perenne', siembra: hace(400), dt: 40, dc: 100 })]);
    assert.ok(!tiene(e, 'Trasplantar')); assert.ok(!tiene(e, 'Cosechar'));
  });
  t('(c) diasATrasplante = 0: sin Trasplantar (y sí Cosechar si ya llegó)', () => {
    const e = evs([fila({ ...base, id: 1, nombre: 'Rabanito', siembra: hace(50), dt: 0, dc: 30 })]);
    assert.ok(!tiene(e, 'Trasplantar')); assert.ok(tiene(e, 'Cosechar'));
  });
  t('(d) anual sin diasACosecha: ni Trasplantar ni Cosechar', () => {
    const e = evs([fila({ ...base, id: 1, nombre: 'Tomate', siembra: hace(200), dt: 40 })]);
    assert.ok(!tiene(e, 'Trasplantar')); assert.ok(!tiene(e, 'Cosechar'));
  });
  t('fechaTrasplante solo espacios cuenta como vacía', () => {
    const e = evs([fila({ ...base, id: 1, nombre: 'Tomate', siembra: hace(45), dt: 40, dc: 100, fechaTrasplante: '  ' })]);
    assert.ok(tiene(e, 'Trasplantar'));
  });
  t('(e) silencio: cosecha hace 3 días NO silencia; hace 2 sí', () => {
    const f = [fila({ ...base, id: 2, nombre: 'Lechuga', siembra: hace(70), fechaTrasplante: hace(40), dt: 25, dc: 60 })];
    const con = d => cargar({ Plantas: hoja([ENC, ...f]), 'Registro Plantas': hoja([['id', 'n', 'fecha', 'tipo'], [2, 'Lechuga', hace(d), '🍂 Cosecha']]) }).verificarEventosHuerta();
    assert.ok(tiene(con(3), 'Cosechar'));
    assert.ok(!tiene(con(2), 'Cosechar'));
  });
}

console.log('doPost: serializa con el lock del script');
{
  const log = [];
  const LockService = { getScriptLock: () => ({ waitLock: ms => log.push('wait' + ms), releaseLock: () => log.push('release') }) };
  const g = cargar({ Plantas: hoja([ENC]) }, { LockService });
  t('toma el lock antes de procesar y lo suelta después', () => {
    log.length = 0;
    const r = g.doPost({ postData: { contents: JSON.stringify({ tipo: 'noexiste', data: {} }) } });
    assert.deepEqual(Array.from(log), ['wait30000', 'release']);
    assert.equal(JSON.parse(r.texto).ok, true);
  });
  t('lo suelta aunque el handler lance', () => {
    log.length = 0;
    const r = g.doPost({ postData: { contents: '{no es json' } });
    assert.deepEqual(Array.from(log), ['wait30000', 'release']);
    assert.equal(JSON.parse(r.texto).ok, false);
  });
  t('si waitLock falla: responde ok:false y no suelta un lock que no tiene', () => {
    const log2 = [];
    const g2 = cargar({}, { LockService: { getScriptLock: () => ({ waitLock() { throw new Error('timeout'); }, releaseLock: () => log2.push('release') }) } });
    const r = g2.doPost({ postData: { contents: '{}' } });
    assert.equal(JSON.parse(r.texto).ok, false); assert.equal(log2.length, 0);
  });
}

console.log('verificarEventosPlantas: los cultivos solo cuentan para la helada');
{
  const filas = [ENC,
    fila({ id: 1, nombre: 'Tomate', categoria: 'huerta', cultivo: 'tomate', ciclo: 'anual', siembra: hace(45), ultimoRiego: hace(30), proxFert: hace(10), proxPlagas: hace(10), rv: 2, ri: 4, fert: 20, plagas: 7, dt: 40, dc: 100 }),
    fila({ id: 2, nombre: 'Cerrada', categoria: 'huerta', cultivo: 'lechuga', ciclo: 'anual', siembra: hace(45), rv: 2, ri: 4, fert: 20, plagas: 7, estado: 'cosechado' }),
    fila({ id: 3, nombre: 'Mandarina', siembra: hace(90), ultimoRiego: hace(30), proxFert: hace(10), proxPlagas: hace(10) }),
  ];
  const clima = hoja([['t'], ['t'], [hace(1), 5, 8, -1, 0, 0, 0, '❌ No', 0]]);   // mínima de -1 °C en la col D (índice 3)
  const g = cargar({ Plantas: hoja(filas), Clima: clima });
  const evs = g.verificarEventosPlantas({}, HOY);
  t('la helada incluye al cultivo activo y a la mandarina, no al cerrado', () => {
    const h = evs.find(e => /HELADA/.test(e.titulo)); assert.ok(h, 'evento de helada');
    assert.match(h.desc, /Tomate/); assert.match(h.desc, /Mandarina/); assert.doesNotMatch(h.desc, /Cerrada/);
  });
  t('riego, fertilización y plagas de plantas comunes NO incluyen cultivos', () => {
    evs.filter(e => !/HELADA/.test(e.titulo)).forEach(e => assert.doesNotMatch(e.desc, /Tomate|Cerrada/, e.titulo));
    assert.ok(evs.some(e => /RIEGO/.test(e.titulo) && /Mandarina/.test(e.desc)), 'la mandarina sigue con su riego');
  });
}

console.log('actualizarFichaPlantas: inicialización de un cultivo nuevo');
{
  const filas = [ENC, fila({ id: 1, nombre: 'Tomate', categoria: 'huerta', cultivo: 'tomate', ciclo: 'anual', siembra: hace(10), rv: 2, ri: 4, fert: 20, plagas: 7, dt: 40, dc: 100 })];
  const sh = hoja(filas);
  const g = cargar({ Plantas: sh });
  g.actualizarFichaPlantas();
  const r = sh.rows[1];
  t('completa Último riego y Próxima revisión de plagas desde la siembra (también en el almácigo)', () => {
    assert.equal(iso(new Date(r[16])), iso(hace(10)));                                   // último riego = siembra
    const dias = d => Math.round((new Date(d) - hace(10)) / 86400000);
    assert.equal(dias(r[15]), 7);                                                        // + diasPlagas
  });
  t('almácigo (con trasplante pendiente): NO hay "Próxima fertilización"', () => {
    assert.ok(r[11] === '' || r[11] === undefined, 'col 12 vacía');
  });
}

console.log('actualizarFichaPlantas: la fertilización se cuenta desde el trasplante');
{
  const dias = (d, desde) => Math.round((new Date(d) - desde) / 86400000);
  const correr = (filaCultivo, registro) => {
    const sh = hoja([ENC, filaCultivo]);
    const hojas = { Plantas: sh }; if (registro) hojas['Registro Plantas'] = hoja(registro);
    cargar(hojas).actualizarFichaPlantas();
    return sh.rows[1];
  };
  const tomate = o => fila({ id: 1, nombre: 'Tomate', categoria: 'huerta', cultivo: 'tomate', ciclo: 'anual', rv: 2, ri: 4, fert: 20, plagas: 7, dt: 40, dc: 120, ...o });

  t('la "Próxima fertilización" vieja (calculada desde la siembra) se borra mientras siga en el almácigo', () => {
    const r = correr(tomate({ siembra: hace(20), proxFert: HOY }));          // ya venía fijada desde la siembra (+20 d)
    assert.ok(r[11] === '' || r[11] === undefined);
  });
  t('por trasplantar (pasó el día 40 sin trasplante): tampoco hay fertilización', () => {
    const r = correr(tomate({ siembra: hace(45), proxFert: hace(5) }));
    assert.ok(r[11] === '' || r[11] === undefined);
  });
  t('trasplantado: próxima fertilización = trasplante + diasFert', () => {
    const r = correr(tomate({ siembra: hace(50), fechaTrasplante: hace(5), proxFert: hace(10) }));
    assert.equal(dias(r[11], hace(5)), 20);
  });
  t('una fertilización registrada DESPUÉS del trasplante manda (evento + diasFert)', () => {
    const reg = [['id', 'n', 'fecha', 'tipo'], [1, 'Tomate', hace(2), '🌿 Fertilización']];
    const r = correr(tomate({ siembra: hace(50), fechaTrasplante: hace(5) }), reg);
    assert.equal(dias(r[11], hace(2)), 20);
  });
  t('una fertilización anterior al trasplante no adelanta el aviso (manda el trasplante)', () => {
    const reg = [['id', 'n', 'fecha', 'tipo'], [1, 'Tomate', hace(30), '🌿 Fertilización']];
    const r = correr(tomate({ siembra: hace(50), fechaTrasplante: hace(5) }), reg);
    assert.equal(dias(r[11], hace(5)), 20);
  });
  t('siembra directa (sin días a trasplante): se cuenta desde la siembra, como antes', () => {
    const r = correr(fila({ id: 2, nombre: 'Zanahoria', categoria: 'huerta', cultivo: 'zanahoria', ciclo: 'anual', siembra: hace(10), rv: 3, ri: 5, fert: 30, plagas: 10, dc: 120 }));
    assert.equal(dias(r[11], hace(10)), 30);
  });
  t('perenne: se cuenta desde la siembra', () => {
    const r = correr(fila({ id: 3, nombre: 'Romero', categoria: 'huerta', cultivo: 'romero', ciclo: 'perenne', siembra: hace(100), rv: 7, ri: 12, fert: 90, plagas: 14 }));
    assert.equal(dias(r[11], hace(100)), 90);
  });
  t('es idempotente: correrlo dos veces deja la misma fecha', () => {
    const sh = hoja([ENC, tomate({ siembra: hace(50), fechaTrasplante: hace(5) })]);
    const g = cargar({ Plantas: sh });
    g.actualizarFichaPlantas(); const primera = String(sh.rows[1][11]);
    g.actualizarFichaPlantas();
    assert.equal(String(sh.rows[1][11]), primera);
  });
  t('un cultivo cerrado no se toca', () => {
    const r = correr(tomate({ siembra: hace(50), fechaTrasplante: hace(5), estado: 'cosechado', cierre: hace(1), proxFert: hace(3) }));
    assert.equal(iso(new Date(r[11])), iso(hace(3)));
  });
}

console.log('guardarPlantaSheet y sincronizarPlantasAFirestore');
{
  const sh = hoja([ENC]);
  const g = cargar({ Plantas: sh });
  g.guardarPlantaSheet({ id: 7, nombre: 'Tomate', variedad: '', especie: 'Tomate', fechaP: '2026-09-01', ubicacion: 'Cantero 1', exposicion: 'Sol pleno', suelo: 'Tierra directa', notas: 'n',
    categoria: 'huerta', cultivo: 'tomate', ciclo: 'anual', fechaTrasplante: '', riegoVerano: 2, riegoInvierno: 4, diasFert: 20, diasPlagas: 7, diasATrasplante: 40, diasACosecha: 100, estadoCultivo: 'activo', fechaCierre: '' });
  g.guardarPlantaSheet({ id: 8, nombre: 'Mandarina', especie: 'Cítrico', fechaP: '2026-08-04', notas: '' });
  t('un cultivo escribe las columnas 21–32', () => {
    const r = sh.rows[1];
    assert.deepEqual([r[20], r[21], r[22], r[24], r[25], r[26], r[27], r[28], r[29], r[30]], ['huerta', 'tomate', 'anual', 2, 4, 20, 7, 40, 100, 'activo']);
    assert.equal(r[23], '');   // sin trasplante
  });
  t('una planta común deja vacías las columnas de huerta', () => {
    const r = sh.rows[2]; assert.equal(r[1], 'Mandarina');
    for (let c = 20; c <= 31; c++) assert.ok(r[c] === undefined || r[c] === '', 'col ' + (c + 1));
  });

  const llamadas = [];
  const UrlFetchApp = { fetch: (url, opts) => { llamadas.push({ url, campos: JSON.parse(opts.payload).fields }); return { getResponseCode: () => 200, getContentText: () => '' }; } };
  const filas2 = [ENC,
    fila({ id: 1, nombre: 'Tomate', categoria: 'huerta', cultivo: 'tomate', ciclo: 'anual', siembra: hace(10), rv: 2, ri: 4, fert: 20, plagas: 7, dt: 40, dc: 100 }),
    fila({ id: 2, nombre: 'Mandarina', siembra: hace(90) }),
  ];
  const g2 = cargar({ Plantas: hoja(filas2) }, { UrlFetchApp });
  g2.sincronizarPlantasAFirestore();
  const de = id => llamadas.find(l => l.url.indexOf('/plantas/' + id + '?') >= 0);
  t('el sync incluye los campos de huerta solo en filas de huerta', () => {
    const c1 = de(1).campos, c2 = de(2).campos;
    assert.equal(c1.categoria.stringValue, 'huerta'); assert.equal(c1.cultivo.stringValue, 'tomate');
    assert.equal(c1.riegoVerano.doubleValue, 2); assert.equal(c1.diasACosecha.doubleValue, 100);
    assert.equal(c1.estadoCultivo.stringValue, 'activo');
    ['categoria', 'cultivo', 'riegoVerano', 'estadoCultivo'].forEach(k => assert.equal(c2[k], undefined, k));
    assert.match(de(1).url, /updateMask\.fieldPaths=categoria/); assert.doesNotMatch(de(2).url, /fieldPaths=categoria/);
  });
}

console.log('evento único y calendario');
{
  const g = cargar({});
  t('EVENTO_UNICO tiene el área huerta después de plantas', () => {
    const ids = Array.from(g.EVENTO_UNICO.areas.map(a => a.id));   // Array.from: los arreglos de vm son de otro contexto
    assert.deepEqual(ids, ['compost', 'plantas', 'huerta', 'pecera']);
    assert.equal(g.EVENTO_UNICO.areas[2].encabezado, '🥬 HUERTA');
  });
  t('armarEventoUnico_ agrupa la huerta en su sección', () => {
    const r = g.armarEventoUnico_([{ titulo: '💧 Regar la huerta · 2 cultivo(s)', desc: '• Tomate\n• Albahaca', area: 'huerta' }, { titulo: '💧 RIEGO: 1 planta(s)', desc: '• Mandarina', area: 'plantas' }]);
    assert.match(r.tareas.desc, /🥬 HUERTA/); assert.ok(r.tareas.desc.indexOf('🪴 PLANTAS') < r.tareas.desc.indexOf('🥬 HUERTA'));
  });
  t('testHuerta y agregarColumnasHuerta existen y corren sin lanzar', () => {
    const sh = hoja([new Array(20).fill('h')]);
    const g2 = cargar({ Plantas: sh });
    g2.agregarColumnasHuerta();
    assert.equal(sh.rows[0][20], 'Categoría'); assert.equal(sh.rows[0][31], 'Fecha cierre');
    g2.testHuerta();
  });
}

console.log(`\n${ok} pruebas OK` + (process.exitCode ? ' — HAY FALLAS' : ''));
