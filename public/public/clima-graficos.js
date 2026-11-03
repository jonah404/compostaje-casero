// Análisis gráfico del clima: períodos, resumen y gráficos SVG (líneas y barras) con tooltip.
// Sin acceso a la app: todo entra por parámetro. Usa los registros diarios ya guardados
// (temp, tmin, tmax, hum, mm, viento, rafaga, evapo, sol, dir, notas) sin recalcularlos.
import { esc } from './util.js';
import { indiceCondicion } from './analisis.js';

export const PERIODOS = [
  { clave: '7', dias: 7, etiqueta: '7 días' }, { clave: '14', dias: 14, etiqueta: '14 días' },
  { clave: '30', dias: 30, etiqueta: '30 días' }, { clave: '90', dias: 90, etiqueta: '90 días' },
  { clave: '180', dias: 180, etiqueta: '180 días' },
];
export const MAX_DIAS_PERSONALIZADO = 366;

// Valor numérico o null: un dato faltante NUNCA se convierte en cero.
export const valorNum = v => (v == null || v === '' || isNaN(+v)) ? null : +v;
const llovio = c => c.lluvia === 'si' || (valorNum(c.mm) || 0) > 0;

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const aFecha = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const utc = f => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const diasEnRango = (desde, hasta) => Math.round((utc(hasta) - utc(desde)) / 86400000) + 1;

// clave: '7' | '14' | '30' | '90' | '180' | 'custom'. Devuelve { desde, hasta, dias, clave } (ISO).
export const rangoPeriodo = (clave, hoy, desdeCustom, hastaCustom) => {
  const hasta0 = iso(hoy);
  if (clave === 'custom' && desdeCustom && hastaCustom) {
    let d = desdeCustom, h = hastaCustom;
    if (d > h) [d, h] = [h, d];
    if (diasEnRango(d, h) > MAX_DIAS_PERSONALIZADO) { const f = aFecha(h); f.setDate(f.getDate() - (MAX_DIAS_PERSONALIZADO - 1)); d = iso(f); }
    return { desde: d, hasta: h, dias: diasEnRango(d, h), clave: 'custom' };
  }
  const n = PERIODOS.some(p => p.clave === String(clave)) ? +clave : 30;
  const f = new Date(hoy); f.setDate(f.getDate() - (n - 1));
  return { desde: iso(f), hasta: hasta0, dias: n, clave: String(n) };
};

// Un elemento por día del rango (con el registro o null si ese día no hay).
export const serieDiaria = (clima, desde, hasta) => {
  const porFecha = new Map();
  (clima || []).forEach(c => { if (c && c.fecha) porFecha.set(c.fecha, c); });
  const fechas = [], registros = [];
  for (const f = aFecha(desde), fin = aFecha(hasta); f <= fin; f.setDate(f.getDate() + 1)) {
    const k = iso(f); fechas.push(k); registros.push(porFecha.get(k) || null);
  }
  return { fechas, registros };
};

const prom = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const suma = a => a.length ? a.reduce((x, y) => x + y, 0) : null;
const valores = (regs, k) => regs.map(r => valorNum(r && r[k])).filter(v => v != null);

// Indicadores del período. `regs` = registros del rango (null = día sin registro); `dias` = días del rango.
export const resumenPeriodo = (regs, dias = regs.length) => {
  const reales = regs.filter(Boolean);
  const mm = valores(reales, 'mm');
  const tempProm = prom(valores(reales, 'temp')), humProm = prom(valores(reales, 'hum'));
  const lluviaTotal = suma(mm);
  const cond = reales.length ? indiceCondicion(tempProm, humProm, (lluviaTotal || 0) / Math.max(1, dias) * 7) : null;
  return {
    diasConDato: reales.length, dias,
    tempProm, tmax: valores(reales, 'tmax').length ? Math.max(...valores(reales, 'tmax')) : null,
    tmin: valores(reales, 'tmin').length ? Math.min(...valores(reales, 'tmin')) : null,
    humProm, lluviaTotal, diasLluvia: reales.filter(llovio).length, lluviaMax: mm.length ? Math.max(...mm) : null,
    vientoProm: prom(valores(reales, 'viento')), rafagaMax: valores(reales, 'rafaga').length ? Math.max(...valores(reales, 'rafaga')) : null,
    evapoTotal: suma(valores(reales, 'evapo')), solProm: prom(valores(reales, 'sol')), solTotal: suma(valores(reales, 'sol')),
    condicion: cond,
  };
};

