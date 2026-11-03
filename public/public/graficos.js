import { fISO, fmt, n1 } from './util.js';

// Gráfico de área SVG liviano (sin librerías) — temperatura (línea+relleno) + lluvia (barras)
export const climaSparkSVG = (clima, hoyFecha, dias=21) => {
  const datos = [...clima].filter(c=>c.fecha<=fISO(hoyFecha) && c.temp!=null).sort((a,b)=>a.fecha>b.fecha?1:-1).slice(-dias);
  if (datos.length < 2) return `<div style="font-size:12px;color:var(--ink3);padding:16px 0">Sin suficientes datos de clima todavía.</div>`;
  const W=600, H=150, pad=10, barZone=26;
  const temps = datos.map(d=>+d.temp);
  const tMin = Math.min(...temps), tMax = Math.max(...temps);
  const mmMax = Math.max(...datos.map(d=>+d.mm||0), 1);
  const stepX = (W-pad*2)/(datos.length-1);
  const yBase = H-pad-barZone, yTop = pad;
  const yTemp = t => yBase - ((t-tMin)/((tMax-tMin)||1))*(yBase-yTop);
  const lastX = pad+(datos.length-1)*stepX;
  const pts = datos.map((d,i)=>`${(pad+i*stepX).toFixed(1)},${yTemp(+d.temp).toFixed(1)}`).join(' ');
  const areaPts = `${pad.toFixed(1)},${yBase.toFixed(1)} ${pts} ${lastX.toFixed(1)},${yBase.toFixed(1)}`;
  const bars = datos.map((d,i)=>{
    const mm = +d.mm||0; if(!mm) return '';
    const h = mm/mmMax*(barZone-4);
    return `<rect x="${(pad+i*stepX-3).toFixed(1)}" y="${(H-pad-h).toFixed(1)}" width="6" height="${h.toFixed(1)}" fill="var(--chart-2)" opacity="0.85" rx="2"/>`;
  }).join('');
  const dots = datos.map((d,i)=>`<circle cx="${(pad+i*stepX).toFixed(1)}" cy="${yTemp(+d.temp).toFixed(1)}" r="2.5" fill="var(--chart-3)"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:150px;display:block">
      <defs><linearGradient id="climaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--chart-3)" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="var(--chart-3)" stop-opacity="0.02"/>
      </linearGradient></defs>
      ${bars}
      <polygon points="${areaPts}" fill="url(#climaGrad)"/>
      <polyline points="${pts}" fill="none" stroke="var(--chart-3)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink3);margin-top:2px">
      <span>${fmt(datos[0].fecha)}</span>
      <span style="color:var(--chart-3);font-weight:600">— temp (${n1(tMin)}°–${n1(tMax)}°)</span>
      <span style="color:var(--chart-2);font-weight:600">▮ lluvia</span>
      <span>${fmt(datos[datos.length-1].fecha)}</span>
    </div>`;
};

// Donut multi-segmento (SVG, stroke-dasharray) — sin librerías
export const donutSVG = (segments, size=112, thickness=15, centerLabel='sistemas') => {
  const total = segments.reduce((s,x)=>s+x.value,0);
  const r = (size-thickness)/2, c = 2*Math.PI*r, cx=size/2, cy=size/2;
  const base = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--paper3)" stroke-width="${thickness}"/>`;
  if (!total) return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${base}</svg>`;
  let offset = 0;
  const arcs = segments.filter(s=>s.value>0).map(s=>{
    const dash = (s.value/total)*c;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}" stroke-dasharray="${dash.toFixed(1)} ${(c-dash).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dash;
    return el;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${base}${arcs}
    <text x="50%" y="47%" text-anchor="middle" font-family="var(--serif)" font-size="${size*0.24}" fill="var(--ink)">${total}</text>
    <text x="50%" y="65%" text-anchor="middle" font-family="var(--sans)" font-size="${size*0.09}" fill="var(--ink3)">${centerLabel}</text>
  </svg>`;
};

// Barras horizontales (SVG) — compara un valor por etiqueta
export const hbarSVG = (rows, max) => {
  const m = max || Math.max(1, ...rows.map(r=>r.value));
  return `<div style="display:flex;flex-direction:column;gap:10px">${rows.map(r=>`
    <div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink2);margin-bottom:3px"><span>${r.label}</span><b style="color:var(--ink)">${r.value}</b></div>
      <div style="height:9px;background:var(--paper3);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${Math.max(3,r.value/m*100)}%;background:${r.color};border-radius:5px"></div>
      </div>
    </div>`).join('')}</div>`;
};

// Anillo de porcentaje único (SVG, stroke-dasharray) — sin librerías
export const ringSVG = (pct, color, size=76, thickness=8) => {
  const r = (size-thickness)/2, c = 2*Math.PI*r, cx=size/2, cy=size/2;
  const p = pct==null ? 0 : Math.max(0, Math.min(100, pct));
  const dash = p/100*c;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--paper3)" stroke-width="${thickness}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${(c-dash).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="50%" y="53%" text-anchor="middle" font-family="var(--serif)" font-size="${size*0.24}" fill="var(--ink)">${pct==null?'—':Math.round(p)+'%'}</text>
  </svg>`;
};
