
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { esAutorizado, nombreCorto, agruparEntradas, filtrarEntradas, htmlGrupo, claveGrupo } from './historial.js';
import { crearEscritor } from './escritor.js';
import { duenoDelDia } from './turnos.js';
import { estadoPlanta, esInterior } from './plantas.js';
import { faseSistema, huecosClima, proxRevolcada, revolcadasEnTiempo } from './compost.js';
import { fISO, pISO, fmt, dd, n1, n0, esc } from './util.js';
import { SEED_SIS, SEED_REV, SEED_CLI, SEED_PLA, SEED_REGPLA, SEED_PEC, SEED_REGPEC } from './semillas.js';
import { NIVEL_DIAS, NIVEL_LABEL, PROBLEMAS_CITRICOS_COMUN, FITOSANITARIO, fichaFito, nivelVigilancia, diasVigilancia } from './fitosanitario.js';
import { PAL, interp, luma, palGradient, GRAD, heatCell } from './heatmap.js';
import { analisisClima } from './analisis.js';
import { armarRespaldo, nombreRespaldo, registrosParaExcel } from './respaldo.js';
import { climaSparkSVG, donutSVG, hbarSVG, ringSVG } from './graficos.js';
import { ETQ, CFG_PEC, estadoPecera, armarTareas, armarUrgentes } from './tareas.js';
import { PLANES, GRUPOS, grupoDePlanta, estadoTratamiento, calendarioAnual } from './preventivo.js';
import {
  getFirestore, collection, doc,
  getDoc, getDocs, writeBatch,
  query, orderBy, limit, startAfter, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ════ FIREBASE CONFIG ════
const firebaseConfig = {
  apiKey: "AIzaSyCjlf3MS68H4lCSZbeWpdvCvv8tZjnm2cE",
  authDomain: "compostaje-casero.firebaseapp.com",
  projectId: "compostaje-casero",
  storageBucket: "compostaje-casero.firebasestorage.app",
  messagingSenderId: "570860670823",
  appId: "1:570860670823:web:2d061232d05e50b248a9c2"
};
// URL del Apps Script desplegado como Web App (Extensions > Apps Script > Deploy > New deployment > Web app).
const SHEET_SYNC_URL = "https://script.google.com/macros/s/AKfycbzCWQBqlaII2vayl6q5Vl2WwP_y9GVHxkkUcXAQiy46h6DSoRB9z5RPb3QE8lFOiBtX/exec";
const CLIMA_DIAS_FIRESTORE = 90;  // solo el clima se limita al cargar; el resto se trae completo
const CLIMA_DIAS_INICIAL = 14;    // filas que muestra el historial hasta tocar "Ver más"
// ?dry=1 → las funciones de escritura (Firestore/Sheet) solo loguean; sirve para
// probar la UI en el navegador sin tocar datos reales.
const DRY = new URLSearchParams(location.search).has('dry');
let db, auth, useFirebase = false;
try {
  const a = initializeApp(firebaseConfig);
  db = getFirestore(a);
  auth = getAuth(a);
  if (!firebaseConfig.apiKey.includes('TU_')) useFirebase = true;
} catch(e) {}

// ════ SEED DATA (planilla) ════
// ════ ESTADO ════
let S = JSON.parse(localStorage.getItem('compost_v7') || 'null');
if (!S) {
  S = { sistemas: SEED_SIS, revolcadas: SEED_REV, clima: SEED_CLI, climaLastFetch: null, plantas: SEED_PLA, registroPlantas: SEED_REGPLA, pecera: SEED_PEC, registroPecera: SEED_REGPEC };
  localStorage.setItem('compost_v7', JSON.stringify(S));
}
if (!S.plantas) S.plantas = SEED_PLA;
if (!S.registroPlantas) S.registroPlantas = SEED_REGPLA;
if (!S.pecera) S.pecera = SEED_PEC;
if (!S.registroPecera) S.registroPecera = SEED_REGPEC;
const sv = () => localStorage.setItem('compost_v7', JSON.stringify(S));
const upsertCli = arr => arr.forEach(c => {
  const i = S.clima.findIndex(x => x.fecha === c.fecha);
  i >= 0 ? (S.clima[i] = {...S.clima[i], ...c}) : S.clima.push(c);
});

// ════ OPEN-METEO ════
const todayISO = () => new Date().toISOString().split('T')[0];
const subDays  = (iso, n) => { const d = new Date(iso+'T12:00:00'); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; };
const DIRS = ['⬆️N','↗️NE','➡️E','↘️SE','⬇️S','↙️SO','⬅️O','↖️NO'];

async function fetchClima(start, end) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=-33.4939&longitude=-60.0628`
    +`&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,precipitation_hours`
    +`,windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant`
    +`,relative_humidity_2m_max,relative_humidity_2m_min,et0_fao_evapotranspiration,sunshine_duration`
    +`&timezone=America%2FArgentina%2FBuenos_Aires&start_date=${start}&end_date=${end}`;
  try {
    const r = await fetch(url); if (!r.ok) return [];
    const j = await r.json(); const d = j.daily; if (!d?.time) return [];
    return d.time.map((fecha, i) => {
      const hx = d.relative_humidity_2m_max?.[i] ?? null;
      const hn = d.relative_humidity_2m_min?.[i] ?? null;
      const mm = d.precipitation_sum?.[i] ?? 0;
      const g  = d.winddirection_10m_dominant?.[i];
      return {
        id:'c-'+fecha, fecha,
        temp: d.temperature_2m_mean?.[i] ?? null,
        tmax: d.temperature_2m_max?.[i]  ?? null,
        tmin: d.temperature_2m_min?.[i]  ?? null,
        hum: hx!=null&&hn!=null ? Math.round((hx+hn)/2) : null,
        humMax: hx, humMin: hn,
        lluvia: mm > 0 ? 'si' : 'no', mm,
        hsLluvia: d.precipitation_hours?.[i] ?? 0,
        viento: d.windspeed_10m_max?.[i]  ?? null,
        rafaga: d.windgusts_10m_max?.[i]  ?? null,
        dir: g != null ? DIRS[Math.round(g/45)%8]+' '+Math.round(g)+'°' : '',
        evapo: d.et0_fao_evapotranspiration?.[i] ?? null,
        sol: d.sunshine_duration?.[i] != null ? +(d.sunshine_duration[i]/3600).toFixed(1) : null,
        notas: '', auto: true
      };
    });
  } catch(e) { return []; }
}

async function autoFetch(force = false) {
  const hoy = todayISO();
  if (!force && S.climaLastFetch === hoy) return false;
  const datos = await fetchClima(subDays(hoy, 35), subDays(hoy, 1));
  if (!datos.length) return false;
  upsertCli(datos); S.climaLastFetch = hoy; sv();
  if (useFirebase) datos.forEach(c => fbSave('clima', c.id, c, { sinHistorial:true }).catch(()=>{}));
  return true;
}

// Los estanques se miden con la temperatura real de cada día: si falta alguna del historial
// (sistema cargado hace más de 35 días, o sin conexión esos días) se pide a Open-Meteo.
async function completarClimaEstanques() {
  const hoy = todayISO();
  if (S.climaHuecosChequeo === hoy) return false;
  const inicios = S.sistemas.filter(x => x.inicioC && x.inicioE).map(x => x.inicioE).sort();
  if (!inicios.length) return false;
  const faltan = huecosClima(pISO(inicios[0]), TODAY, S.clima);
  S.climaHuecosChequeo = hoy;
  if (!faltan.length) { sv(); return false; }
  const datos = (await fetchClima(faltan[0], faltan[faltan.length - 1])).filter(c => faltan.includes(c.fecha));
  sv();
  if (!datos.length) return false;
  upsertCli(datos); sv();
  if (useFirebase) datos.forEach(c => fbSave('clima', c.id, c, { sinHistorial:true }).catch(()=>{}));
  return true;
}

// ════ FIREBASE OPS ════
// Cada escritura lleva autor (_by) y deja una entrada en la colección `historial`
// (ver escritor.js). opts: { grupo, sinHistorial }.
const { fbSave, fbAdd, fbDel, restaurar: fbRestaurar } = crearEscritor({
  db,
  sdk: { doc, collection, getDoc, writeBatch, serverTimestamp },
  getUsuario: () => window.usuarioActual(),
  ctx: { plantaNombre: id => { const p = S.plantas.find(x => x.id == id); return p ? pLbl(p) : 'planta ' + id; }, sistemaLabel: id => { const x = S.sistemas.find(y => y.id == id); return x ? sLbl(x) : 'Sistema ' + id; } },
  dry: DRY,
  habilitado: () => useFirebase,
  alFallarHistorial: () => toast('Guardado, pero no se pudo registrar en el historial')
});
// Al reemplazar una colección con lo que trae Firestore, conserva los registros
// locales pendientes (_pend + id generado en el dispositivo) que todavía no tienen
// su par allá: los guardados mientras la consulta estaba en curso o que nunca
// llegaron. Hace falta _pend porque muchos documentos de Firestore también tienen
// ids con formato local (vienen del Sheet); sin él, lo borrado o editado en otro
// lado reaparecería. No se re-envían a Firestore/Sheet (duplicaría).
const conservarLocales = (antes, ahora, esLocalId, claveFn) => {
  const claves = new Set(ahora.map(claveFn));
  return ahora.concat((antes || []).filter(r => r && r._pend && esLocalId(String(r.id)) && !claves.has(claveFn(r))));
};
const ID_LOCAL_REV = id => /^\d{13}$/.test(id);
const ID_LOCAL_PLA = id => /^ev\d/.test(id);
const ID_LOCAL_PEC = id => /^kv\d/.test(id);
let climaCursor = null;   // fecha del clima más viejo traído de Firestore (para "Ver más")
const fbLoad = async () => {
  if (!useFirebase) return;
  try {
    const sd = await getDocs(collection(db,'sistemas'));
    sd.forEach(d => { const x=d.data(); const i=S.sistemas.findIndex(s=>s.id===x.id); i>=0?(S.sistemas[i]={...S.sistemas[i],...x}):S.sistemas.push(x); });
    // En revolcadas/registroPlantas/registroPecera el id del DOCUMENTO va después del
    // spread: el `id` guardado adentro es el local (Date.now / 'ev…' / 'kv…') y, si
    // ganaba, fbDel apuntaba a un documento inexistente y borrar no borraba nada.
    const rd = await getDocs(query(collection(db,'revolcadas'),orderBy('fecha','desc')));
    if (rd.docs.length) S.revolcadas = conservarLocales(S.revolcadas, rd.docs.map(d=>({...d.data(),id:d.id})), ID_LOCAL_REV, r => r.sistema+'|'+r.fecha);
    const cd = await getDocs(query(collection(db,'clima'),orderBy('fecha','desc'),limit(CLIMA_DIAS_FIRESTORE)));
    if (cd.docs.length) { upsertCli(cd.docs.map(d=>({id:d.id,...d.data()}))); climaCursor = cd.docs[cd.docs.length-1].data().fecha; }
    const pd = await getDocs(collection(db,'plantas'));
    pd.forEach(d => { const x=d.data(); const i=S.plantas.findIndex(p=>p.id===x.id); i>=0?(S.plantas[i]={...S.plantas[i],...x}):S.plantas.push(x); });
    // Firestore es la fuente de verdad: una planta borrada allá no debe sobrevivir en la copia local.
    if (pd.docs.length) { const vivas = new Set(pd.docs.map(d=>d.data().id)); S.plantas = S.plantas.filter(p=>vivas.has(p.id)); }
    const prd = await getDocs(query(collection(db,'registroPlantas'),orderBy('fecha','desc')));
    if (prd.docs.length) S.registroPlantas = conservarLocales(S.registroPlantas, prd.docs.map(d=>({...d.data(),id:d.id})), ID_LOCAL_PLA, r => r.planta+'|'+r.fecha+'|'+r.tipo);
    { const ids = new Set(S.plantas.map(p=>p.id)); S.registroPlantas = S.registroPlantas.filter(r=>ids.has(r.planta)); }
    const kd = await getDocs(collection(db,'pecera'));
    kd.forEach(d => { if (d.id==='main') S.pecera = {...S.pecera, ...d.data()}; });
    const krd = await getDocs(query(collection(db,'registroPecera'),orderBy('fecha','desc')));
    if (krd.docs.length) S.registroPecera = conservarLocales(S.registroPecera, krd.docs.map(d=>({...d.data(),id:d.id})), ID_LOCAL_PEC, r => r.fecha+'|'+r.tipo);
    sv();
    marcarSync();
  } catch(e) { toast('Sin conexión con la nube: se muestra lo guardado en este dispositivo'); }
};

// ════ ÚLTIMA SINCRONIZACIÓN ════
// Se anota cada vez que fbLoad() trae los datos de Firestore sin errores; si falla, la hora
// queda vieja y el texto se pone en naranja a partir de la hora.
const CLAVE_SYNC = 'brote_ultimo_sync';
const leerSync = () => { try { return +localStorage.getItem(CLAVE_SYNC) || null; } catch(e) { return null; } };
const textoSync = (ts, ahora = Date.now()) => {
  if (!ts) return 'Sin sincronizar todavía';
  const min = Math.max(0, Math.floor((ahora - ts) / 60000));
  if (min < 1) return 'Sincronizado ahora';
  if (min < 60) return 'Sincronizado hace ' + min + ' min';
  const h = Math.floor(min / 60);
  return h < 24 ? 'Sincronizado hace ' + h + ' h' : 'Sincronizado hace ' + Math.floor(h / 24) + ' d';
};
const pintarSync = () => {
  const ts = leerSync(), txt = textoSync(ts), viejo = !ts || Date.now() - ts >= 3600000;
  ['sync-ult-side', 'sync-ult-mob'].forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = txt; el.classList.toggle('viejo', viejo); } });
};
const marcarSync = () => { try { localStorage.setItem(CLAVE_SYNC, String(Date.now())); } catch(e) {} pintarSync(); };
setInterval(pintarSync, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pintarSync(); });

// ════ SYNC A GOOGLE SHEET (Apps Script Web App) ════
// fetch en modo no-cors: no podemos leer la respuesta, pero evita el preflight CORS
// que el Web App de Apps Script no maneja. Es "fire and forget".
// Manda el ID token de Firebase: el Apps Script lo valida y solo acepta las cuentas
// autorizadas (el correo que figura en la Sheet sale del token, no de lo que diga el cliente).
// Si el envío falla de entrada (sin conexión, sin token) queda en una cola local y se
// reintenta al volver la conexión o al abrir la app. Lo que Apps Script rechace después
// de recibirlo no se puede ver desde acá (no-cors): eso lo cubre el sync diario Sheet → Firestore.
const COLA_SHEET = 'brote_cola_sheet';
const leerCola = () => { try { return JSON.parse(localStorage.getItem(COLA_SHEET) || '[]'); } catch(e) { return []; } };
const guardarCola = c => { try { localStorage.setItem(COLA_SHEET, JSON.stringify(c)); } catch(e) {} };
const enviarSheet = async (tipo, data) => {
  const idToken = auth && auth.currentUser ? await auth.currentUser.getIdToken() : '';
  if (!idToken) throw new Error('sin sesión');
  await fetch(SHEET_SYNC_URL, {
    method: 'POST', mode: 'no-cors', keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ tipo, data, idToken })
  });
};
const sheetSync = async (tipo, data) => {
  if (!SHEET_SYNC_URL) return;
  if (DRY) { console.info('[dry] sheetSync', tipo, data); return; }
  try { await enviarSheet(tipo, data); }
  catch(e) {
    guardarCola([...leerCola(), { tipo, data }]);
    mostrarEstadoRed();
    toast('Sin conexión con la planilla: se reintenta solo al volver');
  }
};
let vaciandoCola = false;
const vaciarColaSheet = async () => {
  if (vaciandoCola || DRY || !SHEET_SYNC_URL) return;
  vaciandoCola = true;
  try {
    let cola = leerCola();
    while (cola.length) {
      try { await enviarSheet(cola[0].tipo, cola[0].data); } catch(e) { break; }
      cola = cola.slice(1); guardarCola(cola);   // se guarda de a uno: si se corta, no se reenvía lo ya enviado
    }
  } finally { vaciandoCola = false; mostrarEstadoRed(); }
};
const mostrarEstadoRed = () => {
  const el = document.getElementById('estado-red'); if (!el) return;
  const sinRed = typeof navigator !== 'undefined' && navigator.onLine === false;
  const pend = leerCola().length;
  el.textContent = sinRed
    ? 'Sin conexión: lo que cargues se guarda y se envía al volver' + (pend ? ' · ' + pend + ' pendiente' + (pend > 1 ? 's' : '') : '')
    : pend ? pend + ' cambio' + (pend > 1 ? 's' : '') + ' pendiente' + (pend > 1 ? 's' : '') + ' de enviar a la planilla' : '';
  el.classList.toggle('hide', !sinRed && !pend);
};
window.addEventListener('online', () => { mostrarEstadoRed(); vaciarColaSheet().then(mostrarEstadoRed); });
window.addEventListener('offline', mostrarEstadoRed);
mostrarEstadoRed();
pintarSync();

// Las tarjetas son <div role="button">: Enter o Espacio las abren como un clic.
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.sysc[role="button"]')) { e.preventDefault(); e.target.click(); }
});

// ════ UTILS ════
// A medianoche local: si quedara con la hora real, los "días sin agua/cambio/
// etc" cambiarían según a qué hora del día se abre la app (Math.round podía
// redondear para arriba a la tardecita), y además dejaba de coincidir con el
// servidor, que siempre calcula "hoy" a medianoche.
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const cdDia = f => S.clima.find(c => c.fecha === f) || null;

const est = s => faseSistema(s, TODAY, S.clima);
const proxRev = s => proxRevolcada(s, S.revolcadas);
const sLbl = s => s.nombre ? `#${s.id} — ${s.nombre}` : `Sistema ${s.id}`;

// ════ PLANTAS — cálculos ════
const regEventos = (pid, tipo) => S.registroPlantas.filter(r => r.planta===pid && (!tipo || r.tipo.includes(tipo))).sort((a,b)=>a.fecha>b.fecha?-1:1);
const ultimoEvento = (pid, tipo) => regEventos(pid, tipo)[0] || null;
const estPlanta = p => estadoPlanta(p, {
  hoy: TODAY, clima: S.clima, registro: S.registroPlantas,
  diasPlagas: (nombre, mes) => { const f = fichaFito(nombre); return f ? diasVigilancia(f, mes) : null; },
});
const pLbl = p => p.nombre || `Planta ${p.id}`;

// ════ PREVENTIVO (fumigación programada) ════
// Calendario por grupo en preventivo.js. Acá se cruza con lo registrado (tipo
// "🛡️ Preventivo", detalle = nombre del tratamiento) y con el clima ya cargado en
// la app (lluvia que lava el fungicida, calor), sin depender de ninguna API externa.
const grupoP = p => grupoDePlanta(p.nombre, p.especie, esInterior(p));
const ultimaPrev = (p, tr) => { const r = regEventos(p.id, 'Preventivo').find(x => x.detalle === tr.nombre); return r ? pISO(r.fecha) : null; };
const lluviaDesde = fecha => S.clima.reduce((a, c) => { const f = pISO(c.fecha); return f && f > fecha ? a + (+c.mm || 0) : a; }, 0);
// Un tratamiento se agenda por grupo (no por planta): se toma la planta más atrasada
// y al marcarlo se registra para todas las del grupo.
const estadoPreventivos = () => {
  const grupos = {};
  S.plantas.forEach(p => { const g = grupoP(p); if (g) (grupos[g] = grupos[g] || []).push(p); });
  const ult = [...S.clima].sort((a,b) => a.fecha > b.fecha ? -1 : 1)[0];
  const tmax = ult && ult.tmax != null && ult.tmax !== '' ? +ult.tmax : null;
  const out = [];
  Object.keys(grupos).forEach(g => PLANES[g].forEach(tr => {
    const ults = grupos[g].map(p => ultimaPrev(p, tr));
    const ultima = ults.some(u => !u) ? null : new Date(Math.min(...ults));
    const e = estadoTratamiento(tr, ultima, TODAY, { mmDesdeUltima: tr.lavable && ultima ? lluviaDesde(ultima) : 0, tmax });
    out.push({ g, tr, plantas: grupos[g], ultima, ...e });
  }));
  return out;
};
// Aplicaciones que ya se hicieron antes de que existiera el calendario: se cargan una
// sola vez (por dispositivo) y solo si esa planta no tiene ya el registro. [grupo, tratamiento]
const PREV_PREVIAS = { fecha:'2026-10-25', clave:'prev_previas_20261025', items:[
  ['citrico','cobre-brotes'], ['citrico','insecticida-brotes'],
  ['carozo','fungicida-primavera'], ['carozo','insecticida-brotes'],
  ['interior','fungicida-interior'], ['interior','jabon-neem-interior'] ] };
const cargarPreviasPrev = async () => {
  try { if (localStorage.getItem(PREV_PREVIAS.clave)) return; } catch(e) {}
  const nuevas = [];
  PREV_PREVIAS.items.forEach(([g, trId]) => {
    const tr = PLANES[g].find(x => x.id === trId);
    S.plantas.filter(p => grupoP(p) === g).forEach(p => {
      if (S.registroPlantas.some(r => r.planta === p.id && r.detalle === tr.nombre && r.fecha === PREV_PREVIAS.fecha)) return;
      nuevas.push(registrarEventoPlanta(p.id, PREV_PREVIAS.fecha, TIPO_EVT.prev, tr.nombre, `${tr.producto} — ${tr.dosis}`, 'Cargado a posteriori: aplicado el 25/10'));
    });
  });
  try { localStorage.setItem(PREV_PREVIAS.clave, '1'); } catch(e) {}
  if (nuevas.length) { await Promise.all(nuevas); toast('🛡️ Cargué las aplicaciones del 25/10'); refresh(); }
};
const MESES_ABR = ['E','F','M','A','M','J','J','A','S','O','N','D'];
const prevHTML = () => {
  const est = estadoPreventivos();
  if (!est.length) return '';
  const mesAct = TODAY.getMonth() + 1;
  const chip = e => e.estado === 'hoy' ? `<span class="tk-late" style="padding:1px 7px;border-radius:9px;font-size:11px">${e.dias < 0 ? 'atrasado' : 'toca hoy'}</span>`
    : e.estado === 'prox' ? `<span style="font-size:11px;color:var(--umber-mid)">en ${e.dias} d</span>`
    : e.estado === 'ok' ? `<span style="font-size:11px;color:var(--ink3)">al día · en ${e.dias} d</span>`
    : `<span style="font-size:11px;color:var(--ink3)">fuera de época</span>`;
  const grupos = [...new Set(est.map(e => e.g))];
  return `<details class="fold" open><summary>🛡️ Calendario preventivo · ${est.filter(e => e.estado === 'hoy').length} para hoy</summary>
    ${grupos.map(g => `
      <div style="font-weight:600;margin:12px 0 4px">${GRUPOS[g].icono} ${GRUPOS[g].nombre} <span style="font-weight:400;font-size:12px;color:var(--ink3)">· ${est.find(e => e.g === g).plantas.map(p => esc(pLbl(p))).join(', ')}</span></div>
      ${calendarioAnual(g).map(fila => {
        const e = est.find(x => x.g === g && x.tr.id === fila.trat.id);
        return `<div style="padding:8px 0;border-top:1px solid var(--paper3)">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-size:13px">${fila.trat.nombre}</b>${chip(e)}</div>
          <div style="display:flex;gap:2px;margin:6px 0">${fila.meses.map((on, i) => `<span style="flex:1;text-align:center;font-size:10px;padding:2px 0;border-radius:3px;${on ? 'background:var(--sage);color:var(--on-accent);' : 'background:var(--paper3);color:var(--ink3);'}${i + 1 === mesAct ? 'outline:2px solid var(--ink);' : ''}">${MESES_ABR[i]}</span>`).join('')}</div>
          <div style="font-size:12px;color:var(--ink3)"><b>${fila.trat.producto}</b> — ${fila.trat.dosis}${fila.trat.nota ? `<br><i>${fila.trat.nota}</i>` : ''}</div>
          ${e.ultima ? `<div style="font-size:11px;color:var(--ink3);margin-top:3px">Última: ${fmt(fISO(e.ultima))}</div>` : ''}
        </div>`;
      }).join('')}`).join('')}
    <div style="font-size:12px;color:var(--ink3);font-style:italic;margin-top:10px">Referencia general para huerta familiar — confirmá contra la etiqueta de tu producto. Aplicar a la tardecita, sin viento ni lluvia próxima. Primero se monitorea (ver Fitosanitario en cada planta); esto es solo lo preventivo.</div>
  </details>`;
};

// ════ PECERA ════
// Fase "ciclado" = primeros CFG_PEC.diasFinCiclado días desde el armado/limpieza
// total: la bacteria nitrificante todavía no está establecida (se forma sola,
// no se registra), cambios de agua más frecuentes y sin tocar el filtro.
// Después pasa a la fase "establecida", con intervalos más largos.
const pecEventos = tipo => S.registroPecera.filter(r => !tipo || r.tipo.includes(tipo)).sort((a,b)=>a.fecha>b.fecha?-1:1);
const estPecera = () => estadoPecera(S.pecera, S.registroPecera, TODAY);
// ════ RENDER SYS CARD ════
const sysHTML = s => {
  const e=est(s), p=proxRev(s), d=p?dd(TODAY,p):null;
  const rc = S.revolcadas.filter(r=>r.sistema===s.id).length;
  let pp=0, pc='';
  if(e.fase==='s'){pp=e.pct;pc='pfb';}
  if(e.fase==='q'){pp=e.pct;pc='pfa';}
  if(e.fase==='l'){pp=100;pc='pfg';}
  const mp = [s.inicioC?'Carga: '+fmt(s.inicioC):'', s.inicioE?'Estanque: '+fmt(s.inicioE):'', rc?rc+' revolcada(s)':''].filter(Boolean);
  return `<div class="sysc" role="button" tabindex="0" onclick="openSis(${s.id})">
    <div class="sysc-top">
      <span class="sysc-name">${esc(sLbl(s))}</span>
      <span style="display:flex;align-items:center;gap:6px">
        <span class="badge ${e.cls}">${e.label}${e.d?' · '+e.d+'d':''}</span>
        <button class="del-btn" onclick="delSis(${s.id},event)" title="Eliminar sistema" aria-label="Eliminar sistema"><i class="ti ti-trash"></i></button>
      </span>
    </div>
    ${mp.length?`<div class="sysc-meta">${mp.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>`:''}
    ${pp?`<div class="prog"><div class="pf ${pc}" style="width:${pp}%"></div></div><div class="prog-lb"><span>${e.d} días</span><span>meta ~${e.meta} días</span></div>`:''}
    ${p?`<div class="rev-pill ${d<0?'rph':d<=2?'rpp':'rpo'}"><i class="ti ti-refresh" style="font-size:12px"></i>${d<0?'Atrasado '+(-d)+'d':d===0?'HOY':'En '+d+'d'}</div>`:''}
  </div>`;
};

// ════ ANÁLISIS EXTRA — con los datos que se van acumulando ════
const analisisExtra = () => {
  const { totalPares, pct: pctRevolcadas } = revolcadasEnTiempo(S.revolcadas);

  const totalPlantas = S.plantas.length;
  let plantasOk = 0;
  S.plantas.forEach(p=>{ const e=estPlanta(p); if(!e.riegoUrg && !e.fertUrg && !e.plagasUrg) plantasOk++; });
  const pctPlantas = totalPlantas ? Math.round(plantasOk/totalPlantas*100) : null;

  return { pctRevolcadas, totalPares, pctPlantas, plantasOk, totalPlantas };
};

// ════ HOY ════
// Une lo que ya calculan estPlanta/proxRev/estPecera en una lista de tareas.
// Mismos criterios que el evento "Tareas de hoy" del calendario (codigo.gs).
const TIPO_EVT = { riego:'💧 Riego', fert:'🌿 Fertilización', plagas:'🐛 Revisión plagas', poda:'✂️ Poda', prev:'🛡️ Preventivo' };
const AREAS_HOY = [ {id:'compost', t:'🌱 Compost'}, {id:'plantas', t:'🪴 Plantas'}, {id:'pecera', t:'🐠 Pecera'} ];
const diferidos = new Map();   // id de tarea → { timer, commit } (ver "marcar hecho")
let TAREAS = new Map();



const armarTareasHoy = () => armarTareas({
  hoy: TODAY, sistemas: S.sistemas, plantas: S.plantas, proxRev, estPlanta,
  preventivos: estadoPreventivos(), pecera: estPecera(), sLbl, pLbl, nombreGrupo: g => GRUPOS[g].nombre,
});
window.armarTareasHoy = armarTareasHoy;

// Lo ya registrado hoy (de los mismos tipos que generan tareas).
const hechasHoy = () => {
  const hoyISO = fISO(TODAY), out = [];
  S.revolcadas.filter(r => r.fecha === hoyISO).forEach(r => {
    const s = S.sistemas.find(x => x.id === r.sistema);
    out.push({ titulo:`${s ? sLbl(s) : 'Sistema '+r.sistema} · revolcada` });
  });
  const prevVistos = new Set();   // un preventivo se registra para todo el grupo: se muestra una sola vez
  S.registroPlantas.filter(r => r.fecha === hoyISO && /Riego|Fertiliz|plagas|Poda|Preventivo/.test(r.tipo)).forEach(r => {
    if (/Preventivo/.test(r.tipo)) {
      if (prevVistos.has(r.detalle)) return;
      prevVistos.add(r.detalle); out.push({ titulo:`🛡️ ${r.detalle || 'Preventivo'}` }); return;
    }
    const p = S.plantas.find(x => x.id === r.planta);
    out.push({ titulo:`${p ? pLbl(p) : 'Planta'} · ${r.tipo.replace(/^\S+\s/, '')}` });
  });
  S.registroPecera.filter(r => r.fecha === hoyISO && /Cambio de agua|Limpieza/.test(r.tipo)).forEach(r => {
    out.push({ titulo:`Pecera · ${r.tipo.replace(/^\S+\s/, '')}` });
  });
  return out;
};

const urgentesHoy = () => armarUrgentes({ clima: S.clima, plantas: S.plantas, sistemas: S.sistemas, faseSistema: x => est(x).fase, sLbl, pLbl });

const filaTarea = (t, enEspera = false) => `<div class="tk ${enEspera ? 'tk-done' : (t.atraso > 0 ? 'tk-late' : '')}">
  <div class="tk-body"><div class="tk-t">${esc(t.titulo)}</div><div class="tk-d">${enEspera ? 'Registrado — se guarda en unos segundos' : esc(t.detalle)}</div></div>
  ${enEspera
    ? `<button class="tk-btn tk-undo" onclick="deshacerTarea('${t.id}')">Deshacer</button>`
    : `<button class="tk-btn" aria-label="${t.modo === 'uno' ? 'Marcar hecha' : 'Registrar'}" onclick="tareaTap('${t.id}')">${t.modo === 'uno' ? '✓' : '›'}</button>`}
</div>`;

const renderHoy = () => {
  const { hoy, prox } = armarTareasHoy();
  TAREAS = new Map([...hoy, ...prox].map(t => [t.id, t]));
  const pend  = hoy.filter(t => !diferidos.has(t.id));
  const hechas = hechasHoy();
  const urg   = urgentesHoy();
  const ch    = cdDia(fISO(TODAY)) || [...S.clima].sort((a,b) => a.fecha > b.fecha ? -1 : 1)[0];
  const nC = pend.filter(t => t.area === 'compost').length, nP = pend.filter(t => t.area === 'plantas').length;
  const seccion = a => {
    const l = hoy.filter(t => t.area === a.id).sort((x,y) => y.atraso - x.atraso);
    return l.length ? `<div class="tk-grp">${a.t}</div>${l.map(t => filaTarea(t, diferidos.has(t.id))).join('')}` : '';
  };
  document.getElementById('hoy-c').innerHTML = `
    <div class="hoy-date">${TODAY.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</div>
    <div class="chips">
      <button class="chip" onclick="go('cli')">${ch ? `🌡 ${n1(ch.temp)}${n1(ch.temp) !== '—' ? '°' : ''}${+ch.mm > 0 ? ` · ☔ ${n1(ch.mm)} mm` : ''}` : '🌡 —'}</button>
      <button class="chip" onclick="go('comp')">🌱 Compost · ${nC}</button>
      <button class="chip" onclick="go('pla')">🪴 Plantas · ${nP}</button>
    </div>
    ${urg.map(a => `<div class="al ${a.c}"><div class="al-t">${esc(a.t)}</div>${a.b ? `<div class="al-b">${esc(a.b)}</div>` : ''}</div>`).join('')}
    <div class="sh">Tareas de hoy para ${duenoDelDia(TODAY)} <span class="sh-sub">${pend.length}</span></div>
    ${hoy.length
      ? AREAS_HOY.map(seccion).join('')
      : `<div class="card tk-empty">Todo al día 🌿${prox[0] ? `<div class="tk-d">Próximo: ${esc(prox[0].titulo)} — ${esc(prox[0].detalle)}</div>` : ''}</div>`}
    ${hechas.length ? `<details class="fold"><summary>Hechas hoy · ${hechas.length}</summary>${hechas.map(h => `<div class="tk tk-done"><div class="tk-body"><div class="tk-t">${esc(h.titulo)}</div></div></div>`).join('')}</details>` : ''}
    ${prox.length ? `<details class="fold"><summary>Próximos · ${prox.length}</summary>${prox.map(t => `<div class="tk"><div class="tk-body"><div class="tk-t">${esc(t.titulo)}</div><div class="tk-d">${esc(t.detalle)}</div></div></div>`).join('')}</details>` : ''}`;
};
window.renderHoy = renderHoy;

// ── Marcar como hecho ────────────────────────────────────────────────
// El guardado real se demora DEMORA_DESHACER ms: si se toca "Deshacer" antes,
// nunca se escribe nada. No se escribe-y-luego-borra porque la sincronización
// diaria del Sheet puede resucitar documentos borrados de Firestore.
const DEMORA_DESHACER = 5000;
const ejecutarTarea = t => {
  const hoy = fISO(TODAY);
  if (t.tipo === 'revolcada')   return registrarRevolcada(t.ref, hoy);
  if (t.tipo === 'riego')       return registrarEventoPlanta(t.ref, hoy, TIPO_EVT.riego);
  if (t.tipo === 'cambio-agua') return registrarEventoPecera(hoy, '💧 Cambio de agua parcial');
  if (t.tipo === 'prev') {
    const [g, trId] = t.ref.split('|');
    const tr = PLANES[g].find(x => x.id === trId);
    return Promise.all(S.plantas.filter(p => grupoP(p) === g)
      .map(p => registrarEventoPlanta(p.id, hoy, TIPO_EVT.prev, tr.nombre, `${tr.producto} — ${tr.dosis}`)));
  }
};
const marcarHecha = t => {
  if (diferidos.has(t.id)) return;
  const commit = async () => {
    const d = diferidos.get(t.id); if (!d) return;
    clearTimeout(d.timer); diferidos.delete(t.id);
    // La parte síncrona de ejecutarTarea ya deja el registro en S: se re-renderiza
    // enseguida para que "Deshacer" no quede visible sin efecto durante la escritura.
    const p = ejecutarTarea(t);
    renderHoy();
    try { await p; toast(`✅ Registrado — ${t.titulo}`); }
    finally { refresh(); }
  };
  diferidos.set(t.id, { timer: setTimeout(commit, DEMORA_DESHACER), commit });
  renderHoy();
};
window.deshacerTarea = id => {
  const d = diferidos.get(id); if (!d) return;
  clearTimeout(d.timer); diferidos.delete(id);
  renderHoy();
};
// Si la app se cierra o pasa a segundo plano dentro de la demora, se guarda ya.
const vaciarDiferidos = () => [...diferidos.values()].forEach(d => d.commit());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') vaciarDiferidos(); });
// TODAY se fija al cargar: si la PWA vuelve a primer plano en otro día, se recarga
// (los toques pendientes ya se guardaron al pasar a segundo plano).
const DIA_CARGA = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== DIA_CARGA) location.reload();
});
window.addEventListener('pagehide', vaciarDiferidos);

