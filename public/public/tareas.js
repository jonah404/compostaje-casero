// Tareas de hoy, urgencias y estado de la pecera. Sin acceso a la app: todo entra por parámetro
// para poder probarlo. Mismos criterios que el evento "Tareas de hoy" del calendario (codigo.gs).
import { esInterior, perfilEspecie } from './plantas.js';

export const ETQ = { riego:'regar', fert:'fertilizar', plagas:'revisar plagas', poda:'poda', revolcada:'revolver' };
export const TEMP_CALOR = 38, TEMP_HELADA = 2, TEMP_HELADA_SEVERA = -2;

const pISO = s => s ? new Date(s + 'T00:00:00') : null;
const dd = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));
const n1 = v => (v != null && v !== '' && !isNaN(+v)) ? (+v).toFixed(1) : '—';

// ════ PECERA ════
// Fase "ciclado" = primeros CFG_PEC.diasFinCiclado días desde el armado/limpieza
// total: la bacteria nitrificante todavía no está establecida (se forma sola,
// no se registra), cambios de agua más frecuentes y sin tocar el filtro.
// Después pasa a la fase "establecida", con intervalos más largos.
export const CFG_PEC = { diasCambioAguaCiclado:3, diasCambioAguaEstable:7, diasLimpiezaFiltro:14, diasMinPrimeraLimpieza:25, diasFinCiclado:30 };

export const estadoPecera = (pecera, registro, hoy) => {
  const p = pecera || {};
  const eventos = tipo => registro.filter(r => r.tipo.includes(tipo)).sort((a, b) => a.fecha > b.fecha ? -1 : 1);
  const diasArmado = p.fechaArmado ? dd(pISO(p.fechaArmado), hoy) : null;
  const enCiclado = diasArmado == null || diasArmado < CFG_PEC.diasFinCiclado;

  const ultCambio = eventos('Cambio de agua')[0];
  const diasSinCambio = ultCambio ? dd(pISO(ultCambio.fecha), hoy) : diasArmado;
  const limiteCambio = enCiclado ? CFG_PEC.diasCambioAguaCiclado : CFG_PEC.diasCambioAguaEstable;
  const cambioUrg = diasSinCambio != null && diasSinCambio >= limiteCambio;

  const ultLimpieza = eventos('Limpieza')[0];
  const diasSinLimpieza = ultLimpieza ? dd(pISO(ultLimpieza.fecha), hoy) : diasArmado;
  const puedeLimpiar = !!ultLimpieza || diasArmado == null || diasArmado >= CFG_PEC.diasMinPrimeraLimpieza;
  const limpiezaUrg = puedeLimpiar && diasSinLimpieza != null && diasSinLimpieza >= CFG_PEC.diasLimpiezaFiltro;

  return { diasArmado, enCiclado, diasSinCambio, limiteCambio, cambioUrg, diasSinLimpieza, limpiezaUrg, puedeLimpiar };
};

