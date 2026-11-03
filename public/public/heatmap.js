import { n1 } from './util.js';

// Cada paleta: [{v,r,g,b}, …] igual que el AppScript original
export const PAL = {
  temp: [{v:-10,r:110,g:20,b:180},{v:0,r:70,g:100,b:230},{v:5,r:60,g:180,b:240},{v:10,r:80,g:220,b:180},{v:15,r:100,g:230,b:80},{v:20,r:200,g:230,b:30},{v:25,r:250,g:190,b:0},{v:30,r:245,g:110,b:0},{v:35,r:220,g:30,b:0},{v:40,r:140,g:0,b:60}],
  hum:  [{v:0,r:220,g:100,b:20},{v:20,r:240,g:180,b:40},{v:40,r:240,g:230,b:130},{v:60,r:160,g:220,b:240},{v:80,r:60,g:160,b:230},{v:100,r:20,g:80,b:200}],
  lluvia: [{v:0,r:240,g:248,b:255},{v:2,r:160,g:210,b:255},{v:5,r:80,g:160,b:240},{v:15,r:30,g:100,b:210},{v:30,r:10,g:50,b:170},{v:60,r:5,g:20,b:120}],
  hsLluvia:[{v:0,r:240,g:248,b:255},{v:3,r:140,g:200,b:255},{v:6,r:60,g:140,b:230},{v:12,r:20,g:60,b:180},{v:24,r:5,g:20,b:120}],
  viento:[{v:0,r:200,g:240,b:200},{v:10,r:150,g:230,b:100},{v:20,r:230,g:230,b:30},{v:35,r:250,g:160,b:0},{v:50,r:230,g:50,b:20},{v:75,r:160,g:0,b:100}],
  evapo: [{v:0,r:80,g:160,b:230},{v:2,r:120,g:210,b:160},{v:4,r:180,g:230,b:80},{v:6,r:240,g:220,b:30},{v:8,r:240,g:130,b:0},{v:10,r:210,g:30,b:0}],
  sol:   [{v:0,r:130,g:130,b:140},{v:4,r:200,g:200,b:160},{v:8,r:250,g:220,b:80},{v:12,r:255,g:200,b:0},{v:14,r:255,g:170,b:0}],
};

export function interp(pal, val) {
  if (val == null || val === '' || isNaN(+val)) return null;
  const v = +val;
  if (v <= pal[0].v) return pal[0];
  if (v >= pal[pal.length-1].v) return pal[pal.length-1];
  for (let i=0; i<pal.length-1; i++) {
    const p0=pal[i], p1=pal[i+1];
    if (v >= p0.v && v <= p1.v) {
      const t = (v-p0.v)/(p1.v-p0.v);
      return {r:Math.round(p0.r+t*(p1.r-p0.r)), g:Math.round(p0.g+t*(p1.g-p0.g)), b:Math.round(p0.b+t*(p1.b-p0.b))};
    }
  }
  return null;
}
export function luma(c) { return (0.299*c.r + 0.587*c.g + 0.114*c.b)/255; }
// Genera un degradé de toda la paleta para usar como fondo de columna
export function palGradient(pal, orientation) {
  // orientation: 'to right' para columnas de temp/hum, etc.
  const stops = pal.map((p,i) => {
    const pct = Math.round(i/(pal.length-1)*100);
    return `rgb(${p.r},${p.g},${p.b}) ${pct}%`;
  }).join(', ');
  return `linear-gradient(${orientation||'to right'}, ${stops})`;
}

// Pre-calcular gradientes por paleta
export const GRAD = {};
Object.keys(PAL).forEach(k => { GRAD[k] = palGradient(PAL[k]); });

export function heatCell(val, palKey, display) {
  const pal = PAL[palKey];
  const c = interp(pal, val);
  if (!c) return `<td style="background:var(--paper2);color:var(--ink3);font-weight:500">${display ?? '—'}</td>`;
  // Color sólido del valor interpolado para el texto y borde izquierdo
  const solid = `rgb(${c.r},${c.g},${c.b})`;
  const fg = luma(c) > 0.52 ? '#1a180f' : '#ffffff';
  // Degradé: del blanco/muy claro al color del valor
  // Calculamos un color de inicio más claro mezclando con blanco
  const mix = (ch, w=0.15) => Math.round(ch + (255-ch)*w);
  const lighter = `rgb(${mix(c.r,.55)},${mix(c.g,.55)},${mix(c.b,.55)})`;
  const grad = `linear-gradient(135deg, ${lighter} 0%, ${solid} 100%)`;
  return `<td style="background:${grad};color:${fg};font-weight:600">${display ?? n1(val)}</td>`;
}
