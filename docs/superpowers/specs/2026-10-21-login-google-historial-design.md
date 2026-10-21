# Login con Google e historial de cambios — diseño

## Intención
La app (tracker de compost, plantas, pecera y clima, un solo `public/public/index.html` con Firebase/Firestore y espejo a Google Sheet vía Apps Script) la usan dos personas: Jonah y su esposa. Hoy no hay login y Firestore está abierto a cualquiera (`allow read, write: if true`). Se quiere:
1. Entrar con Google, solo las dos cuentas autorizadas.
2. Que cada cambio quede registrado con quién lo hizo, y poder leer ese historial.

## Objetivos
- Pantalla "Entrar con Google"; sesión persistente en cada dispositivo.
- Acceso solo para `jonahlalvarez@gmail.com` y `mavidiaz092@gmail.com`; cualquier otra cuenta ve "sin acceso" y no puede leer ni escribir.
- Reglas de Firestore que exigen sesión y pertenencia a esa lista (la lista vive en las reglas, no solo en la app). Cierra el hueco actual.
- Cada documento escrito guarda autor (`_by`: uid, email, nombre) además del `_ts` existente.
- Colección `historial`: una entrada por alta, edición y borrado, con fecha, usuario, colección, id de documento, acción, resumen legible en español ("Fulano regó Limonero") y, en edición/borrado, el valor anterior (para poder recuperar).
- Vista de Historial en la app: lista cronológica inversa, filtros por persona, tipo de acción y planta/sistema.
- Las reglas impiden editar o borrar entradas de `historial` (solo crear) y exigen que el autor declarado sea el usuario logueado.
- La Google Sheet suma una columna con el correo de quien cargó cada fila nueva.

## No-objetivos
- API de plantas / fichas de cuidado (proyecto posterior, separado).
- Historial a prueba de manipulación deliberada (requeriría Cloud Functions / plan Blaze). Con dos usuarios de confianza basta un registro honesto.
- Validar tokens en el Apps Script: la Sheet es un espejo, el control real está en Firestore.
- Roles o permisos distintos entre los dos usuarios: ambos pueden todo.
- Retroactividad: los datos existentes no reciben autor.

## Anti-objetivos (sería un fracaso aunque "funcione")
- Que la app deje de funcionar offline o con mala señal tal como funciona hoy (cola local `_pend`, modo local si falla Firestore).
- Que el login sea solo cosmético y la base siga abierta.
- Que un fallo al escribir el historial rompa o bloquee la acción principal del usuario.
- Perder la posibilidad de recuperar algo borrado.

## Restricciones
- Se mantiene la arquitectura: un solo HTML, Firebase JS SDK 10.12 por CDN, sin build, hosting en Firebase (`public/firebase.json`, proyecto `compostaje-casero`).
- Todas las escrituras a Firestore pasan por `fbSave`, `fbAdd`, `fbDel` (`index.html` ~l.889): es el punto único donde agregar autor e historial. Hay también `sheetSync` (~l.937) para la Sheet.
- Hay service worker (`sw.js`) y es PWA: el login debe convivir con ambos y con el flag `DRY`.
- Habilitar el proveedor Google y agregar el dominio autorizado en la consola de Firebase es un paso manual de Jonah; el despliegue de reglas también (`firebase deploy --only firestore:rules`).
- Datos anteriores al login se muestran en el historial como "anterior al login" cuando no tienen `_by`.

## Decisiones ya tomadas (por Jonah)
- Dos usuarios, correos arriba, ambos con los mismos permisos.
- Se registra todo (altas, ediciones, borrados) con autor y fecha, legible en la app.

## Decisiones mías (a validar al leer)
- Lista de correos en las reglas de Firestore.
- Historial inmutable desde la app (crear sí; editar/borrar no).
- Borrados guardan copia del documento en `historial`.
- Datos viejos sin autor.
- Sheet: columna extra con el correo, sin validar token.

## A criterio del constructor
- Estructura exacta de las entradas de `historial` y el texto del resumen por tipo de evento.
- Dónde vive la vista de Historial en la navegación (hoy hay 4 pestañas: Hoy, Compost, Plantas, Clima, en escritorio y móvil).
- Cómo se hace el flujo de login (popup vs redirect, lo que mejor ande en PWA móvil) y la pantalla de "sin acceso".
- Cómo agrupar ediciones masivas o repetidas para no llenar el historial de ruido.
- Estrategia de pruebas y despliegue de reglas.

## Resultado de la revisión del constructor (decisiones mías, a validar)
- **Apps Script → Firestore:** los scripts de backfill/sincronización (`appscript_backfill_*.txt`, `sincronizarPlantasAFirestore`) escriben por REST de Firestore **sin credenciales**, apoyándose en las reglas abiertas. Al cerrar las reglas se rompen. Decisión: autenticarlos con `ScriptApp.getOAuthToken()` (scope `datastore`), usando la cuenta dueña del script, que tiene permisos de proyecto y no pasa por las reglas. Hay que agregar el scope al manifiesto del script y volver a autorizarlo.
- **Escrituras sin conexión:** al encolar con `_pend` se guarda también `_by` y la hora local; al sincronizar se usa ese autor, no el de la sesión vigente. La entrada de `historial` se escribe en el mismo `writeBatch` que el documento principal. Si falla, la acción principal igual se completa (el historial se reintenta, nunca bloquea). Con sesión ya iniciada, la app abre sin conexión.
- **Orden de despliegue:** primero el cliente nuevo (con login, `sw.js` sube de `v5` a `v6` para reemplazar copias en caché), después las reglas nuevas. Hasta desplegar las reglas la base sigue abierta; es una ventana corta.
- **Qué se guarda como "valor anterior":** el documento completo, sin diferencias ni retención; el volumen de dos usuarios es chico.
- **Filtro planta/sistema:** cada entrada guarda `ref` ({tipo, id}) con un mapeo por colección (sistemas, revolcadas, plantas, registroPlantas, pecera, registroPecera, clima).
- Las reglas cubren todas las colecciones actuales; cualquier colección nueva queda denegada por defecto.

## Decisión de Jonah sobre restaurar
- El historial incluye un botón **Restaurar** en las entradas de borrado y de edición: vuelve a escribir el valor anterior guardado. La restauración es una escritura más, con su propio autor y su propia entrada en `historial` (acción "restauración"). Si el documento ya existe con otro valor, se pide confirmación antes de pisarlo.
