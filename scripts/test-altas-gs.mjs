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

// Tokens de prueba → lo que devolvería accounts:lookup de Firebase.
const OK = 'jonahlalvarez@gmail.com';
const TOKENS = {
  'tok-ok': { email: OK, emailVerified: true },
  'tok-sin-verificar': { email: OK, emailVerified: false },
  'tok-ajeno': { email: 'otro@x.com', emailVerified: true },
};
// Firestore de prueba: documentos por colección (en páginas) y un Drive con carpeta y archivos.
let FS_PAGINAS = {}, FS_ERROR = null, TRIGGERS = [];
const campo = x => typeof x === 'string' ? { stringValue: x } : Number.isInteger(x) ? { integerValue: String(x) } : typeof x === 'number' ? { doubleValue: x }
  : typeof x === 'boolean' ? { booleanValue: x } : x === null ? { nullValue: null } : Array.isArray(x) ? { arrayValue: { values: x.map(campo) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, campo(v)])) } };
const doc = (col, id, o) => ({ name: 'projects/p/databases/(default)/documents/' + col + '/' + id, fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, campo(v)])) });
const nuevoDrive = (archivosIniciales = []) => {
  const carpetas = {};
  const crearArchivo = (nombre, contenido) => { const f = { nombre, contenido, papelera: false, getName: () => nombre, setTrashed(v) { f.papelera = v; } }; return f; };
  const carpeta = { archivos: archivosIniciales.map(n => crearArchivo(n, '{}')),
    getFiles() { const a = carpeta.archivos.filter(f => !f.papelera); let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; },
    getFilesByName(n) { const a = carpeta.archivos.filter(f => !f.papelera && f.nombre === n); let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; },
    createFile(n, c, tipo) { const f = crearArchivo(n, c); f.tipo = tipo; carpeta.archivos.push(f); return f; } };
  return { carpeta, creadas: [], getFoldersByName: n => { const hay = carpetas[n]; return { hasNext: () => !!hay, next: () => hay }; },
    createFolder(n) { carpetas[n] = carpeta; this.creadas.push(n); return carpeta; } };
};
let DRIVE = nuevoDrive();
const cargar = (hojas, llamadas = []) => {
  const ctx = {
    Logger: { log() {} },
    Utilities: {
      formatDate: d => new Date(d).toISOString().slice(0, 10),
      computeDigest: (_, s) => Array.from(Buffer.from(String(s))), DigestAlgorithm: { SHA_256: 'sha256' },
      base64EncodeWebSafe: b => Buffer.from(b).toString('base64'),
    },
    CalendarApp: { EventColor: new Proxy({}, { get: (_, k) => String(k) }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => hojas[n] || null }) },
    CacheService: { getScriptCache: () => { const m = {}; return { get: k => m[k] || null, put: (k, v) => { m[k] = v; } }; } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: txt => ({ txt, setMimeType() { return this; } }) },
    UrlFetchApp: { fetch: (url, o) => {
      llamadas.push({ url, o });
      if (url.includes('identitytoolkit')) {
        const u = TOKENS[JSON.parse(o.payload).idToken];
        return u ? { getResponseCode: () => 200, getContentText: () => JSON.stringify({ users: [u] }) }
                 : { getResponseCode: () => 400, getContentText: () => '{}' };
      }
      const lista = url.match(/documents\/([A-Za-z]+)\?pageSize/);
      if (lista) {
        const paginas = FS_PAGINAS[lista[1]] || [[]];
        const token = (url.match(/pageToken=([0-9]+)/) || [])[1];
        const i = token ? +token : 0;
        return { getResponseCode: () => FS_ERROR === lista[1] ? 500 : 200,
          getContentText: () => JSON.stringify({ documents: paginas[i], nextPageToken: i + 1 < paginas.length ? String(i + 1) : undefined }) };
      }
      return { getResponseCode: () => 200, getContentText: () => '' };
    } },
    DriveApp: DRIVE,
    ScriptApp: { getOAuthToken: () => 'TOKEN-STUB', getProjectTriggers: () => TRIGGERS, newTrigger: fn => { const t = { fn, getHandlerFunction: () => fn };
      const b = { timeBased: () => b, atHour: () => b, nearMinute: () => b, everyDays: () => b, inTimezone: () => b, create: () => { TRIGGERS.push(t); return t; } }; return b; } },
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

console.log('respaldo en Drive');
{
  const lista = ['sistemas', 'revolcadas', 'plantas', 'registroPlantas', 'pecera', 'registroPecera', 'clima', 'historial'];
  const preparar = (archivos = []) => {
    DRIVE = nuevoDrive(archivos); TRIGGERS = []; FS_ERROR = null;
    FS_PAGINAS = { plantas: [[doc('plantas', '1', { id: 1, nombre: 'Limonero', _by: { uid: 'u1', email: 'a@b.c' }, dias: [1, 2.5], ok: true, nada: null })], [doc('plantas', '2', { id: 2, nombre: 'Durazno' })]],
      pecera: [[doc('pecera', 'main', { litros: 42 })]] };
    return cargar({});
  };
  t('lee todas las colecciones, incluidas las páginas siguientes', () => {
    const g = preparar(); g.respaldarFirestoreEnDrive();
    const f = DRIVE.carpeta.archivos[0], r = JSON.parse(f.contenido);
    assert.deepEqual(Object.keys(r.datos), lista);
    assert.deepEqual(r.datos.plantas.map(p => p._docId), ['1', '2']);
    assert.equal(r.datos.pecera[0].litros, 42);
    assert.deepEqual(r.datos.sistemas, []);
    assert.equal(r.origen, 'firestore');
  });
  t('convierte los valores de Firestore (números, listas, mapas, nulos)', () => {
    const g = preparar(); g.respaldarFirestoreEnDrive();
    const p = JSON.parse(DRIVE.carpeta.archivos[0].contenido).datos.plantas[0];
    assert.equal(p.id, 1); assert.deepEqual(p.dias, [1, 2.5]); assert.equal(p.ok, true); assert.equal(p.nada, null);
    assert.deepEqual(p._by, { uid: 'u1', email: 'a@b.c' });
  });
  t('crea la carpeta una vez y guarda un archivo por día con la fecha en el nombre', () => {
    const g = preparar(); g.respaldarFirestoreEnDrive(); g.respaldarFirestoreEnDrive();
    assert.deepEqual(DRIVE.creadas, ['Brote respaldos']);
    const vivos = DRIVE.carpeta.archivos.filter(f => !f.papelera);
    assert.equal(vivos.length, 1);
    assert.match(vivos[0].nombre, /^brote-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(vivos[0].tipo, 'application/json');
  });
  t('conserva solo los últimos 30 y manda los más viejos a la papelera', () => {
    const viejos = Array.from({ length: 35 }, (_, i) => 'brote-respaldo-2026-09-' + String(i + 1).padStart(2, '0') + '.json').map(n => n.replace('-09-3', '-10-0').replace('-09-4', '-10-1'));
    const g = preparar([...new Set(viejos)]);
    g.respaldarFirestoreEnDrive();
    const vivos = DRIVE.carpeta.archivos.filter(f => !f.papelera);
    assert.equal(vivos.length, 30);
    assert.ok(vivos.some(f => f.nombre.startsWith('brote-respaldo-2026-11') || f.nombre.indexOf(new Date().getFullYear()) > 0), 'el de hoy se conserva');
    const papelera = DRIVE.carpeta.archivos.filter(f => f.papelera).map(f => f.nombre).sort();
    assert.ok(papelera.length >= 5);
    assert.ok(papelera.every(n => vivos.every(v => v.nombre > n)), 'se borran los más viejos');
  });
  t('no toca otros archivos de la carpeta', () => {
    const g = preparar(['notas.txt']); g.respaldarFirestoreEnDrive();
    assert.equal(DRIVE.carpeta.archivos.find(f => f.nombre === 'notas.txt').papelera, false);
  });
  t('si Firestore falla corta con un error y no guarda un respaldo a medias', () => {
    const g = preparar(); FS_ERROR = 'revolcadas';
    assert.throws(() => g.respaldarFirestoreEnDrive(), /revolcadas: 500/);
    assert.equal(DRIVE.carpeta.archivos.length, 0);
  });
  t('las lecturas llevan el token OAuth del script', () => {
    const llamadas = []; DRIVE = nuevoDrive(); TRIGGERS = []; FS_ERROR = null; FS_PAGINAS = {};
    cargar({}, llamadas).respaldarFirestoreEnDrive();
    const fsl = llamadas.filter(l => l.url.includes('firestore.googleapis.com'));
    assert.equal(fsl.length, lista.length);
    fsl.forEach(l => assert.equal(l.o.headers.Authorization, 'Bearer TOKEN-STUB'));
  });
  t('el trigger nocturno se agrega una sola vez', () => {
    const g = preparar(); g.agregarTriggerRespaldo(); g.agregarTriggerRespaldo();
    assert.equal(TRIGGERS.length, 1);
    assert.equal(TRIGGERS[0].fn, 'respaldarFirestoreEnDrive');
  });
}

console.log('autenticación de Firestore');
{
  const llamadas = [];
  const g = cargar({ Especies: hoja(espBase(), 13), Plantas: hoja(plaBase()), 'Registro Plantas': hoja(regBase()) }, llamadas);
  g.sincronizarPlantasAFirestore();
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
  const post = (g, tipo, data, idToken) => g.doPost({ postData: { contents: JSON.stringify({ tipo, data, idToken }) } });
  const g0 = (hojas) => cargar(hojas);
  t('revolcada: el correo queda en la col. 6 y el encabezado se escribe', () => {
    const rev = hoja([['Sistema', 'Fecha', 'Días', 'En tiempo', 'Obs']]);
    post(g0({ 'Registro Revolcadas': rev }), 'revolcada', { sistema: 1, fecha: '2026-10-21', obs: '' }, 'tok-ok');
    assert.equal(rev.rows[1][5], OK);
    assert.equal(rev.rows[0][5], 'Cargado por');
  });
  const rechaza = (nombre, idToken) => t('rechaza: ' + nombre, () => {
    const rev = hoja([['Sistema', 'Fecha']]);
    const out = post(g0({ 'Registro Revolcadas': rev }), 'revolcada', { sistema: 1, fecha: '2026-10-21' }, idToken);
    assert.equal(JSON.parse(out.txt).ok, false);
    assert.equal(rev.rows.length, 1, 'no debe escribir nada');
  });
  rechaza('sin token', undefined);
  rechaza('token inválido', 'tok-falso');
  rechaza('cuenta no autorizada', 'tok-ajeno');
  rechaza('correo sin verificar', 'tok-sin-verificar');
  t('el correo de la Sheet sale del token, no de lo que diga el cliente', () => {
    const rev = hoja([['Sistema', 'Fecha']]);
    g0({ 'Registro Revolcadas': rev }).doPost({ postData: { contents: JSON.stringify({ tipo: 'revolcada', data: { sistema: 1, fecha: '2026-10-21' }, idToken: 'tok-ok', usuario: 'falso@x.com' }) } });
    assert.equal(rev.rows[1][5], OK);
  });
  t('evento de planta: col. 11', () => {
    const pla = hoja(plaBase()), reg = hoja([['ID', 'Planta']]);
    post(g0({ Plantas: pla, 'Registro Plantas': reg }), 'plantaEvento', { planta: 7, fecha: '2026-10-21', tipo: 'Riego' }, 'tok-ok');
    assert.equal(reg.rows[1][10], OK);
  });
  t('ficha de planta: col. 21 ("Editado por")', () => {
    const pla = hoja(plaBase());
    post(g0({ Plantas: pla }), 'planta', { id: 7, nombre: 'Helecho' }, 'tok-ok');
    assert.equal(pla.rows[1][20], OK);
  });
  t('evento de pecera: col. 5', () => {
    const pe = hoja([['Fecha', 'Tipo']]);
    post(g0({ 'Registro Pecera': pe }), 'peceraEvento', { fecha: '2026-10-21', tipo: 'Cambio' }, 'tok-ok');
    assert.equal(pe.rows[1][4], OK);
  });
}

console.log(ok + ' pruebas ok' + (process.exitCode ? ' (hay fallas)' : ''));
