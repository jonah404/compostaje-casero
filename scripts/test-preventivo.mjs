// Prueba public/public/preventivo.js. Correr: node scripts/test-preventivo.mjs
import assert from 'node:assert/strict';
import { grupoDePlanta, estadoTratamiento, cadaDiasEnMes, tratamientosDelMes, calendarioAnual, PLANES } from '../public/public/preventivo.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};
const d = (y, m, dia) => new Date(y, m - 1, dia);
const trat = id => Object.values(PLANES).flat().find(x => x.id === id);

t('agrupa las plantas del huerto por nombre', () => {
  assert.equal(grupoDePlanta('Mandarina Criolla', 'Cítrico', false), 'citrico');
  assert.equal(grupoDePlanta('Limonero 4 Estaciones', 'Cítrico', false), 'citrico');
  assert.equal(grupoDePlanta('Ciruela Reina Claudia', 'Prunus doméstica', false), 'carozo');
  assert.equal(grupoDePlanta('Durazno amarillo', 'Prunus pérsica', false), 'carozo');
});
t('interior manda sobre el nombre; lo desconocido no tiene plan', () => {
  assert.equal(grupoDePlanta('Monstera', 'Monstera', true), 'interior');
  assert.equal(grupoDePlanta('Tomate', 'Hortaliza', false), null);
});
t('sin aplicaciones previas, en época, toca hoy', () => {
  const e = estadoTratamiento(trat('cobre-brotes'), null, d(2026, 10, 26));
  assert.equal(e.estado, 'hoy');
});
t('fuera de época no genera tarea', () => {
  assert.equal(estadoTratamiento(trat('cobre-brotes'), null, d(2026, 7, 10)).estado, 'fuera');
});
t('cobre de cítricos: 20 días después de la última', () => {
  const ult = d(2026, 10, 10);
  assert.equal(estadoTratamiento(trat('cobre-brotes'), ult, d(2026, 10, 26)).estado, 'ok');     // faltan 4
  assert.equal(estadoTratamiento(trat('cobre-brotes'), ult, d(2026, 10, 27)).estado, 'prox');   // faltan 3
  assert.equal(estadoTratamiento(trat('cobre-brotes'), ult, d(2026, 10, 29)).estado, 'prox');   // faltan 1
  assert.equal(estadoTratamiento(trat('cobre-brotes'), ult, d(2026, 10, 30)).estado, 'hoy');
  assert.equal(estadoTratamiento(trat('cobre-brotes'), ult, d(2026, 11, 5)).dias, -6);
});
t('recién aplicado queda "ok"', () => {
  assert.equal(estadoTratamiento(trat('cobre-brotes'), d(2026, 10, 25), d(2026, 10, 26)).estado, 'ok');
});
t('lluvia fuerte lava el fungicida y adelanta la repetición', () => {
  const e = estadoTratamiento(trat('cobre-brotes'), d(2026, 10, 20), d(2026, 10, 26), { mmDesdeUltima: 40 });
  assert.equal(e.estado, 'hoy');
  assert.match(e.detalle, /llovieron 40 mm/);
});
t('lluvia justo después de aplicar no obliga a repetir enseguida', () => {
  const e = estadoTratamiento(trat('cobre-brotes'), d(2026, 10, 25), d(2026, 10, 26), { mmDesdeUltima: 40 });
  assert.equal(e.estado, 'ok');
});
t('la lluvia no afecta a lo que no se lava (neem, aceite)', () => {
  const e = estadoTratamiento(trat('neem-verano'), d(2027, 1, 10), d(2027, 1, 13), { mmDesdeUltima: 80 });
  assert.equal(e.estado, 'ok');
});
t('con calor fuerte avisa de aplicar a la tardecita', () => {
  const e = estadoTratamiento(trat('neem-verano'), null, d(2027, 1, 15), { tmax: 36 });
  assert.equal(e.estado, 'hoy');
  assert.match(e.detalle, /tardecita/);
});
t('frecuencia variable por mes en interior (invierno más seguido)', () => {
  const tr = trat('jabon-neem-interior');
  assert.equal(cadaDiasEnMes(tr, 7), 21);
  assert.equal(cadaDiasEnMes(tr, 10), 30);
});
t('hay tratamientos en cada época del año para el durazno', () => {
  for (const mes of [5, 6, 7, 8, 9, 10, 11, 12, 1, 2]) assert.ok(tratamientosDelMes('carozo', mes).length > 0, 'mes ' + mes);
});
t('cobre y aceite de carozo no coinciden en el mismo mes', () => {
  const cobre = trat('cobre-invierno').meses, aceite = trat('aceite-reposo').meses;
  assert.deepEqual(cobre.filter(m => aceite.includes(m)), []);
});
t('el calendario anual tiene 12 meses por tratamiento', () => {
  for (const g of Object.keys(PLANES)) calendarioAnual(g).forEach(f => assert.equal(f.meses.length, 12));
});
t('hay insecticida y fungicida preventivo para cada grupo', () => {
  for (const g of ['citrico', 'carozo', 'interior']) {
    assert.ok(PLANES[g].some(x => /Insecticida/.test(x.nombre)), g + ' sin insecticida');
  }
  assert.ok(trat('fungicida-interior'));
});
t('aplicado el 25/10, lo siguiente cae a los 21 días (insecticida) y 15 (fungicida carozo)', () => {
  assert.equal(estadoTratamiento(trat('insecticida-brotes'), d(2026, 10, 25), d(2026, 11, 14)).dias, 1);
  assert.equal(estadoTratamiento(trat('fungicida-primavera'), d(2026, 10, 25), d(2026, 11, 9)).estado, 'hoy');
});
console.log(`${ok} ok`);