window.tareaTap = id => {
  const t = TAREAS.get(id); if (!t) return;
  if (t.modo === 'uno') { marcarHecha(t); return; }
  if (t.tipo === 'filtro') openRegistro('fc-pecEvt', { tipo:'🧽 Limpieza de filtro/esponja' });
  else openRegistro('fc-plaEvt', { planta:t.ref, tipo:TIPO_EVT[t.tipo] });
};

// ════ RENDER SISTEMAS ════
const renderSist = () => {
  document.getElementById('sist-c').innerHTML = S.sistemas.map(s=>sysHTML(s)).join('');
};

// ════ RESUMEN DE COMPOST (antes en Inicio) ════
const renderCompostResumen = () => {
  const an = analisisClima(S.clima, TODAY), ax = analisisExtra();
  const cnt = f => S.sistemas.filter(s => s.inicioC && est(s).fase === f).length;
  const n = { c:cnt('c'), s:cnt('s'), q:cnt('q'), l:cnt('l') };
  const donut = donutSVG([
    {value:n.c, color:'var(--chart-1)'}, {value:n.s, color:'var(--chart-2)'},
    {value:n.q, color:'var(--chart-3)'}, {value:n.l, color:'var(--chart-5)'},
  ]);
  const legend = [
    {n:'En carga', v:n.c, c:'var(--chart-1)'}, {n:'En estanque', v:n.s, c:'var(--chart-2)'},
    {n:'Casi listo', v:n.q, c:'var(--chart-3)'}, {n:'Listo', v:n.l, c:'var(--chart-5)'},
  ];
  const revBarMax = Math.max(1, ...S.sistemas.map(s => S.revolcadas.filter(r => r.sistema === s.id).length));
  const colorPct = p => p == null ? 'var(--ink3)' : p >= 80 ? 'var(--chart-1)' : p >= 50 ? 'var(--chart-3)' : 'var(--chart-4)';
  document.getElementById('comp-resumen').innerHTML = `
    <div class="card">
      <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:10px">Estado de sistemas</div>
      <div class="donut-wrap">
        ${donut}
        <div class="donut-legend">
          ${legend.map(l => `<div class="donut-legend-item"><span style="display:flex;align-items:center;gap:7px"><span class="donut-dot" style="background:${l.c}"></span>${l.n}</span><b>${l.v}</b></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="ring-row">
      <div class="ring-tile">
        ${ringSVG(ax.pctRevolcadas, colorPct(ax.pctRevolcadas))}
        <div class="ring-tile-l">Revolcadas en tiempo</div>
        <div class="ring-tile-s">${ax.totalPares ? ax.totalPares+' intervalos' : 'sin datos'}</div>
      </div>
    </div>
    <div class="card">
      <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:10px">Revolcadas por sistema</div>
      ${S.sistemas.some(s => s.inicioC) ? hbarSVG(
        S.sistemas.filter(s => s.inicioC).map((s,i) => ({
          label: sLbl(s),
          value: S.revolcadas.filter(r => r.sistema === s.id).length,
          color: ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-5)','var(--chart-4)'][i%5]
        })), revBarMax
      ) : `<div style="font-size:13px;color:var(--ink3)">Sin sistemas activos.</div>`}
    </div>
    <div class="cond">
      <div class="cond-hdr"><span class="cond-t">Índice de condición</span><span class="cond-s" style="color:${an.ic}">${an.idx}/100</span></div>
      <div class="cond-bar"><div class="cond-f" style="width:${an.idx}%;background:${an.ic}"></div></div>
      <div style="font-size:13px;color:${an.ic};font-weight:700;margin-bottom:10px">${an.il2}</div>
      <div class="pills">
        <span class="pill" style="background:${an.cr?'var(--sage-bg)':'var(--umber-bg)'};color:${an.cr?'var(--sage)':'var(--umber)'}">🔄 ${an.cr?'Conviene revolver':'Esperar para revolver'}</span>
        <span class="pill" style="background:${an.nr?'var(--umber-bg)':'var(--sage-bg)'};color:${an.nr?'var(--umber)':'var(--sage)'}">💧 ${an.nr?'Necesita riego':'Riego OK'}</span>
        ${an.df ? `<span class="pill" style="background:var(--sky-bg);color:var(--sky)">❄️ ${an.df}d de frío</span>` : ''}
      </div>
    </div>
    <div class="sh">Sistemas</div>`;
};

// ════ RENDER PLANTAS ════
const plantHTML = p => {
  const e = estPlanta(p);
  const badges = [];
  if (e.riegoUrg) badges.push(`<span class="badge" style="background:var(--rust-bg);color:var(--rust)">💧 Regar — ${e.diasSinAgua}d sin agua</span>`);
  else if (e.riegoProx) badges.push(`<span class="badge" style="background:var(--umber-bg);color:var(--umber)">💧 Riego pronto</span>`);
  else if (e.diasSinAgua!=null) badges.push(`<span class="badge bc">💧 ${e.diasSinAgua}d sin agua</span>`);
  if (e.fertUrg) badges.push(`<span class="badge" style="background:var(--umber-bg);color:var(--umber)">🌿 Fertilizar</span>`);
  if (e.plagasUrg) badges.push(`<span class="badge" style="background:var(--sky-bg);color:var(--sky)">🐛 Revisar plagas</span>`);
  if (e.podaProx) badges.push(`<span class="badge bv">✂️ Poda cerca</span>`);
  const meta = [p.variedad||p.especie, p.ubicacion].filter(Boolean).join(' · ');
  return `<div class="sysc" role="button" tabindex="0" onclick="openPla(${p.id})">
    <div class="sysc-top">
      <span class="sysc-name">${esc(pLbl(p))}</span>
      ${p.estado?`<span class="badge bv">${p.estado}</span>`:''}
    </div>
    ${meta?`<div class="sysc-meta">${meta}</div>`:''}
    <div class="pills" style="margin-top:8px">${badges.join('')||'<span class="badge bl">✅ Al día</span>'}</div>
  </div>`;
};
const renderPla = () => {
  document.getElementById('pla-c').innerHTML = prevHTML() + S.plantas.map(p=>plantHTML(p)).join('') || '<div style="font-size:13px;color:var(--ink3)">Sin plantas registradas.</div>';
};

// ════ RESUMEN DE PLANTAS (antes en Inicio) ════
const renderPlaResumen = () => {
  const ax = analisisExtra();
  const ests = S.plantas.map(estPlanta);
  const estsRiego = ests.filter(e => !e.interior);
  const nUrg = estsRiego.filter(e => e.riegoUrg).length;
  const nProx = estsRiego.filter(e => e.riegoProx).length;
  const nOk = estsRiego.length - nUrg - nProx;
  const donut = donutSVG([
    {value:nOk, color:'var(--chart-1)'}, {value:nProx, color:'var(--chart-3)'}, {value:nUrg, color:'var(--chart-4)'},
  ], 112, 15, 'plantas');
  const legend = [ {n:'Al día', v:nOk, c:'var(--chart-1)'}, {n:'Riego pronto', v:nProx, c:'var(--chart-3)'}, {n:'Regar ahora', v:nUrg, c:'var(--chart-4)'} ];
  document.getElementById('pla-resumen').innerHTML = S.plantas.length ? `
    ${estsRiego.length ? `<div class="card">
      <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:10px">Riego de plantas</div>
      <div class="donut-wrap">
        ${donut}
        <div class="donut-legend">
          ${legend.map(l => `<div class="donut-legend-item"><span style="display:flex;align-items:center;gap:7px"><span class="donut-dot" style="background:${l.c}"></span>${l.n}</span><b>${l.v}</b></div>`).join('')}
        </div>
      </div>
    </div>` : ''}
    <div class="ring-row">
      <div class="ring-tile">
        ${ringSVG(ax.pctPlantas, ax.pctPlantas == null ? 'var(--ink3)' : ax.pctPlantas >= 80 ? 'var(--chart-1)' : ax.pctPlantas >= 50 ? 'var(--chart-3)' : 'var(--chart-4)')}
        <div class="ring-tile-l">Plantas al día</div>
        <div class="ring-tile-s">${ax.totalPlantas} plantas</div>
      </div>
    </div>
    <div class="sh">Plantas</div>` : '';
};

// ════ RENDER REVOLCADAS ════
const renderRev = () => {
  const f = document.getElementById('hf').value;
  let revs = [...S.revolcadas].sort((a,b)=>a.fecha>b.fecha?-1:1);
  if (f!=='todos') revs = revs.filter(r=>r.sistema===+f);
  if (!revs.length) { document.getElementById('rev-c').innerHTML='<div style="font-size:13px;color:var(--ink3);padding:24px;text-align:center">Sin revolcadas registradas</div>'; return; }
  const byS = {};
  revs.forEach(r=>{if(!byS[r.sistema])byS[r.sistema]=[];byS[r.sistema].push(r.fecha);});
  Object.keys(byS).forEach(k=>byS[k].sort());
  const rows = revs.map(r => {
    const c = cdDia(r.fecha);
    const arr = byS[r.sistema], idx = arr.indexOf(r.fecha);
    const diasAnt = idx > 0 ? dd(pISO(arr[idx-1]), pISO(r.fecha)) : null;
    const ok = diasAnt!==null ? (diasAnt<=7?`<span style="color:var(--sage);font-weight:700">✅ En tiempo</span>`:`<span style="color:var(--rust);font-weight:700">⚠️ Demorado</span>`) : `<span style="color:var(--ink3)">Primera</span>`;
    return `<tr>
      <td><b>Sistema ${r.sistema}</b></td>
      <td>${fmt(r.fecha)}</td>
      <td style="text-align:center">${diasAnt!==null?diasAnt:'—'}</td>
      <td>${ok}</td>
      <td style="font-size:12px;color:var(--ink3)">${c?`${n1(c.temp)}°C · ${n0(c.hum)}% · ${c.lluvia==='si'?'☔ '+n1(c.mm)+'mm':'sin lluvia'} · ${n0(c.viento)} km/h`:'Sin datos de clima'}</td>
      <td style="font-size:12px;color:var(--ink3);font-style:italic">${esc(r.obs)}</td>
      <td><button class="del-btn" aria-label="Eliminar revolcada" onclick="delRev('${r.id}',event)"><i class="ti ti-x"></i></button></td>
    </tr>`;
  }).join('');
  document.getElementById('rev-c').innerHTML=`
    <table class="rtbl">
      <thead><tr>
        <th>Sistema</th><th>Fecha</th><th style="text-align:center">Días ant.</th>
        <th>¿En tiempo?</th><th>Clima del día</th><th>Observaciones</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};
