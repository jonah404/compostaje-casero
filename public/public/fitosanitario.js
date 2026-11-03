// Fichas de plagas por frutal: problemas comunes, monitoreo y calendario de vigilancia.
// Fuente: manejo INTA San Pedro (monitoreo por estado fenológico, no
// pulverización de rutina). Producto/dosis = guía agronómica genérica de
// huerta familiar, NO dosis de etiqueta de marca específica — confirmar
// siempre contra el envase real. Para plagas persistentes o graves,
// conviene diagnóstico dirigido antes de tratar (criterio INTA).
export const NIVEL_DIAS = { '🟢':14, '🟠':7, '🔴':5, '🔴🔴':3 };
export const NIVEL_LABEL = { '🟢':'Vigilancia baja', '🟠':'Vigilancia normal', '🔴':'Vigilancia alta', '🔴🔴':'Vigilancia muy alta' };

export const PROBLEMAS_CITRICOS_COMUN = [
  { nombre:'Minador de los cítricos', sintoma:'Galerías serpenteantes en hojas nuevas; la hoja puede deformarse',
    producto:'Sin tratamiento de rutina', dosis:'Retirar hojas muy afectadas. Si son pocas hojas no amerita tratar todo el árbol — evaluar solo si avanza sobre gran parte de la brotación nueva.' },
  { nombre:'Pulgones', sintoma:'Colonias en brotes tiernos; hojas enrolladas',
    producto:'Jabón potásico', dosis:'5-10ml/L de agua, rociar brotes y envés de hojas. Repetir a los 7 días si persiste.' },
  { nombre:'Cochinillas', sintoma:'Bultitos adheridos a hojas/ramitas, a veces con melaza',
    producto:'Alcohol isopropílico (focos chicos) o aceite mineral/agropecuario (infestación mayor)',
    dosis:'Alcohol: algodón directo sobre cada cochinilla, repetir cada 4-5 días, 2-3 veces. Aceite: 1-2% según etiqueta.' },
  { nombre:'Ácaros', sintoma:'Punteado amarillento/bronceado, pérdida de aspecto saludable',
    producto:'Aceite de neem', dosis:'Según etiqueta, repetir a los 7-10 días. Mejorar aireación de la copa.' },
  { nombre:'Cancrosis', sintoma:'Lesiones/costras en hojas y brotes',
    producto:'Fungicida cúprico (oxicloruro de cobre)', dosis:'Según etiqueta, aplicar durante la brotación tierna cada 15-20 días mientras dure el brote. Desinfectar herramientas de poda entre plantas.' },
];

