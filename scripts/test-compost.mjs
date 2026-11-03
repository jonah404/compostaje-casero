// Prueba las fases del compost y las revolcadas. Correr: node scripts/test-compost.mjs
import assert from 'node:assert/strict';
import { faseSistema, factorActividad, diasHastaPlenos, huecosClima, DIAS_PLENOS_LISTO, proxRevolcada, revolcadasEnTiempo } from '../public/public/compost.js';

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
// Historial diario con temperatura constante entre dos fechas (inclusive)
const clima = (desde, hasta, temp) => {
  const out = [], f = new Date(desde);
  while (f <= hasta) {
    out.push({ fecha: f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0'), temp });
    f.setDate(f.getDate() + 1);
  }
  return out;
};

t('en estanque todavía sin llegar a casi listo', () => {
  const f = faseSistema({ inicioC: '2026-06-01', inicioE: '2026-09-20' }, HOY, clima(dia(2026, 9, 20), dia(2026, 11, 1), 18));
  assert.equal(f.fase, 's');
  assert.equal(f.d, 43);
});

console.log('maduración según el clima real');
t('el factor de actividad va de 0.5 (frío) a 1 (calor)', () => {
  assert.equal(factorActividad(25), 1);
  assert.equal(factorActividad(20), 1);
  assert.equal(factorActividad(10), 0.5);
  assert.equal(factorActividad(0), 0.5);
  assert.ok(factorActividad(15) > 0.5 && factorActividad(15) < 1);
});
t('con calor sostenido está listo a los 90 días', () => {
  const cl = clima(dia(2026, 1, 1), dia(2026, 12, 31), 24);
  assert.equal(diasHastaPlenos(dia(2026, 1, 1), DIAS_PLENOS_LISTO, dia(2026, 2, 1), cl), 90);
});
t('con frío sostenido tarda 180 días', () => {
  const cl = clima(dia(2026, 1, 1), dia(2026, 12, 31), 8);
  assert.equal(diasHastaPlenos(dia(2026, 1, 1), DIAS_PLENOS_LISTO, dia(2026, 2, 1), cl), 180);
});
t('usa la temperatura real de cada día y no un promedio', () => {
  const caluroso = [...clima(dia(2026, 5, 1), dia(2026, 7, 31), 24)];
  const frio = [...clima(dia(2026, 5, 1), dia(2026, 7, 31), 8)];
  const e = { inicioC: '2026-04-01', inicioE: '2026-05-01' };
  const h = dia(2026, 8, 1);   // 92 días
  assert.equal(faseSistema(e, h, caluroso).fase, 'l');
  assert.notEqual(faseSistema(e, h, frio).fase, 'l');
  assert.equal(faseSistema(e, h, frio).plenos, 46);
});
t('un estanque que cruza de calor a frío se ajusta con los días reales', () => {
  const cl = [...clima(dia(2026, 3, 1), dia(2026, 4, 30), 24), ...clima(dia(2026, 5, 1), dia(2026, 12, 31), 8)];
  // 61 días cálidos (61) y después 0,5 por día: faltan 29 → 58 días fríos
  assert.equal(diasHastaPlenos(dia(2026, 3, 1), DIAS_PLENOS_LISTO, dia(2026, 6, 1), cl), 61 + 58);
});
t('los días sin dato (hoy y futuro) se proyectan con la temperatura reciente', () => {
  const cl = clima(dia(2026, 10, 1), dia(2026, 11, 1), 10);   // lo reciente es frío
  const f = faseSistema({ inicioC: '2026-09-01', inicioE: '2026-10-01' }, HOY, cl);
  assert.equal(f.meta, 180);
});
t('sin ningún dato de clima no se rompe', () => {
  const f = faseSistema({ inicioC: '2026-09-01', inicioE: '2026-10-01' }, HOY, []);
  assert.ok(f.meta > 90 && f.meta <= 180 && f.pct >= 0);
});
t('nunca pasa de 180 ni baja de 90 días', () => {
  assert.ok(faseSistema({ inicioC: '2026-09-01', inicioE: '2026-10-01' }, HOY, clima(dia(2026, 10, 1), dia(2026, 11, 1), -5)).meta === 180);
  assert.ok(faseSistema({ inicioC: '2026-09-01', inicioE: '2026-10-01' }, HOY, clima(dia(2026, 10, 1), dia(2026, 11, 1), 35)).meta === 90);
});
t('huecosClima lista los días sin dato', () => {
  const cl = clima(dia(2026, 10, 1), dia(2026, 10, 5), 15);
  assert.deepEqual(huecosClima(dia(2026, 9, 30), dia(2026, 10, 7), cl), ['2026-09-30', '2026-10-06']);
});
t('expone meta estimada, avance y fecha de listo', () => {
  const f = faseSistema({ inicioC: '2026-09-01', inicioE: '2026-10-01' }, HOY, clima(dia(2026, 10, 1), dia(2026, 11, 1), 15));
  assert.ok(f.meta > 90 && f.meta < 180);
  assert.ok(f.pct > 0 && f.pct < 100);
  assert.equal(Math.round((f.fechaListo - new Date(2026, 9, 1)) / 86400000), f.meta);
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
