// Estado de los sistemas de compost y de las revolcadas. Sin acceso a la app (todo entra por
// parámetro) para poder probarlo. Mismo criterio que verificarYCrearEventos() en codigo.gs.

const pISO = s => s ? new Date(s + 'T00:00:00') : null;
const dd = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));

export const DIAS_LISTO = 180, DIAS_CASI_LISTO = 120, DIAS_ENTRE_REVOLCADAS = 7;

export const faseSistema = (s, hoy) => {
  if (!s.inicioC) return { label:'Sin datos', cls:'bv', fase:'v' };
  if (s.inicioE) {
    const d = dd(pISO(s.inicioE), hoy);
    if (d >= DIAS_LISTO) return { label:'✅ Listo', cls:'bl', fase:'l', d };
    if (d >= DIAS_CASI_LISTO) return { label:'Casi listo', cls:'bq', fase:'q', d };
    return { label:'En estanque', cls:'bs', fase:'s', d };
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
