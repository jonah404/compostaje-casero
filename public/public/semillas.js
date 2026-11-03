// Datos iniciales (planilla original). Se usan solo la primera vez, hasta que llegan los de Firestore.

export const SEED_SIS = [
  {id:1,nombre:'',inicioC:'2026-04-28',finC:'',inicioE:'',notas:''},
  {id:2,nombre:'',inicioC:'',finC:'',inicioE:'',notas:''},
  {id:3,nombre:'',inicioC:'',finC:'',inicioE:'',notas:''}
];
export const SEED_REV = [
  {id:'r1',sistema:1,fecha:'2026-05-05',obs:''},
  {id:'r2',sistema:1,fecha:'2026-05-12',obs:''},
  {id:'r3',sistema:1,fecha:'2026-05-19',obs:''},
  {id:'r4',sistema:1,fecha:'2026-05-26',obs:''},
];
export const SEED_CLI = [
  {id:'c-2026-04-28',fecha:'2026-04-28',temp:12.8,tmax:19.6,tmin:6.6,hum:71,humMax:86,humMin:55,lluvia:'no',mm:0,hsLluvia:0,viento:17.3,rafaga:32.0,dir:'↖️NO 328°',evapo:2.4,sol:8.7,notas:''},
  {id:'c-2026-04-29',fecha:'2026-04-29',temp:15.3,tmax:22.8,tmin:11.3,hum:65,humMax:85,humMin:44,lluvia:'no',mm:0,hsLluvia:0,viento:19.8,rafaga:36.7,dir:'↖️NO 305°',evapo:2.5,sol:8.3,notas:''},
  {id:'c-2026-04-30',fecha:'2026-04-30',temp:14.9,tmax:23.0,tmin:7.8,hum:77,humMax:94,humMin:60,lluvia:'no',mm:0,hsLluvia:0,viento:13.4,rafaga:28.8,dir:'↗️NE 39°',evapo:2.6,sol:10.1,notas:''},
  {id:'c-2026-05-01',fecha:'2026-05-01',temp:18.7,tmax:24.8,tmin:13.9,hum:71,humMax:90,humMin:52,lluvia:'si',mm:0.3,hsLluvia:1.0,viento:20.3,rafaga:36.0,dir:'↖️NO 337°',evapo:2.9,sol:10.0,notas:'☔ Día lluvioso'},
  {id:'c-2026-05-02',fecha:'2026-05-02',temp:12.7,tmax:17.0,tmin:6.8,hum:50,humMax:70,humMin:29,lluvia:'no',mm:0,hsLluvia:0,viento:22.7,rafaga:47.2,dir:'⬇️S 192°',evapo:3.4,sol:10.0,notas:''},
  {id:'c-2026-05-03',fecha:'2026-05-03',temp:10.4,tmax:17.0,tmin:4.3,hum:69,humMax:90,humMin:47,lluvia:'no',mm:0,hsLluvia:0,viento:15.5,rafaga:33.5,dir:'↗️NE 24°',evapo:2.3,sol:10.0,notas:''},
  {id:'c-2026-05-04',fecha:'2026-05-04',temp:13.5,tmax:20.5,tmin:7.7,hum:73,humMax:91,humMin:54,lluvia:'no',mm:0,hsLluvia:0,viento:12.1,rafaga:24.8,dir:'⬆️N 15°',evapo:2.3,sol:10.0,notas:''},
  {id:'c-2026-05-05',fecha:'2026-05-05',temp:19.5,tmax:25.4,tmin:13.4,hum:82,humMax:98,humMin:65,lluvia:'no',mm:0,hsLluvia:0,viento:15.8,rafaga:27.4,dir:'➡️E 71°',evapo:1.5,sol:5.8,notas:''},
  {id:'c-2026-05-06',fecha:'2026-05-06',temp:22.3,tmax:28.0,tmin:18.9,hum:86,humMax:99,humMin:73,lluvia:'si',mm:21.5,hsLluvia:9.0,viento:30.1,rafaga:54.7,dir:'⬆️N 15°',evapo:2.2,sol:9.0,notas:'☔ Día lluvioso'},
  {id:'c-2026-05-07',fecha:'2026-05-07',temp:16.0,tmax:20.1,tmin:12.4,hum:74,humMax:95,humMin:53,lluvia:'no',mm:0,hsLluvia:0,viento:32.0,rafaga:61.2,dir:'↙️SO 233°',evapo:2.3,sol:3.0,notas:''},
  {id:'c-2026-05-08',fecha:'2026-05-08',temp:10.5,tmax:13.6,tmin:7.9,hum:48,humMax:62,humMin:34,lluvia:'no',mm:0,hsLluvia:0,viento:29.6,rafaga:59.4,dir:'⬅️O 250°',evapo:3.5,sol:9.8,notas:''},
  {id:'c-2026-05-09',fecha:'2026-05-09',temp:9.4,tmax:11.4,tmin:7.2,hum:64,humMax:88,humMin:40,lluvia:'si',mm:0.8,hsLluvia:5.0,viento:32.0,rafaga:63.7,dir:'↙️SO 239°',evapo:1.7,sol:2.4,notas:'❄️ Frío'},
  {id:'c-2026-05-10',fecha:'2026-05-10',temp:9.0,tmax:15.6,tmin:3.8,hum:64,humMax:88,humMin:40,lluvia:'no',mm:0,hsLluvia:0,viento:17.9,rafaga:37.8,dir:'⬅️O 271°',evapo:2.2,sol:10.0,notas:'❄️ Frío'},
  {id:'c-2026-05-11',fecha:'2026-05-11',temp:10.0,tmax:17.6,tmin:2.7,hum:71,humMax:92,humMin:49,lluvia:'no',mm:0,hsLluvia:0,viento:15.6,rafaga:29.9,dir:'↖️NO 314°',evapo:2.3,sol:10.0,notas:''},
  {id:'c-2026-05-12',fecha:'2026-05-12',temp:13.5,tmax:20.6,tmin:8.6,hum:72,humMax:87,humMin:57,lluvia:'no',mm:0,hsLluvia:0,viento:16.7,rafaga:31.7,dir:'↖️NO 302°',evapo:2.4,sol:10.0,notas:''},
  {id:'c-2026-05-13',fecha:'2026-05-13',temp:11.9,tmax:16.4,tmin:7.9,hum:69,humMax:92,humMin:45,lluvia:'no',mm:0,hsLluvia:0,viento:16.0,rafaga:27.7,dir:'↘️SE 136°',evapo:2.0,sol:8.2,notas:''},
  {id:'c-2026-05-14',fecha:'2026-05-14',temp:12.1,tmax:17.5,tmin:9.4,hum:70,humMax:88,humMin:52,lluvia:'no',mm:0,hsLluvia:0,viento:9.4,rafaga:19.1,dir:'↘️SE 147°',evapo:1.9,sol:9.0,notas:''},
  {id:'c-2026-05-15',fecha:'2026-05-15',temp:11.1,tmax:17.4,tmin:6.2,hum:74,humMax:96,humMin:51,lluvia:'no',mm:0,hsLluvia:0,viento:10.9,rafaga:25.6,dir:'↗️NE 25°',evapo:2.0,sol:10.0,notas:''},
  {id:'c-2026-05-16',fecha:'2026-05-16',temp:12.1,tmax:17.1,tmin:8.1,hum:76,humMax:96,humMin:56,lluvia:'si',mm:0.5,hsLluvia:3.0,viento:15.5,rafaga:28.4,dir:'⬇️S 188°',evapo:1.5,sol:5.8,notas:'☔ Día lluvioso'},
  {id:'c-2026-05-17',fecha:'2026-05-17',temp:9.8,tmax:13.1,tmin:6.3,hum:74,humMax:96,humMin:52,lluvia:'si',mm:5.0,hsLluvia:11.0,viento:17.4,rafaga:35.6,dir:'⬇️S 181°',evapo:1.2,sol:3.8,notas:'❄️ Frío'},
  {id:'c-2026-05-18',fecha:'2026-05-18',temp:8.6,tmax:15.4,tmin:3.5,hum:69,humMax:92,humMin:46,lluvia:'no',mm:0,hsLluvia:0,viento:9.6,rafaga:21.6,dir:'⬅️O 270°',evapo:1.9,sol:10.0,notas:'❄️ Frío'},
  {id:'c-2026-05-19',fecha:'2026-05-19',temp:9.7,tmax:17.0,tmin:4.2,hum:70,humMax:93,humMin:47,lluvia:'no',mm:0,hsLluvia:0,viento:10.7,rafaga:24.8,dir:'↖️NO 296°',evapo:1.9,sol:10.0,notas:'❄️ Frío'},
  {id:'c-2026-05-20',fecha:'2026-05-20',temp:10.8,tmax:16.8,tmin:6.3,hum:71,humMax:89,humMin:53,lluvia:'no',mm:0,hsLluvia:0,viento:15.2,rafaga:30.6,dir:'⬇️S 191°',evapo:2.1,sol:10.0,notas:''},
  {id:'c-2026-05-21',fecha:'2026-05-21',temp:9.3,tmax:12.6,tmin:6.3,hum:70,humMax:91,humMin:49,lluvia:'no',mm:0,hsLluvia:0,viento:10.1,rafaga:24.1,dir:'↘️SE 136°',evapo:1.7,sol:10.0,notas:'❄️ Frío'},
  {id:'c-2026-05-22',fecha:'2026-05-22',temp:7.5,tmax:13.0,tmin:3.2,hum:74,humMax:92,humMin:55,lluvia:'no',mm:0,hsLluvia:0,viento:9.0,rafaga:21.2,dir:'➡️E 110°',evapo:1.6,sol:10.0,notas:'❄️ Frío'},
  {id:'c-2026-05-23',fecha:'2026-05-23',temp:8.5,tmax:14.6,tmin:3.6,hum:78,humMax:98,humMin:57,lluvia:'no',mm:0,hsLluvia:0,viento:11.3,rafaga:23.4,dir:'➡️E 85°',evapo:1.6,sol:10.0,notas:'❄️ Frío'},
  {id:'c-2026-05-24',fecha:'2026-05-24',temp:9.8,tmax:16.1,tmin:5.8,hum:81,humMax:99,humMin:63,lluvia:'no',mm:0,hsLluvia:0,viento:10.2,rafaga:21.2,dir:'➡️E 76°',evapo:1.2,sol:5.6,notas:'❄️ Frío'},
  {id:'c-2026-05-25',fecha:'2026-05-25',temp:10.5,tmax:16.8,tmin:6.9,hum:83,humMax:100,humMin:66,lluvia:'si',mm:0.1,hsLluvia:1.0,viento:8.1,rafaga:17.3,dir:'↘️SE 129°',evapo:1.3,sol:7.2,notas:'☔ Día lluvioso'},
  {id:'c-2026-05-26',fecha:'2026-05-26',temp:10.0,tmax:16.2,tmin:6.2,hum:85,humMax:100,humMin:69,lluvia:'no',mm:0,hsLluvia:0,viento:9.0,rafaga:19.4,dir:'↘️SE 139°',evapo:1.4,sol:8.3,notas:''},
  {id:'c-2026-05-27',fecha:'2026-05-27',temp:10.7,tmax:13.8,tmin:7.6,hum:92,humMax:100,humMin:83,lluvia:'no',mm:0,hsLluvia:0,viento:14.0,rafaga:25.2,dir:'➡️E 71°',evapo:0.9,sol:2.4,notas:''},
  {id:'c-2026-05-28',fecha:'2026-05-28',temp:13.0,tmax:17.1,tmin:10.1,hum:86,humMax:99,humMin:73,lluvia:'si',mm:0.2,hsLluvia:2.0,viento:13.2,rafaga:24.1,dir:'➡️E 94°',evapo:1.2,sol:7.1,notas:'☔ Día lluvioso'},
];

