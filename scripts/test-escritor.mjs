// Prueba public/public/escritor.js con un SDK de Firestore falso en memoria.
// Correr: node scripts/test-escritor.mjs
import assert from 'node:assert/strict';
import { crearEscritor } from '../public/public/escritor.js';

let ok = 0;
const t = async (nombre, fn) => {
  try { await fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};

const usuario = { uid: 'u1', email: 'mavidiaz092@gmail.com', nombre: 'Maria Diaz' };
const ctx = { plantaNombre: id => 'Planta ' + id, sistemaLabel: id => 'Sistema ' + id };

const montar = (extra = {}) => {
  const store = new Map();
  const flags = { fallaHistorial: false, fallaGet: false, fallaTodo: false };
  let n = 0;
  const clave = r => r.col + '/' + r.id;
  const sdk = {
    collection: (_db, col) => ({ col, esColeccion: true }),
    doc: (a, col, id) => a.esColeccion ? { col: a.col, id: 'auto' + (++n) } : { col, id: String(id) },
    serverTimestamp: () => 'TS',
    getDoc: async ref => {
      if (flags.fallaGet) throw new Error('offline');
      const d = store.get(clave(ref));
      return { exists: () => d !== undefined, data: () => d && { ...d } };
    },
    writeBatch: () => {
      const ops = [];
      return {
        set: (ref, data) => ops.push(['set', ref, data]),
        delete: ref => ops.push(['delete', ref]),
        commit: async () => {
          if (flags.fallaTodo) throw new Error('sin red');
          if (flags.fallaHistorial && ops.some(o => o[1].col === 'historial')) throw new Error('rechazado');
          for (const [tipo, ref, data] of ops) tipo === 'set' ? store.set(clave(ref), data) : store.delete(clave(ref));
        }
      };
    }
  };
  let avisos = 0;
  const w = crearEscritor({
    db: {}, sdk, getUsuario: () => usuario, ctx, dry: false, habilitado: () => true,
    ahora: () => new Date('2026-10-21T10:00:00Z'), alFallarHistorial: () => { avisos++; }, ...extra
  });
  const entradas = () => [...store].filter(([k]) => k.startsWith('historial/')).map(([, v]) => v);
  return { w, store, flags, entradas, avisos: () => avisos };
};

await t('fbSave de un documento nuevo: doc con _by y entrada de alta', async () => {
  const m = montar();
  await m.w.fbSave('sistemas', 2, { id: 2, notas: '' });
  assert.equal(m.store.get('sistemas/2')._by.uid, 'u1');
  assert.equal(m.store.get('sistemas/2')._ts, 'TS');
  const [e] = m.entradas();
  assert.equal(e.accion, 'alta');
  assert.equal(e.docId, '2');
  assert.equal(e._ts, 'TS');
});
await t('fbSave de uno existente: entrada de edición con previo y campos', async () => {
  const m = montar();
  m.store.set('sistemas/2', { id: 2, notas: '', _ts: 'viejo' });
  await m.w.fbSave('sistemas', 2, { id: 2, notas: 'x' });
  const [e] = m.entradas();
  assert.equal(e.accion, 'edicion');
  assert.deepEqual(e.previo, { id: 2, notas: '' });
  assert.deepEqual(e.campos, ['notas']);
});
await t('fbSave sin cambios reales no crea entrada', async () => {
  const m = montar();
  m.store.set('sistemas/2', { id: 2, notas: 'x', _ts: 'viejo', _by: {} });
  await m.w.fbSave('sistemas', 2, { id: 2, notas: 'x' });
  assert.equal(m.entradas().length, 0);
  assert.equal(m.store.get('sistemas/2')._by.uid, 'u1');
});
await t('fbSave con sinHistorial no crea entrada (clima)', async () => {
  const m = montar();
  await m.w.fbSave('clima', 'c-1', { id: 'c-1', fecha: '2026-10-21' }, { sinHistorial: true });
  assert.equal(m.entradas().length, 0);
  assert.equal(m.store.get('clima/c-1')._by.uid, 'u1');
});
await t('fbDel de un existente guarda baja con previo completo', async () => {
  const m = montar();
  m.store.set('plantas/3', { id: 3, nombre: 'Limonero', _ts: 'viejo' });
  await m.w.fbDel('plantas', 3);
  assert.equal(m.store.has('plantas/3'), false);
  const [e] = m.entradas();
  assert.equal(e.accion, 'baja');
  assert.deepEqual(e.previo, { id: 3, nombre: 'Limonero' });
});
await t('fbDel de un inexistente no crea entrada', async () => {
  const m = montar();
  await m.w.fbDel('plantas', 99);
  assert.equal(m.entradas().length, 0);
});
await t('fbDel con el mismo grupo comparte grupo', async () => {
  const m = montar();
  m.store.set('plantas/3', { id: 3, nombre: 'L' });
  m.store.set('registroPlantas/r1', { planta: 3, tipo: 'Riego' });
  await m.w.fbDel('plantas', 3, { grupo: 'g1' });
  await m.w.fbDel('registroPlantas', 'r1', { grupo: 'g1' });
  assert.deepEqual(m.entradas().map(e => e.grupo), ['g1', 'g1']);
});
await t('fbAdd devuelve el id y la entrada lo lleva como docId', async () => {
  const m = montar();
  const id = await m.w.fbAdd('revolcadas', { sistema: 1, fecha: '2026-10-21', obs: '' });
  assert.ok(id);
  assert.equal(m.store.get('revolcadas/' + id)._by.uid, 'u1');
  assert.equal(m.entradas()[0].docId, id);
  assert.equal(m.entradas()[0].accion, 'alta');
});
await t('si falla el historial el documento igual se guarda y no lanza', async () => {
  const m = montar();
  m.flags.fallaHistorial = true;
  await m.w.fbSave('sistemas', 5, { id: 5 });
  assert.equal(m.store.has('sistemas/5'), true);
  assert.equal(m.entradas().length, 0);
  assert.equal(m.avisos(), 1);
});
await t('si falla todo no lanza y fbAdd devuelve null', async () => {
  const m = montar();
  m.flags.fallaTodo = true;
  await m.w.fbSave('sistemas', 5, { id: 5 });
  assert.equal(await m.w.fbAdd('revolcadas', { sistema: 1 }), null);
});
await t('si falla la lectura previa la entrada queda con previo null', async () => {
  const m = montar();
  m.flags.fallaGet = true;
  await m.w.fbSave('sistemas', 6, { id: 6 });
  assert.equal(m.entradas()[0].previo, null);
});
await t('dry no escribe nada', async () => {
  const m = montar({ dry: true });
  await m.w.fbSave('sistemas', 7, { id: 7 });
  assert.equal(m.store.size, 0);
});
await t('sin usuario no escribe nada', async () => {
  const m = montar({ getUsuario: () => null });
  await m.w.fbSave('sistemas', 7, { id: 7 });
  assert.equal(m.store.size, 0);
});
await t('restaurar una baja reescribe el doc y registra la restauración', async () => {
  const m = montar();
  m.store.set('plantas/3', { id: 3, nombre: 'Limonero', _by: { uid: 'otro' }, _ts: 'v' });
  await m.w.fbDel('plantas', 3);
  const baja = m.entradas()[0];
  assert.equal(await m.w.restaurar(baja, { confirmarPisar: async () => true }), true);
  assert.equal(m.store.get('plantas/3').nombre, 'Limonero');
  assert.equal(m.store.get('plantas/3')._by.uid, 'u1');
  assert.deepEqual(m.entradas().map(e => e.accion).sort(), ['baja', 'restauracion']);
});
await t('restaurar sobre un doc con otro valor pide confirmación y respeta el no', async () => {
  const m = montar();
  m.store.set('sistemas/1', { id: 1, notas: 'nuevo' });
  const e = { accion: 'edicion', col: 'sistemas', docId: '1', previo: { id: 1, notas: 'viejo' } };
  let preguntado = 0;
  assert.equal(await m.w.restaurar(e, { confirmarPisar: async () => { preguntado++; return false; } }), false);
  assert.equal(preguntado, 1);
  assert.equal(m.store.get('sistemas/1').notas, 'nuevo');
});
await t('restaurar sin previo devuelve false', async () => {
  const m = montar();
  assert.equal(await m.w.restaurar({ accion: 'baja', col: 'plantas', docId: '3', previo: null }), false);
});
console.log(`${ok} ok`);
await t('baja con lectura fallida no deja undefined en la entrada (Firestore lo rechaza)', async () => {
  const m = montar();
  m.flags.fallaGet = true;
  await m.w.fbDel('registroPlantas', 'r1');
  const [e] = m.entradas();
  assert.ok(e, 'se esperaba entrada');
  assert.equal(e.ref, null);
  assert.equal(e.previo, null);
});
console.log(`${ok} ok (adicionales)`);