// ════ TAREAS DE HOY ════
// ctx: { hoy, sistemas, plantas, proxRev(s)→Date|null, estPlanta(p), preventivos:[estado de cada tratamiento],
//        pecera:{estadoPecera}, sLbl(s), pLbl(p), nombreGrupo(g) }
export const armarTareas = ctx => {
  const { hoy: hoyFecha, sLbl, pLbl } = ctx;
  const hoy = [], prox = [];
  ctx.sistemas.forEach(s => {
    const p = ctx.proxRev(s); if (!p) return;
    const d = dd(hoyFecha, p);
    const base = { id:`revolcada-${s.id}`, area:'compost', tipo:'revolcada', ref:s.id, titulo:`${sLbl(s)} · revolver`, modo:'uno' };
    if (d <= 0) hoy.push({ ...base, detalle: d < 0 ? `atrasado ${-d} d` : 'toca hoy', atraso: -d });
    else if (d <= 3) prox.push({ ...base, detalle:`en ${d} d`, atraso: -d });
  });
  ctx.plantas.forEach(p => {
    const e = ctx.estPlanta(p);
    const base = (tipo, modo) => ({ id:`${tipo}-${p.id}`, area:'plantas', tipo, ref:p.id, titulo:`${pLbl(p)} · ${ETQ[tipo]}`, modo });
    if (e.riegoUrg) hoy.push({ ...base('riego','uno'), detalle:`${e.diasSinAgua} días sin agua (límite ${e.limite})`, atraso: e.diasSinAgua - e.limite });
    else if (e.riegoProx) prox.push({ ...base('riego','uno'), detalle:`${e.diasSinAgua} días sin agua`, atraso: 0 });
    [ { tipo:'fert', dias:e.diasParaFert, activo:e.fertEnTemporada }, { tipo:'plagas', dias:e.diasParaPlagas, activo:true } ].forEach(c => {
      if (!c.activo || c.dias == null) return;
      if (c.dias <= 0) hoy.push({ ...base(c.tipo,'form'), detalle: c.dias < 0 ? `${-c.dias} días de atraso` : 'toca hoy', atraso: -c.dias });
      else if (c.dias <= 3) prox.push({ ...base(c.tipo,'form'), detalle:`en ${c.dias} d`, atraso: -c.dias });
    });
    // Igual que "poda se acerca" del calendario: solo de 0 a 30 días antes.
    if (e.diasParaPoda != null && e.diasParaPoda >= 0 && e.diasParaPoda <= 30) {
      prox.push({ ...base('poda','form'), detalle: e.diasParaPoda === 0 ? 'toca hoy' : `en ${e.diasParaPoda} d`, atraso: -e.diasParaPoda });
    }
  });
  ctx.preventivos.forEach(e => {
    if (e.estado !== 'hoy' && e.estado !== 'prox') return;
    const t = { id:`prev-${e.g}-${e.tr.id}`, area:'plantas', tipo:'prev', ref:`${e.g}|${e.tr.id}`, modo:'uno',
      titulo:`🛡️ ${e.tr.nombre} · ${ctx.nombreGrupo(e.g).toLowerCase()}`,
      detalle:`${e.detalle} — ${e.tr.producto}`, atraso: -e.dias };
    (e.estado === 'hoy' ? hoy : prox).push(t);
  });
  const ep = ctx.pecera;
  const pec = (tipo, titulo, modo) => ({ id:`pec-${tipo}`, area:'pecera', tipo, ref:null, titulo, modo });
  if (ep.cambioUrg) hoy.push({ ...pec('cambio-agua','Cambio de agua','uno'), detalle:`${ep.diasSinCambio} días sin cambio (objetivo cada ${ep.limiteCambio} d)`, atraso: ep.diasSinCambio - ep.limiteCambio });
  else if (ep.diasSinCambio != null && ep.limiteCambio - ep.diasSinCambio <= 3) prox.push({ ...pec('cambio-agua','Cambio de agua','uno'), detalle:`en ${ep.limiteCambio - ep.diasSinCambio} d`, atraso: 0 });
  if (ep.limpiezaUrg) hoy.push({ ...pec('filtro','Limpiar filtro/esponja','form'), detalle:`${ep.diasSinLimpieza} días sin limpiar`, atraso: ep.diasSinLimpieza - CFG_PEC.diasLimpiezaFiltro });
  return { hoy, prox };
};

// ════ URGENTES ════
// Helada, frío en interior, calor extremo, compost listo (mismos umbrales que codigo.gs).
// ctx: { clima, plantas, sistemas, faseSistema(s)→'l'|…, sLbl, pLbl }
export const armarUrgentes = ctx => {
  const out = [];
  const ult = [...ctx.clima].sort((a, b) => a.fecha > b.fecha ? -1 : 1)[0];
  if (ult && ult.tmin != null && ult.tmin !== '') {
    const tmin = +ult.tmin;
    if (ctx.plantas.some(p => !esInterior(p)) && tmin <= TEMP_HELADA) {
      const sev = tmin <= TEMP_HELADA_SEVERA;
      out.push({ c: sev ? 'al-r' : 'al-w', t: (sev ? '🧊 Helada severa' : '❄️ Helada') + ' — proteger plantas de exterior', b:`Mínima registrada: ${n1(tmin)}°C` });
    }
    const frias = ctx.plantas.filter(p => { const pf = esInterior(p) && perfilEspecie(p.especie || p.nombre); return pf && pf.tempMin != null && tmin <= pf.tempMin + 2; });
    if (frias.length) out.push({ c:'al-w', t:'🥶 Frío — alejar de la ventana', b: frias.map(ctx.pLbl).join(', ') });
  }
  if (ult && ult.tmax != null && ult.tmax !== '' && +ult.tmax >= TEMP_CALOR) out.push({ c:'al-r', t:'🔥 Calor extremo — revisar humedad del compost', b:`Máxima registrada: ${n1(ult.tmax)}°C` });
  ctx.sistemas.filter(s => ctx.faseSistema(s) === 'l').forEach(s => out.push({ c:'al-ok', t:`🎉 ${ctx.sLbl(s)} — listo para cosechar`, b:'Más de 180 días en estanque' }));
  return out;
};
