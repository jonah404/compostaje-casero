// Catálogo de la huerta y funciones puras (sin DOM ni Firebase). Lo importa
// index.html y lo prueba scripts/test-huerta.mjs en Node.
// Cada vez que se cambie este archivo hay que subir la versión de CACHE en sw.js.

// ── Fuentes y alcance: los valores son orientativos y solo parcialmente contrastados.
//   Los meses de siembra y los días a cosecha se verificaron contra las tablas de
//   Pro-Huerta/INTA en 16 de las 24 especies (sin verificar: cilantro, menta, orégano,
//   romero, tomillo, frutilla, rúcula). Riego, fertilización, `diasPlagas` y todos los
//   productos y dosis de plagas son referencias generales, no contrastadas: confirmar
//   con la etiqueta del producto. Todo es editable por cultivo desde la app.

// Problemas frecuentes, reutilizados en varias especies.
const PB = {
  pulgones:   { nombre:'Pulgones', sintoma:'Colonias en brotes tiernos y en el envés; hojas enrolladas y pegajosas', producto:'Jabón potásico', dosis:'5-10 ml por litro de agua, rociar brotes y envés. Repetir a los 7 días si persisten.' },
  moscaBlanca:{ nombre:'Mosca blanca', sintoma:'Insectos blancos diminutos que vuelan al mover la planta; hojas pegajosas con fumagina', producto:'Trampas amarillas pegajosas + jabón potásico', dosis:'Trampas a la altura de la copa; jabón potásico 5-10 ml/L en el envés, repetir a los 5-7 días.' },
  trips:      { nombre:'Trips', sintoma:'Plateado y puntitos negros en las hojas; brotes deformados', producto:'Jabón potásico o aceite de neem', dosis:'Neem según etiqueta, rociar a la tardecita; repetir a los 7 días.' },
  acaros:     { nombre:'Ácaros (araña roja)', sintoma:'Punteado amarillento y telarañas finas en el envés, con tiempo seco y caluroso', producto:'Aceite de neem o jabón potásico', dosis:'Neem según etiqueta, repetir a los 7-10 días; mojar bien el envés y subir la humedad.' },
  caracoles:  { nombre:'Caracoles y babosas', sintoma:'Hojas comidas con bordes irregulares y rastro plateado, sobre todo de noche', producto:'Trampas de cerveza o cebo de fosfato férrico', dosis:'Recolectar a mano de noche o al amanecer; cebo de fosfato férrico según etiqueta.' },
  hormigas:   { nombre:'Hormigas cortadoras', sintoma:'Hojas cortadas en pocas horas y sendero de hormigas hacia la planta', producto:'Cebo granulado para hormigas', dosis:'Colocar cerca del hormiguero o del sendero; no rociar insecticida sobre la planta.' },
  oruga:      { nombre:'Orugas de la col', sintoma:'Hojas agujereadas y orugas verdes en el envés', producto:'Recolección manual o Bacillus thuringiensis (Bt)', dosis:'Bt según etiqueta, aplicar a la tardecita; repetir a los 7 días si persisten.' },
  pulguilla:  { nombre:'Pulguilla', sintoma:'Muchos agujeritos redondos en las hojas; los bichitos saltan al tocar la planta', producto:'Cobertura de tul + jabón potásico', dosis:'Cubrir el cantero mientras las plantas son chicas; jabón potásico 5-10 ml/L.' },
  oidio:      { nombre:'Oídio', sintoma:'Polvillo blanco sobre las hojas', producto:'Azufre mojable o bicarbonato de sodio', dosis:'Azufre según etiqueta (no aplicar con más de 30 °C); o bicarbonato 5 g/L con unas gotas de jabón. Retirar hojas muy afectadas.' },
  mildiu:     { nombre:'Mildiu', sintoma:'Manchas amarillas en el haz y moho grisáceo en el envés, con humedad', producto:'Fungicida cúprico', dosis:'Cobre según etiqueta; no mojar las hojas al regar y mejorar la ventilación.' },
  tizon:      { nombre:'Tizón tardío', sintoma:'Manchas oscuras de aspecto aceitoso en hojas, tallos y frutos con tiempo húmedo y fresco', producto:'Fungicida cúprico preventivo', dosis:'Cobre según etiqueta cada 10-14 días en períodos húmedos; retirar y destruir plantas muy afectadas.' },
  polilla:    { nombre:'Polilla del tomate', sintoma:'Galerías en las hojas y orificios en los frutos', producto:'Trampas de feromona y retirada de hojas minadas', dosis:'Trampas de feromona según etiqueta; eliminar hojas y frutos afectados.' },
  apical:     { nombre:'Podredumbre apical', sintoma:'Mancha negra hundida en la punta del fruto', producto:'Riego parejo y aporte de calcio', dosis:'Evitar alternar sequía con exceso de agua; calcio según etiqueta. Es un desorden fisiológico, no una plaga.' },
  cogollera:  { nombre:'Oruga cogollera', sintoma:'Hojas del cogollo comidas y excrementos en el centro de la planta', producto:'Bacillus thuringiensis (Bt) o recolección manual', dosis:'Bt según etiqueta al aparecer los primeros daños; repetir a los 7 días.' },
  alternaria: { nombre:'Alternaria (tizón foliar)', sintoma:'Manchas oscuras en las hojas que se secan de afuera hacia adentro', producto:'Fungicida cúprico', dosis:'Cobre según etiqueta; evitar mojar el follaje y rotar el cantero.' },
  cercospora: { nombre:'Cercospora', sintoma:'Manchas circulares pardas con borde rojizo en las hojas', producto:'Fungicida cúprico', dosis:'Cobre según etiqueta; retirar hojas muy manchadas y no mojar el follaje.' },
  roya:       { nombre:'Roya', sintoma:'Pústulas anaranjadas en hojas o tallos', producto:'Retirar lo afectado y fungicida cúprico o azufre', dosis:'Cobre o azufre según etiqueta; cortar y descartar las partes con pústulas.' },
  botrytis:   { nombre:'Botrytis (moho gris)', sintoma:'Moho gris sobre flores y frutos, con humedad', producto:'Retirar lo afectado y mejorar la ventilación', dosis:'Sacar los frutos afectados a diario; regar sin mojar los frutos y usar cobertura seca (paja).' },
  cochinilla: { nombre:'Cochinillas', sintoma:'Bultitos blancos algodonosos o marrones adheridos a tallos y hojas', producto:'Alcohol isopropílico (focos chicos) o jabón potásico', dosis:'Algodón con alcohol sobre cada cochinilla; repetir cada 4-5 días, 2-3 veces.' },
  podredumbre:{ nombre:'Podredumbre de raíz', sintoma:'Marchitez con suelo húmedo y raíces oscuras y blandas', producto:'Drenaje y menos riego', dosis:'Espaciar los riegos y mejorar el drenaje (cantero elevado); retirar la planta si está muy afectada.' },
};