window.renderRev = renderRev;

// ════ RENDER PECERA ════
const renderPec = () => {
  const p = S.pecera || {};
  const e = estPecera();
  const regs = [...S.registroPecera].sort((a,b)=>a.fecha>b.fecha?-1:1);

  const statsHTML = `
    <div class="g4" style="margin-bottom:16px">
      <div class="stat"><div class="stat-l">Volumen</div><div class="stat-v">${esc(p.litros)||'—'}L</div><div class="stat-s">${e.enCiclado?'🔄 en ciclado':'✅ establecida'}</div></div>
      <div class="stat"><div class="stat-l">Desde el armado</div><div class="stat-v">${e.diasArmado!=null?e.diasArmado:'—'}</div><div class="stat-s">días</div></div>
      <div class="stat"><div class="stat-l">Último cambio de agua</div><div class="stat-v" style="color:${e.cambioUrg?'var(--rust)':'var(--sage)'}">${e.diasSinCambio!=null?e.diasSinCambio+'d':'—'}</div><div class="stat-s">objetivo cada ${e.limiteCambio}d</div></div>
      <div class="stat"><div class="stat-l">Última limpieza filtro</div><div class="stat-v" style="color:${e.limpiezaUrg?'var(--rust)':'var(--sage)'}">${e.diasSinLimpieza!=null?e.diasSinLimpieza+'d':'—'}</div><div class="stat-s">${e.puedeLimpiar?'objetivo cada '+CFG_PEC.diasLimpiezaFiltro+'d':'esperar al día '+CFG_PEC.diasMinPrimeraLimpieza}</div></div>
    </div>
    <div class="pills" style="margin-bottom:16px">
      ${e.cambioUrg?`<span class="badge" style="background:var(--rust-bg);color:var(--rust)">💧 Cambio de agua atrasado</span>`:`<span class="badge bl">💧 Cambio de agua al día</span>`}
      ${e.limpiezaUrg?`<span class="badge" style="background:var(--umber-bg);color:var(--umber)">🧽 Limpiar filtro/esponja</span>`:''}
    </div>
    ${p.notas?`<div style="font-size:12px;color:var(--ink3);font-style:italic;margin-bottom:16px">${esc(p.notas)}</div>`:''}
    <div class="fc" style="margin-bottom:16px">
      <h3><i class="ti ti-flask"></i>Guía de dosis</h3>
      <div style="font-size:12px;color:var(--ink3);line-height:1.7">
        <b>🧪 Anticloro:</b> la dosis que ya tenés establecida para tu producto — se agrega al agua nueva antes de cada cambio.<br>
        <b>🔵 Azul de metileno:</b> uso puntual/preventivo, no de rutina — ~1 gota cada 2L de agua tratada. Para pez enfermo en pecera hospital: 1ml cada 10L (~5 gotas/L), renovar cada 48h por 4-6 días. Retirar el carbón activado del filtro mientras se usa (lo neutraliza). <i>Referencia general — confirmá contra la etiqueta de tu producto, las concentraciones varían entre marcas.</i><br>
      </div>
    </div>`;

  const rows = regs.map(r => `<tr>
      <td>${fmt(r.fecha)}</td>
      <td>${esc(r.tipo)}</td>
      <td style="font-size:12px;color:var(--ink3)">${esc(r.detalle)}</td>
      <td style="font-size:12px;color:var(--ink3);font-style:italic">${esc(r.resultado)}</td>
      <td><button class="del-btn" aria-label="Eliminar evento" onclick="delEventoPecera('${r.id}',event)"><i class="ti ti-x"></i></button></td>
    </tr>`).join('');
  const tableHTML = regs.length
    ? `<div class="tbl-wrap"><div class="tbl-scroll"><table class="rtbl">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Resultado</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`
    : `<div style="font-size:13px;color:var(--ink3);padding:24px;text-align:center">Sin eventos registrados</div>`;

  document.getElementById('pec-c').innerHTML = statsHTML + tableHTML;
};
window.renderPec = renderPec;

