// Prueba las tareas de hoy, las urgencias y el estado de la pecera. Correr: node scripts/test-tareas.mjs
import assert from 'node:assert/strict';
import { estadoPecera, armarTareas, armarUrgentes, CFG_PEC } from '../public/public/tareas.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};

const dia = (y, m, d) => new Date(y, m - 1, d);
const HOY = dia(2026, 11, 2);

console.log('pecera');
t('en los primeros 30 días está en ciclado y cambia el agua cada 3 días', () => {
  const e = estadoPecera({ fechaArmado: '2026-10-20' }, [], HOY);
  assert.equal(e.diasArmado, 13);
  assert.equal(e.enCiclado, true);
  assert.equal(e.limiteCambio, CFG_PEC.diasCambioAguaCiclado);
  assert.equal(e.cambioUrg, true);
});
t('pasado el ciclado, el cambio es cada 7 días y cuenta desde el último', () => {
  const reg = [{ fecha: '2026-10-30', tipo: '💧 Cambio de agua parcial' }];
  const e = estadoPecera({ fechaArmado: '2026-09-15' }, reg, HOY);
  assert.equal(e.enCiclado, false);
  assert.equal(e.limiteCambio, 7);
  assert.equal(e.diasSinCambio, 3);
  assert.equal(e.cambioUrg, false);
});
t('no se limpia el filtro antes de los 25 días de armada', () => {
  assert.equal(estadoPecera({ fechaArmado: '2026-10-20' }, [], HOY).puedeLimpiar, false);
  assert.equal(estadoPecera({ fechaArmado: '2026-10-20' }, [], HOY).limpiezaUrg, false);
});
t('limpieza urgente a los 14 días de la última', () => {
  const reg = [{ fecha: '2026-10-18', tipo: '🧽 Limpieza de filtro' }];
  const e = estadoPecera({ fechaArmado: '2026-09-01' }, reg, HOY);
  assert.equal(e.diasSinLimpieza, 15);
  assert.equal(e.limpiezaUrg, true);
});
t('sin datos de la pecera no rompe', () => {
  const e = estadoPecera(null, [], HOY);
  assert.equal(e.diasArmado, null);
  assert.equal(e.cambioUrg, false);
});

console.log('tareas de hoy');
const sLbl = s => s.nombre ? `#${s.id} — ${s.nombre}` : `Sistema ${s.id}`;
const pLbl = p => p.nombre || `Planta ${p.id}`;
const peceraOk = { cambioUrg: false, diasSinCambio: 1, limiteCambio: 7, limpiezaUrg: false };
const base = (extra = {}) => ({
  hoy: HOY, sistemas: [], plantas: [], proxRev: () => null, estPlanta: () => ({}),
  preventivos: [], pecera: peceraOk, sLbl, pLbl, nombreGrupo: g => ({ citrico: 'Cítricos' }[g] || g), ...extra,
});
t('sistema: hoy si toca o está atrasado, "próximo" hasta 3 días antes', () => {
  const s = [{ id: 1, nombre: 'A' }, { id: 2 }, { id: 3 }, { id: 4 }];
  const prox = { 1: dia(2026, 10, 30), 2: dia(2026, 11, 2), 3: dia(2026, 11, 4), 4: dia(2026, 11, 20) };
  const r = armarTareas(base({ sistemas: s, proxRev: x => prox[x.id] }));
  assert.deepEqual(r.hoy.map(x => x.id), ['revolcada-1', 'revolcada-2']);
  assert.equal(r.hoy[0].detalle, 'atrasado 3 d');
  assert.equal(r.hoy[1].detalle, 'toca hoy');
  assert.deepEqual(r.prox.map(x => x.id), ['revolcada-3']);
  assert.equal(r.hoy[0].titulo, '#1 — A · revolver');
});
t('planta: riego urgente y próximo, con el límite en el detalle', () => {
  const plantas = [{ id: 1, nombre: 'Limonero' }, { id: 2, nombre: 'Durazno' }];
  const est = { 1: { riegoUrg: true, diasSinAgua: 9, limite: 7 }, 2: { riegoProx: true, diasSinAgua: 6 } };
  const r = armarTareas(base({ plantas, estPlanta: p => est[p.id] }));
  assert.equal(r.hoy[0].detalle, '9 días sin agua (límite 7)');
  assert.equal(r.hoy[0].atraso, 2);
  assert.equal(r.hoy[0].modo, 'uno');
  assert.equal(r.prox[0].id, 'riego-2');
});
t('planta: fertilizar y plagas respetan la temporada y los 3 días de aviso', () => {
  const plantas = [{ id: 1, nombre: 'A' }, { id: 2, nombre: 'B' }, { id: 3, nombre: 'C' }];
  const est = {
    1: { diasParaFert: -4, fertEnTemporada: true, diasParaPlagas: 2 },
    2: { diasParaFert: -4, fertEnTemporada: false, diasParaPlagas: 0 },
    3: { diasParaFert: null, fertEnTemporada: true, diasParaPlagas: 5 },
  };
  const r = armarTareas(base({ plantas, estPlanta: p => est[p.id] }));
  assert.deepEqual(r.hoy.map(x => x.id).sort(), ['fert-1', 'plagas-2']);
  assert.equal(r.hoy.find(x => x.id === 'fert-1').detalle, '4 días de atraso');
  assert.equal(r.hoy.find(x => x.id === 'plagas-2').detalle, 'toca hoy');
  assert.deepEqual(r.prox.map(x => x.id), ['plagas-1']);
});
t('poda: solo aparece como próxima, de 0 a 30 días antes', () => {
  const plantas = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const dias = { 1: 0, 2: 30, 3: 31, 4: -1 };
  const r = armarTareas(base({ plantas, estPlanta: p => ({ diasParaPoda: dias[p.id] }) }));
  assert.deepEqual(r.hoy, []);
  assert.deepEqual(r.prox.map(x => x.id), ['poda-1', 'poda-2']);
  assert.equal(r.prox[0].detalle, 'toca hoy');
});
t('preventivos: "hoy" va a hoy, "prox" a próximas, el resto se ignora', () => {
  const tr = { id: 'cobre', nombre: 'Cobre', producto: 'Oxicloruro' };
  const prev = [
    { g: 'citrico', tr, estado: 'hoy', detalle: 'toca hoy', dias: 0 },
    { g: 'citrico', tr: { ...tr, id: 'x' }, estado: 'prox', detalle: 'en 2 d', dias: 2 },
    { g: 'citrico', tr: { ...tr, id: 'y' }, estado: 'ok', detalle: '', dias: 20 },
  ];
  const r = armarTareas(base({ preventivos: prev }));
  assert.equal(r.hoy.length, 1);
  assert.equal(r.hoy[0].titulo, '🛡️ Cobre · cítricos');
  assert.equal(r.hoy[0].ref, 'citrico|cobre');
  assert.equal(r.prox.length, 1);
});
t('pecera: cambio de agua urgente o próximo y limpieza de filtro', () => {
  const urg = armarTareas(base({ pecera: { cambioUrg: true, diasSinCambio: 9, limiteCambio: 7, limpiezaUrg: true, diasSinLimpieza: 16 } }));
  assert.deepEqual(urg.hoy.map(x => x.id), ['pec-cambio-agua', 'pec-filtro']);
  assert.equal(urg.hoy[1].atraso, 2);
  const prox = armarTareas(base({ pecera: { cambioUrg: false, diasSinCambio: 5, limiteCambio: 7, limpiezaUrg: false } }));
  assert.deepEqual(prox.prox.map(x => x.id), ['pec-cambio-agua']);
  assert.equal(prox.prox[0].detalle, 'en 2 d');
  const lejos = armarTareas(base({ pecera: { cambioUrg: false, diasSinCambio: 1, limiteCambio: 7, limpiezaUrg: false } }));
  assert.deepEqual(lejos.prox, []);
});

