// Estado de los sistemas de compost y de las revolcadas. Sin acceso a la app (todo entra por
// parámetro) para poder probarlo. Mismo criterio que verificarYCrearEventos() en codigo.gs.

const pISO = s => s ? new Date(s + 'T00:00:00') : null;
const dd = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));

export const DIAS_ENTRE_REVOLCADAS = 7;

// Maduración en estanque según el clima real. La actividad microbiana (y la de las lombrices)
// se duplica cada ~10 °C (Q10 ≈ 2) entre unos 10 y 20 °C: por debajo de 10 °C el material casi
// no avanza y desde 20 °C está en régimen pleno. Un sistema que madura en 90 días en plena
// actividad necesita unos 180 con frío. Por eso se cuentan "días de actividad plena" (1 por día
// cálido, hasta 0,5 por día frío) con la temperatura media REAL de cada día del historial.
export const DIAS_PLENOS_LISTO = 90, DIAS_PLENOS_CASI_LISTO = 60;   // 60/90 = 120/180 de antes
export const DIAS_PROYECCION = 14;   // para los días que aún no pasaron: la temperatura reciente

export const factorActividad = temp =>
  Math.min(1, Math.max(0.5, 2 ** ((temp - 20) / 10)));

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// clima: [{ fecha:'YYYY-MM-DD', temp }] (temp = media diaria). Devuelve fn(Date) → factor del día:
// el real si hay dato; si no (hoy, futuro o hueco), el de la temperatura media de los últimos
// DIAS_PROYECCION días con dato. Sin ningún dato queda en 0,75 (punto medio).
const factorPorDia = (clima, hoy) => {
  const mapa = new Map();
  (clima || []).forEach(c => { if (c && c.temp != null && !isNaN(+c.temp)) mapa.set(c.fecha, +c.temp); });
  const rec = [];
  const f = new Date(hoy);
  for (let i = 0; i < 60 && rec.length < DIAS_PROYECCION; i++) {
    f.setDate(f.getDate() - 1);
    const t = mapa.get(iso(f));
    if (t != null) rec.push(t);
  }
  const fProy = rec.length ? factorActividad(rec.reduce((a, b) => a + b, 0) / rec.length) : 0.75;
  return d => {
    if (d < hoy) { const t = mapa.get(iso(d)); if (t != null) return factorActividad(t); }
    return fProy;
  };
};

// Días de actividad plena acumulados entre desde y hoy (el día desde cuenta, hoy no).
export const diasPlenos = (desde, hoy, clima) => {
  const fd = factorPorDia(clima, hoy);
  let ac = 0;
  const f = new Date(desde);
  while (f < hoy) { ac += fd(f); f.setDate(f.getDate() + 1); }
  return ac;
};

// Días de calendario que hacen falta, desde, para juntar esos días de actividad plena:
// los ya transcurridos con su clima real y el resto proyectado con la temperatura reciente.
export const diasHastaPlenos = (desde, plenos, hoy, clima) => {
  const fd = factorPorDia(clima, hoy);
  let ac = 0, n = 0;
  const f = new Date(desde);
  while (ac < plenos && n < 1000) { ac += fd(f); f.setDate(f.getDate() + 1); n++; }
  return n;
};

// Fechas sin dato de temperatura entre desde y ayer (para ir a buscarlas).
export const huecosClima = (desde, hoy, clima) => {
  const tiene = new Set((clima || []).filter(c => c && c.temp != null).map(c => c.fecha));
  const f = new Date(desde), falt = [];
  while (f < hoy) { const k = iso(f); if (!tiene.has(k)) falt.push(k); f.setDate(f.getDate() + 1); }
  return falt;
};

export const faseSistema = (s, hoy, clima) => {
  if (!s.inicioC) return { label:'Sin datos', cls:'bv', fase:'v' };
  if (s.inicioE) {
    const ini = pISO(s.inicioE);
    const d = dd(ini, hoy);
    const plenos = diasPlenos(ini, hoy, clima);
    const meta = diasHastaPlenos(ini, DIAS_PLENOS_LISTO, hoy, clima);   // días de calendario estimados
    const pct = Math.min(100, Math.round(plenos / DIAS_PLENOS_LISTO * 100));
    const listo = new Date(ini); listo.setDate(listo.getDate() + meta);
    const extra = { d, meta, pct, plenos: Math.round(plenos), fechaListo: listo };
    if (plenos >= DIAS_PLENOS_LISTO) return { label:'✅ Listo', cls:'bl', fase:'l', ...extra };
    if (plenos >= DIAS_PLENOS_CASI_LISTO) return { label:'Casi listo', cls:'bq', fase:'q', ...extra };
    return { label:'En estanque', cls:'bs', fase:'s', ...extra };
  }
  return { label:'En carga', cls:'bc', fase:'c' };
};

// Igual que verificarYCrearEventos() del calendario: se revuelve cada 7 días también
// con el sistema ya en estanque (no se corta al cargar inicioE).
export const proxRevolcada = (s, revolcadas) => {
  if (!s.inicioC) return null;
  const r = revolcadas.filter(x => x.sistema === s.id).sort((a, b) => a.fecha > b.fecha ? -1 : 1);
  const base = r.length ? pISO(r[0].fecha) : pISO(s.inicioC);
  const p = new Date(base); p.setDate(p.getDate() + DIAS_ENTRE_REVOLCADAS); return p;
};

// De cada par de revolcadas seguidas del mismo sistema, cuántas se hicieron dentro de los 7 días.
export const revolcadasEnTiempo = revolcadas => {
  const bySis = {};
  [...revolcadas].sort((a, b) => a.fecha > b.fecha ? 1 : -1).forEach(r => { (bySis[r.sistema] ??= []).push(r.fecha); });
  let enTiempo = 0, totalPares = 0;
  Object.values(bySis).forEach(arr => {
    for (let i = 1; i < arr.length; i++) {
      totalPares++;
      if (dd(pISO(arr[i - 1]), pISO(arr[i])) <= DIAS_ENTRE_REVOLCADAS) enTiempo++;
    }
  });
  return { enTiempo, totalPares, pct: totalPares ? Math.round(enTiempo / totalPares * 100) : null };
};