// ════ FITOSANITARIO (sección de la ficha de cada planta) ════
const fitoHTML = p => {
  const ficha = fichaFito(p.nombre); // por nombre, no por especie (ver nota en Task 2 del plan fitosanitario)
  if (!ficha) return '';
  const nivel = nivelVigilancia(ficha, TODAY.getMonth()+1);
  const rows = ficha.problemas.map(pr => `<tr>
      <td>${pr.nombre}</td>
      <td style="font-size:12px;color:var(--ink3)">${pr.sintoma}</td>
      <td style="font-size:12px"><b>${pr.producto}</b><br><span style="color:var(--ink3)">${pr.dosis}</span></td>
    </tr>`).join('');
  return `<details class="fold" open>
    <summary>🐛 Fitosanitario · ${nivel} ${NIVEL_LABEL[nivel]}</summary>
    <div style="font-size:12px;color:var(--ink3);margin:6px 0"><b>Momento crítico:</b> ${ficha.momentoCritico}</div>
    <div style="font-size:12px;color:var(--ink3);margin-bottom:10px"><b>Qué monitorear:</b> ${ficha.monitoreo}</div>
    <div style="overflow-x:auto"><table class="rtbl" style="width:100%">
      <thead><tr><th>Problema</th><th>Qué vas a ver</th><th>Producto / Dosis</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div style="font-size:12px;color:var(--ink3);font-style:italic;margin-top:10px">Referencia general — confirmá contra la etiqueta de tu producto, las concentraciones varían entre marcas. Para plagas persistentes o graves, conviene un diagnóstico específico antes de tratar.</div>
  </details>`;
};

