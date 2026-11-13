// Prueba el estado de las plantas (riego, fertilización, plagas, poda). Correr: node scripts/test-plantas.mjs
import assert from 'node:assert/strict';
import { estadoPlanta, aguaEfectiva, perfilEspecie, esInterior, mesEnTemporada } from '../public/public/plantas.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};

const dia = (y, m, d) => new Date(y, m - 1, d);
const ctx = (hoy, extra = {}) => ({ hoy, clima: [], registro: [], diasPlagas: () => null, ...extra });
const limonero = { id: 2, nombre: 'Limonero 4 Estaciones', especie: 'Cítrico', fechaP: '2026-08-04' };
const monstera = { id: 9, nombre: 'Monstera', especie: 'Monstera', fechaP: '2026-01-10' };
const elefante = { id: 10, nombre: 'Pata de elefante', especie: 'Pata de elefante', fechaP: '2026-01-10' };

console.log('perfiles');
t('el helecho específico gana al genérico', () => {
  assert.equal(perfilEspecie('Helecho Hawaii').riegoVerano, 4);
  assert.equal(perfilEspecie('Helecho nido de ave').riegoVerano, 3);
  assert.equal(perfilEspecie('Limonero'), null);
  assert.equal(perfilEspecie(''), null);
});
t('interior = tiene perfil de interior; los frutales no', () => {
  assert.equal(esInterior(monstera), true);
  assert.equal(esInterior(limonero), false);
});
t('si la especie escrita a mano no matchea, se reconoce por el nombre (potus)', () => {
  const potus = { id: 12, nombre: 'Potus', especie: 'Epipremnum aureum', fechaP: '2026-01-10' };
  assert.equal(esInterior(potus), true);
  const e = estadoPlanta(potus, ctx(dia(2026, 11, 11)));
  assert.equal(e.interior, true);
  assert.equal(e.riegoUrg, false);
  assert.equal(e.riegoProx, false);
  assert.equal(e.fertUrg, false);
  assert.equal(e.plagasUrg, false);
  assert.equal(e.diasParaFert, null);
  assert.equal(e.diasParaPlagas, null);
});
t('interior: sin fertilizar ni plagas aunque estén vencidos; exterior sí', () => {
  const vencido = { ultimaFert: '2026-01-01', proximaFert: '2026-02-01', ultimaPlagas: '2026-01-01', proximaPlagas: '2026-02-01' };
  const m = estadoPlanta({ ...monstera, ...vencido }, ctx(dia(2026, 11, 11)));
  assert.equal(m.fertUrg, false); assert.equal(m.plagasUrg, false);
  const l = estadoPlanta({ ...limonero, ...vencido }, ctx(dia(2026, 11, 11)));
  assert.equal(l.fertUrg, true); assert.equal(l.plagasUrg, true);
});
t('temporada de fertilización que cruza fin de año (sep a abr)', () => {
  assert.equal(mesEnTemporada(11, 9, 4), true);
  assert.equal(mesEnTemporada(2, 9, 4), true);
  assert.equal(mesEnTemporada(6, 9, 4), false);
  assert.equal(mesEnTemporada(6, null, null), true);
});

console.log('riego');
t('frutal sin riego registrado cuenta desde la plantación', () => {
  const e = estadoPlanta(limonero, ctx(dia(2026, 11, 2)));
  assert.equal(e.agua.tipo, 'riego');
  assert.equal(e.diasSinAgua, 90);
  assert.equal(e.riegoUrg, true);
});
t('el límite es 7 días en verano y 14 en invierno', () => {
  const reg = [{ planta: 2, fecha: '2026-10-28', tipo: '💧 Riego' }];
  assert.equal(estadoPlanta(limonero, ctx(dia(2026, 11, 2), { registro: reg })).limite, 7);
  assert.equal(estadoPlanta(limonero, ctx(dia(2026, 6, 2), { registro: reg })).limite, 14);
});
t('riego reciente: al día; a partir del 70% del límite: riego pronto', () => {
  const reg = [{ planta: 2, fecha: '2026-10-29', tipo: '💧 Riego' }];
  const alDia = estadoPlanta(limonero, ctx(dia(2026, 11, 2), { registro: reg }));
  assert.equal(alDia.diasSinAgua, 4);
  assert.equal(alDia.riegoUrg || alDia.riegoProx, false);
  const vencido = estadoPlanta(limonero, ctx(dia(2026, 11, 5), { registro: reg }));
  assert.equal(vencido.diasSinAgua, 7);
  assert.equal(vencido.riegoUrg, true);
  const prox = estadoPlanta(limonero, ctx(dia(2026, 11, 3), { registro: reg }));
  assert.equal(prox.diasSinAgua, 5);
  assert.equal(prox.riegoProx, true);
});
t('una lluvia de 8 mm o más cuenta como riego si es más nueva', () => {
  const reg = [{ planta: 2, fecha: '2026-10-20', tipo: '💧 Riego' }];
  const clima = [{ fecha: '2026-10-30', mm: 12 }, { fecha: '2026-10-25', mm: 3 }];
  const a = aguaEfectiva(limonero, ctx(dia(2026, 11, 2), { registro: reg, clima }));
  assert.equal(a.tipo, 'lluvia');
  assert.equal(a.mm, 12);
  assert.equal(estadoPlanta(limonero, ctx(dia(2026, 11, 2), { registro: reg, clima })).diasSinAgua, 3);
});
t('una lluvia de menos de 8 mm no cuenta', () => {
  const reg = [{ planta: 2, fecha: '2026-10-20', tipo: '💧 Riego' }];
  const a = aguaEfectiva(limonero, ctx(dia(2026, 11, 2), { registro: reg, clima: [{ fecha: '2026-10-30', mm: 7.9 }] }));
  assert.equal(a.tipo, 'riego');
});
t('la fecha más reciente entre la Sheet y la app gana', () => {
  const conSheet = { ...limonero, ultimoRiego: '2026-10-31' };
  const reg = [{ planta: 2, fecha: '2026-10-25', tipo: '💧 Riego' }];
  assert.equal(estadoPlanta(conSheet, ctx(dia(2026, 11, 2), { registro: reg })).diasSinAgua, 2);
});
t('las plantas de interior no tienen riego ni alertas de riego', () => {
  const e = estadoPlanta(monstera, ctx(dia(2026, 11, 2)));
  assert.equal(e.interior, true);
  assert.equal(e.agua, null);
  assert.equal(e.diasSinAgua, null);
  assert.equal(e.riegoUrg, false);
  assert.equal(e.riegoProx, false);
});
t('el interior no usa la lluvia pero igual calcula su riego con el perfil si se pide el agua', () => {
  const a = aguaEfectiva(monstera, ctx(dia(2026, 11, 2), { clima: [{ fecha: '2026-11-01', mm: 30 }] }));
  assert.equal(a.tipo, 'riego');
});