// Escala "bonita" del eje Y independiente para cada gráfico.
export const escalaY = (min, max, { base0 = false, ticks = 4 } = {}) => {
  if (min == null || max == null) return null;
  if (base0) min = Math.min(0, min);
  if (min === max) { if (base0 && min === 0) max = 1; else { min -= 1; max += 1; } }
  const paso0 = (max - min) / ticks, mag = 10 ** Math.floor(Math.log10(paso0)), norm = paso0 / mag;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / paso + 1e-9) * paso, hi = Math.ceil(max / paso - 1e-9) * paso;
  const t = []; for (let v = lo; v <= hi + paso / 2; v += paso) t.push(+v.toFixed(10));
  return { min: t[0], max: t[t.length - 1], ticks: t };
};

// Posiciones (índices) de las fechas que se rotulan en el eje horizontal.
export const indicesEjeX = (n, anchoUtil, pxPorEtiqueta = 52) => {
  if (n <= 1) return [0];
  const cant = Math.max(2, Math.min(n, Math.floor(anchoUtil / pxPorEtiqueta)));
  const out = new Set(); for (let k = 0; k < cant; k++) out.add(Math.round(k * (n - 1) / (cant - 1)));
  return [...out];
};

// Del punto del cursor (x, en px del SVG) al índice del día.
export const indiceDesdeX = (x, { n, padL, plotW, barras }) => {
  if (n <= 1) return 0;
  const i = barras ? Math.floor((x - padL) / (plotW / n)) : Math.round((x - padL) / plotW * (n - 1));
  return Math.max(0, Math.min(n - 1, i));
};

export const fmtFechaCorta = f => f.slice(8, 10) + '/' + f.slice(5, 7);
export const fmtFechaLarga = f => aFecha(f).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
// Decimales con punto, igual que el resto de la app (n1/n0).
const fmtNum = (v, dec) => v == null ? 'sin dato' : v.toFixed(dec);

// Tramos continuos de una serie (un hueco de datos corta la línea).
export const tramos = vals => {
  const out = []; let t = [];
  vals.forEach((v, i) => { if (v == null) { if (t.length) out.push(t); t = []; } else t.push(i); });
  if (t.length) out.push(t);
  return out;
};