// ════ CABECERA DE CLIMA (antes en Inicio): gráfico de 21 días + clima reciente ════
const climaHeadHTML = () => {
  const ch = cdDia(fISO(TODAY)) || [...S.clima].sort((a,b) => a.fecha > b.fecha ? -1 : 1)[0];
  return `<div class="card">
    <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:8px">Temperatura y lluvia — últimos 21 días</div>
    ${climaSparkSVG(S.clima, TODAY, 21)}
    <div class="sep"></div>
    <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:10px">Clima reciente <span class="sh-sub">${ch ? fmt(ch.fecha) : ''}</span></div>
    ${ch ? `<div>
      <div class="clh-row">
        <div><div class="clh-temp">${n1(ch.temp)}°</div><div class="clh-sub">${ch.lluvia==='si' ? '☔ Llovió' : 'Sin lluvia'}${+ch.mm>0 ? ' — '+n1(ch.mm)+' mm' : ''}</div></div>
        <div class="clh-right"><div class="clh-hum">${n0(ch.hum)}<span>%</span></div><div class="clh-mini">humedad relativa</div></div>
      </div>
      <div class="clg">
        <div class="cli"><div class="cli-l">Máx</div><div class="cli-v">${n1(ch.tmax)}<span class="cli-u">°C</span></div></div>
        <div class="cli"><div class="cli-l">Mín</div><div class="cli-v">${n1(ch.tmin)}<span class="cli-u">°C</span></div></div>
        <div class="cli"><div class="cli-l">Viento</div><div class="cli-v">${n1(ch.viento)}<span class="cli-u"> km/h</span></div></div>
        <div class="cli"><div class="cli-l">Evapo</div><div class="cli-v">${n1(ch.evapo)}<span class="cli-u"> mm</span></div></div>
      </div>
    </div>` : `<div style="font-size:13px;color:var(--ink3)">Sin datos. Pulsá Sincronizar.</div>`}
  </div>`;
};

