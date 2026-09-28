# Monitoreo fitosanitario de frutales/cítricos + fix de sistemas fantasma

Fecha: 2026-09-28
Repo: compostaje-casero

## 1. Contexto y objetivo

Las 4 plantas leñosas ya registradas en la app (`S.plantas`, ids 1-4: Mandarina
Criolla, Limonero 4 Estaciones, Ciruela Reina Claudia, Durazno amarillo) hoy
comparten una revisión de plagas genérica cada 30 días
(`CFG_PLA.diasPlagas` / `CFG_PLANTAS.diasRevisionPlagas`), sin distinción por
especie ni por época del año, y sin ninguna guía de qué mirar, cuándo
preocuparse, ni qué producto/dosis aplicar.

El objetivo es llevar el manejo fitosanitario de estas 4 plantas al mismo
nivel de detalle que ya tiene el riego/fertilización (perfil por especie,
CFG_PLA/ESPECIES) y que tiene la Pecera (guía de dosis embebida): monitoreo
con frecuencia variable según época del año, una ficha de referencia por
planta (problemas a vigilar + producto/dosis genérico), y que el registro de
hallazgos siga alimentando el calendario igual que hoy hace todo lo demás.

Se resuelve además, en el mismo lote de trabajo, un bug no relacionado: los
"sistemas de compostaje" fantasma (4 al 10) que siguen apareciendo en la
pantalla Sistemas aunque estén vacíos.

## 2. Fuente y limitación importante

El contenido de las 4 fichas (problemas a vigilar, qué monitorear, momento
crítico, calendario de vigilancia por mes) viene del texto que preparó el
usuario, basado en criterios de manejo del **INTA San Pedro**. Ese texto es
deliberadamente sobre *monitorear antes de tratar* — no da nombres de
producto ni dosis.

El producto/dosis por problema que se agrega en este trabajo es **guía
agronómica genérica de uso común en huerta familiar** (mismo criterio ya
usado en `CHULETA_PLAGAS` de `codigo.gs` para plantas de interior: jabón
potásico, aceite mineral, alcohol isopropílico, fungicida cúprico, etc.), no
una dosis de etiqueta de un producto específico. Cada entrada lleva la misma
leyenda que ya usa la guía de dosis de la Pecera: confirmar contra el envase
del producto que se tenga a mano. Para plagas persistentes o graves, la
recomendación de INTA de diagnóstico dirigido antes de tratar sigue vigente
y se deja explícita en la ficha.

## 3. Datos — bloque `FITOSANITARIO`

Estructura nueva, hardcodeada en `index.html` (mismo patrón que `ESPECIES`,
que también es un espejo hardcodeado de una hoja de cálculo — ver comentario
en `index.html:859-867`). Clave de búsqueda: por **nombre de planta**
(substring, case-insensitive), igual criterio que `perfilEspecie()`, para no
depender de que los ids numéricos coincidan siempre entre Sheet/Firestore/app.