// tipo: 'lineas' | 'barras'. series: [{ id, nombre, color, valores:[num|null], visible }].
// Devuelve el SVG con su geometría en data-* para que la app resuelva el hover.
export const graficoSVG = ({ tipo = 'lineas', fechas, series, ancho = 320, alto = 190, dec = 1, base0 = false, fijo = null, etiqueta = '' }) => {
  const visibles = series.filter(s => s.visible !== false);
  const todos = visibles.flatMap(s => s.valores.filter(v => v != null));
  if (!todos.length) return `<div class="cg-vacio">${visibles.length ? 'Sin datos en este período' : 'Activá al menos una serie'}</div>`;
  const esc_ = fijo ? { min: fijo[0], max: fijo[1], ticks: fijo[2] } : escalaY(Math.min(...todos), Math.max(...todos), { base0: base0 || tipo === 'barras' });
  const n = fechas.length, barras = tipo === 'barras';
  const maxLabel = Math.max(...esc_.ticks.map(t => fmtNum(t, dec).length));
  const padL = Math.max(30, maxLabel * 6.4 + 10), padR = 8, padT = 8, padB = 22;
  const plotW = Math.max(40, ancho - padL - padR), plotH = alto - padT - padB;
  const X = i => barras ? padL + (i + 0.5) * plotW / n : (n === 1 ? padL + plotW / 2 : padL + i * plotW / (n - 1));
  const Y = v => padT + plotH - (v - esc_.min) / (esc_.max - esc_.min) * plotH;
  const grilla = esc_.ticks.map(t => `<line x1="${padL}" x2="${padL + plotW}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="var(--rule)" stroke-width="1"/>`
    + `<text x="${padL - 6}" y="${(Y(t) + 3.5).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--ink3)">${fmtNum(t, dec)}</text>`).join('');
  const ejeX = indicesEjeX(n, plotW).map(i => `<text x="${X(i).toFixed(1)}" y="${alto - 6}" text-anchor="${i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}" font-size="10.5" fill="var(--ink3)">${fmtFechaCorta(fechas[i])}</text>`).join('');
  let marcas = '';
  if (barras) {
    const bw = Math.max(1, Math.min(18, plotW / n * 0.72));
    marcas = visibles.map(s => s.valores.map((v, i) => {
      if (v == null) return '';
      const y = Y(v), y0 = Y(Math.max(esc_.min, 0)), h = Math.max(v > 0 ? 1 : 0, y0 - y);
      return h > 0 ? `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${(y0 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${s.color}" rx="${bw > 4 ? 2 : 0}"/>` : '';
    }).join('')).join('');
  } else {
    marcas = visibles.map(s => {
      const ts = tramos(s.valores);
      const lineas = ts.filter(t => t.length > 1).map(t => `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${t.map(i => X(i).toFixed(1) + ',' + Y(s.valores[i]).toFixed(1)).join(' ')}"/>`).join('');
      const puntos = ts.flatMap(t => (t.length === 1 || n <= 31) ? t : []).map(i => `<circle cx="${X(i).toFixed(1)}" cy="${Y(s.valores[i]).toFixed(1)}" r="${n <= 31 ? 2.6 : 2.4}" fill="${s.color}"/>`).join('');
      return lineas + puntos;
    }).join('');
  }
  const cursor = `<line class="cg-cursor" x1="0" x2="0" y1="${padT}" y2="${padT + plotH}" stroke="var(--ink3)" stroke-width="1" stroke-dasharray="3 3" style="display:none"/>`;
  return `<svg class="cg-svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="${esc(etiqueta)}"`
    + ` data-n="${n}" data-pl="${padL}" data-pw="${plotW}" data-barras="${barras ? 1 : 0}" data-top="${padT}" data-h="${plotH}">${grilla}${ejeX}${marcas}${cursor}</svg>`;
};

// Valores acumulados (un faltante no suma; el acumulado sigue donde estaba).
export const acumulado = vals => { let a = 0; return vals.map(v => { if (v != null) a += v; return +a.toFixed(4); }); };

// Contenido del tooltip para el día i. extras: [{ nombre, texto }] (ej. acumulado).
export const tooltipHTML = (i, fechas, series, { dec = 1, unidad = '', extras = [] } = {}) =>
  `<div class="cg-tt-f">${esc(fmtFechaLarga(fechas[i]))}</div>`
  + series.filter(s => s.visible !== false).map(s => {
    const v = s.valores[i];
    return `<div class="cg-tt-r"><span class="cg-dot" style="background:${s.color}"></span><span>${esc(s.nombre)}</span><b>${v == null ? '<i>sin dato</i>' : fmtNum(v, dec) + ' ' + esc(unidad)}</b></div>`;
  }).join('')
  + extras.map(e => `<div class="cg-tt-r"><span class="cg-dot" style="background:transparent"></span><span>${esc(e.nombre)}</span><b>${esc(e.texto)}</b></div>`).join('');

