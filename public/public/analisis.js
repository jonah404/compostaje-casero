import { fISO } from './util.js';

// Índice de condición (0–100) para el campo: temperatura media (ideal 22 °C), humedad media (ideal 60 %)
// y lluvia de la semana. tp y hp pueden ser null (sin dato = valor neutro); ll7 es mm en 7 días.
export const indiceCondicion = (tp, hp, ll7) => {
  const it = tp!=null ? Math.max(0,100-Math.abs(tp-22)*4) : 50;
  const ih = hp!=null ? Math.max(0,100-Math.abs(hp-60)*1.5) : 50;
  const il = Math.min(100, (ll7||0)*3);
  const idx = Math.round(it*0.5+ih*0.3+il*0.2);
  const il2 = idx>=80?'Excelente 🌟':idx>=60?'Buena ✅':idx>=40?'Regular ⚠️':'Desfavorable ❌';
  const ic = idx>=80?'var(--chart-1)':idx>=60?'var(--chart-1)':idx>=40?'var(--chart-3)':'var(--chart-4)';
  return { idx, il2, ic };
};

// Indicadores de los últimos 3, 7 y 30 días a partir del clima registrado. hoyFecha: Date a medianoche.
export const analisisClima = (clima, hoyFecha) => {
  const hoy = fISO(hoyFecha);
  const rc = n => { const l = new Date(hoyFecha); l.setDate(l.getDate()-n); return clima.filter(c=>c.fecha<=hoy&&c.fecha>=fISO(l)); };
  const c3=rc(3), c7=rc(7), c30=rc(30);
  const sum = (a,k) => a.reduce((s,c)=>s+(+c[k]||0),0);
  const avg = (a,k) => { const v=a.map(c=>+c[k]).filter(v=>!isNaN(v)&&v!=null); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; };
  const ll3=sum(c3,'mm'), ll7=sum(c7,'mm'), ll30=sum(c30,'mm');
  const tp7=avg(c7,'temp'), tx7=avg(c7,'tmax'), hp7=avg(c7,'hum'), ev7=sum(c7,'evapo'), vp7=avg(c7,'viento');
  const sorted = [...clima].filter(c=>c.fecha<=hoy).sort((a,b)=>a.fecha>b.fecha?-1:1);
  let sl=0; for(const c of sorted){if(c.lluvia==='si'||+c.mm>0)break;sl++;}
  let df=0; for(const c of sorted){if((+c.tmax||99)<5)df++;else break;}
  const { idx, il2, ic } = indiceCondicion(tp7, hp7, ll7);
  return {ll3,ll7,ll30,tp7,tx7,hp7,ev7,vp7,sl,df,idx,il2,ic,
    cr: tp7===null || (tp7>5 && (hp7===null||hp7>30)),
    nr: sl>=3 && hp7!=null && hp7<40};
};
