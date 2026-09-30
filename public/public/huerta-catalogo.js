// Catálogo de la huerta y funciones puras (sin DOM ni Firebase). Lo importa
// index.html y lo prueba scripts/test-huerta.mjs en Node.
// Cada vez que se cambie este archivo hay que subir la versión de CACHE en sw.js.

export const CATALOGO_HUERTA = [];   // se completa en la Tarea 2

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
