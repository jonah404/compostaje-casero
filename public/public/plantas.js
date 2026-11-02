// Estado de cada planta (riego, fertilización, plagas, poda) a partir de su ficha, los eventos
// registrados y el clima. Sin acceso a la app: todo entra por parámetro, así se puede probar.
// Mismo criterio que actualizarFichaPlantas() / verificarEventosPlantas() en codigo.gs.

export const UMBRAL_LLUVIA_MM = 8;
export const CFG_PLA = { diasSinRiegoVerano:7, diasSinRiegoInvierno:14, diasFert:60, diasPlagas:30, diasPoda:365, mesesVerano:[11,12,1,2,3] };
// Mismos perfiles que la hoja "Especies" del Apps Script (codigo.gs →
// inicializarHojaEspecies/agregarEspeciesFaltantes) — sin esto, el dashboard
// calculaba riego/fertilización/poda con los valores genéricos de cítrico de
// exterior para TODAS las plantas, incluidas las de interior con perfil
// propio (ej. Pata de elefante tolera 35 días sin agua en invierno acá vs.
// los 14 genéricos, así que el dashboard la marcaba "urgente" cuando el
// calendario — que sí usa el perfil — correctamente no generaba ninguna
// alerta). Si en algún momento se edita la hoja Especies, actualizar acá
// también para que sigan coincidiendo.
export const ESPECIES = [
  { especie:'Monstera',          tipo:'Interior', riegoVerano:8,  riegoInvierno:12, diasFert:30, fertMesIni:9, fertMesFin:4, tempMin:12, podaDias:150 },
  { especie:'Palo de agua',      tipo:'Interior', riegoVerano:10, riegoInvierno:14, diasFert:60, fertMesIni:9, fertMesFin:4, tempMin:15, podaDias:240 },
  // Específicos antes del genérico 'Helecho': perfilEspecie devuelve el primero que matchea.
  { especie:'Helecho de cinta',      tipo:'Interior', riegoVerano:3,  riegoInvierno:6,  diasFert:30, fertMesIni:9, fertMesFin:4, tempMin:10, podaDias:240 },
  { especie:'Helecho Hawaii',        tipo:'Interior', riegoVerano:4,  riegoInvierno:7,  diasFert:30, fertMesIni:9, fertMesFin:4, tempMin:10, podaDias:240 },
  { especie:'Helecho Davana',        tipo:'Interior', riegoVerano:5,  riegoInvierno:9,  diasFert:30, fertMesIni:9, fertMesFin:4, tempMin:10, podaDias:300 },
  { especie:'Helecho estrella azul', tipo:'Interior', riegoVerano:6,  riegoInvierno:10, diasFert:45, fertMesIni:9, fertMesFin:4, tempMin:10, podaDias:300 },
  // Galería exterior, pero se trata como de interior: no cuenta lluvia ni helada de exterior.
  { especie:'Helecho espárrago',     tipo:'Interior', riegoVerano:5,  riegoInvierno:9,  diasFert:45, fertMesIni:9, fertMesFin:4, tempMin:5,  podaDias:365 },
  { especie:'Helecho',           tipo:'Interior', riegoVerano:3,  riegoInvierno:5,  diasFert:30, fertMesIni:9, fertMesFin:4, tempMin:15, podaDias:240 },
  { especie:'Pilea',             tipo:'Interior', riegoVerano:7,  riegoInvierno:10, diasFert:30, fertMesIni:9, fertMesFin:4, tempMin:10, podaDias:200 },
  { especie:'Potus',             tipo:'Interior', riegoVerano:8,  riegoInvierno:12, diasFert:45, fertMesIni:9, fertMesFin:4, tempMin:10, podaDias:null },
  { especie:'Planta cebra',      tipo:'Interior', riegoVerano:5,  riegoInvierno:8,  diasFert:30, fertMesIni:9, fertMesFin:4, tempMin:15, podaDias:200 },
  { especie:'Pata de elefante',  tipo:'Interior', riegoVerano:20, riegoInvierno:35, diasFert:60, fertMesIni:9, fertMesFin:4, tempMin:7,  podaDias:450 },
  { especie:'Dracena marginata',  tipo:'Interior', riegoVerano:10, riegoInvierno:16, diasFert:45, fertMesIni:9, fertMesFin:4, tempMin:10, podaDias:365 },
  { especie:'Philodendron imperial red', tipo:'Interior', riegoVerano:7, riegoInvierno:11, diasFert:30, fertMesIni:9, fertMesFin:4, tempMin:15, podaDias:240 },
  { especie:'Falsa aralia',      tipo:'Interior', riegoVerano:6,  riegoInvierno:10, diasFert:30, fertMesIni:9, fertMesFin:4, tempMin:15, podaDias:240 },
];
export const perfilEspecie = especie => {
  const buscado = String(especie||'').toLowerCase().trim();
  if (!buscado) return null;
  return ESPECIES.find(e => { const n=e.especie.toLowerCase(); return buscado.includes(n) || n.includes(buscado); }) || null;
};
export const mesEnTemporada = (mes, ini, fin) => !ini || !fin ? true : (ini<=fin ? (mes>=ini && mes<=fin) : (mes>=ini || mes<=fin));

const pISO = s => s ? new Date(s + 'T00:00:00') : null;
const dd = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));

export const esInterior = p => { const pf = perfilEspecie(p.especie || p.nombre); return !!(pf && pf.tipo === 'Interior'); };