// Registro completo de un día (para el detalle al hacer clic).
export const detalleDiaHTML = c => {
  if (!c) return '<div style="font-size:13px;color:var(--ink3)">No hay registro de este día.</div>';
  const f = (v, dec, u) => valorNum(v) == null ? '—' : fmtNum(valorNum(v), dec) + (u ? ' ' + u : '');
  const filas = [
    ['Temperatura promedio', f(c.temp, 1, '°C')], ['Temperatura máxima', f(c.tmax, 1, '°C')], ['Temperatura mínima', f(c.tmin, 1, '°C')],
    ['Humedad promedio', f(c.hum, 0, '%')], ['Humedad máxima / mínima', `${f(c.humMax, 0, '%')} / ${f(c.humMin, 0, '%')}`],
    ['Lluvia', f(c.mm, 1, 'mm')], ['Horas de lluvia', f(c.hsLluvia, 0, 'h')],
    ['Viento (máx. del día)', f(c.viento, 1, 'km/h')], ['Ráfaga máxima', f(c.rafaga, 1, 'km/h')], ['Dirección del viento', c.dir ? esc(c.dir) : '—'],
    ['Evaporación (ET₀)', f(c.evapo, 1, 'mm')], ['Horas de sol', f(c.sol, 1, 'h')],
  ];
  return `<table class="mt-tbl">${filas.map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right;font-weight:600">${v}</td></tr>`).join('')}</table>`
    + (c.notas ? `<div style="font-size:12px;color:var(--ink2);background:var(--paper2);padding:11px;border-radius:var(--r);margin:14px 0">${esc(c.notas)}</div>` : '')
    + `<div style="font-size:11px;color:var(--ink3);margin-top:10px">${c.auto ? 'Dato automático de Open-Meteo' : 'Cargado a mano'}</div>`;
};

// Definición de los gráficos pedidos (cada uno con su escala y unidad).
export const GRAFICOS = [
  { id: 'temp', titulo: 'Temperatura', unidad: '°C', tipo: 'lineas', dec: 1, series: [
    { id: 'tmin', nombre: 'Mínima', campo: 'tmin', color: 'var(--chart-2)' },
    { id: 'temp', nombre: 'Promedio', campo: 'temp', color: 'var(--chart-3)' },
    { id: 'tmax', nombre: 'Máxima', campo: 'tmax', color: 'var(--chart-4)' } ] },
  { id: 'lluvia', titulo: 'Precipitaciones', unidad: 'mm', tipo: 'barras', dec: 1, series: [
    { id: 'mm', nombre: 'Lluvia', campo: 'mm', color: 'var(--sky-mid)' } ] },
  { id: 'viento', titulo: 'Viento', unidad: 'km/h', tipo: 'lineas', dec: 1, series: [
    { id: 'viento', nombre: 'Promedio', campo: 'viento', color: 'var(--chart-1)' },
    { id: 'rafaga', nombre: 'Ráfaga máx.', campo: 'rafaga', color: 'var(--chart-5)' } ] },
  { id: 'hum', titulo: 'Humedad relativa', unidad: '%', tipo: 'lineas', dec: 0, fijo: [0, 100, [0, 25, 50, 75, 100]], series: [
    { id: 'hum', nombre: 'Promedio diario', campo: 'hum', color: 'var(--chart-2)' } ] },
  { id: 'evapo', titulo: 'Evaporación', unidad: 'mm', tipo: 'barras', dec: 1, compacto: true, series: [
    { id: 'evapo', nombre: 'Evaporación', campo: 'evapo', color: 'var(--chart-3)' } ] },
  { id: 'sol', titulo: 'Horas de sol', unidad: 'h', tipo: 'barras', dec: 1, compacto: true, series: [
    { id: 'sol', nombre: 'Horas de sol', campo: 'sol', color: 'var(--umber-mid)' } ] },
];

// Series de un gráfico a partir de los registros diarios (null donde falta el dato).
export const seriesDe = (graf, regs, ocultas = new Set()) =>
  graf.series.map(s => ({ ...s, valores: regs.map(r => valorNum(r && r[s.campo])), visible: !ocultas.has(graf.id + ':' + s.id) }));
