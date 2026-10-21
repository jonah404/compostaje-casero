// Escrituras a Firestore con autor (_by) e historial de cambios. El SDK de Firestore se
// inyecta (deps.sdk) para poder probarlo en Node con un falso (scripts/test-escritor.mjs).
import { armarEntrada, camposCambiados } from './historial.js';

const sinPend = d => { const r = { ...d }; delete r._pend; return r; };

export const crearEscritor = ({ db, sdk, getUsuario, ctx, dry, habilitado, ahora = () => new Date(), alFallarHistorial = () => {} }) => {
  const { doc, collection, getDoc, writeBatch, serverTimestamp } = sdk;

  // Solo escribe con una sesión válida; en ?dry=1 solo loguea (lo decide cada función).
  const usuarioOk = () => (habilitado() ? getUsuario() : null);
  const autor = u => ({ uid: u.uid, email: u.email, nombre: u.nombre || '' });

  // { leido, existe, datos }: si la lectura falla (sin conexión) no se sabe cómo estaba.
  const leerPrevio = async ref => {
    try { const s = await getDoc(ref); return { leido: true, existe: s.exists(), datos: s.exists() ? s.data() : null }; }
    catch (e) { return { leido: false, existe: false, datos: null }; }
  };

  // Documento (set o delete) + entrada de historial en un batch. Si el batch falla se reintenta
  // solo el documento principal: el historial nunca puede bloquear ni perder la acción.
  const confirmar = async (op, ref, entrada) => {
    const aplicar = (b, conEntrada) => {
      op(b);
      if (conEntrada) b.set(doc(collection(db, 'historial')), { ...entrada, _ts: serverTimestamp() });
    };
    try { const b = writeBatch(db); aplicar(b, !!entrada); await b.commit(); return true; }
    catch (e) {
      if (entrada) alFallarHistorial();
      try { const b = writeBatch(db); aplicar(b, false); await b.commit(); return true; }
      catch (e2) { return false; }
    }
  };

  const guardar = async (col, ref, data, opts, esAlta) => {
    const u = usuarioOk(); if (!u) return null;
    const previo = esAlta ? { leido: true, existe: false, datos: null } : await leerPrevio(ref);
    const sinCambios = previo.existe && camposCambiados(previo.datos, data).length === 0;
    let entrada = null;
    if (!opts.sinHistorial && !sinCambios) {
      entrada = armarEntrada({
        accion: previo.leido && !previo.existe ? 'alta' : 'edicion', col, docId: ref.id,
        datos: data, previo: previo.datos, usuario: u, grupo: opts.grupo || null, ahora: ahora()
      }, ctx);
    }
    const payload = { ...sinPend(data), _by: autor(u), _ts: serverTimestamp() };
    return confirmar(b => b.set(ref, payload), ref, entrada);
  };

  const fbSave = async (col, id, data, opts = {}) => {
    if (dry) { console.info('[dry] fbSave', col, id); return; }
    try { await guardar(col, doc(db, col, String(id)), data, opts, false); } catch (e) {}
  };

  const fbAdd = async (col, data, opts = {}) => {
    if (dry) { console.info('[dry] fbAdd', col, data); return null; }
    try {
      const ref = doc(collection(db, col));
      return (await guardar(col, ref, data, opts, true)) ? ref.id : null;
    } catch (e) { return null; }
  };

  const fbDel = async (col, id, opts = {}) => {
    if (dry) { console.info('[dry] fbDel', col, id); return; }
    try {
      const u = usuarioOk(); if (!u) return;
      const ref = doc(db, col, String(id));
      const previo = await leerPrevio(ref);
      let entrada = null;
      if (!opts.sinHistorial && !(previo.leido && !previo.existe)) {
        entrada = armarEntrada({
          accion: 'baja', col, docId: ref.id, datos: undefined, previo: previo.datos || { id }, usuario: u,
          grupo: opts.grupo || null, ahora: ahora()
        }, ctx);
        if (!previo.datos) entrada.previo = null; // lectura fallida: no hay copia que restaurar
      }
      await confirmar(b => b.delete(ref), ref, entrada);
    } catch (e) {}
  };

  // Vuelve a escribir entrada.previo en entrada.docId; confirmarPisar se consulta solo si hoy
  // el documento existe con otro valor.
  const restaurar = async (entrada, { confirmarPisar = async () => true } = {}) => {
    try {
      const u = usuarioOk();
      if (!u || !entrada || !entrada.previo) return false;
      const ref = doc(db, entrada.col, entrada.docId);
      const actual = await leerPrevio(ref);
      if (actual.existe && camposCambiados(actual.datos, entrada.previo).length && !(await confirmarPisar())) return false;
      const reg = armarEntrada({
        accion: 'restauracion', col: entrada.col, docId: entrada.docId, datos: entrada.previo,
        previo: actual.datos, usuario: u, grupo: entrada.grupo || null, ahora: ahora()
      }, ctx);
      return await confirmar(b => b.set(ref, { ...sinPend(entrada.previo), _by: autor(u), _ts: serverTimestamp() }), ref, reg);
    } catch (e) { return false; }
  };

  return { fbSave, fbAdd, fbDel, restaurar };
};