```js
// Nivel de vigilancia → días entre revisiones
const NIVEL_DIAS = { '🟢':14, '🟠':7, '🔴':5, '🔴🔴':3 };

// Problemas comunes a los dos cítricos (mandarina y limón) — evita repetir
// las mismas 5 entradas dos veces; cada ficha las combina con las suyas propias.
const PROBLEMAS_CITRICOS_COMUN = [
  { nombre:'Minador de los cítricos', sintoma:'Galerías serpenteantes en hojas nuevas; la hoja puede deformarse',
    producto:'Sin tratamiento de rutina', dosis:'Retirar hojas muy afectadas. Si son pocas hojas no amerita tratar todo el árbol — evaluar solo si avanza sobre gran parte de la brotación nueva.' },
  { nombre:'Pulgones', sintoma:'Colonias en brotes tiernos; hojas enrolladas',
    producto:'Jabón potásico', dosis:'5-10ml/L de agua, rociar brotes y envés de hojas. Repetir a los 7 días si persiste.' },
  { nombre:'Cochinillas', sintoma:'Bultitos adheridos a hojas/ramitas, a veces con melaza',
    producto:'Alcohol isopropílico (focos chicos) o aceite mineral/agropecuario (infestación mayor)',
    dosis:'Alcohol: algodón directo sobre cada cochinilla, repetir cada 4-5 días, 2-3 veces. Aceite: 1-2% según etiqueta.' },
  { nombre:'Ácaros', sintoma:'Punteado amarillento/bronceado, pérdida de aspecto saludable',
    producto:'Aceite de neem', dosis:'Según etiqueta, repetir a los 7-10 días. Mejorar aireación de la copa.' },
  { nombre:'Cancrosis', sintoma:'Lesiones/costras en hojas y brotes',
    producto:'Fungicida cúprico (oxicloruro de cobre)', dosis:'Según etiqueta, aplicar durante la brotación tierna cada 15-20 días mientras dure el brote. Desinfectar herramientas de poda entre plantas.' },
];

const FITOSANITARIO = [
  {
    match: 'mandarina',
    problemas: [
      ...PROBLEMAS_CITRICOS_COMUN,
      { nombre:'Hormigas', sintoma:'Frecuentemente acompañan ataques de pulgones o cochinillas',
        producto:'Cebo granulado para hormigas', dosis:'Colocar cerca del hormiguero/tronco, no rociar insecticida directo sobre la planta.' },
    ],
    monitoreo:'Revisar 5-10 hojas nuevas por semana, con énfasis en el envés, brotes tiernos y presencia de hormigas.',
    momentoCritico:'Cada nueva brotación, especialmente primavera y los nuevos crecimientos de verano.',
    calendarioVigilancia: {9:'🟢',10:'🟠',11:'🟠',12:'🟠',1:'🟠',2:'🟢',3:'🟢',4:'🟢'}, // resto del año (5-8) default 🟢
  },
  {
    match: 'limon',
    problemas: [
      ...PROBLEMAS_CITRICOS_COMUN,
      { nombre:'Manchas foliares', sintoma:'Manchas que aumentan con humedad',
        producto:'Fungicida cúprico', dosis:'Según etiqueta si las manchas aumentan con humedad. Mejorar ventilación de la copa.' },
    ],
    monitoreo:'Una revisión semanal, con atención a las hojas nuevas (el cítrico puede brotar aunque no tenga fruta).',
    momentoCritico:'Brotación — puede darse aunque el árbol no tenga fruta todavía.',
    calendarioVigilancia: {9:'🟢',10:'🟠',11:'🟠',12:'🟠',1:'🟠',2:'🟠',3:'🟠',4:'🟠'},
  },
  {
    match: 'durazno',
    problemas: [
      { nombre:'Torque', sintoma:'Hojas engrosadas, deformadas, rojizas',
        producto:'Fungicida cúprico o a base de azufre', dosis:'Preventivo, aplicar en la brotación de yemas — difícil de curar una vez instalada. Si aparece, anotar para repetir el preventivo el año próximo.' },
      { nombre:'Cribado / tiro de munición', sintoma:'Manchas pequeñas que terminan dejando agujeros',
        producto:'Fungicida cúprico', dosis:'Según etiqueta, aplicar tras lluvias prolongadas en primavera.' },
      { nombre:'Bacteriosis', sintoma:'Manchas en hojas/frutos y lesiones en ramas',
        producto:'Fungicida/bactericida cúprico', dosis:'Según etiqueta. Retirar y destruir partes muy afectadas (no compostar).' },
      { nombre:'Podredumbre morena', sintoma:'Frutos con manchas marrones que se deterioran rápido',
        producto:'Retiro inmediato + fungicida (captan o azufre) si se repite',
        dosis:'Retirar y destruir INMEDIATAMENTE frutos/flores afectados, no dejarlos bajo el árbol ni compostarlos. Tratamiento químico solo si es recurrente.' },
      { nombre:'Pulgones', sintoma:'Brotes deformados y hojas enrolladas', producto:'Jabón potásico', dosis:'5-10ml/L, rociar brotes y envés. Repetir a los 7 días si persiste.' },
      { nombre:'Gusano del brote', sintoma:'Brotes dañados o secos', producto:'Evaluación específica', dosis:'Si hay varios brotes afectados, identificar antes de tratar — no es de rutina.' },
      { nombre:'Mosca de los frutos', sintoma:'Daño dentro del fruto; caída prematura',
        producto:'Trampas con atrayente (proteína hidrolizada o feromona)', dosis:'Colocar desde que el fruto es pequeño. Recolectar y destruir frutos caídos de inmediato.' },
      { nombre:'Ácaros', sintoma:'Punteado y pérdida de vigor del follaje', producto:'Aceite de neem', dosis:'Según etiqueta, repetir a los 7-10 días.' },
    ],
    monitoreo:'2 controles semanales (fruto en crecimiento): hojas nuevas, frutos, puntas de ramas, lesiones en ramas, frutos caídos. Retirar de inmediato cualquier fruto que caiga enfermo o empiece a pudrirse — no dejarlo bajo el árbol.',
    momentoCritico:'Fruto pequeño → crecimiento → maduración. Monitoreo bastante más frecuente que el de los cítricos durante toda esta etapa.',
    calendarioVigilancia: {9:'🔴🔴',10:'🔴🔴',11:'🔴',12:'🔴',1:'🔴',2:'🟠',3:'🟢',4:'🟢'},
  },
  {
    match: 'ciruela',
    problemas: [
      { nombre:'Pulgones', sintoma:'Colonias en brotes y hojas jóvenes', producto:'Jabón potásico', dosis:'5-10ml/L. Si es una colonia chica y localizada, tratar solo esa zona y seguir observando antes de un tratamiento general.' },
      { nombre:'Cochinillas', sintoma:'Escamas/bultitos sobre ramas', producto:'Alcohol isopropílico (foco chico) o aceite mineral', dosis:'Igual criterio que mandarina/durazno.' },
      { nombre:'Cribado', sintoma:'Manchas en hojas que terminan perforándose', producto:'Fungicida cúprico', dosis:'Según etiqueta, tras lluvias prolongadas.' },
      { nombre:'Bacteriosis', sintoma:'Manchas oscuras en hojas/frutos', producto:'Fungicida/bactericida cúprico', dosis:'Según etiqueta.' },
      { nombre:'Podredumbre morena', sintoma:'Frutos que se manchan y deterioran', producto:'Retiro inmediato', dosis:'Igual criterio que durazno — no dejar frutos afectados bajo el árbol.' },
      { nombre:'Problemas de polinización', sintoma:'Floración abundante pero poca fruta posterior',
        producto:'No es plaga — revisar polinización', dosis:'Reina Claudia puede tener autoincompatibilidad; si se repite, considerar la variedad y un ciruelo compatible cerca.' },
    ],
    monitoreo:'1 revisión semanal, enfocada en brotes nuevos. Buscar especialmente pulgones.',
    momentoCritico:'Floración → cuajado — vigilar si florece bien pero no fructifica (polinización).',
    calendarioVigilancia: {9:'🟠',10:'🔴',11:'🔴',12:'🔴',1:'🔴',2:'🟠',3:'🟢',4:'🟢'},
  },
];

const fichaFito = nombreOEspecie => {
  const buscado = String(nombreOEspecie||'').toLowerCase();
  return FITOSANITARIO.find(f => buscado.includes(f.match)) || null;
};
const nivelVigilancia = (ficha, mes) => (ficha && ficha.calendarioVigilancia[mes]) || '🟢';
const diasVigilancia = (ficha, mes) => NIVEL_DIAS[nivelVigilancia(ficha, mes)];
```