export const FITOSANITARIO = [
  {
    match: 'mandarina',
    problemas: [
      ...PROBLEMAS_CITRICOS_COMUN,
      { nombre:'Hormigas', sintoma:'Frecuentemente acompañan ataques de pulgones o cochinillas',
        producto:'Cebo granulado para hormigas', dosis:'Colocar cerca del hormiguero/tronco, no rociar insecticida directo sobre la planta.' },
    ],
    monitoreo:'Revisar 5-10 hojas nuevas por semana, con énfasis en el envés, brotes tiernos y presencia de hormigas.',
    momentoCritico:'Cada nueva brotación, especialmente primavera y los nuevos crecimientos de verano.',
    calendarioVigilancia: {9:'🟢',10:'🟠',11:'🟠',12:'🟠',1:'🟠',2:'🟢',3:'🟢',4:'🟢'},
  },
  {
    match: 'limon',
    problemas: [
      ...PROBLEMAS_CITRICOS_COMUN,
      { nombre:'Manchas foliares', sintoma:'Manchas que aumentan con humedad',
        producto:'Fungicida cúprico', dosis:'Según etiqueta si las manchas aumentan con humedad. Mejorar ventilación de la copa.' },
    ],
    monitoreo:'Una revisión semanal, con atención a las hojas nuevas (el cítrico puede brotar aunque no tenga fruta).',
    momentoCritico:'Brotación — puede darse aunque el árbol no tenga fruta todavía.',
    calendarioVigilancia: {9:'🟢',10:'🟠',11:'🟠',12:'🟠',1:'🟠',2:'🟠',3:'🟠',4:'🟠'},
  },
  {
    match: 'durazno',
    problemas: [
      { nombre:'Torque', sintoma:'Hojas engrosadas, deformadas, rojizas',
        producto:'Fungicida cúprico o a base de azufre', dosis:'Preventivo, aplicar en la brotación de yemas — difícil de curar una vez instalada. Si aparece, anotar para repetir el preventivo el año próximo.' },
      { nombre:'Cribado / tiro de munición', sintoma:'Manchas pequeñas que terminan dejando agujeros',
        producto:'Fungicida cúprico', dosis:'Según etiqueta, aplicar tras lluvias prolongadas en primavera.' },
      { nombre:'Bacteriosis', sintoma:'Manchas en hojas/frutos y lesiones en ramas',
        producto:'Fungicida/bactericida cúprico', dosis:'Según etiqueta. Retirar y destruir partes muy afectadas (no compostar).' },
      { nombre:'Podredumbre morena', sintoma:'Frutos con manchas marrones que se deterioran rápido',
        producto:'Retiro inmediato + fungicida (captan o azufre) si se repite',
        dosis:'Retirar y destruir INMEDIATAMENTE frutos/flores afectados, no dejarlos bajo el árbol ni compostarlos. Tratamiento químico solo si es recurrente.' },
      { nombre:'Pulgones', sintoma:'Brotes deformados y hojas enrolladas', producto:'Jabón potásico', dosis:'5-10ml/L, rociar brotes y envés. Repetir a los 7 días si persiste.' },
      { nombre:'Gusano del brote', sintoma:'Brotes dañados o secos', producto:'Evaluación específica', dosis:'Si hay varios brotes afectados, identificar antes de tratar — no es de rutina.' },
      { nombre:'Mosca de los frutos', sintoma:'Daño dentro del fruto; caída prematura',
        producto:'Trampas con atrayente (proteína hidrolizada o feromona)', dosis:'Colocar desde que el fruto es pequeño. Recolectar y destruir frutos caídos de inmediato.' },
      { nombre:'Ácaros', sintoma:'Punteado y pérdida de vigor del follaje', producto:'Aceite de neem', dosis:'Según etiqueta, repetir a los 7-10 días.' },
    ],
    monitoreo:'2 controles semanales (fruto en crecimiento): hojas nuevas, frutos, puntas de ramas, lesiones en ramas, frutos caídos. Retirar de inmediato cualquier fruto que caiga enfermo o empiece a pudrirse — no dejarlo bajo el árbol.',
    momentoCritico:'Fruto pequeño → crecimiento → maduración. Monitoreo bastante más frecuente que el de los cítricos durante toda esta etapa.',
    calendarioVigilancia: {9:'🔴🔴',10:'🔴🔴',11:'🔴',12:'🔴',1:'🔴',2:'🟠',3:'🟢',4:'🟢'},
  },
  {
    match: 'ciruela',
    problemas: [
      { nombre:'Pulgones', sintoma:'Colonias en brotes y hojas jóvenes', producto:'Jabón potásico', dosis:'5-10ml/L. Si es una colonia chica y localizada, tratar solo esa zona y seguir observando antes de un tratamiento general.' },
      { nombre:'Cochinillas', sintoma:'Escamas/bultitos sobre ramas', producto:'Alcohol isopropílico (foco chico) o aceite mineral', dosis:'Igual criterio que mandarina/durazno.' },
      { nombre:'Cribado', sintoma:'Manchas en hojas que terminan perforándose', producto:'Fungicida cúprico', dosis:'Según etiqueta, tras lluvias prolongadas.' },
      { nombre:'Bacteriosis', sintoma:'Manchas oscuras en hojas/frutos', producto:'Fungicida/bactericida cúprico', dosis:'Según etiqueta.' },
      { nombre:'Podredumbre morena', sintoma:'Frutos que se manchan y deterioran', producto:'Retiro inmediato', dosis:'Igual criterio que durazno — no dejar frutos afectados bajo el árbol.' },
      { nombre:'Problemas de polinización', sintoma:'Floración abundante pero poca fruta posterior',
        producto:'No es plaga — revisar polinización', dosis:'Reina Claudia puede tener autoincompatibilidad; si se repite, considerar la variedad y un ciruelo compatible cerca.' },
    ],
    monitoreo:'1 revisión semanal, enfocada en brotes nuevos. Buscar especialmente pulgones.',
    momentoCritico:'Floración → cuajado — vigilar si florece bien pero no fructifica (polinización).',
    calendarioVigilancia: {9:'🟠',10:'🔴',11:'🔴',12:'🔴',1:'🔴',2:'🟠',3:'🟢',4:'🟢'},
  },
];

export const fichaFito = nombreOEspecie => {
  const buscado = String(nombreOEspecie||'').toLowerCase();
  return FITOSANITARIO.find(f => buscado.includes(f.match)) || null;
};
export const nivelVigilancia = (ficha, mes) => (ficha && ficha.calendarioVigilancia[mes]) || '🟢';
export const diasVigilancia = (ficha, mes) => NIVEL_DIAS[nivelVigilancia(ficha, mes)];
