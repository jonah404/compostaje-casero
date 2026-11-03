// Prueba el respaldo y la exportación a Excel. Correr: node scripts/test-respaldo.mjs
import assert from 'node:assert/strict';
import { armarRespaldo, nombreRespaldo, aCSV, registrosParaExcel, COLECCIONES } from '../public/public/respaldo.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};

const S = {
  sistemas: [{ id: 1, nombre: 'Cajón', _by: { uid: 'x' } }, { id: 2 }],
  revolcadas: [{ id: 'a', sistema: 1, fecha: '2026-10-30', obs: 'bien; "húmedo"', _pend: true }],
  plantas: [{ id: 1, nombre: 'Limonero' }],
  registroPlantas: [
    { id: 'e1', planta: 1, fecha: '2026-11-01', tipo: '💧 Riego', detalle: '10 L', producto: '', resultado: '' },
    { id: 'e2', planta: 9, fecha: '2026-10-01', tipo: '🌿 Fertilización', detalle: '', producto: '15-15-15', resultado: 'ok' },
  ],
  pecera: { litros: 42, _by: { uid: 'x' } },
  registroPecera: [{ id: 'k1', fecha: '2026-11-02', tipo: '💧 Cambio de agua parcial', detalle: '20%', resultado: '' }],
  clima: [{ id: '2026-11-01', fecha: '2026-11-01', temp: 20 }],
  climaLastFetch: '2026-11-02',
};

console.log('respaldo JSON');
t('incluye las 7 colecciones, la fecha, el usuario y la versión', () => {
  const r = armarRespaldo(S, 'a@b.c', new Date('2026-11-03T12:00:00Z'));
  assert.equal(r.app, 'Brote');
  assert.equal(r.version, 1);
  assert.equal(r.creado, '2026-11-03T12:00:00.000Z');
  assert.equal(r.usuario, 'a@b.c');
  assert.deepEqual(Object.keys(r.datos), COLECCIONES);
  assert.equal(r.datos.sistemas.length, 2);
  assert.equal(r.datos.pecera.litros, 42);
});
t('saca los campos internos (_pend, _by) y no incluye datos de caché', () => {
  const txt = JSON.stringify(armarRespaldo(S));
  assert.ok(!txt.includes('_pend') && !txt.includes('_by') && !txt.includes('climaLastFetch'));
});
t('con datos faltantes no rompe', () => {
  const r = armarRespaldo({});
  assert.deepEqual(r.datos.sistemas, []);
  assert.deepEqual(r.datos.pecera, {});
});
t('el nombre lleva la fecha de hoy', () => {
  assert.equal(nombreRespaldo(new Date(2026, 10, 3)), 'brote-respaldo-2026-11-03.json');
  assert.equal(nombreRespaldo(new Date(2026, 0, 9), 'csv', 'brote-registros'), 'brote-registros-2026-01-09.csv');
});

console.log('CSV para Excel');
t('usa ; como separador, BOM y comillas dobles escapadas', () => {
  const c = aCSV([['a', 'b;c', 'd"e'], ['1', null, undefined]]);
  assert.ok(c.startsWith('﻿'));
  assert.equal(c.slice(1), 'a;"b;c";"d""e"\r\n1;;\r\n');
});
t('un salto de línea dentro de una celda queda entre comillas', () => {
  assert.ok(aCSV([['x\ny']]).includes('"x\ny"'));
});
t('el listado junta compost, plantas y pecera, de lo más nuevo a lo más viejo', () => {
  const filas = registrosParaExcel(S).slice(1).trim().split('\r\n');
  assert.equal(filas[0], 'Fecha;Área;Elemento;Tipo;Detalle;Producto;Resultado / observaciones');
  assert.equal(filas.length, 5);
  assert.deepEqual(filas.slice(1).map(f => f.split(';')[0]), ['2026-11-02', '2026-11-01', '2026-10-30', '2026-10-01']);
});
t('usa los nombres de plantas y sistemas, y tolera que falte alguno', () => {
  const txt = registrosParaExcel(S);
  assert.ok(txt.includes('2026-11-01;Plantas;Limonero;💧 Riego;10 L;;'));
  assert.ok(txt.includes('Planta 9'));
  assert.ok(txt.includes('#1 — Cajón'));
  assert.ok(txt.includes('"bien; ""húmedo"""'));
});
t('sin registros devuelve solo el encabezado', () => {
  assert.equal(registrosParaExcel({}).trim().split('\r\n').length, 1);
});

console.log(ok + ' pruebas ok' + (process.exitCode ? ' (hay fallas)' : ''));