console.log('fertilización, plagas y poda');
t('frutal: fertiliza cada 60 días desde el último evento de la app', () => {
  const reg = [{ planta: 2, fecha: '2026-09-10', tipo: '🌿 Fertilización' }];
  const e = estadoPlanta(limonero, ctx(dia(2026, 11, 2), { registro: reg }));
  assert.equal(e.diasParaFert, 7);
  assert.equal(e.fertUrg, false);
  const tarde = estadoPlanta(limonero, ctx(dia(2026, 11, 20), { registro: reg }));
  assert.equal(tarde.fertUrg, true);
});
t('la próxima fecha que trae la Sheet se respeta si no hay un evento más nuevo en la app', () => {
  const conSheet = { ...limonero, ultimaFert: '2026-10-01', proximaFert: '2026-11-10' };
  assert.equal(estadoPlanta(conSheet, ctx(dia(2026, 11, 2))).diasParaFert, 8);
});
t('interior fuera de temporada de fertilización no es urgente', () => {
  const e = estadoPlanta(monstera, ctx(dia(2026, 6, 15)));
  assert.equal(e.fertEnTemporada, false);
  assert.equal(e.fertUrg, false);
});
t('interior no fertiliza aunque haya un registro viejo (Monstera)', () => {
  const reg = [{ planta: 9, fecha: '2026-10-01', tipo: '🌿 Fertilización' }];
  const e = estadoPlanta(monstera, ctx(dia(2026, 11, 2), { registro: reg }));
  assert.equal(e.diasParaFert, null);
  assert.equal(e.fertUrg, false);
});
t('el intervalo de plagas viene de la ficha fitosanitaria si existe', () => {
  const reg = [{ planta: 2, fecha: '2026-10-30', tipo: '🐛 Revisión plagas' }];
  const c = diasPlagas => ctx(dia(2026, 11, 2), { registro: reg, diasPlagas });
  assert.equal(estadoPlanta(limonero, c(() => 3)).diasParaPlagas, 0);
  assert.equal(estadoPlanta(limonero, c(() => null)).diasParaPlagas, 27);
  assert.equal(estadoPlanta(limonero, c(() => 2)).plagasUrg, true);
});
t('poda: avisa desde 30 días antes y no si ya pasó', () => {
  const cerca = { ...limonero, ultimaPoda: '2025-11-20', proximaPoda: '2026-11-20' };
  assert.equal(estadoPlanta(cerca, ctx(dia(2026, 11, 2))).podaProx, true);
  const lejos = { ...limonero, proximaPoda: '2027-02-01' };
  assert.equal(estadoPlanta(lejos, ctx(dia(2026, 11, 2))).podaProx, false);
  const vencida = { ...limonero, proximaPoda: '2026-10-20' };
  assert.equal(estadoPlanta(vencida, ctx(dia(2026, 11, 2))).podaProx, false);
});
t('la Pata de elefante tolera 35 días en invierno (no es urgente a los 20)', () => {
  assert.equal(perfilEspecie('Pata de elefante').riegoInvierno, 35);
  assert.equal(estadoPlanta(elefante, ctx(dia(2026, 6, 15))).limite, 35);
});

console.log(ok + ' pruebas ok' + (process.exitCode ? ' (hay fallas)' : ''));