**Supuesto a validar con el usuario en la revisión de esta spec:** la tabla
que dio junta "Ahora" + "Próximas 2 semanas" antes de pasar a meses enteros;
se colapsan ambas filas en el mes de septiembre (mes actual) para poder
representarlo como un calendario mes→nivel. Los meses no cubiertos por la
tabla (mayo-agosto) quedan en 🟢 por defecto (fuera de temporada de
crecimiento activo). Limonero no tiene fila 🟢 después de septiembre en la
tabla original — quedó en 🟠 todos los meses siguientes tal cual la dio el
usuario.

## 4. Frecuencia de monitoreo dinámica

**`index.html` (`estPlanta()`, línea ~933):** hoy usa
`CFG_PLA.diasPlagas` fijo. Se cambia a resolver la ficha de la planta y
usar `diasVigilancia(ficha, mesActual)` cuando exista ficha; si no hay
ficha (plantas de interior), se mantiene el comportamiento actual
(`CFG_PLA.diasPlagas`). Mismo patrón que ya usa `limite` de riego
(`esVerano ? perfil.riegoVerano : perfil.riegoInvierno`).

**`codigo.gs`:**
- Nueva función espejo `fichaFito(nombreOEspecie)` / `diasVigilancia(ficha, mes)`
  con la misma tabla `FITOSANITARIO` (duplicada a mano, mismo criterio que
  `ESPECIES` ya está duplicado entre Sheet/Apps Script y el JS de la app).
