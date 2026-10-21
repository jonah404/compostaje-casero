// Prueba public/firestore.rules contra el emulador. Correr: npm run test:reglas
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { CORREOS_AUTORIZADOS } from '../public/public/historial.js';

const rutaReglas = fileURLToPath(new URL('../public/firestore.rules', import.meta.url));
const reglas = fs.readFileSync(rutaReglas, 'utf8');
const env = await initializeTestEnvironment({ projectId: 'compostaje-casero', firestore: { rules: reglas } });

let ok = 0;
const t = async (nombre, fn) => {
  try { await fn(); ok++; console.log('  ok   ' + nombre); }
  catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
};
const yo = (uid, email, verificado = true) => env.authenticatedContext(uid, { email, email_verified: verificado }).firestore();
const jonah = () => yo('u-jonah', 'jonahlalvarez@gmail.com');
const sinSesion = () => env.unauthenticatedContext().firestore();

await t('sin sesión no lee', async () => { await assertFails(getDoc(doc(sinSesion(), 'sistemas/1'))); });
await t('cuenta no autorizada no lee ni escribe', async () => {
  const db = yo('u-x', 'otro@gmail.com');
  await assertFails(getDoc(doc(db, 'sistemas/1')));
  await assertFails(setDoc(doc(db, 'sistemas/1'), { id: 1, _by: { uid: 'u-x' } }));
});
await t('autorizada escribe con su _by', async () => {
  await assertSucceeds(setDoc(doc(jonah(), 'sistemas/1'), { id: 1, _by: { uid: 'u-jonah' } }));
  await assertSucceeds(getDoc(doc(jonah(), 'sistemas/1')));
});
await t('autorizada con _by ajeno o ausente falla', async () => {
  await assertFails(setDoc(doc(jonah(), 'sistemas/2'), { id: 2, _by: { uid: 'otro' } }));
  await assertFails(setDoc(doc(jonah(), 'sistemas/2'), { id: 2 }));
});
await t('autorizada borra un documento', async () => { await assertSucceeds(deleteDoc(doc(jonah(), 'sistemas/1'))); });
await t('historial: crear sí, editar y borrar no', async () => {
  await assertSucceeds(setDoc(doc(jonah(), 'historial/h1'), { by: { uid: 'u-jonah' }, resumen: 'x' }));
  await assertFails(setDoc(doc(jonah(), 'historial/h2'), { by: { uid: 'otro' }, resumen: 'x' }));
  await assertFails(updateDoc(doc(jonah(), 'historial/h1'), { resumen: 'y' }));
  await assertFails(deleteDoc(doc(jonah(), 'historial/h1')));
  await assertSucceeds(getDoc(doc(jonah(), 'historial/h1')));
});
await t('colección no listada denegada', async () => { await assertFails(setDoc(doc(jonah(), 'secreto/x'), { _by: { uid: 'u-jonah' } })); });
await t('correo autorizado sin verificar falla', async () => {
  await assertFails(getDoc(doc(yo('u-j2', 'jonahlalvarez@gmail.com', false), 'sistemas/1')));
});
await t('las reglas tienen los mismos correos que historial.js', async () => {
  for (const c of CORREOS_AUTORIZADOS) assert.ok(reglas.includes(c), 'falta ' + c);
  const todos = reglas.match(/[\w.+-]+@[\w.-]+/g) || [];
  assert.deepEqual([...new Set(todos)].sort(), [...CORREOS_AUTORIZADOS].sort());
});

await env.cleanup();
console.log(`${ok} ok`);
