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

- **App (`public/public/`)**: una sola página sin build. `index.html` tiene la interfaz y las reglas de negocio; los módulos chicos son `preventivo.js` (calendario de fumigación), `turnos.js` (a quién le toca cada día), `escritor.js` e `historial.js` (autor de cada cambio, historial y restaurar) y `sw.js` (service worker).
- **Datos**: Firestore guarda sistemas, revolcadas, plantas, registro de plantas, pecera, registro de pecera, clima e historial. La app también guarda una copia en el navegador (`localStorage`, clave `compost_v7`) para funcionar sin conexión.
- **Google Sheet**: es el respaldo y donde se ven las fichas. La app le escribe vía el Web App de Apps Script (`doPost`); si el envío falla por falta de conexión queda en una cola local y se reintenta.
- **Apps Script (`codigo.gs`)**: se pega a mano en el editor de Apps Script. Corre los triggers diarios (clima, eventos de calendario, fichas de plantas, sincronización a Firestore) y expone el `doPost`.
- **Clima**: Open-Meteo (archive API), sin clave.

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
