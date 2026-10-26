// Calendario de aplicaciones preventivas (fumigación) por grupo de plantas.
// Guía agronómica genérica de huerta familiar para el hemisferio sur (Buenos Aires),
// NO dosis de etiqueta de una marca: confirmar siempre contra el envase.
// Complementa al monitoreo de FITOSANITARIO (index.html): ahí se mira antes de tratar,
// acá se agendan las pocas aplicaciones que conviene hacer sí o sí en cada época.

// cadaDias: número fijo, o { def, <mes>: días } para cambiar la frecuencia en ciertos meses.
// lavable: la lluvia fuerte lava el producto → se adelanta la repetición.
// evitarCalor: no aplicar con calor fuerte (quema hojas) → se avisa de hacerlo a la tardecita.
export const UMBRAL_LAVADO_MM = 25;   // lluvia acumulada desde la última aplicación que "lava" un fungicida
export const TEMP_CALOR_APLICAR = 32; // °C de máxima desde la cual conviene aplicar recién a la tardecita
const DIAS_MIN_LAVADO = 3;            // no se repite antes de este tiempo aunque llueva

export const GRUPOS = {
  citrico: { nombre:'Cítricos', icono:'🍋' },
  carozo:  { nombre:'Frutales de carozo', icono:'🍑' },
  interior:{ nombre:'Plantas de interior', icono:'🪴' },
};

export const PLANES = {
  citrico: [
    { id:'cobre-brotes', nombre:'Cobre preventivo (cancrosis)', meses:[9,10,11,12], cadaDias:20, lavable:true,
      producto:'Fungicida cúprico (oxicloruro de cobre)',
      dosis:'Según etiqueta (típico 2-3 g/L). Mojar brotes tiernos y hojas. Mientras dure la brotación.',
      nota:'No aplicar junto con aceite: dejar 15 días entre uno y otro.' },
    { id:'neem-verano', nombre:'Neem preventivo (ácaros)', meses:[12,1,2,3], cadaDias:15, evitarCalor:true,
      producto:'Aceite de neem',
      dosis:'Según etiqueta. Rociar el envés de las hojas.',
      nota:'Con calor, a la tardecita; nunca a pleno sol.' },
    { id:'aceite-invierno', nombre:'Aceite mineral (cochinillas y huevos invernantes)', meses:[6,7,8], cadaDias:30,
      producto:'Aceite mineral / agropecuario',
      dosis:'1-2% (10-20 ml/L) según etiqueta. Mojar bien ramas y tronco.',
      nota:'No aplicar si hay riesgo de helada esa noche ni con cobre en los últimos 15 días.' },
    { id:'insecticida-brotes', nombre:'Insecticida preventivo (pulgones y cochinillas)', meses:[9,10,11,12,1,2,3], cadaDias:21, evitarCalor:true,
      producto:'Jabón potásico, neem o insecticida de baja toxicidad',
      dosis:'Según etiqueta. Rociar brotes y envés de hojas, a la tardecita.',
      nota:'No aplicar en plena floración (abejas). Si el monitoreo no muestra plagas, se puede espaciar.' },
  ],
  carozo: [
    { id:'cobre-invierno', nombre:'Cobre de reposo (bacteriosis y torque)', meses:[5,6,8], cadaDias:30, lavable:true,
      producto:'Fungicida cúprico',
      dosis:'Según etiqueta. Mojar ramas y yemas. Agosto (yemas hinchadas) es el momento clave del torque del durazno.',
      nota:'Julio queda libre para el aceite mineral.' },
    { id:'aceite-reposo', nombre:'Aceite mineral de invierno (cochinillas)', meses:[7], cadaDias:40,
      producto:'Aceite mineral / agropecuario',
      dosis:'1-2% (10-20 ml/L) según etiqueta, con el árbol sin hojas.',
      nota:'Separar 15 días del cobre.' },
    { id:'fungicida-primavera', nombre:'Fungicida de primavera (cribado y podredumbre)', meses:[9,10,11], cadaDias:15, lavable:true,
      producto:'Fungicida cúprico o azufre mojable',
      dosis:'Según etiqueta. Si el árbol está en plena floración, preferir azufre y no cobre.',
      nota:'Repetir antes si llovió mucho.' },
    { id:'trampas-mosca', nombre:'Trampas de mosca de los frutos (renovar cebo)', meses:[10,11,12,1,2], cadaDias:14,
      producto:'Trampa con atrayente (proteína hidrolizada o feromona)',
      dosis:'Renovar el cebo cada 2 semanas y juntar y destruir los frutos caídos.',
      nota:'No es una fumigación: es una trampa.' },
    { id:'insecticida-brotes', nombre:'Insecticida preventivo (pulgones y cochinillas)', meses:[9,10,11,12,1,2,3], cadaDias:21, evitarCalor:true,
      producto:'Jabón potásico, neem o insecticida de baja toxicidad',
      dosis:'Según etiqueta. Rociar brotes y envés de hojas, a la tardecita.',
      nota:'No aplicar en plena floración (abejas). Si el monitoreo no muestra plagas, se puede espaciar.' },
  ],
  interior: [
    { id:'jabon-neem-interior', nombre:'Insecticida preventivo (jabón potásico o neem)', meses:[1,2,3,4,5,6,7,8,9,10,11,12], cadaDias:{ def:30, 5:21, 6:21, 7:21, 8:21 },
      producto:'Jabón potásico (5 ml/L) o aceite de neem',
      dosis:'Rociar todas las hojas, incluido el envés, a la tardecita y lejos del sol directo. Probar primero en una hoja.',
      nota:'En invierno la calefacción seca el aire y aparecen ácaros: por eso se hace cada 3 semanas. Helechos y Pilea: solo jabón suave.' },
    { id:'fungicida-interior', nombre:'Fungicida preventivo (hongos y manchas)', meses:[1,2,3,4,5,6,7,8,9,10,11,12], cadaDias:30,
      producto:'Fungicida cúprico o bicarbonato de sodio con jabón',
      dosis:'Según etiqueta; con bicarbonato, 5 g/L más unas gotas de jabón. Probar primero en una hoja.',
      nota:'Separar unos días del insecticida si son productos distintos. Más importante con humedad alta o poca ventilación.' },
  ],
};

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const CITRICOS = ['mandarina', 'limon', 'naranja', 'pomelo', 'lima', 'citrico'];
const CAROZOS  = ['durazno', 'ciruela', 'damasco', 'cereza', 'nectarin', 'pelon'];

