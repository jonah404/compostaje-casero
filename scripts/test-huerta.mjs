// Pruebas del módulo de la huerta. Correr: node scripts/test-huerta.mjs
import assert from 'node:assert/strict';
import * as H from '../public/public/huerta-catalogo.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};
const d = (y, m, dd) => new Date(y, m - 1, dd);   // medianoche local

console.log('faseCultivo');
const tomate = { categoria:'huerta', ciclo:'anual', fechaP:'2026-09-01', diasATrasplante:40, diasACosecha:100 };
t('semillero el día 0', () => assert.equal(H.faseCultivo(tomate, d(2026, 9, 1)), 'semillero'));
t('semillero el día 39', () => assert.equal(H.faseCultivo(tomate, d(2026, 10, 10)), 'semillero'));
t('por-trasplantar el día exacto (40)', () => assert.equal(H.faseCultivo(tomate, d(2026, 10, 11)), 'por-trasplantar'));
t('crecimiento con trasplante cargado', () => assert.equal(H.faseCultivo({ ...tomate, fechaTrasplante:'2026-10-11' }, d(2026, 10, 11)), 'crecimiento'));
t('crecimiento el día 92', () => assert.equal(H.faseCultivo({ ...tomate, fechaTrasplante:'2026-10-11' }, d(2026, 12, 2)), 'crecimiento'));
t('cosecha-proxima el día 93 (7 antes)', () => assert.equal(H.faseCultivo({ ...tomate, fechaTrasplante:'2026-10-11' }, d(2026, 12, 3)), 'cosecha-proxima'));
t('cosecha-proxima el día 99', () => assert.equal(H.faseCultivo({ ...tomate, fechaTrasplante:'2026-10-11' }, d(2026, 12, 9)), 'cosecha-proxima'));
t('cosecha el día 100', () => assert.equal(H.faseCultivo({ ...tomate, fechaTrasplante:'2026-10-11' }, d(2026, 12, 10)), 'cosecha'));
t('por-trasplantar tiene prioridad sobre la cosecha', () => assert.equal(H.faseCultivo(tomate, d(2026, 12, 20)), 'por-trasplantar'));
const zanahoria = { categoria:'huerta', ciclo:'anual', fechaP:'2026-03-01', diasATrasplante:null, diasACosecha:100 };
t('siembra directa: cosecha-proxima el día 99', () => assert.equal(H.faseCultivo(zanahoria, d(2026, 6, 8)), 'cosecha-proxima'));
t('siembra directa: cosecha el día 100', () => assert.equal(H.faseCultivo(zanahoria, d(2026, 6, 9)), 'cosecha'));
t('perenne siempre en crecimiento', () => assert.equal(H.faseCultivo({ ciclo:'perenne', fechaP:'2020-01-01', diasACosecha:null }, d(2026, 9, 30)), 'crecimiento'));
t('cosechado y terminado → cerrado', () => {
  assert.equal(H.faseCultivo({ ...zanahoria, estadoCultivo:'cosechado' }, d(2026, 6, 9)), 'cerrado');
  assert.equal(H.faseCultivo({ ...zanahoria, estadoCultivo:'terminado' }, d(2026, 6, 9)), 'cerrado');
});
t('valores numéricos como texto (Firestore/Sheet)', () => assert.equal(H.faseCultivo({ ciclo:'anual', fechaP:'2026-03-01', diasATrasplante:'', diasACosecha:'100' }, d(2026, 6, 9)), 'cosecha'));
t('sin fecha de siembra → crecimiento', () => assert.equal(H.faseCultivo({ ciclo:'anual', diasACosecha:60 }, d(2026, 6, 9)), 'crecimiento'));

console.log('días, progreso y fecha de cosecha');
t('diaDeCultivo', () => assert.equal(H.diaDeCultivo(zanahoria, d(2026, 3, 11)), 10));
t('progreso 50%', () => assert.equal(H.progresoCosecha(zanahoria, d(2026, 4, 20)), 0.5));
t('progreso se topa en 1', () => assert.equal(H.progresoCosecha(zanahoria, d(2026, 12, 1)), 1));
t('progreso null en perennes', () => assert.equal(H.progresoCosecha({ ciclo:'perenne', fechaP:'2026-01-01', diasACosecha:null }, d(2026, 6, 1)), null));
t('diasParaCosecha', () => assert.equal(H.diasParaCosecha(zanahoria, d(2026, 6, 4)), 5));
t('fechaCosechaEstimada', () => assert.equal(H.fechaCosechaEstimada(tomate).getTime(), d(2026, 12, 10).getTime()));
t('fechaCosechaEstimada null sin días', () => assert.equal(H.fechaCosechaEstimada({ fechaP:'2026-01-01' }), null));

console.log('perfilDeCultivo y utilidades');
t('perfil desde la foto', () => assert.deepEqual(H.perfilDeCultivo({ riegoVerano:'2', riegoInvierno:4, diasFert:20, diasPlagas:7 }),
  { tipo:'Exterior', riegoVerano:2, riegoInvierno:4, diasFert:20, diasPlagas:7, fertMesIni:null, fertMesFin:null, tempMin:null, podaDias:null }));
