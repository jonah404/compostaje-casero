// Prueba las altas de plantas y la limpieza de la huerta de codigo.gs (Apps Script, ES5)
// con stubs de los servicios de Google. Correr: node scripts/test-altas-gs.mjs
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

const val = (rows, r, c) => { const v = (rows[r - 1] || [])[c - 1]; return v === undefined ? '' : v; };
const hoja = (rows, maxCols = 32) => {
  const h = {
    rows,
    getLastRow: () => rows.length,
    getMaxRows: () => rows.length + 10,
    getMaxColumns: () => maxCols,
    getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }),
    appendRow: fila => { rows.push(fila.slice()); },
    insertRowBefore: n => { rows.splice(n - 1, 0, []); },
    deleteRow: n => { rows.splice(n - 1, 1); },
    setRowHeight() {}, setColumnWidth() {},
    getRange: (r, c, nr = 1, nc = 1) => {
      const g = {
        getValue: () => val(rows, r, c),
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => val(rows, r + i, c + j))),
        setValue(v) { (rows[r - 1] = rows[r - 1] || [])[c - 1] = v; return g; },
        setValues(vs) { vs.forEach((fila, i) => fila.forEach((v, j) => { (rows[r - 1 + i] = rows[r - 1 + i] || [])[c - 1 + j] = v; })); return g; },
        clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (rows[r - 1 + i]) rows[r - 1 + i][c - 1 + j] = ''; return g; },
      };
      ['setNumberFormat', 'setBackground', 'setFontColor', 'setFontWeight', 'setFontSize', 'setFontFamily',
        'setHorizontalAlignment', 'setVerticalAlignment', 'setWrap'].forEach(m => { g[m] = () => g; });
      return g;
    },
  };
  return h;
};

const cargar = (hojas, llamadas = []) => {
  const ctx = {
    Logger: { log() {} },
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10) },
    CalendarApp: { EventColor: new Proxy({}, { get: (_, k) => String(k) }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => hojas[n] || null }) },
    ScriptApp: { getOAuthToken: () => 'TOKEN-STUB' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: txt => ({ txt, setMimeType() { return this; } }) },
    UrlFetchApp: { fetch: (url, o) => { llamadas.push({ url, o }); return { getResponseCode: () => 200, getContentText: () => '' }; } },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
};

const ENC_ESP = ['Especie', 'Tipo', 'Riego V', 'Riego I', 'Fert', 'Mes ini', 'Mes fin', 'Tmin', 'Luz', 'Notas', 'Producto', 'Dosis', 'Poda'];
const espBase = () => [ENC_ESP,
  ['Monstera', 'Interior', 8, 12, 30, 9, 4, 12, 'Indirecta brillante', '', '', '', 150],
  ['Helecho', 'Interior', 3, 5, 30, 9, 4, 15, 'Sombra / indirecta media', '', '', '', 240],
  ['Pilea', 'Interior', 7, 10, 30, 9, 4, 10, 'Indirecta brillante', '', '', '', 200],
  ['Planta cebra', 'Interior', 5, 8, 30, 9, 4, 15, 'x', '', '', '', 200],
  ['Pata de elefante', 'Interior', 20, 35, 60, 9, 4, 7, 'x', '', '', '', 450],
];
const plaBase = () => {
  const f = (id, nombre, esp, extra = []) => { const r = new Array(20).fill(''); r[0] = id; r[1] = nombre; r[3] = esp; r[16] = new Date('2026-10-01'); extra.forEach(([i, v]) => { r[i] = v; }); return r; };
  const huerta = (id, nombre) => { const r = f(id, nombre, nombre); r[20] = 'huerta'; r[21] = 'tomate'; return r; };
  return [new Array(20).fill('h'), f(7, 'Helecho nido de ave', 'Helecho nido de ave'), f(12, 'Potus', 'Potus'), huerta(14, 'Tomate'), huerta(15, 'Morrón'), huerta(19, 'Perejil')];
};
const regBase = () => [['ID', 'Planta', 'Fecha', 'Tipo'],
  [7, 'Helecho nido de ave', new Date('2026-10-01'), '💧 Riego'],
  [14, 'Tomate', new Date('2026-10-01'), '💧 Riego'],
  [14, 'Tomate', new Date('2026-10-02'), '🌿 Fertilización'],
  [19, 'Perejil', new Date('2026-10-02'), '💧 Riego'],
  [12, 'Potus', new Date('2026-10-03'), '💧 Riego']];