// ctx: { hoy: Date a medianoche, clima: [{fecha, mm}], registro: [eventos de plantas],
//        diasPlagas: (nombre, mes) => intervalo de revisión, o null para el genérico }
const eventosDe = (ctx, pid, tipo) => ctx.registro.filter(r => r.planta === pid && (!tipo || r.tipo.includes(tipo))).sort((a, b) => a.fecha > b.fecha ? -1 : 1);
const ultimoEvento = (ctx, pid, tipo) => eventosDe(ctx, pid, tipo)[0] || null;

// aguaEfectiva/proxCalc combinan lo que ya calculó el trigger diario del Sheet
// (p.ultimoRiego, p.proximaFert, etc. — llega vía Firestore por sincronizarPlantasAFirestore)
// con los eventos cargados directo en la app, usando siempre la fecha más reciente
// entre ambas fuentes. Así el "días sin agua" no queda desactualizado ni por
// riegos anotados solo en la Sheet ni por riegos anotados solo en la app.
export const aguaEfectiva = (p, ctx) => {
  const riego = ultimoEvento(ctx, p.id, 'Riego') || ultimoEvento(ctx, p.id, 'Plantación');
  let fRiego = riego ? pISO(riego.fecha) : (p.fechaP ? pISO(p.fechaP) : null);
  if (p.ultimoRiego) {
    const fSheet = pISO(p.ultimoRiego);
    if (fSheet && (!fRiego || fSheet > fRiego)) fRiego = fSheet;
  }
  // Las plantas de interior no cuentan la lluvia como riego (no les llueve
  // encima) — igual que calcularUltimaAguaEfectiva() en Apps Script.
  if (esInterior(p)) return fRiego ? { fecha: fRiego, tipo: 'riego', mm: null } : null;
  let lluvia = null, mmLluvia = 0;
  [...ctx.clima].sort((a, b) => a.fecha > b.fecha ? -1 : 1).forEach(c => {
    if (lluvia) return;
    if (+c.mm >= UMBRAL_LLUVIA_MM) { lluvia = pISO(c.fecha); mmLluvia = +c.mm; }
  });
  if (lluvia && (!fRiego || lluvia > fRiego)) return { fecha: lluvia, tipo: 'lluvia', mm: mmLluvia };
  return fRiego ? { fecha: fRiego, tipo: 'riego', mm: null } : null;
};

const proxCalc = (p, ctx, tipoEvento, ultimaKey, proximaKey, intervaloDias) => {
  const ev = ultimoEvento(ctx, p.id, tipoEvento);
  const baseLocal = ev ? pISO(ev.fecha) : null;
  const baseSheet = p[ultimaKey] ? pISO(p[ultimaKey]) : null;
  const localEsMasReciente = baseLocal && (!baseSheet || baseLocal > baseSheet);
  let proxima;
  if (localEsMasReciente) { proxima = new Date(baseLocal); proxima.setDate(proxima.getDate() + intervaloDias); }
  else if (p[proximaKey]) proxima = pISO(p[proximaKey]);
  else {
    const base = baseSheet || baseLocal || (p.fechaP ? pISO(p.fechaP) : null);
    if (!base) return { proxima: null, dias: null };
    proxima = new Date(base); proxima.setDate(proxima.getDate() + intervaloDias);
  }
  return { proxima, dias: dd(ctx.hoy, proxima) };
};

export const estadoPlanta = (p, ctx) => {
  const hoy = ctx.hoy, mes = hoy.getMonth() + 1;
  const esVerano = CFG_PLA.mesesVerano.includes(mes);
  const perfil = perfilEspecie(p.especie || p.nombre);
  const limite = perfil ? (esVerano ? perfil.riegoVerano : perfil.riegoInvierno) : (esVerano ? CFG_PLA.diasSinRiegoVerano : CFG_PLA.diasSinRiegoInvierno);
  // Las plantas de interior ya no se riegan desde la app: sin conteo ni alertas de riego.
  const interior = !!(perfil && perfil.tipo === 'Interior');
  const agua = interior ? null : aguaEfectiva(p, ctx);
  const diasSinAgua = agua ? dd(agua.fecha, hoy) : null;
  const fueraDeTemporadaFert = perfil && !mesEnTemporada(mes, perfil.fertMesIni, perfil.fertMesFin);
  const fert = proxCalc(p, ctx, 'Fertiliz', 'ultimaFert', 'proximaFert', perfil ? perfil.diasFert : CFG_PLA.diasFert);
  const intervaloPlagas = ctx.diasPlagas(p.nombre, mes);
  const plagas = proxCalc(p, ctx, 'plagas', 'ultimaPlagas', 'proximaPlagas', intervaloPlagas != null ? intervaloPlagas : CFG_PLA.diasPlagas);
  const poda = proxCalc(p, ctx, 'Poda', 'ultimaPoda', 'proximaPoda', (perfil && perfil.podaDias) ? perfil.podaDias : CFG_PLA.diasPoda);
  return {
    diasSinAgua, limite, agua, interior,
    riegoUrg: diasSinAgua != null && diasSinAgua >= limite,
    riegoProx: diasSinAgua != null && diasSinAgua >= limite * 0.7 && diasSinAgua < limite,
    proximaFert: fert.proxima, diasParaFert: fert.dias, fertEnTemporada: !fueraDeTemporadaFert, fertUrg: !fueraDeTemporadaFert && fert.dias != null && fert.dias <= 0,
    proximaPlagas: plagas.proxima, diasParaPlagas: plagas.dias, plagasUrg: plagas.dias != null && plagas.dias <= 0,
    proximaPoda: poda.proxima, diasParaPoda: poda.dias, podaProx: poda.dias != null && poda.dias <= 30 && poda.dias >= 0,
  };
};