// Nivel de vigilancia mensual: 🟢 baja (por defecto), `alta` en `mesesAlta`, `pico` en `mesesPico`.
const vig = (alta, mesesAlta, pico = null, mesesPico = []) => {
  const o = {};
  for (let m = 1; m <= 12; m++) o[m] = mesesPico.includes(m) ? pico : (mesesAlta.includes(m) ? alta : '🟢');
  return o;
};
const VIG_CALOR   = vig('🟠', [9, 10, 11, 12, 1, 2, 3, 4], '🔴', [11, 12, 1, 2]);   // cultivos de calor
const VIG_FRESCA  = vig('🟠', [3, 4, 5, 6, 8, 9, 10]);                               // hojas y raíces de estación fresca
const VIG_PERENNE = vig('🟠', [3, 4, 9, 10, 11]);                                    // perennes y aromáticas

const G1 = 'Hojas y crucíferas', G2 = 'Frutos', G3 = 'Raíces y bulbos', G4 = 'Aromáticas y perennes';
const ficha = (problemas, monitoreo, momentoCritico, calendarioVigilancia) => ({ problemas, monitoreo, momentoCritico, calendarioVigilancia });
// C(clave, nombre, grupo, ciclo, riegoVerano, riegoInvierno, diasFert, diasPlagas, diasATrasplante, diasACosecha, mesesSiembra, ficha)
// riego* = días entre riegos; diasATrasplante = null si se siembra directo; diasACosecha desde la siembra (null en perennes).
const C = (clave, nombre, grupo, ciclo, riegoVerano, riegoInvierno, diasFert, diasPlagas, diasATrasplante, diasACosecha, mesesSiembra, f) =>
  ({ clave, nombre, grupo, ciclo, riegoVerano, riegoInvierno, diasFert, diasPlagas, diasATrasplante, diasACosecha, mesesSiembra, ficha: f });

