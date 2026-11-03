# Brote

App para dos personas (Jonah y Viky) que lleva el compost, las plantas (frutales de exterior y plantas de interior), la pecera y el clima, con tareas del día y un calendario preventivo de fumigación. Se publica en https://brote.web.app (la URL vieja, `compostaje-casero.web.app`, redirige).

## Cómo está armado

```
Celular / navegador (PWA)          Firestore                 Google Sheet + Apps Script
public/public/index.html  ───────► colecciones (fuente  ◄──── sync diario ~07:30
  + escritor.js (autor + historial)  de verdad de la app)      (codigo.gs: triggers, calendario,
  + sw.js (offline)                                             alertas, fichas, pecera)
        │                                                              ▲
        └── POST con token de Firebase ────────────────────────────────┘
            (doPost: solo acepta las cuentas autorizadas)
```

- **App (`public/public/`)**: sin build, solo archivos estáticos.
  - `index.html` es solo el HTML (marcado y pantallas), `styles.css` los estilos y `app.js` la interfaz y el estado (`S`, que se guarda en el navegador y se sincroniza).
  - La lógica va en módulos sin acceso a la app, todos con tests: `plantas.js` (riego, fertilización, plagas y poda), `tareas.js` (tareas de hoy, urgencias y pecera), `compost.js`, `preventivo.js` (calendario de fumigación), `turnos.js`, `fitosanitario.js` (fichas de plagas), `analisis.js` (clima), `clima-graficos.js` (períodos, resumen y gráficos del clima), `heatmap.js`, `graficos.js`, `util.js` y `semillas.js` (datos iniciales).
  - `escritor.js` e `historial.js` guardan el autor de cada cambio, el historial y "restaurar". `sw.js` es el service worker (sin conexión).
- **Datos**: Firestore guarda sistemas, revolcadas, plantas, registro de plantas, pecera, registro de pecera, clima e historial. La app también guarda una copia en el navegador (`localStorage`, clave `compost_v7`) para funcionar sin conexión.
- **Google Sheet**: es el respaldo y donde se ven las fichas. La app le escribe vía el Web App de Apps Script (`doPost`); si el envío falla por falta de conexión queda en una cola local y se reintenta.
- **Apps Script (`codigo.gs`)**: se pega a mano en el editor de Apps Script. Corre los triggers diarios (clima, eventos de calendario, fichas de plantas, sincronización a Firestore) y expone el `doPost`.
- **Clima**: Open-Meteo (archive API), sin clave.

## Respaldos

- **Automático**: `respaldarFirestoreEnDrive()` (Apps Script) guarda cada noche, ~03:15, un JSON con todas las colecciones de Firestore en la carpeta "Brote respaldos" de Drive, y conserva los últimos 30. Hay que darle el permiso `https://www.googleapis.com/auth/drive` en `appsscript.json` y correr `agregarTriggerRespaldo()` una vez (los pasos están en el encabezado de la función).
- **Manual**: en la app, Historial → "Respaldo completo (JSON)" o "Registros para Excel (CSV)".
- **Restaurar**: no hay botón. Los JSON se pueden volver a cargar en Firestore a mano; el historial de la app permite deshacer cambios puntuales.

## Seguridad

- Login con Google. Solo entran `jonahlalvarez@gmail.com` y `mavidiaz092@gmail.com`.
- Las reglas de Firestore (`public/firestore.rules`) son el control real. Cada alta o edición declara su autor en `_by`, y `historial` solo se puede crear.
- El `doPost` valida el ID token de Firebase con `accounts:lookup` y escribe en la Sheet el correo que sale del token, no el que diga el cliente.
- **Si cambia la lista de cuentas hay que actualizarla en tres lugares**: `firestore.rules`, `CORREOS_AUTORIZADOS` en `public/public/historial.js` y `CORREOS_AUTORIZADOS_` en `codigo.gs`.

## Plantas

- Los frutales de exterior (limón, mandarina, ciruela y durazno) llevan riego (con lluvia), helada, fertilización, plagas, poda y fumigación preventiva.
- Las plantas de interior llevan fertilización, plagas y poda, **sin riego**.
- Los perfiles por especie viven en la hoja "Especies" de la Sheet y se repiten en la constante `ESPECIES` de `index.html`. Si se edita uno, actualizar el otro.
- Los umbrales (riego, helada, pecera) están repetidos entre `index.html` y `codigo.gs`; mantenerlos iguales.

## Trabajar en el proyecto

```bash
npm run test:rapido     # sintaxis de la app + pruebas (no necesita instalar nada)
npm install && npm run test:reglas   # reglas de Firestore, con el emulador
```

GitHub corre `test:rapido` en cada push (`.github/workflows/tests.yml`).

**Desplegar la app**

```bash
cd public && firebase deploy --only hosting
```

Antes de desplegar un cambio que toque archivos servidos con caché primero (manifest, íconos, `sw.js`), subir el número de `CACHE` en `public/public/sw.js` (hoy `brote-vN`).

**Actualizar Apps Script**: pegar `codigo.gs` en el editor y publicar una versión nueva del Web App (Implementar → Administrar implementaciones → editar → Nueva versión) para que la URL no cambie. Si el cambio toca el login o la autorización, desplegar primero la app y después el script.

Más detalle del login y el historial en `docs/login-historial-despliegue.md`. Los planes y diseños ya ejecutados están en `docs/superpowers/`.
