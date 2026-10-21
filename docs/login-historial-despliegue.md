# Despliegue: login con Google e historial

Pasos en este orden. Los marcados **(Jonah)** se hacen en consolas externas con tu cuenta; el resto ya está en el código de la rama `feat/login-historial`.

Hasta el paso 5 la base de datos sigue abierta como hoy, así que si algo falla en el medio no se pierde acceso.

## 1. Habilitar Google como método de acceso (Jonah)
Consola de Firebase → proyecto `compostaje-casero` → Authentication → Sign-in method → Google → Habilitar (correo de soporte: el tuyo). Los dominios `*.web.app` y `*.firebaseapp.com` ya vienen autorizados.

## 2. Subir la app nueva primero (Jonah)
```bash
cd public && firebase deploy --only hosting
```
Abrir la app y probar:
1. Entrar con `jonahlalvarez@gmail.com`: debe abrir la app y mostrar tu nombre abajo a la izquierda (en el celular, los íconos de la barra de arriba).
2. Guardar un cambio (por ejemplo una revolcada) y abrir **Historial**: debe aparecer con tu nombre.
3. Borrar algo de prueba y tocar **Restaurar**: debe volver, y quedar una entrada "restauró…".
4. Repetir el ingreso con `mavidiaz092@gmail.com` (en su celular).
5. Entrar con una tercera cuenta cualquiera: debe mostrar "Sin acceso" y no ver ningún dato.
6. **Probar el ingreso desde la app instalada (PWA) en cada celular**, no solo desde el navegador: es el caso más delicado en iOS. Nota: `authDomain` queda en `compostaje-casero.firebaseapp.com`; ponerlo en `.web.app` da `redirect_uri_mismatch` salvo que se agregue `https://compostaje-casero.web.app/__/auth/handler` a las URIs de redireccionamiento autorizadas del cliente web en Google Cloud → Credenciales. Después, con sesión iniciada, poner el celular en modo avión y abrir la app: debe abrir igual.

Las copias viejas instaladas como app se reemplazan solas: el service worker pasó a `compost-tracker-v6`.

## 3. Autorizar el Apps Script a escribir en Firestore (Jonah)
Cuando las reglas se cierren, los scripts que escriben en Firestore (`sincronizarPlantasAFirestore`, `sincronizarSistemasAFirestore`, `sincronizarRevolcadasAFirestore`, `sincronizarClimaAFirestore` y los backfills) dejan de funcionar sin credenciales. El código ya los hace llamar con el token de la cuenta que ejecuta el script, pero hay que:
1. Pegar el `codigo.gs` actualizado (y los `appscript_backfill_*.txt` si los usás) en el proyecto de Apps Script.
2. Configuración del proyecto → marcar "Mostrar el archivo de manifiesto appsscript.json" y agregar a `oauthScopes` (conservando los que ya tenga):
   ```json
   "oauthScopes": [
     "https://www.googleapis.com/auth/datastore"
   ]
   ```
   Importante: si el manifiesto no tenía `oauthScopes`, agregar también los scopes que el script ya usa (hojas, calendario, conexión externa, etc.) o se perderán. Apps Script los detecta solos cuando el campo no existe.
3. **Proyecto de Google Cloud del script:** Configuración del proyecto → "Proyecto de Google Cloud Platform (GCP)" → Cambiar proyecto → poner el número del proyecto `compostaje-casero` (Consola de Google Cloud → Información del proyecto). Hace falta tener configurada la pantalla de consentimiento OAuth en ese proyecto. Sin este paso, Google rechaza las llamadas con "Cloud Firestore API has not been used in project…". Si no querés cambiar el proyecto del script, la alternativa es una cuenta de servicio (avisame y lo armamos).
4. La cuenta dueña del script necesita un rol de Firestore en el proyecto de Firebase (Consola de Google Cloud → IAM → "Cloud Datastore User" o "Editor" para esa cuenta). Si es `jonahlalvarez@gmail.com` y es propietaria del proyecto, ya lo tiene.
5. Ejecutar una función cualquiera desde el editor para aceptar los permisos nuevos.
6. **Columnas nuevas en la Sheet:** el script ahora escribe el correo de quien cargó en estas columnas. Antes de publicar, confirmar que estén libres (hoy no deberían tener nada):
   - Registro Revolcadas: **F** · Sistemas: **K** (encabezado en la fila 2) · Registro Plantas: **K** · Plantas: **U** ("Editado por") · Pecera: **D** (fila 2) · Registro Pecera: **E**.
7. Implementar → Administrar implementaciones → editar la implementación existente → nueva versión (la URL de `SHEET_SYNC_URL` no cambia).
8. Todavía con las reglas abiertas, ejecutar `sincronizarPlantasAFirestore()` y verificar en la consola de Firestore que sigue escribiendo.

## 4. Verificar el historial
En Firestore debe existir la colección `historial` con las entradas de las pruebas del paso 2.

## 5. Cerrar la base (Jonah)
```bash
cd public && firebase deploy --only firestore:rules
```
Repetir: guardar un cambio desde la app, ejecutar `sincronizarPlantasAFirestore()`, y comprobar que sigue todo funcionando. Una lectura sin sesión desde otra pestaña (o el script de prueba con la API REST sin token) debe dar `PERMISSION_DENIED`.

## Si algo crítico falla después del paso 5
Volver a la regla abierta (solo como medida temporal): en `public/firestore.rules` reemplazar el contenido por `match /{document=**} { allow read, write: if true; }` y repetir el deploy de reglas. Después revisar qué falló.

## Para agregar o quitar a alguien
Editar la lista de correos en **dos lugares** y volver a desplegar: `public/firestore.rules` (función `autorizado`) y `CORREOS_AUTORIZADOS` en `public/public/historial.js`. `npm run test:reglas` falla si no coinciden.

## Qué no queda registrado
- Los datos que ya existían antes del login no tienen autor.
- El clima descargado automáticamente de Open-Meteo no genera entradas de historial (lo escribe la app sola, no una persona).
- Un usuario autorizado con conocimientos técnicos podría falsificar el historial desde la consola del navegador; para dos usuarios de confianza se considera suficiente.