- `actualizarFichaPlantas()` línea 1820: el `actualizarProximoEvento_(shP,
  fila, idPlanta, 'plagas', 15, 16, CFG_PLANTAS.diasRevisionPlagas)` pasa a
  usar `diasVigilancia(fichaFito(especie || nombre), mes)` cuando hay ficha,
  con fallback al valor actual si no.
- `verificarEventosPlantas()` línea 1942: en vez de solo `grupos.plagas.push(nombre)`,
  empuja `{nombre, ficha: fichaFito(especie||nombre)}`.
- Construcción de la descripción del evento (línea 2034-2043): si **todas**
  las plantas del grupo tienen ficha fitosanitaria, arma el texto con el
  `monitoreo` específico de cada una en vez del `CHULETA_PLAGAS` genérico
  (que se sigue usando tal cual para plantas de interior sin ficha, o si el
  grupo mezcla ambos tipos se listan por separado: "Frutales/cítricos" con
  su `monitoreo` propio y "Otras plantas" con la chuleta genérica).

## 5. Nueva sección "Fitosanitario" en el menú

Sigue el patrón de navegación existente (`go('pec')`, `TITLES`, botones de
sidebar/mobile-tab en líneas ~428-458): se agrega `go('fito')`, entrada en
`TITLES` (`fito:'Fitosanitario'`), botón de menú, y una función
`renderFito()` que arma, para cada una de las 4 plantas con ficha:

- Encabezado con nombre de la planta y estado fenológico actual (dato ya
  existente en `p.notas` o se puede leer del último registro relevante —
  no se agrega un campo nuevo, se muestra lo que ya haya en `notas`).
