// Respaldo y exportación de los datos de la app. Sin acceso a la app: recibe el estado `S`.

export const COLECCIONES = ['sistemas', 'revolcadas', 'plantas', 'registroPlantas', 'pecera', 'registroPecera', 'clima'];

const sinInternos = x => {
  if (Array.isArray(x)) return x.map(sinInternos);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, sinInternos(v)]));
  return x;
};

// JSON completo: todo lo que la app guarda, sin los campos internos (_pend, _by, etc.).
export const armarRespaldo = (S, usuario = '', ahora = new Date()) => ({
  app: 'Brote',
  version: 1,
  creado: ahora.toISOString(),
  usuario,
  datos: Object.fromEntries(COLECCIONES.map(c => [c, sinInternos(S[c] === undefined ? (c === 'pecera' ? {} : []) : S[c])])),
});

export const nombreRespaldo = (ahora = new Date(), extension = 'json', prefijo = 'brote-respaldo') => {
  const p = n => String(n).padStart(2, '0');
  return `${prefijo}-${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}.${extension}`;
};

// CSV para Excel en español: separador ";", comillas dobles y BOM para que respete los acentos.
export const aCSV = filas => '﻿' + filas.map(f => f.map(v => {
  const t = v == null ? '' : String(v);
  return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}).join(';')).join('\r\n') + '\r\n';

// Un solo listado con todo lo registrado (compost, plantas y pecera), de lo más nuevo a lo más viejo.
export const registrosParaExcel = S => {
  const planta = id => { const p = (S.plantas || []).find(x => x.id === id); return p ? (p.nombre || 'Planta ' + p.id) : 'Planta ' + id; };
  const sistema = id => { const s = (S.sistemas || []).find(x => x.id === id); return s ? (s.nombre ? `#${s.id} — ${s.nombre}` : 'Sistema ' + s.id) : 'Sistema ' + id; };
  const filas = [
    ...(S.revolcadas || []).map(r => ({ fecha: r.fecha, area: 'Compost', elemento: sistema(r.sistema), tipo: 'Revolcada', detalle: '', producto: '', resultado: r.obs || '' })),
    ...(S.registroPlantas || []).map(r => ({ fecha: r.fecha, area: 'Plantas', elemento: planta(r.planta), tipo: r.tipo, detalle: r.detalle || '', producto: r.producto || '', resultado: r.resultado || '' })),
    ...(S.registroPecera || []).map(r => ({ fecha: r.fecha, area: 'Pecera', elemento: 'Pecera', tipo: r.tipo, detalle: r.detalle || '', producto: '', resultado: r.resultado || '' })),
  ].sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);
  return aCSV([['Fecha', 'Área', 'Elemento', 'Tipo', 'Detalle', 'Producto', 'Resultado / observaciones'],
    ...filas.map(f => [f.fecha, f.area, f.elemento, f.tipo, f.detalle, f.producto, f.resultado])]);
};