t('perfil con defaults si faltan datos', () => assert.deepEqual(H.perfilDeCultivo({}),
  { tipo:'Exterior', riegoVerano:3, riegoInvierno:5, diasFert:30, diasPlagas:7, fertMesIni:null, fertMesFin:null, tempMin:null, podaDias:null }));
t('numero()', () => { assert.equal(H.numero(''), null); assert.equal(H.numero(null), null); assert.equal(H.numero('12'), 12); assert.equal(H.numero('x'), null); assert.equal(H.numero(0), 0); });
t('estaCerrado()', () => { assert.equal(H.estaCerrado({ estadoCultivo:'cosechado' }), true); assert.equal(H.estaCerrado({ estadoCultivo:'activo' }), false); assert.equal(H.estaCerrado({}), false); });
t('funciones de catálogo con clave desconocida', () => {
  assert.equal(H.perfilDeCatalogo('nada'), null);
  assert.equal(H.fichaDeCatalogo('manual'), null);
  assert.equal(H.enEpocaDeSiembra('nada', 5), true);
});

console.log('catálogo');
const CLAVES = ['acelga','albahaca','berenjena','brocoli','cebolla-verdeo','choclo','cilantro','espinaca','frutilla','lechuga','menta','morron','oregano','pepino','perejil','remolacha','repollo','romero','rucula','tomate','tomillo','zanahoria','zapallito','zapallo'];
const GRUPOS = ['Hojas y crucíferas', 'Frutos', 'Raíces y bulbos', 'Aromáticas y perennes'];
const NIVELES = ['🟢', '🟠', '🔴', '🔴🔴'];
t('exactamente las 24 claves, sin duplicados', () => {
  assert.deepEqual(H.CATALOGO_HUERTA.map(c => c.clave).sort(), CLAVES);
  assert.equal(new Set(H.CATALOGO_HUERTA.map(c => c.clave)).size, 24);
});
H.CATALOGO_HUERTA.forEach(c => {
  t(`esquema de ${c.clave}`, () => {
    assert.ok(c.nombre && typeof c.nombre === 'string', 'nombre');
    assert.ok(GRUPOS.includes(c.grupo), 'grupo válido: ' + c.grupo);
    assert.ok(['anual', 'perenne'].includes(c.ciclo), 'ciclo');
    ['riegoVerano', 'riegoInvierno', 'diasFert', 'diasPlagas'].forEach(k => assert.ok(Number.isFinite(c[k]) && c[k] > 0, k + ' numérico y positivo'));
    assert.ok(c.riegoVerano <= c.riegoInvierno, 'riegoVerano <= riegoInvierno');
    assert.ok(Array.isArray(c.mesesSiembra) && c.mesesSiembra.length > 0 && c.mesesSiembra.every(m => Number.isInteger(m) && m >= 1 && m <= 12), 'mesesSiembra');
    if (c.ciclo === 'anual') {
      assert.ok(Number.isFinite(c.diasACosecha) && c.diasACosecha > 0, 'anual con diasACosecha');
      if (c.diasATrasplante != null) assert.ok(c.diasACosecha > c.diasATrasplante, 'diasACosecha > diasATrasplante');
    } else {
      assert.equal(c.diasACosecha, null, 'perenne sin diasACosecha');
    }
    const f = c.ficha;
    assert.ok(f && f.monitoreo && f.momentoCritico, 'ficha con monitoreo y momentoCritico');
    assert.ok(Array.isArray(f.problemas) && f.problemas.length >= 2, 'al menos 2 problemas');
    f.problemas.forEach(p => ['nombre', 'sintoma', 'producto', 'dosis'].forEach(k => assert.ok(p[k] && typeof p[k] === 'string', 'problema.' + k)));
    for (let m = 1; m <= 12; m++) assert.ok(NIVELES.includes(f.calendarioVigilancia[m]), `vigilancia mes ${m}`);
  });
});
t('cuatro grupos con la cantidad esperada', () => {
  const n = g => H.CATALOGO_HUERTA.filter(c => c.grupo === g).length;
  assert.deepEqual([n(GRUPOS[0]), n(GRUPOS[1]), n(GRUPOS[2]), n(GRUPOS[3])], [6, 7, 3, 8]);
});
t('perfilDeCatalogo copia lo necesario', () => {
  const p = H.perfilDeCatalogo('tomate');
  assert.equal(p.clave, 'tomate'); assert.equal(p.ciclo, 'anual');
  assert.ok(p.diasATrasplante > 0 && p.diasACosecha > p.diasATrasplante);
  assert.ok(Array.isArray(p.mesesSiembra));
  p.mesesSiembra.push(99);   // es una copia
  assert.ok(!H.buscarCultivo('tomate').mesesSiembra.includes(99));
});
t('enEpocaDeSiembra', () => { assert.equal(H.enEpocaDeSiembra('tomate', 9), true); assert.equal(H.enEpocaDeSiembra('tomate', 5), false); });
t('fichaDeCatalogo devuelve la ficha', () => assert.ok(H.fichaDeCatalogo('lechuga').problemas.length >= 2));

console.log(`\n${ok} pruebas OK` + (process.exitCode ? ' — HAY FALLAS' : ''));