export const SEED_PLA = [
  {id:1,nombre:'Mandarina Criolla',variedad:'Citrus reticulata',especie:'Cítrico',fechaP:'2026-08-04',ubicacion:'Huerta - posición 1',exposicion:'Sol pleno',suelo:'Tierra directa',notas:''},
  {id:2,nombre:'Limonero 4 Estaciones',variedad:'Citrus limon',especie:'Cítrico',fechaP:'2026-08-04',ubicacion:'Huerta - posición 2',exposicion:'Sol pleno',suelo:'Tierra directa',notas:''},
  {id:3,nombre:'Ciruela Reina Claudia',variedad:'Reina Claudia',especie:'Prunus doméstica',fechaP:'2026-08-30',ubicacion:'Huerta - posición 3',exposicion:'Sol pleno',suelo:'Tierra directa',notas:''},
  {id:4,nombre:'Durazno amarillo',variedad:'Amarillo',especie:'Prunus pérsica',fechaP:'2026-08-30',ubicacion:'Huerta posición 4',exposicion:'Sol pleno',suelo:'Tierra directa',notas:''},
];
export const SEED_REGPLA = [
  {id:'p1',planta:1,fecha:'2026-08-04',tipo:'🌱 Plantación',detalle:'Plantación en tierra directa, sol pleno',producto:'Fertilizante 15-15-15, 250g en fondo de hoyo',resultado:'Planta instalada. Pan de tierra intacto. Relleno con tierra y regado.'},
  {id:'p2',planta:2,fecha:'2026-08-04',tipo:'🌱 Plantación',detalle:'Plantación en tierra directa, sol pleno',producto:'Fertilizante 15-15-15, 250g en fondo de hoyo',resultado:'Planta instalada. Pan de tierra intacto. Relleno con tierra y regado.'},
  {id:'p3',planta:3,fecha:'2026-08-30',tipo:'🌱 Plantación',detalle:'Plantación en tierra directa, sol pleno',producto:'Fertilizante 15-15-15, 50g en fondo de hoyo',resultado:'Planta instalada. Pan de tierra intacto. Relleno con tierra y regado.'},
  {id:'p4',planta:4,fecha:'2026-08-30',tipo:'🌱 Plantación',detalle:'Plantación en tierra directa, sol pleno',producto:'Fertilizante 15-15-15, 50g en fondo de hoyo',resultado:'Planta instalada. Pan de tierra intacto. Relleno con tierra y regado.'},
];

export const SEED_PEC = { litros:42, fechaArmado:'2026-09-15', notas:'Filtro interno XINXIU WP-008YF, 800L/h. Esponja + ~2cm de cerámica biológica en la base. 4 goldfish.' };
export const SEED_REGPEC = [
  {id:'k1',fecha:'2026-09-15',tipo:'🧪 Anticloro',detalle:'Tras limpieza completa de la pecera',resultado:''},
  {id:'k2',fecha:'2026-09-15',tipo:'🔵 Azul de metileno',detalle:'Antiséptico puntual post-limpieza — no usar de rutina',resultado:''},
];
