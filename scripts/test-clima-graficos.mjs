// Prueba los períodos, el resumen y los gráficos del clima. Correr: node scripts/test-clima-graficos.mjs
import assert from 'node:assert/strict';
import {
  PERIODOS, rangoPeriodo, serieDiaria, resumenPeriodo, escalaY, indicesEjeX, indiceDesdeX, tramos, graficoSVG,
  acumulado, tooltipHTML, detalleDiaHTML, GRAFICOS, seriesDe, valorNum, diasEnRango, MAX_DIAS_PERSONALIZADO,
} from '../public/public/clima-graficos.js';
import { analisisClima, indiceCondicion } from '../public/public/analisis.js';

let ok = 0;
const t = (nombre, fn) => {
  try { fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};
const HOY = new Date(2026, 10, 3);
const rec = (fecha, o = {}) => ({ id: 'c-' + fecha, fecha, temp: 15, tmax: 20, tmin: 10, hum: 60, mm: 0, lluvia: 'no', viento: 12, rafaga: 30, evapo: 3, sol: 8, ...o });

console.log('períodos');
t('los cinco períodos pedidos están disponibles', () => assert.deepEqual(PERIODOS.map(p => p.dias), [7, 14, 30, 90, 180]));
t('el rango incluye hoy y cuenta los días pedidos', () => {
  [7, 14, 30, 90, 180].forEach(n => {
    const r = rangoPeriodo(String(n), HOY);
    assert.equal(r.hasta, '2026-11-03'); assert.equal(r.dias, n); assert.equal(diasEnRango(r.desde, r.hasta), n);
  });
  assert.equal(rangoPeriodo('7', HOY).desde, '2026-10-28');
});
t('un período desconocido cae en 30 días', () => assert.equal(rangoPeriodo('45', HOY).dias, 30));
t('personalizado: usa las fechas, las ordena si vienen al revés y limita el largo', () => {
  assert.deepEqual(rangoPeriodo('custom', HOY, '2026-10-01', '2026-10-10'), { desde: '2026-10-01', hasta: '2026-10-10', dias: 10, clave: 'custom' });
  const r = rangoPeriodo('custom', HOY, '2026-10-10', '2026-10-01');
  assert.equal(r.desde, '2026-10-01'); assert.equal(r.hasta, '2026-10-10');
  const largo = rangoPeriodo('custom', HOY, '2020-01-01', '2026-11-03');
  assert.equal(largo.dias, MAX_DIAS_PERSONALIZADO); assert.equal(largo.hasta, '2026-11-03');
});
t('personalizado sin fechas completas vuelve al período normal', () => assert.equal(rangoPeriodo('custom', HOY, '', '').dias, 30));
t('serieDiaria tiene un elemento por día y null donde no hay registro', () => {
  const s = serieDiaria([rec('2026-11-01'), rec('2026-11-03')], '2026-10-31', '2026-11-03');
  assert.deepEqual(s.fechas, ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
  assert.deepEqual(s.registros.map(r => r && r.fecha), [null, '2026-11-01', null, '2026-11-03']);
});
t('serieDiaria cruza el cambio de mes y de año', () => {
  assert.deepEqual(serieDiaria([], '2026-12-30', '2027-01-02').fechas, ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
});

console.log('datos faltantes');
t('valorNum: null, vacío y texto no son cero', () => {
  assert.equal(valorNum(null), null); assert.equal(valorNum(undefined), null); assert.equal(valorNum(''), null); assert.equal(valorNum('x'), null);
  assert.equal(valorNum(0), 0); assert.equal(valorNum('0'), 0); assert.equal(valorNum('3.5'), 3.5);
});
t('seriesDe deja null donde falta el dato y respeta las series ocultas', () => {
  const regs = [rec('2026-11-01', { tmin: null }), null, rec('2026-11-03', { tmin: 0 })];
  const s = seriesDe(GRAFICOS[0], regs, new Set(['temp:tmax']));
  assert.deepEqual(s.find(x => x.id === 'tmin').valores, [null, null, 0]);
  assert.equal(s.find(x => x.id === 'tmax').visible, false);
  assert.equal(s.find(x => x.id === 'tmin').visible, true);
});
t('tramos: un hueco corta la línea', () => {
  assert.deepEqual(tramos([1, 2, null, 3, null, null, 4, 5]), [[0, 1], [3], [6, 7]]);
  assert.deepEqual(tramos([null, null]), []);
});

console.log('resumen del período');
t('promedia, suma y busca extremos solo con los datos que existen', () => {
  const regs = [rec('a', { temp: 10, tmax: 25, tmin: 2, hum: 50, mm: 5, lluvia: 'si', viento: 10, rafaga: 40, evapo: 2, sol: 6 }),
    rec('b', { temp: 20, tmax: 30, tmin: 8, hum: 70, mm: 0, viento: 20, rafaga: 20, evapo: 4, sol: 10 }), null];
  const r = resumenPeriodo(regs, 3);
  assert.equal(r.diasConDato, 2); assert.equal(r.dias, 3);
  assert.equal(r.tempProm, 15); assert.equal(r.tmax, 30); assert.equal(r.tmin, 2);
  assert.equal(r.humProm, 60); assert.equal(r.lluviaTotal, 5); assert.equal(r.diasLluvia, 1); assert.equal(r.lluviaMax, 5);
  assert.equal(r.vientoProm, 15); assert.equal(r.rafagaMax, 40); assert.equal(r.evapoTotal, 6); assert.equal(r.solProm, 8); assert.equal(r.solTotal, 16);
});
t('un dato faltante no entra como cero en los promedios', () => {
  const r = resumenPeriodo([rec('a', { temp: 20 }), rec('b', { temp: null })], 2);
  assert.equal(r.tempProm, 20);
});
t('sin ningún dato todo queda en null (no en cero)', () => {
  const r = resumenPeriodo([null, null], 2);
  assert.equal(r.diasConDato, 0); assert.equal(r.tempProm, null); assert.equal(r.lluviaTotal, null);
  assert.equal(r.tmax, null); assert.equal(r.condicion, null);
});
t('la lluvia 0 es un dato real: suma 0 y 0 días con lluvia', () => {
  const r = resumenPeriodo([rec('a'), rec('b')], 2);
  assert.equal(r.lluviaTotal, 0); assert.equal(r.diasLluvia, 0);
});
t('el índice de condición es el mismo que usa el análisis semanal', () => {
  const clima = Array.from({ length: 8 }, (_, i) => rec('2026-10-' + String(27 + i).padStart(2, '0'), { temp: 18, hum: 55, mm: i === 3 ? 10 : 0 }));
  const sem = analisisClima(clima, new Date(2026, 9, 31));
  const porPeriodo = resumenPeriodo(clima.slice(0, 5), 7).condicion;
  assert.equal(indiceCondicion(18, 55, 10).idx, sem.idx);
  assert.equal(porPeriodo.idx, sem.idx);
});

console.log('escalas y ejes');
t('escalaY: valores redondos, independientes por gráfico', () => {
  assert.deepEqual(escalaY(3.2, 27.9), { min: 0, max: 30, ticks: [0, 10, 20, 30] });
  assert.deepEqual(escalaY(0, 1, { base0: true }).ticks.slice(0, 2), [0, 0.25]);
  const v = escalaY(10, 100); assert.ok(v.min <= 10 && v.max >= 100);
});
t('escalaY: barras desde cero y valores iguales no rompen', () => {
  assert.equal(escalaY(5, 40, { base0: true }).min, 0);
  const igual = escalaY(7, 7); assert.ok(igual.max > igual.min);
  assert.deepEqual(escalaY(0, 0, { base0: true }).ticks.length > 1, true);
  assert.equal(escalaY(null, null), null);
});
t('indicesEjeX: siempre incluye el primero y el último y no se amontona', () => {
  const a = indicesEjeX(30, 300); assert.equal(a[0], 0); assert.equal(a[a.length - 1], 29); assert.ok(a.length <= 6);
  assert.deepEqual(indicesEjeX(1, 300), [0]);
  assert.deepEqual(indicesEjeX(2, 20), [0, 1]);
  assert.ok(indicesEjeX(180, 280).length <= 5);
});
t('indiceDesdeX: líneas y barras, con límites', () => {
  const l = { n: 5, padL: 40, plotW: 200, barras: false };
  assert.equal(indiceDesdeX(40, l), 0); assert.equal(indiceDesdeX(240, l), 4); assert.equal(indiceDesdeX(140, l), 2);
  assert.equal(indiceDesdeX(-10, l), 0); assert.equal(indiceDesdeX(999, l), 4);
  const b = { n: 4, padL: 40, plotW: 200, barras: true };
  assert.equal(indiceDesdeX(41, b), 0); assert.equal(indiceDesdeX(95, b), 1); assert.equal(indiceDesdeX(239, b), 3);
});

console.log('gráficos SVG');
const fechas = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
t('líneas: una polilínea por tramo y colores por serie', () => {
  const series = [{ id: 'a', nombre: 'A', color: 'red', valores: [1, 2, null, 4, 5] }, { id: 'b', nombre: 'B', color: 'blue', valores: [3, 3, 3, 3, 3] }];
  const svg = graficoSVG({ fechas, series, ancho: 320 });
  assert.equal((svg.match(/<polyline/g) || []).length, 3);   // A: 2 tramos + B: 1
  assert.ok(svg.includes('stroke="red"') && svg.includes('stroke="blue"'));
});
t('el hueco no se dibuja como cero: no hay punto en el día sin dato', () => {
  const series = [{ id: 'a', nombre: 'A', color: 'red', valores: [10, null, 10, null, 10] }];
  const svg = graficoSVG({ fechas, series });
  assert.equal((svg.match(/<polyline/g) || []).length, 0);       // ningún tramo tiene 2 puntos
  assert.equal((svg.match(/<circle/g) || []).length, 3);          // solo los 3 días con dato
});
t('barras: no hay barra donde falta el dato ni donde llovió 0', () => {
  const series = [{ id: 'mm', nombre: 'Lluvia', color: 'blue', valores: [5, null, 0, 12, null] }];
  const svg = graficoSVG({ tipo: 'barras', fechas, series });
  assert.equal((svg.match(/<rect/g) || []).length, 2);
});
t('cada gráfico lleva su propia escala (no se mezclan unidades)', () => {
  const temp = graficoSVG({ fechas, series: [{ id: 'a', nombre: 'T', color: 'red', valores: [5, 10, 15, 20, 25] }], dec: 0 });
  const lluvia = graficoSVG({ tipo: 'barras', fechas, series: [{ id: 'b', nombre: 'mm', color: 'blue', valores: [0.2, 0.4, 0.6, 0.8, 1] }] });
  assert.ok(temp.includes('>25<') && !lluvia.includes('>25<'));
  assert.ok(lluvia.includes('>1.0<'));
});
t('humedad con escala fija 0–100', () => {
  const g = GRAFICOS.find(x => x.id === 'hum');
  const svg = graficoSVG({ fechas, series: seriesDe(g, fechas.map(f => rec(f, { hum: 70 }))), dec: 0, fijo: g.fijo });
  ['>0<', '>50<', '>100<'].forEach(x => assert.ok(svg.includes(x), x));
});
t('muestra las fechas en el eje horizontal y deja los datos para el hover', () => {
  const svg = graficoSVG({ fechas, series: [{ id: 'a', nombre: 'A', color: 'red', valores: [1, 2, 3, 4, 5] }] });
  assert.ok(svg.includes('>01/11<') && svg.includes('>05/11<'));
  assert.match(svg, /data-n="5"/); assert.match(svg, /data-pl="\d/); assert.match(svg, /class="cg-cursor"/);
});
t('sin datos o con todas las series ocultas avisa en vez de dibujar', () => {
  assert.match(graficoSVG({ fechas, series: [{ id: 'a', nombre: 'A', color: 'red', valores: [null, null, null, null, null] }] }), /Sin datos en este período/);
  assert.match(graficoSVG({ fechas, series: [{ id: 'a', nombre: 'A', color: 'red', valores: [1, 2, 3, 4, 5], visible: false }] }), /Activá al menos una serie/);
});
t('ocultar una serie la saca del gráfico y reajusta la escala', () => {
  const series = [{ id: 'a', nombre: 'A', color: 'red', valores: [1, 2, 3, 4, 5] }, { id: 'b', nombre: 'B', color: 'blue', valores: [100, 200, 300, 400, 500], visible: true }];
  const todo = graficoSVG({ fechas, series });
  const sin = graficoSVG({ fechas, series: [series[0], { ...series[1], visible: false }] });
  assert.ok(todo.includes('stroke="blue"') && !sin.includes('stroke="blue"'));
  assert.ok(!sin.includes('>500<'));
});
t('el ancho se adapta: el SVG usa el ancho pedido (móvil y escritorio)', () => {
  const s = [{ id: 'a', nombre: 'A', color: 'red', valores: [1, 2, 3, 4, 5] }];
  assert.match(graficoSVG({ fechas, series: s, ancho: 280 }), /viewBox="0 0 280 190"/);
  assert.match(graficoSVG({ fechas, series: s, ancho: 720 }), /viewBox="0 0 720 190"/);
});
t('180 días de barras se dibujan sin romper', () => {
  const f = Array.from({ length: 180 }, (_, i) => { const d = new Date(2026, 4, 1 + i); return d.toISOString().slice(0, 10); });
  const svg = graficoSVG({ tipo: 'barras', fechas: f, series: [{ id: 'a', nombre: 'A', color: 'red', valores: f.map((_, i) => i % 3 === 0 ? i / 10 : null) }], ancho: 320 });
  assert.equal((svg.match(/<rect/g) || []).length, 59);
});

console.log('tooltip y detalle');
t('acumulado: los faltantes no suman ni se toman como cero', () => assert.deepEqual(acumulado([1, null, 2.5, 0]), [1, 1, 3.5, 3.5]));
t('tooltip: fecha, valor exacto con su unidad, "sin dato" y extras', () => {
  const series = [{ id: 'a', nombre: 'Lluvia', color: 'blue', valores: [5.25, null], visible: true }];
  const a = tooltipHTML(0, fechas, series, { unidad: 'mm', extras: [{ nombre: 'Acumulado', texto: '5.3 mm' }] });
  assert.ok(a.includes('<b>5.3 mm</b>') || a.includes('<b>5.2 mm</b>')); assert.ok(a.includes('Lluvia') && a.includes('Acumulado'));
  assert.ok(tooltipHTML(1, fechas, series, { unidad: 'mm' }).includes('sin dato'));
});
t('el tooltip no muestra las series ocultas', () => {
  const series = [{ id: 'a', nombre: 'Mínima', color: 'blue', valores: [1], visible: true }, { id: 'b', nombre: 'Máxima', color: 'red', valores: [9], visible: false }];
  const h = tooltipHTML(0, ['2026-11-01'], series, { unidad: '°C' });
  assert.ok(h.includes('Mínima') && !h.includes('Máxima'));
});
t('detalle del día: todos los campos, dirección del viento y notas (escapadas)', () => {
  const h = detalleDiaHTML(rec('2026-11-01', { dir: 'NO 328°', notas: '<b>granizo</b>', auto: true, humMax: 80, humMin: 40, hsLluvia: 3 }));
  ['Temperatura promedio', 'Ráfaga máxima', 'Dirección del viento', 'NO 328°', 'Horas de sol', 'Open-Meteo'].forEach(x => assert.ok(h.includes(x), x));
  assert.ok(h.includes('&lt;b&gt;granizo') && !h.includes('<b>granizo'));
  assert.ok(h.includes('80 % / 40 %'));
});
t('detalle: campos faltantes como — y día sin registro con aviso', () => {
  const h = detalleDiaHTML({ fecha: '2026-11-01', temp: null });
  assert.ok(h.includes('—'));
  assert.ok(detalleDiaHTML(null).includes('No hay registro'));
});

console.log(ok + ' pruebas ok' + (process.exitCode ? ' (hay fallas)' : ''));