// 'citrico' | 'carozo' | 'interior' | null (sin plan: ej. hortalizas).
export const grupoDePlanta = (nombre, especie, esInterior) => {
  if (esInterior) return 'interior';
  const t = norm(nombre) + ' ' + norm(especie);
  if (CITRICOS.some(k => t.includes(k))) return 'citrico';
  if (CAROZOS.some(k => t.includes(k)) || t.includes('prunus')) return 'carozo';
  return null;
};

export const cadaDiasEnMes = (trat, mes) =>
  typeof trat.cadaDias === 'number' ? trat.cadaDias : (trat.cadaDias[mes] ?? trat.cadaDias.def);

const utc = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
const MS_DIA = 86400000;
const diasEntre = (a, b) => Math.round((utc(b) - utc(a)) / MS_DIA);

// ultima: Date de la última aplicación de este tratamiento (o null si nunca).
// ctx.mmDesdeUltima: lluvia acumulada desde esa fecha (mm). ctx.tmax: máxima de hoy (°C) o null.
// Devuelve { estado:'hoy'|'prox'|'ok'|'fuera', dias, detalle }. dias<0 = atrasada.
export const estadoTratamiento = (trat, ultima, hoy, ctx = {}) => {
  const mes = hoy.getMonth() + 1;
  if (!trat.meses.includes(mes)) return { estado:'fuera', dias:null, detalle:'fuera de época' };
  let dias, detalle;
  if (!ultima) { dias = 0; detalle = 'sin aplicaciones registradas'; }
  else {
    const desde = diasEntre(ultima, hoy);
    dias = cadaDiasEnMes(trat, mes) - desde;
    detalle = dias < 0 ? `${-dias} días de atraso` : dias === 0 ? 'toca hoy' : `en ${dias} d`;
    if (trat.lavable && dias > 0 && desde >= DIAS_MIN_LAVADO && (ctx.mmDesdeUltima || 0) >= UMBRAL_LAVADO_MM) {
      dias = 0; detalle = `llovieron ${Math.round(ctx.mmDesdeUltima)} mm desde la última: repetir`;
    }
  }
  if (dias <= 0) {
    if (trat.evitarCalor && ctx.tmax != null && ctx.tmax >= TEMP_CALOR_APLICAR) detalle += ' · hace calor: a la tardecita';
    return { estado:'hoy', dias, detalle };
  }
  return { estado: dias <= 3 ? 'prox' : 'ok', dias, detalle };
};

// Tratamientos del grupo que corresponden a un mes.
export const tratamientosDelMes = (grupo, mes) => (PLANES[grupo] || []).filter(t => t.meses.includes(mes));

// Calendario anual: para cada tratamiento, los 12 meses (true = se aplica).
export const calendarioAnual = grupo => (PLANES[grupo] || []).map(t => ({
  trat: t, meses: Array.from({ length: 12 }, (_, i) => t.meses.includes(i + 1)),
}));
