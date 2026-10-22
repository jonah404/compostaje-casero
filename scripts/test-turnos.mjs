// Prueba public/public/turnos.js. Correr: node scripts/test-turnos.mjs
import assert from 'node:assert/strict';
import { duenoDelDia } from '../public/public/turnos.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};

t('el 22/10/2026 le toca a Viky', () => assert.equal(duenoDelDia('2026-10-22'), 'Viky'));
t('el 23/10/2026 le toca a Jona', () => assert.equal(duenoDelDia('2026-10-23'), 'Jona'));
t('alternan día por día', () => {
  assert.equal(duenoDelDia('2026-10-24'), 'Viky');
  assert.equal(duenoDelDia('2026-10-25'), 'Jona');
});
t('cruza el fin de mes y de año sin romper la alternancia', () => {
  assert.equal(duenoDelDia('2026-10-31'), 'Jona');
  assert.equal(duenoDelDia('2026-11-01'), 'Viky');
  assert.equal(duenoDelDia('2027-01-01'), 'Jona');
});
t('días anteriores a la fecha de inicio también alternan', () => {
  assert.equal(duenoDelDia('2026-10-21'), 'Jona');
  assert.equal(duenoDelDia('2026-10-20'), 'Viky');
});
t('acepta un Date (hora local) igual que el texto', () => {
  assert.equal(duenoDelDia(new Date(2026, 9, 22, 23, 59)), 'Viky');
  assert.equal(duenoDelDia(new Date(2026, 9, 23, 0, 1)), 'Jona');
});
console.log(`${ok} ok`);