// ════ RENDER CLIMA ════
let climaVerTodo = false;
// Muestra todo lo que hay en el dispositivo y, si Firestore tiene días anteriores, trae otro bloque.
window.climaMas = async () => {
  climaVerTodo = true;
  // Cursor: el día más viejo que trajo Firestore (no el local, que en un
  // dispositivo nuevo es el seed y dejaría un hueco sin traer).
  const cursor = climaCursor || [...S.clima].sort((a,b) => a.fecha < b.fecha ? -1 : 1)[0]?.fecha;
  if (useFirebase && cursor) {
    try {
      const cd = await getDocs(query(collection(db,'clima'),orderBy('fecha','desc'),startAfter(cursor),limit(CLIMA_DIAS_FIRESTORE)));
      if (cd.docs.length) { upsertCli(cd.docs.map(d => ({id:d.id,...d.data()}))); climaCursor = cd.docs[cd.docs.length-1].data().fecha; sv(); }
    } catch(e) {}
  }
  renderCli();
};
const renderCli = () => {
  const an = analisisClima(S.clima, TODAY);
  const sorted = [...S.clima].sort((a,b)=>a.fecha>b.fecha?-1:1);
  const shown = climaVerTodo ? sorted : sorted.slice(0, CLIMA_DIAS_INICIAL);
  const hoy = fISO(TODAY);
  document.getElementById('fetch-bar').classList.add('hide');

  // Summary stats
  const statsHTML = `
    <div class="g4" style="margin-bottom:10px">
      <div class="stat"><div class="stat-l">Temp prom 7d</div><div class="stat-v">${n1(an.tp7)}°</div><div class="stat-s">°C promedio</div></div>
      <div class="stat"><div class="stat-l">Humedad 7d</div><div class="stat-v">${n0(an.hp7)}%</div><div class="stat-s">promedio</div></div>
      <div class="stat"><div class="stat-l">Lluvia 7d</div><div class="stat-v">${n1(an.ll7)}</div><div class="stat-s">mm acumulados</div></div>
      <div class="stat"><div class="stat-l">Lluvia 30d</div><div class="stat-v">${n1(an.ll30)}</div><div class="stat-s">mm acumulados</div></div>
    </div>
    <div class="g4" style="margin-bottom:20px">
      <div class="stat"><div class="stat-l">Sin lluvia</div><div class="stat-v">${an.sl}</div><div class="stat-s">días consecutivos</div></div>
      <div class="stat"><div class="stat-l">Evapo 7d</div><div class="stat-v">${n1(an.ev7)}</div><div class="stat-s">mm total</div></div>
      <div class="stat"><div class="stat-l">Viento 7d</div><div class="stat-v">${n1(an.vp7)}</div><div class="stat-s">km/h promedio</div></div>
      <div class="stat"><div class="stat-l">Condición</div><div class="stat-v" style="color:${an.ic}">${an.idx}</div><div class="stat-s">/100 — ${an.il2.split(' ').slice(-1)[0]}</div></div>
    </div>`;

  // Tabla heatmap (sin columna UV)
  const tableHTML = shown.length ? `
    <div class="tbl-wrap"><div class="tbl-scroll">
      <table class="ctbl">
        <thead><tr>
          <th>Fecha</th>
          <th>T° prom</th><th>T° máx</th><th>T° mín</th>
          <th>Hum%</th><th>¿Llovió?</th><th>mm</th><th>Hs lluvia</th>
          <th>Viento</th><th>Ráfaga</th><th>Dirección</th>
          <th>Evapo</th><th>Sol (h)</th><th>Notas</th>
        </tr></thead>
        <tbody>
          ${shown.map(c => {
            const isHoy = c.fecha === hoy;
            // lluvia cell
            const llovioCell = c.lluvia==='si'||+c.mm>0
              ? `<td style="background:#1565C0;color:#fff;font-weight:700">✅ Sí</td>`
              : `<td style="background:#e8f5e9;color:#2e7d32">❌ No</td>`;
            return `<tr class="${isHoy?'hoy':''}">
              <td>${fmt(c.fecha)}</td>
              ${heatCell(c.temp,  'temp', n1(c.temp)+'°')}
              ${heatCell(c.tmax,  'temp', n1(c.tmax)+'°')}
              ${heatCell(c.tmin,  'temp', n1(c.tmin)+'°')}
              ${heatCell(c.hum,   'hum',  n0(c.hum)+'%')}
              ${llovioCell}
              ${heatCell(c.mm,    'lluvia')}
              ${heatCell(c.hsLluvia, 'hsLluvia')}
              ${heatCell(c.viento,'viento')}
              ${heatCell(c.rafaga,'viento')}
              <td style="text-align:left;font-size:12px;color:var(--ink2)">${c.dir||'—'}</td>
              ${heatCell(c.evapo, 'evapo')}
              ${heatCell(c.sol,   'sol')}
              <td style="text-align:left;font-size:12px;color:var(--ink3)">${esc(c.notas)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div></div>` : `<div style="font-size:13px;color:var(--ink3);text-align:center;padding:32px">Sin datos. Pulsá Sincronizar.</div>`;

  document.getElementById('cli-c').innerHTML =
    climaHeadHTML() +
    `<div class="sh">Resumen <span class="sh-sub">análisis climatico</span></div>${statsHTML}` +
    `<div class="sh">Historial <span class="sh-sub">${shown.length} de ${sorted.length} días — colores por valor</span></div>` +
    tableHTML +
    (!climaVerTodo ? `<button class="btn-o" style="margin-top:6px" onclick="climaMas()">Ver más días</button>` : '');
};

// ════ MODAL SISTEMA ════
window.openSis = id => {
  const s = S.sistemas.find(x=>x.id===id);
  const e=est(s), p=proxRev(s), d=p?dd(TODAY,p):null;
  const revs = S.revolcadas.filter(r=>r.sistema===id).sort((a,b)=>a.fecha>b.fecha?-1:1);
  document.getElementById('mtitle').textContent = sLbl(s);
  document.getElementById('mbody').innerHTML = `
    <div style="margin-bottom:14px"><span class="badge ${e.cls}" style="font-size:12px;padding:5px 12px">${e.label}${e.d?' · '+e.d+' días':''}</span></div>
    ${(e.fase==='s'||e.fase==='q'||e.fase==='l')?`<div class="prog" style="height:6px;margin-bottom:4px"><div class="pf ${e.fase==='l'?'pfg':e.fase==='q'?'pfa':'pfb'}" style="width:${e.pct}%"></div></div><div class="prog-lb" style="margin-bottom:14px"><span>${e.d} días</span><span>meta ~${e.meta} días · listo ~${e.fechaListo.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'})}</span></div>`:``}
    <table class="mt-tbl">
      <tr><td>Inicio carga</td><td>${fmt(s.inicioC)}</td></tr>
      <tr><td>Fin carga</td><td>${fmt(s.finC)}</td></tr>
      <tr><td>Inicio estanque</td><td>${fmt(s.inicioE)}</td></tr>
      ${p?`<tr><td>Próx. revolver</td><td style="color:${d<=0?'var(--rust-mid)':d<=2?'var(--umber-mid)':'var(--ink)'};font-weight:700">${d<=0?'HOY ⚠️':fmt(fISO(p))}</td></tr>`:''}
      <tr><td>Revolcadas</td><td>${revs.length}</td></tr>
    </table>
    ${s.notas?`<div style="font-size:12px;color:var(--ink2);background:var(--paper2);padding:11px;border-radius:var(--r);margin:14px 0">${esc(s.notas)}</div>`:''}
    <div style="font-family:var(--serif);font-size:17px;color:var(--ink);margin:18px 0 10px">Revolcadas</div>
    ${revs.length?`<div style="overflow-x:auto"><table class="rtbl" style="width:100%">
      <thead><tr><th>Fecha</th><th>Clima del día</th><th>Observaciones</th></tr></thead>
      <tbody>${revs.map(r=>{const c=cdDia(r.fecha);return`<tr>
        <td><b>${fmt(r.fecha)}</b></td>
        <td style="font-size:12px">${c?`${n1(c.temp)}°C · ${n0(c.hum)}% · ${c.lluvia==='si'?'☔':''}`:'—'}</td>
        <td style="font-size:12px;color:var(--ink3);font-style:italic">${esc(r.obs)}</td>
      </tr>`;}).join('')}</tbody>
    </table></div>`:
    `<div style="font-size:13px;color:var(--ink3)">Sin revolcadas registradas</div>`}
    <div style="height:14px"></div>
    <button class="btn-g" onclick="closeMod();openRegistro('fc-rev',{sistema:${id}})">Registrar revolcada</button>
    <div style="height:7px"></div>
    <button class="btn-o" onclick="closeMod();openRegistro('fc-sisEdit',{sistema:${id}})">Editar sistema</button>`;
  document.getElementById('mwrap').classList.add('on');
};
window.openPla = id => {
  const p = S.plantas.find(x=>x.id===id);
  const e = estPlanta(p);
  const eventos = regEventos(id);
  document.getElementById('mtitle').textContent = pLbl(p);
  document.getElementById('mbody').innerHTML = `
    <table class="mt-tbl">
      <tr><td>Variedad / Especie</td><td>${esc([p.variedad,p.especie].filter(Boolean).join(' / '))||'—'}</td></tr>
      <tr><td>Fecha plantación</td><td>${fmt(p.fechaP)}</td></tr>
      <tr><td>Ubicación</td><td>${esc(p.ubicacion)||'—'}</td></tr>
      <tr><td>Estado</td><td>${p.estado||'—'}</td></tr>
      <tr><td>Días sin agua</td><td style="color:${e.riegoUrg?'var(--rust-mid)':e.riegoProx?'var(--umber-mid)':'var(--ink)'}">${e.diasSinAgua!=null?e.diasSinAgua+' días (límite '+e.limite+')':'—'}</td></tr>
      <tr><td>Próxima fertilización</td><td style="color:${e.fertUrg?'var(--umber-mid)':'var(--ink)'}">${e.proximaFert?fmt(fISO(e.proximaFert))+(e.diasParaFert<0?' — atrasada':''):'—'}</td></tr>
      <tr><td>Próxima revisión de plagas</td><td style="color:${e.plagasUrg?'var(--sky-mid)':'var(--ink)'}">${e.proximaPlagas?fmt(fISO(e.proximaPlagas))+(e.diasParaPlagas<0?' — atrasada':''):'—'}</td></tr>
      <tr><td>Próxima poda</td><td>${e.proximaPoda?fmt(fISO(e.proximaPoda)):'—'}</td></tr>
    </table>
    ${p.notas?`<div style="font-size:12px;color:var(--ink2);background:var(--paper2);padding:11px;border-radius:var(--r);margin:14px 0">${esc(p.notas)}</div>`:''}
    ${fitoHTML(p)}
    <div style="font-family:var(--serif);font-size:17px;color:var(--ink);margin:18px 0 10px">Historial</div>
    ${eventos.length?`<div style="overflow-x:auto"><table class="rtbl" style="width:100%">
      <thead><tr><th>Fecha</th><th>Evento</th><th>Detalle</th><th>Resultado</th></tr></thead>
      <tbody>${eventos.map(r=>`<tr>
        <td><b>${fmt(r.fecha)}</b></td>
        <td>${esc(r.tipo)}</td>
        <td style="font-size:12px;color:var(--ink3)">${esc(r.detalle)}${r.producto?' — '+esc(r.producto):''}</td>
        <td style="font-size:12px;color:var(--ink3);font-style:italic">${esc(r.resultado)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`:`<div style="font-size:13px;color:var(--ink3)">Sin eventos registrados</div>`}
    <div style="height:14px"></div>
    <button class="btn-g" onclick="closeMod();openRegistro('fc-plaEvt',{planta:${id}})">Registrar evento</button>
    <div style="height:7px"></div>
    <button class="btn-o" onclick="closeMod();openRegistro('fc-plaEdit',{planta:${id}})">Editar planta</button>
    <div style="height:7px"></div>
    <button class="btn-del" onclick="delPlanta(${id})"><i class="ti ti-trash"></i> Eliminar planta</button>`;
  document.getElementById('mwrap').classList.add('on');
};
window.onMClick = e => { if(e.target===document.getElementById('mwrap')) closeMod(); };
window.closeMod = () => document.getElementById('mwrap').classList.remove('on');

// ════ ACCIONES ════
// Escritura compartida entre los formularios y los toques de "Hoy".
// sheetSync va ANTES de esperar a Firestore: addDoc solo resuelve con el ack del
// servidor, y si la app se cierra en el medio el POST (keepalive) nunca saldría.
// _pend (solo local, no viaja a Firestore/Sheet) marca lo que aún no tiene ack de
// Firestore: fbLoad lo conserva (ver conservarLocales).
const registrarLocal = async (lista, col, tipoSheet, datos) => {
  const r = { ...datos, _pend:true };
  lista.push(r); sv();
  sheetSync(tipoSheet, datos);
  const fbId = await fbAdd(col, datos); if (fbId) { r.id = fbId; delete r._pend; sv(); }
  return r;
};
const registrarRevolcada = (sistema, fecha, obs = '') =>
  registrarLocal(S.revolcadas, 'revolcadas', 'revolcada', { id:Date.now().toString(), sistema, fecha, obs });
let seqEv = 0;   // evita ids repetidos al registrar varias plantas en el mismo milisegundo
const registrarEventoPlanta = (planta, fecha, tipo, detalle = '', producto = '', resultado = '') =>
  registrarLocal(S.registroPlantas, 'registroPlantas', 'plantaEvento', { id:'ev'+Date.now()+(++seqEv), planta, fecha, tipo, detalle, producto, resultado });
const registrarEventoPecera = (fecha, tipo, detalle = '', resultado = '') =>
  registrarLocal(S.registroPecera, 'registroPecera', 'peceraEvento', { id:'kv'+Date.now(), fecha, tipo, detalle, resultado });
// Deshace un registro recién guardado: lo saca de la lista local y de Firestore. La planilla
// no recibe borrados (igual que al eliminar a mano), así que la fila queda ahí.
const deshacerRegistro = async (lista, col, rec, ids = ID_LOCAL_REV) => {
  const i = lista.indexOf(rec); if (i >= 0) lista.splice(i, 1);
  sv();
  if (rec.id && !ids(String(rec.id))) await fbDel(col, rec.id);
  refresh();
  toast('Registro deshecho');
};
window.saveRev = async () => {
  const f=document.getElementById('rf').value, si=+document.getElementById('rs').value;
  if(!f){ toast('Completá la fecha'); return; }
  const rec = await registrarRevolcada(si, f, document.getElementById('ro').value);
  document.getElementById('ro').value = '';
  closeRegistro();
  toast(`✅ Revolcada guardada — Sistema ${si}`, { fn: () => deshacerRegistro(S.revolcadas, 'revolcadas', rec, ID_LOCAL_REV) });
  refresh();
};

window.loadPlanta = () => {
  const id=+document.getElementById('epv').value, p=S.plantas.find(x=>x.id===id); if(!p)return;
  document.getElementById('epn').value = p.nombre||'';
  document.getElementById('epva').value = p.variedad||'';
  document.getElementById('epe').value = p.especie||'';
  document.getElementById('epf').value = p.fechaP||'';
  document.getElementById('epu').value = p.ubicacion||'';
  document.getElementById('epx').value = p.exposicion||'';
  document.getElementById('eps').value = p.suelo||'';
  document.getElementById('epno').value = p.notas||'';
};
window.savePlanta = async () => {
  const id=+document.getElementById('epv').value, p=S.plantas.find(x=>x.id===id); if(!p)return;
  p.nombre = document.getElementById('epn').value;
  p.variedad = document.getElementById('epva').value;
  p.especie = document.getElementById('epe').value;
  p.fechaP = document.getElementById('epf').value;
  p.ubicacion = document.getElementById('epu').value;
  p.exposicion = document.getElementById('epx').value;
  p.suelo = document.getElementById('eps').value;
  p.notas = document.getElementById('epno').value;
  sv(); await fbSave('plantas', id, p); sheetSync('planta', p); poblarSels();
  closeRegistro();
  toast(`✅ ${pLbl(p)} guardada`);
  refresh();
};
window.addPlanta = async () => {
  const nid = S.plantas.length ? Math.max(...S.plantas.map(p=>p.id))+1 : 1;
  const p = {id:nid, nombre:'', variedad:'', especie:'', fechaP:fISO(TODAY), ubicacion:'', exposicion:'', suelo:'', notas:''};
  S.plantas.push(p); sv(); await fbSave('plantas', nid, p); sheetSync('planta', p);
  poblarSels(); renderPla();
  openRegistro('fc-plaEdit', {planta:nid});
  toast(`Planta ${nid} agregada — completá sus datos`);
};
window.delPlanta = async id => {
  const p = S.plantas.find(x=>x.id===id); if(!p) return;
  const regs = S.registroPlantas.filter(r=>r.planta===id);
  const extra = regs.length ? `\nTambién se borran sus ${regs.length} registro(s) de historial.` : '';
  if(!await appConfirm(`¿Eliminar "${pLbl(p)}"?${extra}\nEsta acción no se puede deshacer.`, {title:'Eliminar planta', okText:'Eliminar', danger:true})) return;
  const grupo = 'del-planta-' + id + '-' + Date.now();
  await Promise.all([fbDel('plantas', id, { grupo }), ...regs.filter(r=>!ID_LOCAL_PLA(String(r.id))).map(r=>fbDel('registroPlantas', r.id, { grupo }))]);
  S.plantas = S.plantas.filter(x=>x.id!==id);
  S.registroPlantas = S.registroPlantas.filter(r=>r.planta!==id);
  sv(); sheetSync('plantaEliminar', {id});
  closeMod(); closeRegistro(); poblarSels(); refresh();
  toast(`🗑️ ${pLbl(p)} eliminada`);
};
window.saveEventoPlanta = async () => {
  const pid=+document.getElementById('pv').value, f=document.getElementById('pf').value;
  if(!f){ toast('Completá la fecha'); return; }
  const rec = await registrarEventoPlanta(pid, f, document.getElementById('pt').value, document.getElementById('pd').value, document.getElementById('pp').value, document.getElementById('pr').value);
  ['pd','pp','pr'].forEach(x=>document.getElementById(x).value='');
  closeRegistro();
  toast(`✅ Evento guardado — ${pLbl(S.plantas.find(p=>p.id===pid))}`, { fn: () => deshacerRegistro(S.registroPlantas, 'registroPlantas', rec, ID_LOCAL_PLA) });
  refresh();
};

window.loadPecera = () => {
  const p = S.pecera || {};
  document.getElementById('kl').value = p.litros || '';
  document.getElementById('ka').value = p.fechaArmado || '';
  document.getElementById('kn').value = p.notas || '';
};
window.savePecera = async () => {
  const p = S.pecera = S.pecera || {};
  p.litros = +document.getElementById('kl').value || p.litros;
  p.fechaArmado = document.getElementById('ka').value || p.fechaArmado;
  p.notas = document.getElementById('kn').value;
  sv(); await fbSave('pecera', 'main', p); sheetSync('pecera', p);
  closeRegistro();
  toast('✅ Datos de la pecera guardados');
  refresh();
};
window.saveEventoPecera = async () => {
  const f = document.getElementById('kf').value;
  if(!f){ toast('Completá la fecha'); return; }
  const tipo = document.getElementById('kt').value;
  const rec = await registrarEventoPecera(f, tipo, document.getElementById('kd').value, document.getElementById('kr').value);
  ['kd','kr'].forEach(x=>document.getElementById(x).value='');
  closeRegistro();
  toast(`✅ Evento de pecera guardado — ${tipo}`, { fn: () => deshacerRegistro(S.registroPecera, 'registroPecera', rec, ID_LOCAL_PEC) });
  refresh();
};
window.delEventoPecera = async (id, e) => {
  e.stopPropagation();
  if(!await appConfirm('¿Eliminar este evento de la pecera?', {title:'Eliminar evento', okText:'Eliminar', danger:true})) return;
  await fbDel('registroPecera', id);
  S.registroPecera = S.registroPecera.filter(r=>r.id!=id); sv(); renderPec();
  toast('Evento eliminado');
};

window.loadSis = () => {
  const id=+document.getElementById('es').value, s=S.sistemas.find(x=>x.id===id); if(!s)return;
  ['en','ei','ef','ee','eno'].forEach((x,i)=>document.getElementById(x).value=[s.nombre,s.inicioC,s.finC,s.inicioE,s.notas][i]||'');
};
window.saveSis = async () => {
  const id=+document.getElementById('es').value, s=S.sistemas.find(x=>x.id===id);
  [s.nombre,s.inicioC,s.finC,s.inicioE,s.notas] = ['en','ei','ef','ee','eno'].map(x=>document.getElementById(x).value);
  sv(); await fbSave('sistemas',id,s); sheetSync('sistema', s); poblarSels();
  closeRegistro();
  toast(`✅ Sistema ${id} guardado`);
  refresh();
};
window.clearSis = async () => {
  const id=+document.getElementById('es').value;
  if(!await appConfirm(`Se vacían los datos del Sistema ${id}.`, {title:'Resetear sistema', okText:'Resetear', danger:true}))return;
  const s=S.sistemas.find(x=>x.id===id);
  s.nombre='';s.inicioC='';s.finC='';s.inicioE='';s.notas='';
  ['en','ei','ef','ee','eno'].forEach(x=>document.getElementById(x).value='');
  sv(); await fbSave('sistemas',id,s); toast(`Sistema ${id} reseteado`);
};
window.addSis = async () => {
  const nid = Math.max(0, ...S.sistemas.map(s=>s.id), ...S.revolcadas.map(r=>r.sistema)) + 1;
  const s = {id:nid, nombre:'', inicioC:'', finC:'', inicioE:'', notas:''};
  S.sistemas.push(s); sv(); await fbSave('sistemas',nid,s);
  poblarSels(); renderSist();
  // Cambiar al formulario de edición del nuevo sistema
  openRegistro('fc-sisEdit', {sistema:nid});
  toast(`Sistema ${nid} agregado — completá sus datos`);
};
window.delSis = async (id, e) => {
  e.stopPropagation();
  if(!await appConfirm(`¿Eliminar Sistema ${id}? Esta acción no se puede deshacer.`, {title:'Eliminar sistema', okText:'Eliminar', danger:true})) return;
  await fbDel('sistemas', id);
  S.sistemas = S.sistemas.filter(s=>s.id!=id); sv();
  poblarSels(); renderSist();
  refresh();
  toast(`Sistema ${id} eliminado`);
};
window.delRev = async (id, e) => {
  e.stopPropagation();
  if(!await appConfirm('¿Eliminar esta revolcada?', {title:'Eliminar revolcada', okText:'Eliminar', danger:true}))return;
  await fbDel('revolcadas', id);
  S.revolcadas = S.revolcadas.filter(r=>r.id!=id); sv(); renderRev();
  toast('Revolcada eliminada');
};

// ════ NAVEGACIÓN ════
let cur = 'hoy';
const TABS   = ['hoy','comp','pla','cli'];
const TITLES = {hoy:'Hoy',comp:'Compost',pla:'Plantas',cli:'Clima',his:'Historial'};
// ids viejos → nueva ubicación (openSis/openPla/etc. todavía los usan)
const LEGACY = { dash:{tab:'hoy'}, sist:{tab:'comp',seg:'sist'}, rev:{tab:'comp',seg:'rev'}, pec:{tab:'pla',seg:'pec'}, fito:{tab:'pla',seg:'pla'} };
const renderTab = t => {
  if (t==='hoy')  renderHoy();
  if (t==='comp') { renderCompostResumen(); renderSist(); renderRev(); }
  if (t==='pla')  { renderPlaResumen(); renderPla(); renderPec(); }
  if (t==='cli')  renderCli();
  if (t==='his')  { renderHistorial(); pintarRespaldo(); }
};
window.refresh = () => renderTab(cur);
window.setSeg = (tab, s) => {
  document.querySelectorAll(`#seg-${tab} button`).forEach(b => b.classList.toggle('on', b.dataset.s === s));
  document.querySelectorAll(`#pg-${tab} .seg-pane`).forEach(p => p.classList.toggle('on', p.id === 'pane-'+s));
  refresh();
};
window.go = t => {
  let seg = null;
  if (LEGACY[t]) { seg = LEGACY[t].seg || null; t = LEGACY[t].tab; }
  cur = t;
  document.querySelectorAll('.sn,.bt').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.getElementById('pg-'+t).classList.add('on');
  document.getElementById('pages').scrollTop = 0;
  const ttEl = document.getElementById('tb-title'); if (ttEl) ttEl.textContent = TITLES[t] || '';
  if (TABS.includes(t)) { try { localStorage.setItem('compost_tab', t); } catch(e) {} }
  if (seg) setSeg(t, seg); else refresh();
};

// ════ HISTORIAL ════
const HIS_PAGINA = 50;
let hisEntradas = [], hisCursor = null, hisFin = true;
const hisRefLbl = r => r.tipo === 'planta' ? (S.plantas.find(p => p.id == r.id) ? pLbl(S.plantas.find(p => p.id == r.id)) : 'Planta ' + r.id)
  : r.tipo === 'sistema' ? (S.sistemas.find(x => x.id == r.id) ? sLbl(S.sistemas.find(x => x.id == r.id)) : 'Sistema ' + r.id) : 'Pecera';
const llenarSel = (id, primera, opciones) => {
  const el = document.getElementById(id), previo = el.value;
  el.innerHTML = `<option value="">${primera}</option>` + opciones.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  if ([...el.options].some(o => o.value === previo)) el.value = previo;
};
window.renderHistorial = () => {
  const esc = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const personas = new Map(), refs = new Map();
  hisEntradas.forEach(e => { if (e.by) personas.set(e.by.email, nombreCorto(e.by)); if (e.ref) refs.set(e.ref.tipo + ':' + e.ref.id, hisRefLbl(e.ref)); });
  llenarSel('his-p', 'Todas', [...personas].map(([v, l]) => [esc(v), esc(l)]));
  llenarSel('his-r', 'Todos', [...refs].map(([v, l]) => [esc(v), esc(l)]));
  const rv = document.getElementById('his-r').value;
  const f = { persona: document.getElementById('his-p').value, accion: document.getElementById('his-a').value };
  if (rv) { const [tipo, ...id] = rv.split(':'); f.ref = { tipo, id: id.join(':') }; }
  const grupos = agruparEntradas(filtrarEntradas(hisEntradas, f));
  document.getElementById('his-c').innerHTML = grupos.length
    ? grupos.map(g => htmlGrupo(g, { puedeRestaurar: true })).join('')
    : '<div class="his-vacio">Todavía no hay cambios registrados</div>';
  document.getElementById('his-mas').style.display = hisFin ? 'none' : '';
};
const cargarHistorial = async (mas = false) => {
  // En ?dry=1 no se lee Firestore; window.__hisDemo permite probar la lista en el navegador.
  if (!useFirebase || DRY) { hisEntradas = window.__hisDemo || []; renderHistorial(); return; }
  try {
    const base = [collection(db, 'historial'), orderBy('_ts', 'desc')];
    const q = mas && hisCursor ? query(...base, startAfter(hisCursor), limit(HIS_PAGINA)) : query(...base, limit(HIS_PAGINA));
    const sn = await getDocs(q);
    const nuevas = sn.docs.map(d => ({ ...d.data(), _id: d.id }));
    hisEntradas = mas ? hisEntradas.concat(nuevas) : nuevas;
    if (sn.docs.length) hisCursor = sn.docs[sn.docs.length - 1];
    hisFin = sn.docs.length < HIS_PAGINA;
    renderHistorial();
  } catch (e) { toast('No se pudo cargar el historial'); }
};
// ════ RESPALDO ════
// Baja una copia de lo que la app guarda (JSON completo) o los registros en CSV para Excel.
// En el celular se usa la hoja de compartir (Drive, WhatsApp, correo…); en la PC, una descarga normal.
const CLAVE_RESPALDO = 'brote_ultimo_respaldo';
const descargar = async (nombre, texto, tipo) => {
  const blob = new Blob([texto], { type: tipo });
  const archivo = new File([blob], nombre, { type: tipo });
  if (navigator.canShare && navigator.canShare({ files: [archivo] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [archivo], title: nombre }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
};
const pintarRespaldo = () => {
  const el = document.getElementById('respaldo-ult'); if (!el) return;
  let ts = null; try { ts = +localStorage.getItem(CLAVE_RESPALDO) || null; } catch(e) {}
  el.textContent = ts ? 'Último respaldo descargado: ' + new Date(ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'Todavía no descargaste ninguno';
};
const respaldoHecho = () => { try { localStorage.setItem(CLAVE_RESPALDO, String(Date.now())); } catch(e) {} pintarRespaldo(); };
window.descargarRespaldo = async () => {
  toast('Preparando el respaldo…');
  if (useFirebase) await fbLoad();   // trae lo último de Firestore antes de armarlo
  const r = armarRespaldo(S, (window.usuarioActual() || {}).email || '');
  if (await descargar(nombreRespaldo(), JSON.stringify(r, null, 2), 'application/json')) { respaldoHecho(); toast('✅ Respaldo listo'); }
};
window.exportarExcel = async () => {
  toast('Preparando el archivo…');
  if (useFirebase) await fbLoad();
  if (await descargar(nombreRespaldo(new Date(), 'csv', 'brote-registros'), registrosParaExcel(S), 'text/csv;charset=utf-8')) toast('✅ Archivo listo');
};

window.abrirHistorial = () => { go('his'); cargarHistorial(false); };
window.cargarMasHistorial = () => cargarHistorial(true);
window.clickHistorial = async ev => {
  const b = ev.target.closest('[data-restaurar]'); if (!b) return;
  const clave = b.dataset.restaurar;
  const g = agruparEntradas(hisEntradas).find(x => claveGrupo(x) === clave); if (!g) return;
  // Una sola pregunta aunque el grupo tenga varios documentos que pisar.
  let respuesta = null;
  const confirmarPisar = async () => respuesta ??= await appConfirm('Hoy ese dato existe con otro valor. ¿Reemplazarlo por la versión anterior?', { title:'Restaurar', okText:'Restaurar', danger:true });
  let hechas = 0;
  for (const e of [...g].reverse()) { if ((e.accion === 'baja' || e.accion === 'edicion') && await fbRestaurar(e, { confirmarPisar })) hechas++; }
  if (!hechas) { toast('No se restauró nada'); return; }
  await fbLoad(); poblarSels(); refresh();
  await cargarHistorial(false);
  toast(hechas > 1 ? `✅ Se restauraron ${hechas} registros` : '✅ Restaurado');
};

// ════ HOJA DE REGISTRO ════
const REG_TITLES = { 'fc-rev':'Nueva revolcada', 'fc-sisEdit':'Editar sistema', 'fc-plaEvt':'Actividad de planta', 'fc-plaEdit':'Editar planta', 'fc-pecEvt':'Evento de pecera', 'fc-pecData':'Datos de la pecera' };
window.openRegistro = (fc, pre = {}) => {
  if (fc && !REG_TITLES[fc]) fc = undefined;
  const hoy = fISO(TODAY);
  ['rf','pf','kf'].forEach(id => { document.getElementById(id).value = hoy; });
  if (fc === 'fc-rev' && pre.sistema) document.getElementById('rs').value = pre.sistema;
  if (fc === 'fc-sisEdit') { if (pre.sistema) document.getElementById('es').value = pre.sistema; loadSis(); }
  if (fc === 'fc-plaEvt' && pre.planta) document.getElementById('pv').value = pre.planta;
  if (fc === 'fc-plaEvt') { const s = document.getElementById('pt'); s.value = pre.tipo || (s.options[0] && s.options[0].value); }
  if (fc === 'fc-plaEdit') { if (pre.planta) document.getElementById('epv').value = pre.planta; loadPlanta(); }
  if (fc === 'fc-pecEvt') { const s = document.getElementById('kt'); s.value = pre.tipo || (s.options[0] && s.options[0].value); }
  if (fc === 'fc-pecData') loadPecera();
  actualizarProblemaSel();
  document.getElementById('reg-menu').style.display = fc ? 'none' : '';
  Object.keys(REG_TITLES).forEach(id => document.getElementById(id).classList.toggle('on', id === fc));
  document.getElementById('reg-title').textContent = fc ? REG_TITLES[fc] : 'Registrar';
  document.getElementById('reg-back').style.visibility = fc ? 'visible' : 'hidden';
  // Sugerir primero lo de la pestaña actual (Compost → revolcada, Plantas → plantas)
  document.querySelectorAll('.reg-item').forEach(b => { b.style.order = b.dataset.ctx === cur ? '-1' : '0'; });
  const sheet = document.getElementById('pg-reg');
  sheet.classList.add('on'); sheet.scrollTop = 0;
};
window.closeRegistro = () => document.getElementById('pg-reg').classList.remove('on');

// ════ SYNC ════
window.doSync = async () => {
  const icons = [document.getElementById('sync-i-side'),document.getElementById('sync-i-mob')];
  icons.forEach(i=>{if(i) i.classList.add('spin')});
  const fb = document.getElementById('fetch-bar'); if(fb) fb.classList.remove('hide');
  await fbLoad();
  poblarSels();
  const ok = await autoFetch(true);
  icons.forEach(i=>{if(i) i.classList.remove('spin')});
  if(fb) fb.classList.add('hide');
  refresh();
  toast(ok?'✅ Clima actualizado (Open-Meteo)': useFirebase?'✅ Sincronizado con Firebase':'⚠️ Modo local (Firebase no configurado)');
};

// ════ DIÁLOGO PROPIO ════
const appConfirm = (msg, {title='Confirmar', okText='Aceptar', cancelText='Cancelar', danger=false} = {}) => new Promise(res => {
  const w = document.createElement('div'); w.className = 'dlg-wrap'; w.setAttribute('role','dialog'); w.setAttribute('aria-modal','true');
  const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  w.innerHTML = `<div class="dlg"><h4>${esc(title)}</h4><p>${esc(msg)}</p><div class="dlg-btns"><button data-r="0">${esc(cancelText)}</button><button data-r="1" class="${danger?'danger':'ok'}">${esc(okText)}</button></div></div>`;
  const prev = document.activeElement;
  const done = v => { document.removeEventListener('keydown', key, true); w.remove(); try { prev && prev.focus && prev.focus(); } catch(e){} res(v); };
  const key = e => { if (e.key==='Escape') { e.preventDefault(); e.stopPropagation(); done(false); } };
  w.addEventListener('click', e => { if (e.target===w) done(false); const b=e.target.closest('button[data-r]'); if (b) done(b.dataset.r==='1'); });
  document.addEventListener('keydown', key, true);
  document.body.appendChild(w);
  w.querySelector('button[data-r="0"]').focus();
});
window.appConfirm = appConfirm;

// ════ DESPLEGABLES PROPIOS ════
// Cada <select> de los formularios se oculta (sigue siendo la fuente del valor y de
// sus onchange) y se dibuja un botón + menú de la app. Se resincroniza solo cuando
// el código cambia las opciones (innerHTML) o el valor (.value = …).
const csClose = () => { const m = document.querySelector('.cs-menu'); if (m) { m._cs.classList.remove('open'); m.remove(); } };
const csEnhance = sel => {
  if (sel._cs) return;
  const wrap = document.createElement('div'); wrap.className = 'cs';
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cs-btn'; btn.setAttribute('aria-haspopup','listbox');
  sel.parentNode.insertBefore(wrap, sel); wrap.append(btn, sel); sel._cs = wrap;
  const sync = () => { const o = sel.options[sel.selectedIndex]; btn.textContent = o ? o.textContent : '—'; };
  const proto = HTMLSelectElement.prototype;
  for (const k of ['value','selectedIndex']) {
    const d = Object.getOwnPropertyDescriptor(proto, k);
    Object.defineProperty(sel, k, { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(); } });
  }
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true });
  sync();
  const pick = i => { if (i === sel.selectedIndex) return; sel.selectedIndex = i; sel.dispatchEvent(new Event('change', {bubbles:true})); };
  const open = () => {
    csClose(); if (!sel.options.length) return;
    const menu = document.createElement('div'); menu.className = 'cs-menu'; menu.setAttribute('role','listbox'); menu._cs = wrap;
    let hi = Math.max(0, sel.selectedIndex);
    const opts = [...sel.options].map((o,i) => { const d = document.createElement('div'); d.className = 'cs-opt'+(i===sel.selectedIndex?' sel':''); d.setAttribute('role','option'); d.textContent = o.textContent; d.onmousedown = e => e.preventDefault(); d.onclick = () => { pick(i); csClose(); btn.focus(); }; menu.appendChild(d); return d; });
    const mark = () => { opts.forEach((d,i)=>d.classList.toggle('hi', i===hi)); opts[hi].scrollIntoView({block:'nearest'}); };
    menu._key = e => {
      if (e.key==='ArrowDown') { hi = Math.min(opts.length-1, hi+1); mark(); }
      else if (e.key==='ArrowUp') { hi = Math.max(0, hi-1); mark(); }
      else if (e.key==='Enter' || e.key===' ') { pick(hi); csClose(); }
      else if (e.key==='Escape' || e.key==='Tab') { csClose(); if (e.key==='Escape') e.stopPropagation(); }
      else return;
      if (e.key!=='Tab') e.preventDefault();
    };
    document.body.appendChild(menu); wrap.classList.add('open');
    const r = btn.getBoundingClientRect(), vh = window.innerHeight, gap = 6;
    const h = Math.min(menu.scrollHeight + 2, 280);
    const below = vh - r.bottom - gap, up = r.top - gap;
    menu.style.width = r.width + 'px'; menu.style.left = r.left + 'px';
    if (below >= h || below >= up) { menu.style.top = (r.bottom + gap) + 'px'; menu.style.maxHeight = Math.min(280, below - 8) + 'px'; }
    else { menu.style.bottom = (vh - r.top + gap) + 'px'; menu.style.maxHeight = Math.min(280, up - 8) + 'px'; }
    mark();
  };
  btn.addEventListener('click', () => wrap.classList.contains('open') ? csClose() : open());
  btn.addEventListener('keydown', e => {
    const m = document.querySelector('.cs-menu');
    if (m && m._cs === wrap) return m._key(e);
    if (['ArrowDown','ArrowUp','Enter',' '].includes(e.key)) { e.preventDefault(); open(); }
  });
};
document.addEventListener('mousedown', e => { if (!e.target.closest('.cs-menu, .cs-btn')) csClose(); });
window.addEventListener('resize', csClose);
document.addEventListener('scroll', e => { if (!(e.target.closest && e.target.closest('.cs-menu'))) csClose(); }, true);
document.querySelectorAll('.f select').forEach(csEnhance);

// ════ TOAST ════
let tt;
// op = { label, fn }: agrega un botón (ej. "Deshacer") y deja el aviso más tiempo en pantalla.
const toast = (msg, op) => {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('h');
  t.style.pointerEvents = op ? 'auto' : '';
  if (op) {
    const b = document.createElement('button');
    b.className = 'toast-act'; b.textContent = op.label || 'Deshacer';
    b.onclick = () => { clearTimeout(tt); t.classList.add('h'); t.style.pointerEvents = ''; op.fn(); };
    t.appendChild(b);
  }
  clearTimeout(tt); tt = setTimeout(() => { t.classList.add('h'); t.style.pointerEvents = ''; }, op ? 6500 : 2800);
};
window.showToast = toast;

// ════ INIT ════
const poblarSels = () => {
  const opts = S.sistemas.map(s=>`<option value="${s.id}">${esc(sLbl(s))}</option>`).join('');
  ['rs','es'].forEach(id=>{const el=document.getElementById(id);const c=el.value;el.innerHTML=opts;if(c)el.value=c;});
  document.getElementById('hf').innerHTML = '<option value="todos">Todos los sistemas</option>'+opts;
  const poptsPla = S.plantas.map(p=>`<option value="${p.id}">${esc(pLbl(p))}</option>`).join('');
  ['pv','epv'].forEach(id=>{const el=document.getElementById(id);const c=el.value;el.innerHTML=poptsPla;if(c)el.value=c;});
  actualizarProblemaSel();
};
window.actualizarProblemaSel = () => {
  const wrap = document.getElementById('pb-wrap');
  const pid = +document.getElementById('pv').value;
  const tipo = document.getElementById('pt').value;
  const p = S.plantas.find(x=>x.id===pid);
  const ficha = p ? fichaFito(p.nombre) : null; // por nombre, no por especie (ver nota en Task 2)
  if (tipo !== '🐛 Revisión plagas' || !ficha) {
    wrap.style.display = 'none';
    document.getElementById('pb').innerHTML = '';
    return;
  }
  wrap.style.display = '';
  document.getElementById('pb').innerHTML = '<option value="">Ninguno / solo monitoreo</option>' +
    ficha.problemas.map((pr,i)=>`<option value="${i}">${pr.nombre}</option>`).join('');
};
window.aplicarProblema = () => {
  const pid = +document.getElementById('pv').value;
  const p = S.plantas.find(x=>x.id===pid);
  const ficha = p ? fichaFito(p.nombre) : null; // por nombre, no por especie (ver nota en Task 2)
  const idx = document.getElementById('pb').value;
  if (!ficha || idx==='') return;
  const pr = ficha.problemas[+idx];
  document.getElementById('pp').value = `${pr.producto} — ${pr.dosis}`;
};

const init = async () => {
  const now = TODAY.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  ['sb-date','tb-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=now;});
  poblarSels();
  document.getElementById('rf').value = fISO(TODAY);
  loadSis();
  let t0 = 'hoy';
  try { const g = localStorage.getItem('compost_tab'); if (TABS.includes(g)) t0 = g; } catch(e) {}
  go(t0);

  // Auto-fetch en background si no se hizo hoy
  if (S.climaLastFetch !== todayISO()) {
    document.getElementById('fetch-bar').classList.remove('hide');
    autoFetch(false).then(ok=>{
      document.getElementById('fetch-bar').classList.add('hide');
      if(ok){ refresh(); }
    });
  }
  fbLoad().then(async ()=>{ poblarSels(); refresh(); await cargarPreviasPrev(); vaciarColaSheet(); if (await completarClimaEstanques()) refresh(); });
  // Si la app queda abierta de un día para otro, al volver se baja el clima nuevo y se recalcula
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || S.climaLastFetch === todayISO()) return;
    if (await autoFetch(false)) refresh();
  });
};

// ════ ACCESO (login con Google) ════
// La app solo arranca con una cuenta autorizada; las reglas de Firestore son el control real,
// esto evita mostrar datos (ni la copia local) a quien no corresponde.
window.usuarioActual = () => {
  if (DRY) return { uid:'dry', email:'dry@local', nombre:'Dry' };
  const u = auth && auth.currentUser;
  return u ? { uid:u.uid, email:u.email, nombre:u.displayName || '' } : null;
};
let appIniciada = false, rechazado = null;
const mostrarAcceso = (modo, email) => {
  document.body.classList.add('sin-sesion');
  document.getElementById('acceso').classList.remove('hide');
  const sin = modo === 'sinacceso';
  document.getElementById('acc-t').textContent = sin ? 'Sin acceso' : 'Brote';
  document.getElementById('acc-p').textContent = sin
    ? `La cuenta ${email} no tiene permiso para usar esta app.`
    : 'Entrá con tu cuenta de Google para ver y registrar los cambios.';
  document.getElementById('acc-btn').textContent = sin ? 'Probar con otra cuenta' : 'Entrar con Google';
};
const arrancar = () => {
  if (appIniciada) return;
  appIniciada = true;
  document.getElementById('acceso').classList.add('hide');
  document.body.classList.remove('sin-sesion');
  const u = window.usuarioActual();
  if (u) { document.getElementById('sb-user-n').textContent = nombreCorto(u); document.getElementById('sb-user-e').textContent = u.email; }
  init();
};
window.entrarConGoogle = async () => {
  rechazado = null;
  const prov = new GoogleAuthProvider();
  prov.setCustomParameters({ prompt:'select_account' });
  try { await signInWithPopup(auth, prov); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      try { await signInWithRedirect(auth, prov); } catch (e2) { toast('No se pudo iniciar sesión'); }
    } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      toast('No se pudo iniciar sesión: revisá la conexión');
    }
  }
};
window.salir = async () => {
  if (!auth) return;
  try { await signOut(auth); } catch (e) {}
  location.reload();
};
if (DRY || !auth) arrancar();
else onAuthStateChanged(auth, async user => {
  if (!user) { mostrarAcceso(rechazado ? 'sinacceso' : 'login', rechazado); return; }
  if (!esAutorizado(user.email)) {
    rechazado = user.email;
    await signOut(auth).catch(()=>{});
    mostrarAcceso('sinacceso', rechazado);
    return;
  }
  arrancar();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