export const CATALOGO_HUERTA = [
  // ── Hojas y crucíferas
  C('lechuga', 'Lechuga', G1, 'anual', 2, 4, 20, 7, 25, 60, [2, 3, 4, 5, 6, 7, 8, 9],
    ficha([PB.caracoles, PB.pulgones, PB.hormigas], 'Revisar el cogollo y el envés dos veces por semana; caracoles y babosas de noche o al amanecer.', 'Plantín recién trasplantado y tiempo húmedo y templado.', VIG_FRESCA)),
  C('acelga', 'Acelga', G1, 'anual', 3, 5, 25, 7, null, 60, [2, 3, 4, 8, 9, 10],
    ficha([PB.pulgones, PB.caracoles, PB.hormigas], 'Revisar el envés de las hojas externas una vez por semana.', 'Plantas jóvenes y tiempo húmedo.', VIG_FRESCA)),
  C('espinaca', 'Espinaca', G1, 'anual', 3, 5, 25, 7, null, 80, [2, 3, 4, 5, 6],
    ficha([PB.pulgones, PB.caracoles, PB.mildiu], 'Revisar hojas y envés semanalmente; retirar las hojas manchadas.', 'Días fríos y húmedos (mildiu) y plantas jóvenes (caracoles).', VIG_FRESCA)),
  C('rucula', 'Rúcula', G1, 'anual', 2, 4, 25, 7, null, 35, [3, 4, 5, 6, 7, 8, 9, 10],
    ficha([PB.pulguilla, PB.pulgones, PB.caracoles], 'Revisar hojas por agujeritos y el envés por pulgones, dos veces por semana.', 'Primeras semanas tras la siembra y tiempo seco (pulguilla).', VIG_FRESCA)),
  C('repollo', 'Repollo', G1, 'anual', 3, 5, 20, 7, 35, 100, [2, 3, 4, 5, 8, 9],
    ficha([PB.oruga, PB.pulgones, PB.caracoles], 'Revisar el envés y el centro de la planta cada semana en busca de orugas y pulgones.', 'Formación de la cabeza y semanas templadas (orugas).', VIG_FRESCA)),
  C('brocoli', 'Brócoli', G1, 'anual', 3, 5, 20, 7, 35, 90, [2, 3, 4, 5, 8],
    ficha([PB.oruga, PB.pulgones, PB.caracoles], 'Revisar hojas, envés y la pella semanalmente.', 'Formación de la pella y semanas templadas (orugas).', VIG_FRESCA)),
  // ── Frutos
  C('tomate', 'Tomate', G2, 'anual', 2, 4, 20, 7, 40, 120, [7, 8, 9, 10],
    ficha([PB.tizon, PB.polilla, PB.moscaBlanca, PB.apical], 'Revisar hojas, tallos y frutos dos veces por semana; retirar hojas bajas manchadas.', 'Floración, cuaje de frutos y períodos húmedos y frescos (tizón).', VIG_CALOR)),
  C('morron', 'Morrón', G2, 'anual', 3, 5, 20, 7, 50, 130, [7, 8, 9],
    ficha([PB.pulgones, PB.trips, PB.moscaBlanca, PB.apical], 'Revisar brotes, flores y envés una vez por semana.', 'Floración y cuaje de frutos.', VIG_CALOR)),
  C('berenjena', 'Berenjena', G2, 'anual', 3, 5, 20, 7, 50, 130, [7, 8, 9],
    ficha([PB.pulgones, PB.moscaBlanca, PB.acaros], 'Revisar el envés de las hojas semanalmente; el ácaro aparece con calor y sequedad.', 'Verano caluroso y seco (ácaros).', VIG_CALOR)),
  C('zapallito', 'Zapallito', G2, 'anual', 2, 4, 20, 7, null, 55, [9, 10, 11, 12, 1],
    ficha([PB.oidio, PB.pulgones, PB.moscaBlanca], 'Revisar hojas y envés cada semana; el oídio aparece con noches frescas y días secos.', 'Floración y fructificación.', VIG_CALOR)),
  C('zapallo', 'Zapallo', G2, 'anual', 3, 6, 25, 7, null, 120, [9, 10, 11, 12],
    ficha([PB.oidio, PB.pulgones, PB.moscaBlanca], 'Revisar hojas y envés cada semana.', 'Crecimiento de guías y fructificación.', VIG_CALOR)),
  C('pepino', 'Pepino', G2, 'anual', 2, 4, 20, 7, null, 65, [9, 10, 11, 12],
    ficha([PB.oidio, PB.mildiu, PB.pulgones, PB.acaros], 'Revisar hojas y envés dos veces por semana.', 'Floración y períodos húmedos (mildiu).', VIG_CALOR)),
  C('choclo', 'Choclo', G2, 'anual', 3, 5, 25, 7, null, 100, [9, 10, 11, 12],
    ficha([PB.cogollera, PB.pulgones, PB.hormigas], 'Revisar el cogollo y las espigas cada semana en busca de larvas.', 'Cogollo joven y formación de la espiga.', VIG_CALOR)),
  // ── Raíces y bulbos
  C('zanahoria', 'Zanahoria', G3, 'anual', 3, 5, 30, 10, null, 120, [2, 3, 4, 5, 8, 9, 10],
    ficha([PB.alternaria, PB.pulgones, PB.caracoles], 'Revisar el follaje cada 10 días; raleo temprano para evitar humedad entre plantas.', 'Plántulas y tiempo húmedo.', VIG_FRESCA)),
  C('remolacha', 'Remolacha', G3, 'anual', 3, 5, 30, 10, null, 100, [3, 4, 5, 8, 9, 10],
    ficha([PB.pulgones, PB.caracoles, PB.cercospora], 'Revisar el follaje cada 10 días.', 'Plántulas y tiempo húmedo (manchas foliares).', VIG_FRESCA)),
  C('cebolla-verdeo', 'Cebolla de verdeo', G3, 'anual', 3, 5, 30, 10, 50, 100, [2, 3, 4, 5],
    ficha([PB.trips, PB.roya, PB.mildiu], 'Revisar las hojas cada 10 días; el trips se ve como plateado en las puntas.', 'Tiempo seco (trips) y húmedo (mildiu, roya).', VIG_FRESCA)),
  // ── Aromáticas y perennes
  C('albahaca', 'Albahaca', G4, 'anual', 2, 4, 25, 10, 30, 80, [9, 10, 11, 12, 1],
    ficha([PB.pulgones, PB.caracoles, PB.mildiu], 'Revisar hojas y brotes cada 10 días; pinzar las flores para que siga produciendo.', 'Noches húmedas (mildiu) y plantas jóvenes (caracoles).', VIG_CALOR)),
  C('perejil', 'Perejil', G4, 'anual', 3, 5, 30, 10, null, 70, [3, 4, 5, 8, 9, 10],
    ficha([PB.pulgones, PB.caracoles, PB.hormigas], 'Revisar el follaje cada 10 días.', 'Plántulas y tiempo húmedo.', VIG_FRESCA)),
  C('cilantro', 'Cilantro', G4, 'anual', 3, 5, 30, 10, null, 45, [3, 4, 5, 8, 9, 10],
    ficha([PB.pulgones, PB.caracoles, PB.oidio], 'Revisar hojas y envés cada 10 días.', 'Plántulas y noches frescas (oídio).', VIG_FRESCA)),
  C('menta', 'Menta', G4, 'perenne', 3, 5, 40, 10, null, null, [3, 4, 8, 9, 10],
    ficha([PB.roya, PB.pulgones, PB.caracoles], 'Revisar el envés cada 10 días; cortar y descartar los tallos con pústulas.', 'Primavera húmeda (roya).', VIG_PERENNE)),
  C('oregano', 'Orégano', G4, 'perenne', 5, 8, 60, 14, null, null, [3, 4, 8, 9, 10],
    ficha([PB.pulgones, PB.podredumbre, PB.cochinilla], 'Revisar tallos y brotes cada 2 semanas; regar poco y con buen drenaje.', 'Períodos lluviosos (exceso de humedad en la raíz).', VIG_PERENNE)),
  C('romero', 'Romero', G4, 'perenne', 7, 12, 90, 14, null, null, [3, 4, 8, 9, 10],
    ficha([PB.cochinilla, PB.podredumbre, PB.oidio], 'Revisar tallos leñosos cada 2 semanas; evitar el encharcamiento.', 'Períodos lluviosos y poca ventilación.', VIG_PERENNE)),
  C('tomillo', 'Tomillo', G4, 'perenne', 7, 12, 90, 14, null, null, [3, 4, 8, 9, 10],
    ficha([PB.cochinilla, PB.podredumbre, PB.pulgones], 'Revisar tallos y brotes cada 2 semanas; regar poco.', 'Períodos lluviosos (exceso de humedad en la raíz).', VIG_PERENNE)),
  C('frutilla', 'Frutilla', G4, 'perenne', 3, 5, 25, 10, null, null, [3, 4, 5],
    ficha([PB.botrytis, PB.caracoles, PB.acaros, PB.pulgones], 'Revisar flores y frutos cada 10 días; retirar los frutos afectados a diario.', 'Floración y fructificación con humedad (moho gris).', VIG_PERENNE)),
];