- Nivel de vigilancia del mes actual (badge con el emoji correspondiente).
- Tabla de problemas a vigilar (nombre + síntoma).
- Texto de "qué monitorear" y "momento crítico".
- Guía de producto/dosis por problema, con el disclaimer genérico fijo al
  pie (mismo texto que ya usa la Pecera: *"Referencia general — confirmá
  contra la etiqueta de tu producto"*).
- Link/botón para ir directo al detalle de esa planta (`verPlanta(id)`).

No se toca la vista de detalle de planta existente — la ficha vive solo en
la sección nueva, con un enlace cruzado.

## 6. Formulario de registro — autocompletado por problema

En el formulario de "Registrar" (sección plantas, alrededor de
`index.html:546-549`), cuando:
1. El tipo seleccionado es `🐛 Revisión plagas`, **y**
2. La planta seleccionada tiene ficha fitosanitaria (`fichaFito`),

aparece un `<select>` nuevo "Problema detectado" poblado con `"Ninguno /
solo monitoreo"` + cada `problema.nombre` de la ficha de esa planta. Al
cambiar la selección, se autocompleta el campo `producto` (texto libre) con
`"${producto} — ${dosis}"`. El campo sigue siendo editable a mano antes de
guardar — no se fuerza el valor. Si la planta no tiene ficha (plantas de
interior) o el tipo no es "Revisión plagas", el select queda oculto y el
comportamiento es idéntico al actual.

El registro se sigue guardando en `registroPlantas` exactamente igual que
hoy (mismo `id`, `planta`, `fecha`, `tipo`, `detalle`, `producto`,
`resultado`) — no se agrega ningún campo nuevo al esquema de datos, así que
no hace falta tocar Firestore rules ni el Sheet.

## 7. Fix — sistemas fantasma

**Causa (confirmada leyendo el código):** `S.sistemas` se llena desde
`SEED_SIS` (3 items) + todo lo que haya en la colección Firestore
`sistemas`. `window.clearSis()` ([index.html:1709](../../../public/public/index.html))
solo vacía los campos de un sistema pero nunca lo saca del array ni borra el
documento — por eso "resetear" un sistema lo deja como una tarjeta "Sin
datos" que sigue apareciendo para siempre. Editar la hoja de Google Sheets
no tiene ningún efecto porque la sincronización es de la app hacia la hoja,
nunca al revés.

**Fix:** agregar `window.delSis`, mismo patrón que `delRev`/`delEventoPecera`:

```js
window.delSis = async (id, e) => {
  e.stopPropagation();
  if(!confirm(`¿Eliminar Sistema ${id}? Esta acción no se puede deshacer.`)) return;
  await fbDel('sistemas', id);
  S.sistemas = S.sistemas.filter(s=>s.id!=id); sv();
  poblarSels(); renderSist(); if(cur==='dash') renderDash();
  toast(`Sistema ${id} eliminado`);
};
```

Botón "🗑️ Eliminar" agregado a `sysHTML()` (línea 1051), visible en cada
tarjeta de la pantalla Sistemas, con `e.stopPropagation()` para no disparar
el click de la tarjeta completa.

Una vez deployado, el usuario borra manualmente los sistemas 4 al 10 desde
la app en vivo (son datos, no algo que se pueda "arreglar" con código — hay
que borrar esos documentos puntuales de Firestore).

## 8. Fuera de alcance

- No se agregan columnas nuevas a la hoja de Google Sheets "Especies" ni una
  hoja "Fitosanitario" — los datos quedan hardcodeados en ambos lados
  (index.html y codigo.gs), igual que ya está `ESPECIES` hoy.
- No se calcula dosis proporcional a tamaño de copa/litros de caldo (a
  diferencia de la Pecera, que sí escala por litros de agua) — las dosis
  son "por litro de agua a aplicar", igual que cualquier etiqueta de
  producto.
- No se agregan productos ni marcas específicas, ni se valida contra
  ninguna base de datos de agroquímicos registrados.
- No se toca la vista de detalle de planta existente.

## 9. Verificación

- Revisar visualmente la sección Fitosanitario en el navegador (las 4
  fichas, badges de nivel de vigilancia correctos para el mes actual).
- Registrar un evento de "Revisión plagas" para el durazno, elegir un
  problema del select, confirmar que autocompleta producto y que el
  registro impacta `estPlanta()`/el dashboard.
- Confirmar que una planta de interior (ej. Monstera) sigue sin mostrar el
  select de problema y sigue usando el intervalo genérico de 30 días.
- Sistemas: crear un sistema de prueba, resetearlo, confirmar que el botón
  "Eliminar" lo saca de la lista y no reaparece al recargar.
- No hace falta tocar Apps Script en este repo para verificar (no hay forma
  de correrlo desde acá) — se deja documentado el cambio para que el
  usuario lo pegue en el editor de Apps Script y corra
  `diagnosticarPecera()`-equivalente si quiere confirmar antes del trigger
  diario real.