console.log('agregarEspeciesFaltantes');
{
  const esp = hoja(espBase(), 13);
  const g = cargar({ Especies: esp, Plantas: hoja(plaBase()), 'Registro Plantas': hoja(regBase()) });
  g.agregarEspeciesFaltantes();
  const nombres = esp.rows.map(r => r[0]);
  t('agrega las 8 especies nuevas', () => {
    ['Helecho de cinta', 'Helecho Hawaii', 'Helecho Davana', 'Helecho estrella azul', 'Helecho espárrago', 'Dracena marginata', 'Philodendron imperial red', 'Falsa aralia']
      .forEach(n => assert.ok(nombres.includes(n), 'falta ' + n));
  });
  t('los helechos específicos quedan ANTES del "Helecho" genérico', () => {
    const iGen = nombres.indexOf('Helecho');
    ['Helecho de cinta', 'Helecho Hawaii', 'Helecho Davana', 'Helecho estrella azul', 'Helecho espárrago']
      .forEach(n => assert.ok(nombres.indexOf(n) < iGen, n + ' debe ir antes del genérico'));
  });
  t('perfilEspecie encuentra el específico y no el genérico', () => {
    assert.equal(g.perfilEspecie('Helecho Hawaii').riegoVerano, 4);
    assert.equal(g.perfilEspecie('Helecho de cinta').riegoInvierno, 6);
    assert.equal(g.perfilEspecie('Helecho nido de ave').riegoVerano, 3);   // sigue con el genérico
    assert.equal(g.perfilEspecie('Dracena marginata tricolor').especie, 'Dracena marginata');
    assert.equal(g.perfilEspecie('Helecho espárrago').tempMin, 5);
  });
  t('todas son de tipo Interior', () => {
    ['Helecho espárrago', 'Falsa aralia', 'Philodendron imperial red'].forEach(n => assert.equal(g.perfilEspecie(n).tipo, 'Interior'));
  });
  t('repetirla no duplica filas', () => {
    const antes = esp.rows.length; g.agregarEspeciesFaltantes(); assert.equal(esp.rows.length, antes);
  });
}

console.log('altaPlantasInterior2');
{
  const esp = hoja(espBase(), 13), pla = hoja(plaBase()), reg = hoja(regBase());
  const llamadas = [];
  const g = cargar({ Especies: esp, Plantas: pla, 'Registro Plantas': reg }, llamadas);
  g.altaPlantasInterior2();
  const nuevas = pla.rows.filter(r => Number(r[0]) >= 20);
  t('crea 8 fichas con IDs 20-27 (sin reusar 13-19)', () => {
    assert.deepEqual(nuevas.map(r => r[0]), [20, 21, 22, 23, 24, 25, 26, 27]);
    assert.deepEqual(nuevas.map(r => r[1]), ['Helecho de cinta', 'Helecho Hawaii', 'Helecho Davana', 'Helecho estrella azul', 'Dracena marginata tricolor', 'Philodendron imperial red', 'Falsa aralia', 'Helecho espárrago']);
  });
  t('el helecho espárrago queda en la galería; el resto en interior', () => {
    assert.equal(nuevas[7][5], 'Galería (exterior)');
    nuevas.slice(0, 7).forEach(r => assert.equal(r[5], 'Interior'));
  });
  t('cada una tiene último riego y un evento en Registro Plantas', () => {
    nuevas.forEach(r => { assert.equal(Object.prototype.toString.call(r[16]), '[object Date]'); assert.ok(reg.rows.some(x => x[0] === r[0] && x[3].indexOf('Riego') >= 0), 'riego ' + r[1]); });
  });
  t('la ficha se recalcula con el perfil (próxima fertilización cargada)', () => {
    nuevas.forEach(r => { [11, 13, 15].forEach(c => assert.equal(Object.prototype.toString.call(r[c]), '[object Date]', 'col ' + (c + 1) + ' de ' + r[1])); });
  });
  t('sincroniza a Firestore (una llamada por planta de la hoja)', () => {
    const ids = llamadas.map(l => l.url.match(/plantas\/(\d+)\?/)[1]);
    [20, 27].forEach(i => assert.ok(ids.includes(String(i))));
  });
  t('repetirla no duplica plantas ni riegos', () => {
    const p = pla.rows.length, r = reg.rows.length;
    g.altaPlantasInterior2();
    assert.equal(pla.rows.length, p); assert.equal(reg.rows.length, r);
  });
}

