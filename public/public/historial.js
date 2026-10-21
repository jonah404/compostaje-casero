// Lógica pura del historial de cambios (sin DOM ni Firebase): la importan index.html
// y las pruebas de Node (scripts/test-historial.mjs).

// Debe coincidir con la lista de public/firestore.rules (scripts/test-reglas.mjs lo verifica).
// Acá solo sirve para la pantalla de acceso; el control real está en las reglas.
export const CORREOS_AUTORIZADOS = ['jonahlalvarez@gmail.com', 'mavidiaz092@gmail.com'];

export const esAutorizado = email =>
  !!email && CORREOS_AUTORIZADOS.includes(String(email).trim().toLowerCase());

export const nombreCorto = u => {
  const n = String((u && u.nombre) || '').trim();
  return n ? n.split(/\s+/)[0] : String((u && u.email) || '').split('@')[0];
};

const META = ['_ts', '_by', '_pend'];
const limpiar = o => {
  if (!o) return null;
  const r = { ...o };
  META.forEach(k => delete r[k]);
  return r;
};

export const refDe = (col, d) => {
  switch (col) {
    case 'sistemas':        return { tipo: 'sistema', id: d.id };
    case 'revolcadas':      return { tipo: 'sistema', id: d.sistema };
    case 'plantas':         return { tipo: 'planta', id: d.id };
    case 'registroPlantas': return { tipo: 'planta', id: d.planta };
    case 'pecera':
    case 'registroPecera':  return { tipo: 'pecera', id: 'main' };
    default:                return null;
  }
};

export const camposCambiados = (previo, nuevo) => {
  const p = limpiar(previo) || {}, n = limpiar(nuevo) || {};
  return Object.keys(n).filter(k => JSON.stringify(p[k]) !== JSON.stringify(n[k]));
};

const objeto = (col, d, ctx) => {
  switch (col) {
    case 'sistemas':        return ctx.sistemaLabel(d.id);
    case 'plantas':         return ctx.plantaNombre(d.id);
    case 'registroPlantas': return `un registro de «${d.tipo}» en ${ctx.plantaNombre(d.planta)}`;
    case 'revolcadas':      return `una revolcada de ${ctx.sistemaLabel(d.sistema)}`;
    case 'pecera':          return 'los datos de la pecera';
    case 'registroPecera':  return `un evento de pecera «${d.tipo}»`;
    default:                return `un dato de ${col}`;
  }
};

export const resumir = ({ accion, col, datos, previo, usuario }, ctx) => {
  const n = nombreCorto(usuario);
  const d = datos || previo || {};
  if (accion === 'alta' && col === 'registroPlantas') return `${n} registró «${d.tipo}» en ${ctx.plantaNombre(d.planta)}`;
  if (accion === 'alta' && col === 'registroPecera')  return `${n} registró «${d.tipo}» en la pecera`;
  const obj = objeto(col, d, ctx);
  if (accion === 'alta') return `${n} agregó ${obj}`;
  if (accion === 'baja') return `${n} eliminó ${obj}`;
  if (accion === 'restauracion') return `${n} restauró ${obj}`;
  const campos = camposCambiados(previo, datos);
  return `${n} editó ${obj}` + (campos.length ? ` (${campos.join(', ')})` : '');
};

export const armarEntrada = ({ accion, col, docId, datos, previo, usuario, grupo = null, ahora }, ctx) => ({
  accion, col, docId: String(docId),
  ref: refDe(col, datos || previo || {}),
  resumen: resumir({ accion, col, datos, previo, usuario }, ctx),
  previo: limpiar(previo),
  campos: accion === 'edicion' ? camposCambiados(previo, datos) : [],
  by: { uid: usuario.uid, email: usuario.email, nombre: usuario.nombre || '' },
  grupo,
  fechaLocal: ahora.toISOString()
});

export const agruparEntradas = entradas => {
  const grupos = [], porGrupo = new Map();
  for (const e of entradas) {
    if (!e.grupo) { grupos.push([e]); continue; }
    if (porGrupo.has(e.grupo)) porGrupo.get(e.grupo).push(e);
    else { const g = [e]; porGrupo.set(e.grupo, g); grupos.push(g); }
  }
  return grupos;
};

export const filtrarEntradas = (entradas, f = {}) => entradas.filter(e =>
  (!f.persona || (e.by && e.by.email === f.persona)) &&
  (!f.accion || e.accion === f.accion) &&
  (!f.ref || (e.ref && e.ref.tipo === f.ref.tipo && String(e.ref.id) === String(f.ref.id))));

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Clave con la que la vista pide restaurar un grupo (o una entrada suelta).
export const claveGrupo = g => g[0].grupo || `${g[0].col}/${g[0].docId}`;

export const htmlGrupo = (grupo, { puedeRestaurar }) => {
  const e = grupo[0];
  const fecha = new Date(e.fechaLocal).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const mas = grupo.length > 1 ? ` <span class="his-mas">y ${grupo.length - 1} registro(s) más</span>` : '';
  const restaurable = puedeRestaurar && grupo.some(x => (x.accion === 'baja' || x.accion === 'edicion') && x.previo);
  const boton = restaurable ? `<button class="btn his-rest" data-restaurar="${esc(claveGrupo(grupo))}">Restaurar</button>` : '';
  return `<div class="his-item"><div class="his-txt"><div>${esc(e.resumen)}${mas}</div><div class="his-fecha">${esc(fecha)}</div></div>${boton}</div>`;
};