export const numero = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
const dia = s => (s ? new Date(String(s).slice(0, 10) + 'T00:00:00') : null);
const MS_DIA = 86400000;

export const CERRADOS = ['cosechado', 'terminado'];
export const estaCerrado = p => !!p && CERRADOS.includes(p.estadoCultivo);

// Valores de respaldo si a un cultivo manual le falta algún dato. Apps Script usa
// los mismos (perfilHuertaFila_ en codigo.gs).
export const PERFIL_POR_DEFECTO = { riegoVerano: 3, riegoInvierno: 5, diasFert: 30, diasPlagas: 7 };

// Perfil de un cultivo a partir de su "foto" (lo copiado del catálogo al agregarlo).
export const perfilDeCultivo = p => ({
  tipo: 'Exterior',
  riegoVerano:   numero(p.riegoVerano)   ?? PERFIL_POR_DEFECTO.riegoVerano,
  riegoInvierno: numero(p.riegoInvierno) ?? PERFIL_POR_DEFECTO.riegoInvierno,
  diasFert:      numero(p.diasFert)      ?? PERFIL_POR_DEFECTO.diasFert,
  diasPlagas:    numero(p.diasPlagas)    ?? PERFIL_POR_DEFECTO.diasPlagas,
  fertMesIni: null, fertMesFin: null, tempMin: null, podaDias: null,
});