console.log('quitarHuertaSheet');
{
  const pla = hoja(plaBase()), reg = hoja(regBase());
  const g = cargar({ Especies: hoja(espBase(), 13), Plantas: pla, 'Registro Plantas': reg });
  g.quitarHuertaSheet();
  t('borra solo las filas de huerta (14, 15, 19)', () => {
    assert.deepEqual(pla.rows.slice(1).map(r => r[0]), [7, 12]);
  });
  t('borra sus eventos y conserva los de las otras plantas', () => {
    assert.deepEqual(reg.rows.slice(1).map(r => r[0]), [7, 12]);
  });
  t('vacía las columnas U:AF', () => {
    pla.rows.forEach(r => { for (let c = 20; c < 32; c++) assert.ok(r[c] === '' || r[c] === undefined, 'col ' + (c + 1)); });
  });
  t('repetirla no rompe nada', () => { g.quitarHuertaSheet(); assert.equal(pla.rows.length, 3); });
}

console.log('autenticación de Firestore');
{
  const llamadas = [];
  const g = cargar({ Especies: hoja(espBase(), 13), Plantas: hoja(plaBase()), 'Registro Plantas': hoja(regBase()) }, llamadas);
  g.altaPlantasInterior2();
  t('las llamadas a Firestore llevan el token OAuth del script', () => {
    const fs_ = llamadas.filter(l => l.url.includes('firestore.googleapis.com'));
    assert.ok(fs_.length > 0);
    fs_.forEach(l => assert.equal(l.o.headers.Authorization, 'Bearer TOKEN-STUB'));
  });
  const sinAuth = (nombre, texto) => t(nombre + ': ningún fetch a Firestore sin fsFetch_', () => {
    const ls = texto.split(/\r?\n/);
    ls.forEach((l, i) => {
      if (!l.includes('UrlFetchApp.fetch(')) return;
      const ventana = ls.slice(Math.max(0, i - 6), i + 1).join(' ');
      assert.ok(!ventana.includes('firestore.googleapis.com') || l.includes('function fsFetch_') || ventana.includes('return UrlFetchApp'), 'línea ' + (i + 1));
    });
  });
  sinAuth('codigo.gs', src);
  for (const n of ['appscript_backfill_clima.txt', 'appscript_backfill_revolcadas_sistemas.txt'])
    sinAuth(n, fs.readFileSync(fileURLToPath(new URL('../' + n, import.meta.url)), 'utf8'));
}

console.log('doPost: "Cargado por"');
{
  const post = (g, tipo, data, usuario) => g.doPost({ postData: { contents: JSON.stringify({ tipo, data, usuario }) } });
  const g0 = (hojas) => cargar(hojas);
  t('revolcada: el correo queda en la col. 6 y el encabezado se escribe', () => {
    const rev = hoja([['Sistema', 'Fecha', 'Días', 'En tiempo', 'Obs']]);
    post(g0({ 'Registro Revolcadas': rev }), 'revolcada', { sistema: 1, fecha: '2026-10-21', obs: '' }, 'a@b.c');
    assert.equal(rev.rows[1][5], 'a@b.c');
    assert.equal(rev.rows[0][5], 'Cargado por');
  });
  t('revolcada sin usuario no rompe y deja la celda vacía', () => {
    const rev = hoja([['Sistema', 'Fecha']]);
    post(g0({ 'Registro Revolcadas': rev }), 'revolcada', { sistema: 1, fecha: '2026-10-21' });
    assert.equal(rev.rows[1][0], 1);
    assert.ok(!rev.rows[1][5]);
  });
  t('evento de planta: col. 11', () => {
    const pla = hoja(plaBase()), reg = hoja([['ID', 'Planta']]);
    post(g0({ Plantas: pla, 'Registro Plantas': reg }), 'plantaEvento', { planta: 7, fecha: '2026-10-21', tipo: 'Riego' }, 'a@b.c');
    assert.equal(reg.rows[1][10], 'a@b.c');
  });
  t('ficha de planta: col. 21 ("Editado por")', () => {
    const pla = hoja(plaBase());
    post(g0({ Plantas: pla }), 'planta', { id: 7, nombre: 'Helecho' }, 'a@b.c');
    assert.equal(pla.rows[1][20], 'a@b.c');
  });
  t('evento de pecera: col. 5', () => {
    const pe = hoja([['Fecha', 'Tipo']]);
    post(g0({ 'Registro Pecera': pe }), 'peceraEvento', { fecha: '2026-10-21', tipo: 'Cambio' }, 'a@b.c');
    assert.equal(pe.rows[1][4], 'a@b.c');
  });
}

console.log(ok + ' pruebas ok' + (process.exitCode ? ' (hay fallas)' : ''));