console.log('urgentes');
const u = (clima, extra = {}) => armarUrgentes({ clima, plantas: [], sistemas: [], faseSistema: () => 'v', sLbl, pLbl, ...extra });
const limonero = { id: 1, nombre: 'Limonero', especie: 'Cítrico' };
const monstera = { id: 2, nombre: 'Monstera', especie: 'Monstera' };
t('helada: avisa si hay plantas de exterior y la mínima es 2 °C o menos', () => {
  const r = u([{ fecha: '2026-11-01', tmin: 1 }], { plantas: [limonero] });
  assert.equal(r.length, 1);
  assert.match(r[0].t, /Helada/);
  assert.equal(r[0].c, 'al-w');
  assert.equal(u([{ fecha: '2026-11-01', tmin: -3 }], { plantas: [limonero] })[0].c, 'al-r');
  assert.equal(u([{ fecha: '2026-11-01', tmin: 5 }], { plantas: [limonero] }).length, 0);
});
t('sin plantas de exterior no hay aviso de helada', () => {
  assert.equal(u([{ fecha: '2026-11-01', tmin: -3 }], { plantas: [monstera] }).filter(x => /Helada/.test(x.t)).length, 0);
});
t('frío: avisa de las de interior cuando la mínima llega a su tolerancia + 2', () => {
  const r = u([{ fecha: '2026-11-01', tmin: 14 }], { plantas: [monstera, limonero] });
  assert.equal(r.length, 1);
  assert.match(r[0].t, /Frío/);
  assert.equal(r[0].b, 'Monstera');
  assert.equal(u([{ fecha: '2026-11-01', tmin: 15 }], { plantas: [monstera] }).length, 0);
});
t('calor extremo desde 38 °C y se usa el día más reciente', () => {
  const r = u([{ fecha: '2026-10-01', tmax: 20 }, { fecha: '2026-11-01', tmax: 38 }]);
  assert.equal(r.length, 1);
  assert.match(r[0].t, /Calor extremo/);
  assert.equal(u([{ fecha: '2026-10-01', tmax: 40 }, { fecha: '2026-11-01', tmax: 30 }]).length, 0);
});
t('un sistema en fase "listo" avisa que se puede cosechar', () => {
  const r = u([], { sistemas: [{ id: 1, nombre: 'A' }, { id: 2 }], faseSistema: s => s.id === 1 ? 'l' : 'c' });
  assert.equal(r.length, 1);
  assert.equal(r[0].t, '🎉 #1 — A — listo para cosechar');
});
t('sin clima ni sistemas no devuelve nada', () => { assert.deepEqual(u([]), []); });

console.log(ok + ' pruebas ok' + (process.exitCode ? ' (hay fallas)' : ''));
