// Prueba las fases del compost y las revolcadas. Correr: node scripts/test-compost.mjs
import assert from 'node:assert/strict';
import { faseSistema, proxRevolcada, revolcadasEnTiempo } from '../public/public/compost.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};
const dia = (y, m, d) => new Date(y, m - 1, d);
const HOY = dia(2026, 11, 2);

console.log('fases');
t('sin fecha de carga no hay datos', () => assert.equal(faseSistema({ id: 1 }, HOY).fase, 'v'));
t('con carga y sin estanque está en carga', () => assert.equal(faseSistema({ inicioC: '2026-10-01' }, HOY).fase, 'c'));
t('en estanque menos de 120 días', () => {
  const f = faseSistema({ inicioC: '2026-06-01', inicioE: '2026-08-04' }, HOY);
  assert.equal(f.fase, 's');
  assert.equal(f.d, 90);
});
t('casi listo desde los 120 días', () => {
  assert.equal(faseSistema({ inicioC: '2026-01-01', inicioE: '2026-07-05' }, HOY).fase, 'q');   // 120
  assert.equal(faseSistema({ inicioC: '2026-01-01', inicioE: '2026-07-06' }, HOY).fase, 's');   // 119
});
t('listo exactamente a los 180 días', () => {
  assert.equal(faseSistema({ inicioC: '2026-01-01', inicioE: '2026-05-06' }, HOY).fase, 'l');   // 180
  assert.equal(faseSistema({ inicioC: '2026-01-01', inicioE: '2026-05-07' }, HOY).fase, 'q');   // 179
});

console.log('próxima revolcada');
t('sin carga no hay próxima', () => assert.equal(proxRevolcada({ id: 1 }, []), null));
t('sin revolcadas cuenta 7 días desde la carga', () => {
  const p = proxRevolcada({ id: 1, inicioC: '2026-10-20' }, []);
  assert.equal(p.getTime(), dia(2026, 10, 27).getTime());
});
t('con revolcadas cuenta 7 días desde la última del mismo sistema', () => {
  const rev = [{ sistema: 1, fecha: '2026-10-25' }, { sistema: 1, fecha: '2026-10-28' }, { sistema: 2, fecha: '2026-10-31' }];
  assert.equal(proxRevolcada({ id: 1, inicioC: '2026-10-01' }, rev).getTime(), dia(2026, 11, 4).getTime());
});
t('sigue revolviendo cada 7 días con el sistema ya en estanque', () => {
  const p = proxRevolcada({ id: 1, inicioC: '2026-06-01', inicioE: '2026-08-04' }, [{ sistema: 1, fecha: '2026-10-30' }]);
  assert.equal(p.getTime(), dia(2026, 11, 6).getTime());
});

console.log('revolcadas en tiempo');
t('sin pares no hay porcentaje', () => {
  assert.equal(revolcadasEnTiempo([]).pct, null);
  assert.equal(revolcadasEnTiempo([{ sistema: 1, fecha: '2026-10-01' }]).pct, null);
});
t('cuenta los pares seguidos del mismo sistema dentro de 7 días', () => {
  const rev = [
    { sistema: 1, fecha: '2026-10-01' }, { sistema: 1, fecha: '2026-10-08' },   // 7 días: en tiempo
    { sistema: 1, fecha: '2026-10-20' },                                         // 12 días: tarde
    { sistema: 2, fecha: '2026-10-05' }, { sistema: 2, fecha: '2026-10-09' },   // 4 días: en tiempo
  ];
  const r = revolcadasEnTiempo(rev);
  assert.equal(r.totalPares, 3);
  assert.equal(r.enTiempo, 2);
  assert.equal(r.pct, 67);
});
t('no importa el orden en que vengan', () => {
  const r = revolcadasEnTiempo([{ sistema: 1, fecha: '2026-10-08' }, { sistema: 1, fecha: '2026-10-01' }]);
  assert.equal(r.pct, 100);
});

console.log(ok + ' pruebas ok' + (process.exitCode ? ' (hay fallas)' : ''));
