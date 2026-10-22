// De quién es cada día: alternan Viky y Jona, empezando con Viky el 22/10/2026.
// Se calcula solo desde la fecha, así los dos celulares siempre coinciden.
const INICIO = Date.UTC(2026, 9, 22);   // día en que arrancó el reparto: le toca a Viky
const DUENOS = ['Viky', 'Jona'];
const MS_DIA = 86400000;

// fecha: 'YYYY-MM-DD' o Date (se toma su día local).
export const duenoDelDia = fecha => {
  const [y, m, d] = typeof fecha === 'string'
    ? fecha.split('-').map(Number)
    : [fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate()];
  const dias = Math.round((Date.UTC(y, m - 1, d) - INICIO) / MS_DIA);
  return DUENOS[((dias % 2) + 2) % 2];
};
