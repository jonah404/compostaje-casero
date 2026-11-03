// Formato y fechas. Sin acceso a la app.
export const fISO  = d => d instanceof Date ? d.toISOString().split('T')[0] : (d||'');
export const pISO  = s => s ? new Date(s+'T00:00:00') : null;
export const fmt   = s => { if(!s) return '—'; const d=pISO(s); return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'}); };
export const dd    = (a,b) => Math.round((b-a)/(1000*60*60*24));
export const n1    = v => (v!=null&&v!==''&&!isNaN(+v)) ? (+v).toFixed(1) : '—';
export const n0    = v => (v!=null&&v!==''&&!isNaN(+v)) ? Math.round(+v)  : '—';

// Todo texto cargado por el usuario (nombres, notas, observaciones) se escapa antes de meterlo en innerHTML.
export const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