// Días desde la siembra (fechaP). `hoy` es un Date a medianoche local.
export const diaDeCultivo = (p, hoy) => {
  const s = dia(p.fechaP);
  return s ? Math.round((hoy - s) / MS_DIA) : null;
};

export const faseCultivo = (p, hoy) => {
  if (estaCerrado(p)) return 'cerrado';
  const d = diaDeCultivo(p, hoy);
  const dc = numero(p.diasACosecha), dt = numero(p.diasATrasplante);
  if (p.ciclo === 'perenne' || !dc || d == null) return 'crecimiento';
  if (dt && !p.fechaTrasplante) return d < dt ? 'semillero' : 'por-trasplantar';
  if (d >= dc) return 'cosecha';
  if (d >= dc - 7) return 'cosecha-proxima';
  return 'crecimiento';
};

export const progresoCosecha = (p, hoy) => {
  const d = diaDeCultivo(p, hoy), dc = numero(p.diasACosecha);
  if (p.ciclo === 'perenne' || !dc || d == null) return null;
  return Math.max(0, Math.min(1, d / dc));
};

export const diasParaCosecha = (p, hoy) => {
  const d = diaDeCultivo(p, hoy), dc = numero(p.diasACosecha);
  if (p.ciclo === 'perenne' || !dc || d == null) return null;
  return dc - d;
};

export const fechaCosechaEstimada = p => {
  const s = dia(p.fechaP), dc = numero(p.diasACosecha);
  if (!s || !dc) return null;
  return new Date(s.getTime() + dc * MS_DIA);
};

// ── Catálogo ─────────────────────────────────────────────────────────
export const buscarCultivo = clave => CATALOGO_HUERTA.find(c => c.clave === clave) || null;

export const perfilDeCatalogo = clave => {
  const c = buscarCultivo(clave);
  if (!c) return null;
  return {
    clave: c.clave, nombre: c.nombre, ciclo: c.ciclo,
    riegoVerano: c.riegoVerano, riegoInvierno: c.riegoInvierno,
    diasFert: c.diasFert, diasPlagas: c.diasPlagas,
    diasATrasplante: c.diasATrasplante, diasACosecha: c.diasACosecha,
    mesesSiembra: c.mesesSiembra.slice(),
  };
};

export const fichaDeCatalogo = clave => { const c = buscarCultivo(clave); return c ? c.ficha : null; };

// Una clave desconocida (o 'manual') no genera aviso de época.
export const enEpocaDeSiembra = (clave, mes) => { const c = buscarCultivo(clave); return !c || c.mesesSiembra.includes(mes); };
