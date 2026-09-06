// ====================================================================
//  COMPOST TRACKER  v4.0
//  • Registro diario de clima (archive-api.open-meteo.com)
//  • Colores estilo Windy por columna
//  • Análisis cruzado Clima x Compost
//  • Alertas via Google Calendar (sin email)
//
//  Coordenadas: 33°30'18.0"S  60°04'19.0"W
//
//  ── COPIA CANÓNICA ─────────────────────────────────────────────────
//  Este archivo es una copia de referencia del Apps Script atado a la
//  Google Sheet (Extensiones → Apps Script). NO se ejecuta desde acá:
//  es solo para tener el código a mano y versionado.
//  Cada vez que edites el script real en el editor de Apps Script,
//  actualizá este archivo también (pedile a Claude que lo sincronice
//  o copialo a mano) para que no se desactualice.
//  Después de pegar cambios en el editor de Apps Script, recordá
//  Implementar → Administrar implementaciones → Editar → Nueva versión
//  para que el Web App (/exec) sirva el código nuevo.
// ====================================================================

var CFG = {
  lat:           -33.5050,
  lon:           -60.0719,
  tz:            "America/Argentina/Buenos_Aires",
  calendarId:    "d92a701e31654c0eb379b9e7d8c804126bbdd2e15a8258f360a8803b26f34038@group.calendar.google.com",
  sheetClima:    "Clima",
  sheetSistemas: "Sistemas",
  sheetRevolc:   "Registro Revolcadas",
  sheetAnalisis: "Análisis",

  // Umbrales de alerta
  diasSinRevolver:    7,
  diasSinLluvia:      3,
  humedadBajaUmbral:  40,
  evapotranspAlta:    6,
  vientoFuerte:       35,
  tempFria:           5,
  diasFrioConsec:     2,
  tempCalor:          38,
  diasEstanqueMin:    120,  // 4 meses → aviso
  diasEstanqueOk:     180,  // 6 meses → listo
};

// ====================================================================
//  TRIGGERS SEPARADOS — configurar con configurarTriggerDiario()
//  registrarClimaHoy   → 23:00
//  actualizarAnalisis  → 07:00
//  verificarYCrearEventos → 08:00
// ====================================================================

function ejecutarDiario() {
  registrarClimaHoy();
  actualizarAnalisis();
  verificarYCrearEventos();
}

// ====================================================================
//  PALETAS DE COLOR estilo Windy
// ====================================================================

var PALETAS = {
  temperatura: [
    {v:-10,r:110,g:20,b:180},{v:0,r:70,g:100,b:230},{v:5,r:60,g:180,b:240},
    {v:10,r:80,g:220,b:180},{v:15,r:100,g:230,b:80},{v:20,r:200,g:230,b:30},
    {v:25,r:250,g:190,b:0},{v:30,r:245,g:110,b:0},{v:35,r:220,g:30,b:0},{v:40,r:140,g:0,b:60}
  ],
  humedad: [
    {v:0,r:220,g:100,b:20},{v:20,r:240,g:180,b:40},{v:40,r:240,g:230,b:130},
    {v:60,r:160,g:220,b:240},{v:80,r:60,g:160,b:230},{v:100,r:20,g:80,b:200}
  ],
  lluvia: [
    {v:0,r:240,g:248,b:255},{v:2,r:160,g:210,b:255},{v:5,r:80,g:160,b:240},
    {v:15,r:30,g:100,b:210},{v:30,r:10,g:50,b:170},{v:60,r:5,g:20,b:120}
  ],
  horasLluvia: [
    {v:0,r:240,g:248,b:255},{v:3,r:140,g:200,b:255},{v:6,r:60,g:140,b:230},
    {v:12,r:20,g:60,b:180},{v:24,r:5,g:20,b:120}
  ],
  viento: [
    {v:0,r:200,g:240,b:200},{v:10,r:150,g:230,b:100},{v:20,r:230,g:230,b:30},
    {v:35,r:250,g:160,b:0},{v:50,r:230,g:50,b:20},{v:75,r:160,g:0,b:100},{v:100,r:100,g:0,b:150}
  ],
  evapo: [
    {v:0,r:80,g:160,b:230},{v:2,r:120,g:210,b:160},{v:4,r:180,g:230,b:80},
    {v:6,r:240,g:220,b:30},{v:8,r:240,g:130,b:0},{v:10,r:210,g:30,b:0}
  ],
  uv: [
    {v:0,r:100,g:220,b:100},{v:3,r:230,g:230,b:40},{v:6,r:250,g:165,b:0},
    {v:8,r:230,g:50,b:0},{v:11,r:140,g:0,b:180}
  ],
  sol: [
    {v:0,r:130,g:130,b:140},{v:4,r:200,g:200,b:160},{v:8,r:250,g:220,b:80},
    {v:12,r:255,g:200,b:0},{v:14,r:255,g:170,b:0}
  ]
};

function interpolarColor(paleta, valor) {
  if (valor === "" || valor === null || isNaN(Number(valor))) return null;
  var v = Number(valor);
  if (v <= paleta[0].v) return rgbHex(paleta[0]);
  if (v >= paleta[paleta.length-1].v) return rgbHex(paleta[paleta.length-1]);
  for (var i = 0; i < paleta.length-1; i++) {
    var p0 = paleta[i], p1 = paleta[i+1];
    if (v >= p0.v && v <= p1.v) {
      var t = (v-p0.v)/(p1.v-p0.v);
      return rgbHex({
        r: Math.round(p0.r + t*(p1.r-p0.r)),
        g: Math.round(p0.g + t*(p1.g-p0.g)),
        b: Math.round(p0.b + t*(p1.b-p0.b))
      });
    }
  }
  return null;
}
function rgbHex(c) { return "#" + pad(c.r) + pad(c.g) + pad(c.b); }
function pad(n)    { return ("0" + n.toString(16)).slice(-2); }
function textoColor(hex) {
  if (!hex) return "#000";
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.55 ? "#1a1a1a" : "#ffffff";
}
function applyColor(cell, val, paleta) {
  var hex = interpolarColor(paleta, val);
  if (hex) { cell.setBackground(hex); cell.setFontColor(textoColor(hex)); }
  else      { cell.setBackground("#F5F5F5"); cell.setFontColor("#AAAAAA"); }
}
function gradosFlecha(g) {
  var dirs = ["⬆️ N","↗️ NE","➡️ E","↘️ SE","⬇️ S","↙️ SO","⬅️ O","↖️ NO"];
  return dirs[Math.round(g/45) % 8];
}

// ====================================================================
//  REGISTRO DIARIO DE CLIMA — archive-api (sin límite de llamadas)
// ====================================================================

function registrarClimaHoy() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CFG.sheetClima);
  if (!sheet) {
    sheet = ss.insertSheet(CFG.sheetClima);
    crearEncabezadosClima(sheet);
  }

  var tz       = CFG.tz;
  var fechaObj = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  // Verificar si ya existe registro para hoy
  var datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    var celda = datos[i][0];
    if (!celda) continue;
    var fechaCelda = celda instanceof Date
      ? Utilities.formatDate(celda, tz, "yyyy-MM-dd")
      : String(celda).substring(0, 10);
    if (fechaCelda === fechaObj) {
      Logger.log("[OK] Ya existe registro para: " + fechaObj);
      return;
    }
  }

  var url = "https://archive-api.open-meteo.com/v1/archive" +
    "?latitude="  + CFG.lat +
    "&longitude=" + CFG.lon +
    "&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean" +
    ",precipitation_sum,precipitation_hours" +
    ",windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant" +
    ",relative_humidity_2m_max,relative_humidity_2m_min" +
    ",et0_fao_evapotranspiration,uv_index_max,sunshine_duration" +
    "&timezone=" + encodeURIComponent(tz) +
    "&start_date=" + fechaObj +
    "&end_date="   + fechaObj;

  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var code     = response.getResponseCode();
  if (code !== 200) {
    Logger.log("[ERROR] Archive API (" + code + "): " + response.getContentText());
    return;
  }

  var json = JSON.parse(response.getContentText());
  var d    = json.daily;
  if (!d || !d.time || d.time.length === 0) {
    Logger.log("[WARN] Sin datos para: " + fechaObj);
    return;
  }

  var idx     = 0;
  var humMax  = d.relative_humidity_2m_max ? d.relative_humidity_2m_max[idx] : null;
  var humMin  = d.relative_humidity_2m_min ? d.relative_humidity_2m_min[idx] : null;
  var humProm = (humMax !== null && humMin !== null) ? Math.round((humMax + humMin) / 2) : (humMax || humMin || "");
  var precip  = d.precipitation_sum ? (d.precipitation_sum[idx] || 0) : 0;
  var llovio  = precip > 0 ? "✅ Sí" : "❌ No";
  var horasSol = d.sunshine_duration && d.sunshine_duration[idx] !== null
    ? Math.round(d.sunshine_duration[idx] / 3600 * 10) / 10 : "";
  var dir    = d.winddirection_10m_dominant ? d.winddirection_10m_dominant[idx] : null;
  var dirStr = dir !== null ? gradosFlecha(dir) + " " + dir + "°" : "";

  var fila = [
    new Date(d.time[idx] + "T12:00:00"),
    d.temperature_2m_mean        ? (d.temperature_2m_mean[idx]        || "") : "",
    d.temperature_2m_max         ? (d.temperature_2m_max[idx]         || "") : "",
    d.temperature_2m_min         ? (d.temperature_2m_min[idx]         || "") : "",
    humMax !== null ? humMax : "",
    humMin !== null ? humMin : "",
    humProm,
    llovio,
    precip,
    d.precipitation_hours        ? (d.precipitation_hours[idx]        || 0)  : 0,
    d.windspeed_10m_max          ? (d.windspeed_10m_max[idx]          || "") : "",
    d.windgusts_10m_max          ? (d.windgusts_10m_max[idx]          || "") : "",
    dirStr,
    d.et0_fao_evapotranspiration ? (d.et0_fao_evapotranspiration[idx] || "") : "",
    d.uv_index_max               ? (d.uv_index_max[idx]               || "") : "",
    horasSol,
    "",
  ];

  sheet.appendRow(fila);
  formatearFilaClima(sheet, sheet.getLastRow(), fila);
  Logger.log("[OK] Clima: " + fechaObj + " | T: " + fila[1] + "°C | Lluvia: " + fila[8] + "mm");
}

function crearEncabezadosClima(sheet) {
  var enc = [
    "📅 Fecha","🌡️ Temp Prom\n(°C)","🌡️ Temp Max\n(°C)","🌡️ Temp Min\n(°C)",
    "💧 Hum Max\n(%)","💧 Hum Min\n(%)","💧 Hum Prom\n(%)",
    "☔ ¿Llovió?","🌧️ Lluvia\n(mm)","⏱️ Hs lluvia",
    "💨 Viento\n(km/h)","🌬️ Ráfaga\n(km/h)","🧭 Dirección",
    "💦 Evapo\n(mm)","☀️ UV","☀️ Sol (h)","📝 Notas"
  ];
  sheet.appendRow(enc);
  sheet.getRange(1,1,1,enc.length)
    .setBackground("#1B4332").setFontColor("#fff").setFontWeight("bold")
    .setFontSize(9).setFontFamily("Arial").setHorizontalAlignment("center")
    .setVerticalAlignment("middle").setWrap(true);
  sheet.setRowHeight(1, 50);

  var ley = ["🗓️ dd/mm","❄️↔🔥","❄️↔🔥","❄️↔🔥","🏜️↔💧","🏜️↔💧","🏜️↔💧",
    "❌/✅","0↔60mm","0↔24h","🍃↔🌪️","🍃↔🌪️","N/NE/E…","Bajo↔Alto","🟢↔🔴","☁️↔☀️","Texto"];
  sheet.appendRow(ley);
  sheet.getRange(2,1,1,ley.length)
    .setBackground("#ECEFF1").setFontColor("#555").setFontSize(7)
    .setFontStyle("italic").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(2, 14);
  sheet.setFrozenRows(2);

  [105,85,80,80,90,90,90,75,80,80,95,100,95,90,65,80,150].forEach(function(w,i){
    sheet.setColumnWidth(i+1, w);
  });
}

function formatearFilaClima(sheet, fila, valores) {
  if (!valores) valores = sheet.getRange(fila,1,1,17).getValues()[0];
  sheet.getRange(fila,1,1,17)
    .setFontFamily("Arial").setFontSize(10)
    .setVerticalAlignment("middle").setHorizontalAlignment("center");
  sheet.getRange(fila,1).setNumberFormat("DD/MM/YYYY");
  sheet.getRange(fila,2,1,3).setNumberFormat("0.0");
  sheet.getRange(fila,5,1,3).setNumberFormat('0"%"');
  sheet.getRange(fila,9).setNumberFormat("0.0");
  sheet.getRange(fila,10).setNumberFormat("0.0");
  sheet.getRange(fila,11,1,2).setNumberFormat("0.0");
  sheet.getRange(fila,14,1,3).setNumberFormat("0.0");
  sheet.getRange(fila,17).setHorizontalAlignment("left");

  sheet.getRange(fila,1).setBackground("#F0F0F0").setFontColor("#333");
  applyColor(sheet.getRange(fila,2),  valores[1],  PALETAS.temperatura);
  applyColor(sheet.getRange(fila,3),  valores[2],  PALETAS.temperatura);
  applyColor(sheet.getRange(fila,4),  valores[3],  PALETAS.temperatura);
  applyColor(sheet.getRange(fila,5),  valores[4],  PALETAS.humedad);
  applyColor(sheet.getRange(fila,6),  valores[5],  PALETAS.humedad);
  applyColor(sheet.getRange(fila,7),  valores[6],  PALETAS.humedad);

  var llovioCell = sheet.getRange(fila,8);
  if (valores[7] === "✅ Sí") {
    llovioCell.setBackground("#1565C0").setFontColor("#fff").setFontWeight("bold");
  } else {
    llovioCell.setBackground("#E8F5E9").setFontColor("#2E7D32");
  }

  applyColor(sheet.getRange(fila,9),  valores[8],  PALETAS.lluvia);
  applyColor(sheet.getRange(fila,10), valores[9],  PALETAS.horasLluvia);
  applyColor(sheet.getRange(fila,11), valores[10], PALETAS.viento);
  applyColor(sheet.getRange(fila,12), valores[11], PALETAS.viento);
  sheet.getRange(fila,13).setBackground("#E3F2FD").setFontColor("#0D47A1");
  applyColor(sheet.getRange(fila,14), valores[13], PALETAS.evapo);
  applyColor(sheet.getRange(fila,15), valores[14], PALETAS.uv);
  applyColor(sheet.getRange(fila,16), valores[15], PALETAS.sol);

  var notas = valores[16] || "";
  if (!notas && valores[1] !== "") {
    var temp = Number(valores[1]);
    if      (temp > 30)              notas = "🔥 Calor extremo";
    else if (temp < 10)              notas = "❄️ Frío";
    else if (valores[7] === "✅ Sí") notas = "☔ Día lluvioso";
  }
  sheet.getRange(fila,17).setValue(notas).setBackground("#FAFAFA").setFontColor("#333");
  sheet.setRowHeight(fila, 24);
}

function recolorearTodo() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.sheetClima);
  if (!sheet) return;
  var last = sheet.getLastRow();
  if (last < 3) return;
  var all = sheet.getRange(3,1,last-2,17).getValues();
  for (var i = 0; i < all.length; i++) formatearFilaClima(sheet, i+3, all[i]);
  Logger.log("[OK] Recoloreado: " + all.length + " filas");
}

// ====================================================================
//  ANÁLISIS CRUZADO CLIMA × COMPOST
// ====================================================================

function actualizarAnalisis() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var shClima  = ss.getSheetByName(CFG.sheetClima);
  var shSis    = ss.getSheetByName(CFG.sheetSistemas);
  var shAn     = ss.getSheetByName(CFG.sheetAnalisis);
  if (!shClima || !shSis) { Logger.log("Faltan hojas"); return; }
  if (!shAn) shAn = ss.insertSheet(CFG.sheetAnalisis);
  shAn.clearContents(); shAn.clearFormats();

  var hoy        = new Date();
  var climaDatos = shClima.getDataRange().getValues().slice(2);
  var sisDatos   = shSis.getDataRange().getValues().slice(2);

  function ultimosDias(n) {
    var corte = new Date(hoy); corte.setDate(corte.getDate()-n);
    return climaDatos.filter(function(r){ return r[0] && new Date(r[0]) >= corte; });
  }
  function avgCol(filas, col) {
    var vals = filas.map(function(r){ return Number(r[col]); }).filter(function(v){ return !isNaN(v) && v !== ""; });
    return vals.length ? vals.reduce(function(a,b){ return a+b; }, 0) / vals.length : null;
  }
  function sumCol(filas, col) {
    return filas.map(function(r){ return Number(r[col]); }).filter(function(v){ return !isNaN(v); })
      .reduce(function(a,b){ return a+b; }, 0);
  }

  var u3  = ultimosDias(3), u7 = ultimosDias(7), u30 = ultimosDias(30);
  var lluviaUlt3   = sumCol(u3,  8);
  var lluviaUlt7   = sumCol(u7,  8);
  var lluviaUlt30  = sumCol(u30, 8);
  var tempPromUlt7 = avgCol(u7,  1);
  var tempMaxUlt7  = avgCol(u7,  2);
  var humPromUlt7  = avgCol(u7,  6);
  var evapoUlt7    = avgCol(u7,  13);
  var vientoUlt7   = avgCol(u7,  10);

  var diasSinLluvia = 0;
  for (var i = climaDatos.length-1; i >= 0; i--) {
    if (climaDatos[i][7] === "❌ No" || Number(climaDatos[i][8]) === 0) diasSinLluvia++;
    else break;
  }
  var diasFrio = 0;
  for (var i = climaDatos.length-1; i >= 0; i--) {
    if (Number(climaDatos[i][2]) < CFG.tempFria) diasFrio++;
    else break;
  }

  var idxTemp     = tempPromUlt7 !== null ? Math.max(0, 100 - Math.abs(tempPromUlt7-22)*4)   : 50;
  var idxHum      = humPromUlt7  !== null ? Math.max(0, 100 - Math.abs(humPromUlt7-60)*1.5)  : 50;
  var idxLluvia   = Math.min(100, lluviaUlt7*3);
  var idxCondicion = Math.round(idxTemp*0.5 + idxHum*0.3 + idxLluvia*0.2);
  var labelCond   = idxCondicion>=80?"Excelente 🌟":idxCondicion>=60?"Buena ✅":idxCondicion>=40?"Regular ⚠️":"Desfavorable ❌";

  var row = 1;
  function titulo(txt, color) {
    shAn.getRange(row,1,1,6).merge().setValue(txt)
      .setBackground(color||"#1B4332").setFontColor("#fff").setFontWeight("bold")
      .setFontSize(11).setFontFamily("Arial").setVerticalAlignment("middle").setHorizontalAlignment("left");
    shAn.setRowHeight(row,28); row++;
  }
  function fil(label, valor, color) {
    shAn.getRange(row,1,1,2).merge().setValue(label).setFontSize(9).setFontColor("#555").setFontFamily("Arial");
    var vc = shAn.getRange(row,3,1,4).merge();
    vc.setValue(valor).setFontSize(10).setFontWeight("bold").setFontFamily("Arial").setFontColor("#1a1a1a");
    if (color) vc.setBackground(color);
    shAn.setRowHeight(row,20); row++;
  }
  function sep() { shAn.setRowHeight(row,8); row++; }

  titulo("📊 RESUMEN CLIMATICO — ÚLTIMOS DÍAS");
  fil("Lluvia últimos 3 días",   lluviaUlt3.toFixed(1)  + " mm");
  fil("Lluvia últimos 7 días",   lluviaUlt7.toFixed(1)  + " mm");
  fil("Lluvia últimos 30 días",  lluviaUlt30.toFixed(1) + " mm");
  fil("Días consecutivos sin lluvia", diasSinLluvia + " días");
  fil("Temp promedio (7d)",      tempPromUlt7  !== null ? tempPromUlt7.toFixed(1)+"°C"  : "—");
  fil("Temp máx promedio (7d)",  tempMaxUlt7   !== null ? tempMaxUlt7.toFixed(1)+"°C"   : "—");
  fil("Humedad promedio (7d)",   humPromUlt7   !== null ? humPromUlt7.toFixed(0)+"%"    : "—");
  fil("Evapotranspiración (7d)", evapoUlt7     !== null ? evapoUlt7.toFixed(1)+" mm"    : "—");
  fil("Viento promedio (7d)",    vientoUlt7    !== null ? vientoUlt7.toFixed(1)+" km/h" : "—");
  sep();

  titulo("🌱 CONDICION CLIMATICA PARA COMPOSTAJE", "#2D6A4F");
  var colIdx = idxCondicion>=80?"#B7E4C7":idxCondicion>=60?"#FFE066":idxCondicion>=40?"#FFBB44":"#FF6B6B";
  fil("Índice de condición (0-100)", idxCondicion + " / 100  →  " + labelCond, colIdx);
  fil("¿Conviene revolver hoy?",
    (tempPromUlt7!==null && tempPromUlt7>5 && humPromUlt7>30) ? "✅ Si, condiciones OK" : "⚠️ Revisar: temp baja o muy seco");
  fil("¿Necesita riego?",
    diasSinLluvia>=CFG.diasSinLluvia && humPromUlt7<CFG.humedadBajaUmbral ? "🚰 REGAR URGENTE" : "✅ No por ahora");
  fil("Días seguidos de frío (<"+CFG.tempFria+"°C)", diasFrio + " días");
  sep();

  titulo("📦 ESTADO POR SISTEMA  +  CLIMA EN SU PERÍODO", "#374151");
  var hdrSis = ["🆔 Sistema","📅 Inicio carga","📅 Fin carga","🏺 Inicio estanque",
    "⏱️ Días estanque","🍂 Estado","🌡️ T°prom período","🌧️ Lluvia período",
    "📊 Condición","🔄 Próx. revolver","⚠️ Alerta"];
  hdrSis.forEach(function(h,i){
    shAn.getRange(row,i+1).setValue(h).setBackground("#374151").setFontColor("#fff")
      .setFontWeight("bold").setFontSize(8).setFontFamily("Arial")
      .setHorizontalAlignment("center").setWrap(true);
  });
  shAn.setRowHeight(row,32); row++;

  sisDatos.forEach(function(sis, si) {
    if (!sis[0] || sis[0]==="") return;
    var numSis      = sis[0];
    var fechaInicio = sis[1] ? new Date(sis[1]) : null;
    var fechaFin    = sis[2] ? new Date(sis[2]) : null;
    var fechaEstanq = sis[5] ? new Date(sis[5]) : null;

    var climaPer = fechaInicio ? climaDatos.filter(function(r){
      if (!r[0]) return false;
      var d = new Date(r[0]);
      return d >= fechaInicio && (!fechaFin || d <= fechaFin);
    }) : [];
    var tProm  = avgCol(climaPer, 1);
    var lluPer = sumCol(climaPer, 8);
    var diasEstanq = fechaEstanq ? Math.floor((hoy-fechaEstanq)/86400000) : null;

    var estado = !fechaInicio ? "Sin datos" :
      !fechaEstanq ? "En carga 🔄" :
      diasEstanq>=CFG.diasEstanqueOk  ? "LISTO 🎉" :
      diasEstanq>=CFG.diasEstanqueMin ? "CASI LISTO ⏳" : "En estanque 🏺";

    // Próximo revolver: calculado desde ULTIMA revolcada registrada para este sistema
    var proxRev = "—";
    if (fechaInicio) {
      var ultimaRevolcada = obtenerUltimaRevolcada(numSis);
      var baseConteo = ultimaRevolcada || fechaInicio;
      var diasDesdeBase = Math.floor((hoy - baseConteo) / 86400000);
      var diasParaProx  = CFG.diasSinRevolver - (diasDesdeBase % CFG.diasSinRevolver);
      if (diasParaProx === CFG.diasSinRevolver || diasDesdeBase === 0) proxRev = "HOY 🔄";
      else proxRev = "En " + diasParaProx + " día(s)";
    }

    var alerta = "—";
    if (fechaInicio) {
      var ultRev = obtenerUltimaRevolcada(numSis);
      var base   = ultRev || fechaInicio;
      var dias   = Math.floor((hoy - base) / 86400000);
      if (dias >= CFG.diasSinRevolver) alerta = "🔄 REVOLVER";
    }
    if (diasEstanq !== null && diasEstanq >= CFG.diasEstanqueOk)  alerta = "🎉 COSECHAR";
    else if (diasEstanq !== null && diasEstanq >= CFG.diasEstanqueMin && alerta === "—") alerta = "👀 REVISAR";

    var bgEst = estado.indexOf("LISTO")>=0?"#B7E4C7":estado.indexOf("CASI")>=0?"#FFF3B0":"#F9F9F9";
    var bgAl  = alerta.indexOf("REVOLVER")>=0?"#FFD166":
                alerta.indexOf("COSECHAR")>=0?"#B7E4C7":
                alerta.indexOf("REVISAR")>=0?"#FFF3B0":"#F9F9F9";

    var celdas = [
      numSis,
      fechaInicio ? Utilities.formatDate(fechaInicio, CFG.tz, "dd/MM/yyyy") : "—",
      fechaFin    ? Utilities.formatDate(fechaFin,    CFG.tz, "dd/MM/yyyy") : "—",
      fechaEstanq ? Utilities.formatDate(fechaEstanq, CFG.tz, "dd/MM/yyyy") : "—",
      diasEstanq !== null ? diasEstanq+" d" : "—",
      estado,
      tProm  !== null ? tProm.toFixed(1)+"°C" : "—",
      lluPer !== null ? lluPer.toFixed(0)+" mm" : "—",
      climaPer.length ? (idxCondicion>=80?"🌟":idxCondicion>=60?"✅":idxCondicion>=40?"⚠️":"❌") : "—",
      proxRev,
      alerta,
    ];
    celdas.forEach(function(val, ci){
      var cell = shAn.getRange(row, ci+1);
      cell.setValue(val).setFontSize(9).setFontFamily("Arial")
        .setHorizontalAlignment("center").setVerticalAlignment("middle");
      if (ci===5)  cell.setBackground(bgEst);
      if (ci===10) cell.setBackground(bgAl);
      else if (si%2===0) cell.setBackground("#F7F9F7");
    });
    shAn.setRowHeight(row, 22); row++;
  });
  sep();

  // Revolcadas + clima
  var shRev = ss.getSheetByName(CFG.sheetRevolc);
  if (shRev) {
    titulo("🔄 REVOLCADAS  +  CLIMA ESE DÍA", "#0F3460");
    var rHdr = ["🆔 Sistema","📅 Fecha","🌡️ Temp (°C)","💧 Humedad (%)","☔ Llovió",
      "💨 Viento (km/h)","💦 Evapo (mm)","⏱️ Días desde anterior","✅ ¿En tiempo?"];
    rHdr.forEach(function(h,i){
      shAn.getRange(row,i+1).setValue(h).setBackground("#0F3460").setFontColor("#fff")
        .setFontWeight("bold").setFontSize(8).setFontFamily("Arial").setHorizontalAlignment("center");
    });
    shAn.setRowHeight(row,28); row++;

    var revDatos = shRev.getDataRange().getValues().slice(2);
    revDatos.forEach(function(rev, ri){
      if (!rev[0] || !rev[1]) return;
      var fechaRev    = new Date(rev[1]);
      var fechaRevStr = Utilities.formatDate(fechaRev, CFG.tz, "yyyy-MM-dd");
      var climaDia    = climaDatos.find(function(c){
        return c[0] && Utilities.formatDate(new Date(c[0]), CFG.tz, "yyyy-MM-dd") === fechaRevStr;
      });
      var diasAnt  = rev[2];
      var enTiempo = typeof diasAnt==="number" ? (diasAnt<=7?"✅ OK":"⚠️ DEMORADO") :
                     (String(diasAnt).indexOf("Primera")>=0 ? "🆕 —" : "—");
      var vals = [
        rev[0],
        Utilities.formatDate(fechaRev, CFG.tz, "dd/MM/yyyy"),
        climaDia ? climaDia[1] : "—",
        climaDia ? climaDia[6] : "—",
        climaDia ? (climaDia[7]==="✅ Sí"?"✅ Sí":"❌ No") : "—",
        climaDia ? climaDia[10] : "—",
        climaDia ? climaDia[13] : "—",
        diasAnt || "—",
        enTiempo,
      ];
      vals.forEach(function(val, ci){
        var cell = shAn.getRange(row, ci+1);
        cell.setValue(val).setFontSize(9).setFontFamily("Arial")
          .setHorizontalAlignment("center").setVerticalAlignment("middle");
        if (ci===8) cell.setBackground(enTiempo==="✅ OK"?"#B7E4C7":enTiempo==="⚠️ DEMORADO"?"#FFD166":"#F9F9F9");
        else if (ri%2===0) cell.setBackground("#EEF2FF");
        if (ci===2 && climaDia) applyColor(cell, climaDia[1],  PALETAS.temperatura);
        if (ci===3 && climaDia) applyColor(cell, climaDia[6],  PALETAS.humedad);
        if (ci===5 && climaDia) applyColor(cell, climaDia[10], PALETAS.viento);
        if (ci===6 && climaDia) applyColor(cell, climaDia[13], PALETAS.evapo);
      });
      shAn.setRowHeight(row, 20); row++;
    });
  }

  for (var c=1; c<=11; c++) shAn.setColumnWidth(c, c===1?75:c===11?120:100);
  shAn.setFrozenRows(1);
  shAn.getRange(row+1,1,1,4).merge()
    .setValue("🔄 Actualizado: " + Utilities.formatDate(new Date(), CFG.tz, "dd/MM/yyyy HH:mm"))
    .setFontSize(8).setFontColor("#999").setFontStyle("italic");
  Logger.log("[OK] Análisis actualizado");
}

// ====================================================================
//  HELPER: última revolcada registrada para un sistema
//  Devuelve un objeto Date o null si no hay registros
// ====================================================================

function obtenerUltimaRevolcada(numSis) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var shRev = ss.getSheetByName(CFG.sheetRevolc);
  if (!shRev) return null;
 
  var todos = shRev.getDataRange().getValues();
  var ultima = null;
 
  for (var i = 0; i < todos.length; i++) {
    var r = todos[i];
    // Saltar filas sin número de sistema o sin fecha válida
    if (!r[0] || !r[1]) continue;
    // Saltar filas que no son numéricas en col 0 (títulos)
    if (isNaN(Number(r[0]))) continue;
    // Saltar filas cuya col 1 no es una fecha real
    if (!(r[1] instanceof Date) && isNaN(Date.parse(r[1]))) continue;
 
    if (String(r[0]).trim() === String(numSis).trim()) {
      var f = r[1] instanceof Date ? r[1] : new Date(r[1]);
      if (!isNaN(f.getTime())) {
        if (!ultima || f > ultima) ultima = f;
      }
    }
  }
 
  if (ultima) {
    Logger.log("[DEBUG] Última revolcada Sistema " + numSis + ": " +
               Utilities.formatDate(ultima, CFG.tz, "dd/MM/yyyy"));
  }
  return ultima;
}

// ====================================================================
//  CARGA HISTÓRICA — archive-api, sin duplicados
// ====================================================================

function cargarHistorico(diasAtras) {
  diasAtras = diasAtras || 30;
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CFG.sheetClima);
  if (!sheet) { sheet = ss.insertSheet(CFG.sheetClima); crearEncabezadosClima(sheet); }

  var tz       = CFG.tz;
  var hoy      = new Date();
  var finDate  = new Date(hoy); finDate.setDate(finDate.getDate()-1);
  var fechaFin = Utilities.formatDate(finDate, tz, "yyyy-MM-dd");
  var iniDate  = new Date(hoy); iniDate.setDate(iniDate.getDate()-diasAtras);
  var fechaIni = Utilities.formatDate(iniDate, tz, "yyyy-MM-dd");

  var datos = sheet.getDataRange().getValues();
  var yaExisten = {};
  for (var i = 1; i < datos.length; i++) {
    var c = datos[i][0];
    if (!c) continue;
    var f = c instanceof Date ? Utilities.formatDate(c, tz, "yyyy-MM-dd") : String(c).substring(0,10);
    yaExisten[f] = true;
  }

  var url = "https://archive-api.open-meteo.com/v1/archive" +
    "?latitude=" + CFG.lat + "&longitude=" + CFG.lon +
    "&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean" +
    ",precipitation_sum,precipitation_hours" +
    ",windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant" +
    ",relative_humidity_2m_max,relative_humidity_2m_min" +
    ",et0_fao_evapotranspiration,uv_index_max,sunshine_duration" +
    "&timezone=" + encodeURIComponent(tz) +
    "&start_date=" + fechaIni + "&end_date=" + fechaFin;

  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) { Logger.log("[ERROR] " + resp.getResponseCode()); return; }

  var d = JSON.parse(resp.getContentText()).daily;
  var nuevos = 0;
  for (var i = 0; i < d.time.length; i++) {
    if (yaExisten[d.time[i]]) continue;
    var humMax  = d.relative_humidity_2m_max ? d.relative_humidity_2m_max[i] : null;
    var humMin  = d.relative_humidity_2m_min ? d.relative_humidity_2m_min[i] : null;
    var humProm = (humMax!==null && humMin!==null) ? Math.round((humMax+humMin)/2) : "";
    var precip  = d.precipitation_sum ? (d.precipitation_sum[i]||0) : 0;
    var llovio  = precip>0 ? "✅ Sí" : "❌ No";
    var horasSol = d.sunshine_duration && d.sunshine_duration[i]!==null
      ? Math.round(d.sunshine_duration[i]/3600*10)/10 : "";
    var dir    = d.winddirection_10m_dominant ? d.winddirection_10m_dominant[i] : null;
    var dirStr = dir!==null ? gradosFlecha(dir)+" "+dir+"°" : "";
    var fila = [
      new Date(d.time[i]+"T12:00:00"),
      d.temperature_2m_mean        ? (d.temperature_2m_mean[i]||"")        : "",
      d.temperature_2m_max         ? (d.temperature_2m_max[i]||"")         : "",
      d.temperature_2m_min         ? (d.temperature_2m_min[i]||"")         : "",
      humMax!==null?humMax:"", humMin!==null?humMin:"", humProm,
      llovio, precip,
      d.precipitation_hours        ? (d.precipitation_hours[i]||0)         : 0,
      d.windspeed_10m_max          ? (d.windspeed_10m_max[i]||"")          : "",
      d.windgusts_10m_max          ? (d.windgusts_10m_max[i]||"")          : "",
      dirStr,
      d.et0_fao_evapotranspiration ? (d.et0_fao_evapotranspiration[i]||"") : "",
      d.uv_index_max               ? (d.uv_index_max[i]||"")               : "",
      horasSol, "",
    ];
    sheet.appendRow(fila);
    formatearFilaClima(sheet, sheet.getLastRow(), fila);
    nuevos++;
  }
  Logger.log("[OK] Histórico: " + nuevos + " días nuevos (" + fechaIni + " a " + fechaFin + ")");
}

// ====================================================================
//  TEST: crear evento de prueba en el calendario
// ====================================================================

function testCalendario() {
  var cal = CalendarApp.getCalendarById(CFG.calendarId);
  if (!cal) { Logger.log("[ERROR] Calendario no encontrado"); return; }

  var hoy    = new Date();
  var titulo = "🧪 COMPOST TEST: verificación del sistema";
  // Verificar que no exista ya
  var ini = new Date(hoy); ini.setHours(0,0,0,0);
  var fin = new Date(hoy); fin.setHours(23,59,59,999);
  var existentes = cal.getEvents(ini,fin).map(function(e){ return e.getTitle(); });
  if (existentes.indexOf(titulo) >= 0) {
    Logger.log("[SKIP] Evento de prueba ya existe hoy");
    return;
  }
  var ev = cal.createAllDayEvent(titulo, hoy, {
    description: "Evento de prueba del sistema Compost Tracker.\n" +
                 "Si ves esto, el calendario está funcionando correctamente.\n" +
                 "Coordenadas: " + CFG.lat + ", " + CFG.lon
  });
  try { ev.setColor(CalendarApp.EventColor.GREEN); } catch(e) {}
  Logger.log("[OK] Evento de prueba creado en el calendario");
}

// ====================================================================
//  COMPOST TRACKER  v4.1  —  Agregado: Seguimiento de Plantas
//  Pegá estas funciones AL FINAL del script existente
//  y reemplazá verificarYCrearEventos() y configurarTriggerDiario()
// ====================================================================

// ====================================================================
//  CONFIGURACIÓN DE PLANTAS
//  Ajustes específicos para cítricos en clima templado (San Jorge, SF)
// ====================================================================

var CFG_PLANTAS = {
  sheetPlantas:      "Plantas",
  sheetRegistro:     "Registro Plantas",

  // Umbrales de alerta para cítricos
  tempHeladaUmbral:  2,    // °C — alerta de helada inminente
  tempHeladaSevera: -2,    // °C — helada severa, riesgo real de daño
  diasSinRiegoMax:   7,    // días máx sin riego en verano
  diasSinRiegoInv:  14,    // días máx sin riego en invierno
  diasFertilizante: 60,    // días entre fertilizaciones (bimestral)
  diasRevisionPlagas: 30,  // días entre revisiones de plagas
  diasPoda:         365,   // días entre podas de formación (anual)

  // Meses de verano en Argentina (cuando necesitan más agua)
  mesesVerano: [11, 12, 1, 2, 3],  // nov-mar
};

// ====================================================================
//  CREAR / INICIALIZAR HOJAS DE PLANTAS
// ====================================================================

function inicializarHojaPlantas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Hoja "Plantas" — ficha de cada planta ──────────────────────
  var shP = ss.getSheetByName(CFG_PLANTAS.sheetPlantas);
  if (!shP) {
    shP = ss.insertSheet(CFG_PLANTAS.sheetPlantas);
    Logger.log("[OK] Hoja Plantas creada");
  } else {
    Logger.log("[INFO] Hoja Plantas ya existe — solo se agrega datos si faltan");
  }

  // Encabezados ficha de plantas
  var encP = [
    "ID", "Nombre", "Variedad", "Especie", "Fecha plantación",
    "Ubicación en huerta", "Exposición solar", "Tipo suelo",
    "Fertilizante inicial (g)", "Fórmula fert. inicial",
    "Última fertilización", "Próxima fertilización",
    "Última poda", "Próxima poda",
    "Última revisión plagas", "Próxima revisión plagas",
    "Último riego", "Días desde último riego",
    "Estado general", "Notas"
  ];
  if (shP.getLastRow() === 0) {
    shP.appendRow(encP);
    var hdr = shP.getRange(1,1,1,encP.length);
    hdr.setBackground("#1B5E20").setFontColor("#fff").setFontWeight("bold")
       .setFontSize(9).setFontFamily("Arial").setHorizontalAlignment("center")
       .setVerticalAlignment("middle").setWrap(true);
    shP.setRowHeight(1, 50);
    shP.setFrozenRows(1);
    [55,140,120,100,110,130,100,100,110,110,115,115,100,100,130,130,110,110,100,160]
      .forEach(function(w,i){ shP.setColumnWidth(i+1,w); });

    // Cargar las dos plantas iniciales
    var hoy = new Date();
    var plantacion = new Date("2026-08-04T12:00:00");
    var proxFert   = new Date(plantacion); proxFert.setDate(proxFert.getDate() + 60);
    var proxPoda   = new Date(plantacion); proxPoda.setDate(proxPoda.getDate() + 365);
    var proxPlagas = new Date(plantacion); proxPlagas.setDate(proxPlagas.getDate() + 30);

    var plantas = [
      [1, "Mandarina Criolla", "Citrus reticulata", "Cítrico", plantacion,
       "Huerta - posición 1", "Sol pleno", "Tierra directa",
       250, "15-15-15", plantacion, proxFert, "", proxPoda, plantacion, proxPlagas,
       plantacion, 1, "Recién plantada 🌱", "Plantada 04/08/2026. Fert. inicial 250g 15-15-15 en fondo."],
      [2, "Limonero 4 Estaciones", "Citrus limon", "Cítrico", plantacion,
       "Huerta - posición 2", "Sol pleno", "Tierra directa",
       250, "15-15-15", plantacion, proxFert, "", proxPoda, plantacion, proxPlagas,
       plantacion, 1, "Recién plantada 🌱", "Plantada 04/08/2026. Fert. inicial 250g 15-15-15 en fondo."],
    ];

    plantas.forEach(function(p) {
      shP.appendRow(p);
      var fila = shP.getLastRow();
      // Formatear fechas
      [5,11,12,13,14,15,16,17].forEach(function(col){
        shP.getRange(fila,col).setNumberFormat("DD/MM/YYYY");
      });
      shP.getRange(fila,1,1,encP.length)
        .setFontFamily("Arial").setFontSize(9)
        .setVerticalAlignment("middle").setHorizontalAlignment("center");
      shP.getRange(fila,2).setFontWeight("bold"); // nombre
      shP.getRange(fila,20).setHorizontalAlignment("left"); // notas
      shP.setRowHeight(fila, 22);
      colorearEstadoPlanta(shP, fila, p[18]);
    });
  }

  // ── Hoja "Registro Plantas" — log de eventos por planta ────────
  var shR = ss.getSheetByName(CFG_PLANTAS.sheetRegistro);
  if (!shR) {
    shR = ss.insertSheet(CFG_PLANTAS.sheetRegistro);
    var encR = [
      "ID Planta", "Planta", "Fecha", "Tipo evento",
      "Detalle", "Producto / Dosis",
      "T° día (°C)", "Lluvia ese día (mm)", "Humedad (%)",
      "Resultado / Observación"
    ];
    shR.appendRow(encR);
    shR.getRange(1,1,1,encR.length)
      .setBackground("#33691E").setFontColor("#fff").setFontWeight("bold")
      .setFontSize(9).setFontFamily("Arial").setHorizontalAlignment("center")
      .setVerticalAlignment("middle").setWrap(true);
    shR.setRowHeight(1, 40);
    shR.setFrozenRows(1);
    [60,140,95,110,200,130,80,90,80,200]
      .forEach(function(w,i){ shR.setColumnWidth(i+1,w); });

    // Registrar el evento inicial de plantación
    var climaInicial = obtenerClimaFecha("2026-08-04");
    [
      [1, "Mandarina Criolla", new Date("2026-08-04T12:00:00"), "🌱 Plantación",
       "Plantación en tierra directa, sol pleno",
       "Fertilizante 15-15-15, 250g en fondo de hoyo",
       climaInicial ? climaInicial[1] : "", climaInicial ? climaInicial[8] : "",
       climaInicial ? climaInicial[6] : "",
       "Planta instalada. Pan de tierra intacto. Relleno con tierra y regado."],
      [2, "Limonero 4 Estaciones", new Date("2026-08-04T12:00:00"), "🌱 Plantación",
       "Plantación en tierra directa, sol pleno",
       "Fertilizante 15-15-15, 250g en fondo de hoyo",
       climaInicial ? climaInicial[1] : "", climaInicial ? climaInicial[8] : "",
       climaInicial ? climaInicial[6] : "",
       "Planta instalada. Pan de tierra intacto. Relleno con tierra y regado."],
    ].forEach(function(r){
      shR.appendRow(r);
      var fila = shR.getLastRow();
      shR.getRange(fila,3).setNumberFormat("DD/MM/YYYY");
      shR.getRange(fila,1,1,10)
        .setFontFamily("Arial").setFontSize(9)
        .setVerticalAlignment("middle").setHorizontalAlignment("center");
      shR.getRange(fila,5).setHorizontalAlignment("left");
      shR.getRange(fila,10).setHorizontalAlignment("left");
      shR.setRowHeight(fila,20);
    });
    Logger.log("[OK] Hoja Registro Plantas creada con plantaciones iniciales");
  }
}

function colorearEstadoPlanta(sheet, fila, estado) {
  var cell = sheet.getRange(fila, 19);
  var colores = {
    "Excelente": "#B7E4C7", "Muy bien": "#D8F3DC",
    "Bien": "#E9F5DB", "Regular": "#FFF3B0",
    "Atención": "#FFD166", "Mal": "#FF6B6B",
  };
  var found = "#F9F9F9";
  for (var k in colores) {
    if (String(estado).indexOf(k) >= 0) { found = colores[k]; break; }
  }
  if (String(estado).indexOf("plantada") >= 0 || String(estado).indexOf("Recién") >= 0)
    found = "#D8F3DC";
  cell.setBackground(found);
}

// Helper: buscar clima de una fecha específica en la hoja Clima
function obtenerClimaFecha(fechaStr) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CFG.sheetClima);
  if (!sheet) return null;
  var datos = sheet.getDataRange().getValues().slice(2);
  return datos.find(function(r){
    if (!r[0]) return false;
    var f = r[0] instanceof Date
      ? Utilities.formatDate(r[0], CFG.tz, "yyyy-MM-dd")
      : String(r[0]).substring(0,10);
    return f === fechaStr;
  }) || null;
}

// ====================================================================
//  HELPER: última agua efectiva para una planta
//  Considera riego manual Y lluvia >= umbral (8mm)
//  Devuelve { fecha, tipo, mm } con la fuente más reciente
// ====================================================================
 
var UMBRAL_LLUVIA_MM = 8; // mm mínimos para considerar lluvia efectiva

// ====================================================================
//  REEMPLAZAR verificarYCrearEventos() — AHORA CREA EVENTOS PARA MAÑANA
// ====================================================================

function verificarYCrearEventos() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var shSis   = ss.getSheetByName(CFG.sheetSistemas);
  var shClima = ss.getSheetByName(CFG.sheetClima);
  if (!shSis || !shClima) return;

  var cal = CalendarApp.getCalendarById(CFG.calendarId);
  if (!cal) { Logger.log("[ERROR] Calendario no encontrado"); return; }

  // ── Crear eventos para MAÑANA (preventivo) ─────────────────────
  var manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(0,0,0,0);

  var hoy        = new Date(); hoy.setHours(0,0,0,0);
  var sisDatos   = shSis.getDataRange().getValues().slice(2);
  var climaDatos = shClima.getDataRange().getValues().slice(2);
  var climaAyer  = climaDatos.length ? climaDatos[climaDatos.length-1] : null;

  var tempMin   = climaAyer ? Number(climaAyer[3])  : null;
  var tempMax   = climaAyer ? Number(climaAyer[2])  : null;
  var humHoy    = climaAyer ? Number(climaAyer[6])  : null;
  var evapoHoy  = climaAyer ? Number(climaAyer[13]) : null;
  var vientoHoy = climaAyer ? Number(climaAyer[10]) : null;
  var mmHoy     = climaAyer ? Number(climaAyer[8])  : null;

  var diasSinLluvia = 0;
  for (var i = climaDatos.length-1; i >= 0; i--) {
    if (climaDatos[i][7]==="❌ No" || Number(climaDatos[i][8])===0) diasSinLluvia++;
    else break;
  }
  var diasFrio = 0;
  for (var i = climaDatos.length-1; i >= 0; i--) {
    if (Number(climaDatos[i][2]) < CFG.tempFria) diasFrio++;
    else break;
  }

  var eventos = [];

  // ── ALERTAS CLIMA ───────────────────────────────────────────────
  if (tempMax !== null && tempMax >= CFG.tempCalor) {
    eventos.push({
      titulo: "🔥 COMPOST: Calor extremo mañana - revisar humedad",
      desc: "Temperatura máxima registrada ayer: " + tempMax + "°C\n" +
            "Acción para mañana: revisá humedad del compost y regá si es necesario.",
      color: CalendarApp.EventColor.RED
    });
  }
  if (diasSinLluvia >= CFG.diasSinLluvia && humHoy !== null && humHoy < CFG.humedadBajaUmbral) {
    eventos.push({
      titulo: "💧 COMPOST: Regar mañana",
      desc: diasSinLluvia + " días sin lluvia. Humedad ambiente: " + humHoy + "%\n" +
            "Acción para mañana: regar el compost y aprovechá para revolver.",
      color: CalendarApp.EventColor.BLUE
    });
  }
  if (evapoHoy !== null && vientoHoy !== null &&
      evapoHoy >= CFG.evapotranspAlta && vientoHoy >= CFG.vientoFuerte && mmHoy === 0) {
    eventos.push({
      titulo: "🌬️ COMPOST: Estrés hídrico - revisá cobertura mañana",
      desc: "Evapotranspiración: " + evapoHoy + " mm | Viento: " + vientoHoy + " km/h\n" +
            "Acción para mañana: revisá la cobertura del compost.",
      color: CalendarApp.EventColor.YELLOW
    });
  }
  if (diasFrio >= CFG.diasFrioConsec) {
    eventos.push({
      titulo: "❄️ COMPOST: Proceso frenado por frío (" + diasFrio + " días)",
      desc: diasFrio + " días consecutivos con temp máx < " + CFG.tempFria + "°C.\n" +
            "Info: no es necesario revolver, el proceso está muy lento.",
      color: CalendarApp.EventColor.CYAN
    });
  }

  // ── ALERTAS POR SISTEMA DE COMPOST ──────────────────────────────
  sisDatos.forEach(function(sis) {
    if (!sis[0] || sis[0]==="") return;
    var numSis      = sis[0];
    var fechaInicio = sis[1] ? new Date(sis[1]) : null;
    var fechaEstanq = sis[5] ? new Date(sis[5]) : null;

    if (fechaInicio) {
      var ultimaRev     = obtenerUltimaRevolcada(numSis);
      var baseConteo    = ultimaRev || fechaInicio;
      var diasDesdeBase = Math.floor((hoy - baseConteo) / 86400000);

      if (diasDesdeBase >= CFG.diasSinRevolver) {
        var diasAtraso = diasDesdeBase - CFG.diasSinRevolver;
        eventos.push({
          titulo: "🔄 COMPOST: Revolver Sistema " + numSis + " mañana" +
                  (diasAtraso > 0 ? " (" + diasAtraso + " día(s) de atraso)" : ""),
          desc: "Han pasado " + diasDesdeBase + " días desde la última revolcada" +
                (ultimaRev ? " (" + Utilities.formatDate(ultimaRev, CFG.tz, "dd/MM/yyyy") + ")" :
                             " (inicio: " + Utilities.formatDate(fechaInicio, CFG.tz, "dd/MM/yyyy") + ")") + ".\n" +
                "Frecuencia recomendada: cada " + CFG.diasSinRevolver + " días.\n" +
                (mmHoy > 0 ? "Ayer llovió " + mmHoy + " mm — buen momento.\n" : "") +
                "Acción: revolver mañana y registrar en 'Registro Revolcadas'.",
          color: CalendarApp.EventColor.ORANGE
        });
      } else if (diasDesdeBase === CFG.diasSinRevolver - 1) {
        // Aviso previo: mañana toca revolver
        eventos.push({
          titulo: "🔄 COMPOST: Mañana toca revolver Sistema " + numSis,
          desc: "Mañana se cumplen " + CFG.diasSinRevolver + " días desde la última revolcada.\n" +
                "Preparate para revolver el Sistema " + numSis + " mañana.",
          color: CalendarApp.EventColor.YELLOW
        });
      }
    }

    if (fechaEstanq) {
      var diasEstanq = Math.floor((hoy - fechaEstanq) / 86400000);
      if (diasEstanq >= CFG.diasEstanqueOk) {
        eventos.push({
          titulo: "🎉 COMPOST: Sistema " + numSis + " LISTO para cosechar",
          desc: "El Sistema " + numSis + " lleva " + diasEstanq + " días en estanque.\n" +
                "Ya cumplió 6 meses. Aspecto esperado: tierra oscura, olor a tierra húmeda.\n" +
                "Acción: cosechar y preparar para el próximo ciclo.",
          color: CalendarApp.EventColor.GREEN
        });
      } else if (diasEstanq >= CFG.diasEstanqueMin) {
        eventos.push({
          titulo: "⏳ COMPOST: Sistema " + numSis + " — Revisar maduración (" + diasEstanq + " días)",
          desc: "El Sistema " + numSis + " lleva " + diasEstanq + " días en estanque (mín: " +
                CFG.diasEstanqueMin + " días).\n" +
                "Fecha estimada de cosecha: " +
                Utilities.formatDate(new Date(fechaEstanq.getTime() + CFG.diasEstanqueOk*86400000), CFG.tz, "dd/MM/yyyy") + ".\n" +
                "Acción: revisá visualmente color, textura y olor.",
          color: CalendarApp.EventColor.TEAL
        });
      }
    }
  });

  // ── ALERTAS DE PLANTAS ──────────────────────────────────────────
  var eventosPlantas = verificarEventosPlantas(cal, manana);
  if (eventosPlantas) eventos = eventos.concat(eventosPlantas);

  if (eventos.length === 0) {
    Logger.log("[OK] Sin eventos para crear mañana");
    return;
  }

  // Verificar duplicados en el día de mañana
  var ini = new Date(manana); ini.setHours(0,0,0,0);
  var fin = new Date(manana); fin.setHours(23,59,59,999);
  var titulosExistentes = cal.getEvents(ini, fin).map(function(e){ return e.getTitle(); });

  var creados = 0;
  eventos.forEach(function(ev) {
    if (titulosExistentes.indexOf(ev.titulo) >= 0) {
      Logger.log("[SKIP] Ya existe: " + ev.titulo);
      return;
    }
    var evento = cal.createAllDayEvent(ev.titulo, manana, { description: ev.desc });
    try { evento.setColor(ev.color); } catch(e) {}
    Logger.log("[CAL] Creado para " + Utilities.formatDate(manana, CFG.tz, "dd/MM") + ": " + ev.titulo);
    creados++;
  });
  Logger.log("[OK] Eventos creados: " + creados + " / " + eventos.length);
}

// ====================================================================
//  REEMPLAZAR configurarTriggerDiario()
//  Ahora verificarYCrearEventos corre a las 23hs junto con el clima
//  para que los eventos aparezcan en el calendario del DÍA SIGUIENTE
// ====================================================================

function configurarTriggerDiario() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    ScriptApp.deleteTrigger(t);
  });

  // 23:00 — registrar clima del día Y crear eventos preventivos para mañana
  ScriptApp.newTrigger("registrarClimaHoy")
    .timeBased().atHour(23).everyDays(1)
    .inTimezone(CFG.tz).create();

  ScriptApp.newTrigger("verificarYCrearEventos")
    .timeBased().atHour(23).everyDays(1)
    .inTimezone(CFG.tz).create();

  // 07:00 — actualizar análisis con datos del día anterior
  ScriptApp.newTrigger("actualizarAnalisis")
    .timeBased().atHour(7).everyDays(1)
    .inTimezone(CFG.tz).create();

  // 07:00 — actualizar ficha de plantas (días desde riego, colores)
  ScriptApp.newTrigger("actualizarFichaPlantas")
    .timeBased().atHour(7).everyDays(1)
    .inTimezone(CFG.tz).create();

  Logger.log("[OK] Triggers: clima+eventos 23hs / análisis+plantas 7hs");
}

// ====================================================================
//  TEST: crear evento de prueba en el calendario
// ====================================================================

function testCalendario() {
  var cal = CalendarApp.getCalendarById(CFG.calendarId);
  if (!cal) { Logger.log("[ERROR] Calendario no encontrado"); return; }
  var manana = new Date(); manana.setDate(manana.getDate()+1); manana.setHours(0,0,0,0);
  var titulo = "🧪 COMPOST TEST: verificación del sistema";
  var ini = new Date(manana); ini.setHours(0,0,0,0);
  var fin = new Date(manana); fin.setHours(23,59,59,999);
  var existe = cal.getEvents(ini,fin).some(function(e){ return e.getTitle()===titulo; });
  if (existe) { Logger.log("[SKIP] Ya existe el evento de prueba"); return; }
  var ev = cal.createAllDayEvent(titulo, manana, {
    description: "Evento de prueba creado por Compost Tracker.\nSi ves esto, el calendario funciona correctamente."
  });
  try { ev.setColor(CalendarApp.EventColor.GREEN); } catch(e) {}
  Logger.log("[OK] Evento de prueba creado para mañana: " + Utilities.formatDate(manana, CFG.tz, "dd/MM/yyyy"));
}

// ====================================================================
//  DIAGNÓSTICO — ejecutar para ver qué fechas está leyendo
//  Útil para verificar el conteo de revolcadas y el agua efectiva
// ====================================================================
 
function diagnosticar() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var hoy = new Date();
  Logger.log("=== DIAGNÓSTICO " + Utilities.formatDate(hoy, CFG.tz, "dd/MM/yyyy HH:mm") + " ===");
 
  // Revolcadas por sistema
  var shSis = ss.getSheetByName(CFG.sheetSistemas);
  if (shSis) {
    var sisDatos = shSis.getDataRange().getValues().slice(2);
    sisDatos.forEach(function(sis) {
      if (!sis[0] || isNaN(Number(sis[0]))) return;
      var numSis = sis[0];
      var ultima = obtenerUltimaRevolcada(numSis);
      if (ultima) {
        var dias = Math.floor((hoy - ultima) / 86400000);
        var diasParaProx = CFG.diasSinRevolver - (dias % CFG.diasSinRevolver);
        if (diasParaProx === CFG.diasSinRevolver) diasParaProx = 0;
        Logger.log("Sistema " + numSis +
          " | Última revolcada: " + Utilities.formatDate(ultima, CFG.tz, "dd/MM/yyyy") +
          " | Días transcurridos: " + dias +
          " | Próximo revolver en: " + diasParaProx + " día(s)");
      } else {
        var fechaInicio = sis[1] ? new Date(sis[1]) : null;
        if (fechaInicio) {
          var dias = Math.floor((hoy - fechaInicio) / 86400000);
          Logger.log("Sistema " + numSis +
            " | Sin revolcadas registradas | Desde inicio: " + dias + " días");
        }
      }
    });
  }
 
  // Agua efectiva por planta
  var shP = ss.getSheetByName(CFG_PLANTAS.sheetPlantas);
  if (shP && shP.getLastRow() > 1) {
    var plantasDatos = shP.getDataRange().getValues().slice(1);
    plantasDatos.forEach(function(p) {
      if (!p[0] || !p[1]) return;
      var ultimoRiego  = p[16] ? new Date(p[16]) : null;
      var agua         = calcularUltimaAguaEfectiva(ultimoRiego);
      if (agua.fecha) {
        var dias = Math.floor((hoy - new Date(agua.fecha)) / 86400000);
        Logger.log("Planta " + p[0] + " (" + p[1] + ")" +
          " | Última agua: " + Utilities.formatDate(agua.fecha, CFG.tz, "dd/MM/yyyy") +
          " (" + agua.tipo + (agua.mm ? " " + agua.mm + "mm" : "") + ")" +
          " | Días sin agua: " + dias);
      }
    });
  }
 
  Logger.log("=== FIN DIAGNÓSTICO ===");
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var tipo = body.tipo, data = body.data;
    if      (tipo === 'revolcada')     guardarRevolcadaSheet(data);
    else if (tipo === 'sistema')       guardarSistemaSheet(data);
    else if (tipo === 'planta')        guardarPlantaSheet(data);
    else if (tipo === 'plantaEvento')  guardarEventoPlantaSheet(data);
    return ContentService.createTextOutput(JSON.stringify({ok:true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false, error:String(err)}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Busca la última fila que tiene un valor real en una columna puntual,
// ignorando filas más abajo que solo tienen fórmulas/formato arrastrado
// (getLastRow() cuenta esas filas como "con contenido" y hace que los
// appendRow terminen muy por debajo de donde parece terminar la data).
function ultimaFilaConDatos_(sh, col) {
  var last = sh.getLastRow();
  if (last < 1) return 0;
  var valores = sh.getRange(1, col, last, 1).getValues();
  for (var i = valores.length - 1; i >= 0; i--) {
    if (valores[i][0] !== '' && valores[i][0] !== null) return i + 1;
  }
  return 0;
}

// ── Revolcada: se agrega siempre como fila nueva al final ──────────
function guardarRevolcadaSheet(d) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.sheetRevolc);
  if (!sh || !d.sistema || !d.fecha) return;
  var fila = ultimaFilaConDatos_(sh, 1) + 1;                        // ancla en col. A (Sistema #), no en getLastRow()
  sh.getRange(fila, 1).setValue(Number(d.sistema));                 // A: Sistema #
  var fc = sh.getRange(fila, 2);
  fc.setValue(new Date(d.fecha + 'T12:00:00')).setNumberFormat('DD/MM/YYYY'); // B: Fecha
  if (d.obs) sh.getRange(fila, 5).setValue(d.obs);                  // E: Observaciones
  // C (días desde última) y D (¿en tiempo?) se dejan intactas: si son
  // fórmulas que se auto-extienden, se completan solas.
}

// ── Sistema: actualiza la fila existente del Sistema # (no crea filas) ──
function guardarSistemaSheet(d) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.sheetSistemas);
  if (!sh || !d.id) return;
  var datos = sh.getDataRange().getValues();
  for (var i = 2; i < datos.length; i++) {           // fila 3 en adelante = Sistema 1, 2, 3...
    if (String(datos[i][0]).trim() !== String(d.id).trim()) continue;
    var fila = i + 1;
    if (d.inicioC) sh.getRange(fila,2).setValue(new Date(d.inicioC+'T12:00:00')).setNumberFormat('DD/MM/YYYY'); // B
    if (d.finC)    sh.getRange(fila,3).setValue(new Date(d.finC+'T12:00:00')).setNumberFormat('DD/MM/YYYY');    // C
    if (d.inicioE) sh.getRange(fila,6).setValue(new Date(d.inicioE+'T12:00:00')).setNumberFormat('DD/MM/YYYY'); // F
    if (d.notas)   sh.getRange(fila,10).setValue(d.notas);          // J
    return;
  }
}

// ── Planta: actualiza la ficha si el ID ya existe, si no la agrega ──
function guardarPlantaSheet(d) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG_PLANTAS.sheetPlantas);
  if (!sh || !d.id) return;
  var datos = sh.getDataRange().getValues();
  var fila = null;
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(d.id).trim()) { fila = i + 1; break; }
  }
  if (!fila) fila = ultimaFilaConDatos_(sh, 1) + 1;       // ancla en col. A (ID), no en getLastRow()
  sh.getRange(fila, 1).setValue(Number(d.id));            // A: ID
  sh.getRange(fila, 2).setValue(d.nombre || '');           // B: Nombre
  sh.getRange(fila, 3).setValue(d.variedad || '');         // C: Variedad
  sh.getRange(fila, 4).setValue(d.especie || '');          // D: Especie
  if (d.fechaP) sh.getRange(fila, 5).setValue(new Date(d.fechaP+'T12:00:00')).setNumberFormat('DD/MM/YYYY'); // E
  sh.getRange(fila, 6).setValue(d.ubicacion || '');         // F: Ubicación
  sh.getRange(fila, 7).setValue(d.exposicion || '');        // G: Exposición solar
  sh.getRange(fila, 8).setValue(d.suelo || '');             // H: Tipo suelo
  sh.getRange(fila, 20).setValue(d.notas || '');            // T: Notas
  // Columnas I-S (fertilización, poda, plagas, riego, días) no se tocan:
  // las mantiene actualizarFichaPlantas() con el trigger diario de las 07:00.
}

// ── Evento de planta: se agrega siempre como fila nueva al final ───
function guardarEventoPlantaSheet(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG_PLANTAS.sheetRegistro);
  if (!sh || !d.planta || !d.fecha) return;

  var nombre = '';
  var plantasSh = ss.getSheetByName(CFG_PLANTAS.sheetPlantas);
  if (plantasSh) {
    var pd = plantasSh.getDataRange().getValues();
    for (var i = 1; i < pd.length; i++) {
      if (String(pd[i][0]).trim() === String(d.planta).trim()) { nombre = pd[i][1]; break; }
    }
  }

  var fila = ultimaFilaConDatos_(sh, 1) + 1;                // ancla en col. A (ID Planta), no en getLastRow()
  sh.getRange(fila, 1).setValue(Number(d.planta));          // A: ID Planta
  sh.getRange(fila, 2).setValue(nombre);                    // B: Planta
  sh.getRange(fila, 3).setValue(new Date(d.fecha+'T12:00:00')).setNumberFormat('DD/MM/YYYY'); // C: Fecha
  sh.getRange(fila, 4).setValue(d.tipo || '');               // D: Tipo evento
  sh.getRange(fila, 5).setValue(d.detalle || '');            // E: Detalle
  sh.getRange(fila, 6).setValue(d.producto || '');           // F: Producto / Dosis
  sh.getRange(fila, 10).setValue(d.resultado || '');         // J: Resultado / Observación
  // G-I (T° día, lluvia, humedad) se dejan vacías — no son críticas y
  // actualizarFichaPlantas() no las requiere para funcionar.
}

// ====================================================================
//  SHEET → FIRESTORE: empuja la ficha de Plantas ya calculada
//  (Días sin agua, próximas fechas, estado) hacia la app.
//
//  CÓMO INSTALARLO:
//  1. Apps Script → pegar este bloque al final del script (después de
//     todo lo que ya agregaste, incluido el doPost del otro archivo).
//  2. Ejecutar UNA VEZ ahora mismo la función sincronizarPlantasAFirestore
//     (▶ Ejecutar, elegir esa función) para corregir ya los datos
//     desactualizados que ves en la app (Mandarina/Limonero, etc.).
//     La primera vez te va a pedir autorizar permisos — es normal.
//  3. Ejecutar UNA VEZ la función agregarTriggerSincroPlantas() para que
//     esto se repita solo, todos los días después de que corra
//     actualizarFichaPlantas (07:00). No hace falta tocar los triggers
//     que ya tenías.
// ====================================================================

var FIRESTORE_PROJECT_ID = 'compostaje-casero';

function sincronizarPlantasAFirestore() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG_PLANTAS.sheetPlantas);
  if (!sh || sh.getLastRow() < 2) { Logger.log('[WARN] Sin datos en Plantas'); return; }

  var datos = sh.getDataRange().getValues();
  var enviados = 0;
  for (var i = 1; i < datos.length; i++) {
    var row = datos[i];
    if (!row[0]) continue;
    var id = row[0];

    var campos = {
      id:            { integerValue: Number(id) },
      nombre:        { stringValue: String(row[1]  || '') },
      variedad:      { stringValue: String(row[2]  || '') },
      especie:       { stringValue: String(row[3]  || '') },
      fechaP:        { stringValue: fechaISO_(row[4]) },
      ubicacion:     { stringValue: String(row[5]  || '') },
      exposicion:    { stringValue: String(row[6]  || '') },
      suelo:         { stringValue: String(row[7]  || '') },
      ultimaFert:    { stringValue: fechaISO_(row[10]) },
      proximaFert:   { stringValue: fechaISO_(row[11]) },
      ultimaPoda:    { stringValue: fechaISO_(row[12]) },
      proximaPoda:   { stringValue: fechaISO_(row[13]) },
      ultimaPlagas:  { stringValue: fechaISO_(row[14]) },
      proximaPlagas: { stringValue: fechaISO_(row[15]) },
      ultimoRiego:   { stringValue: fechaISO_(row[16]) },
      diasSinRiego:  { stringValue: String(row[17] || '') },
      estado:        { stringValue: String(row[18] || '') },
      notas:         { stringValue: String(row[19] || '') },
    };

    var mask = Object.keys(campos).map(function(k){ return 'updateMask.fieldPaths=' + k; }).join('&');
    var url = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT_ID +
      '/databases/(default)/documents/plantas/' + id + '?' + mask;

    var resp = UrlFetchApp.fetch(url, {
      method: 'patch',
      contentType: 'application/json',
      payload: JSON.stringify({ fields: campos }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) {
      Logger.log('[ERROR] Planta ' + id + ': ' + resp.getResponseCode() + ' ' + resp.getContentText());
    } else {
      enviados++;
    }
  }
  Logger.log('[OK] Sincronizadas ' + enviados + ' plantas a Firestore');
}

function fechaISO_(v) {
  if (!v) return '';
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, CFG.tz, 'yyyy-MM-dd');
}

// Agrega el trigger diario SIN tocar los que ya existen (a diferencia de
// configurarTriggerDiario(), que borra y recrea todo).
function agregarTriggerSincroPlantas() {
  var yaExiste = ScriptApp.getProjectTriggers().some(function(t){
    return t.getHandlerFunction() === 'sincronizarPlantasAFirestore';
  });
  if (yaExiste) { Logger.log('[SKIP] El trigger ya existía'); return; }
  ScriptApp.newTrigger('sincronizarPlantasAFirestore')
    .timeBased().atHour(7).nearMinute(30).everyDays(1)
    .inTimezone(CFG.tz).create();
  Logger.log('[OK] Trigger creado: sincronizarPlantasAFirestore ~07:30 (después de actualizarFichaPlantas)');
}


var CFG_ESPECIES = { sheet: 'Especies' };

function inicializarHojaEspecies() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG_ESPECIES.sheet);
  if (sh) { Logger.log('[INFO] La hoja Especies ya existe — no se tocó'); return; }
  sh = ss.insertSheet(CFG_ESPECIES.sheet);

  var enc = ['Especie', 'Tipo', 'Riego verano (días)', 'Riego invierno (días)',
    'Fertilizar cada (días)', 'Mes inicio temporada', 'Mes fin temporada',
    'Temp mín tolerada (°C)', 'Luz', 'Notas'];
  sh.appendRow(enc);
  sh.getRange(1, 1, 1, enc.length)
    .setBackground('#1B5E20').setFontColor('#fff').setFontWeight('bold')
    .setFontSize(9).setFontFamily('Arial').setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setWrap(true);
  sh.setRowHeight(1, 40);
  sh.setFrozenRows(1);
  [140, 90, 110, 110, 120, 110, 100, 110, 160, 260].forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  });

  // Meses: 9=sept ... 4=abril (temporada de crecimiento típica en el hemisferio sur)
  var filas = [
    ['Monstera', 'Interior', 8, 12, 30, 9, 4, 12, 'Indirecta brillante', 'Dejar secar 2-3cm de sustrato entre riegos'],
    ['Palo de agua', 'Interior', 10, 14, 60, 9, 4, 15, 'Media / indirecta', 'Asumido Dracaena fragrans — sensible al exceso de riego, evitar encharcar'],
    ['Helecho', 'Interior', 3, 5, 30, 9, 4, 15, 'Sombra / indirecta media', 'Mantener sustrato siempre húmedo, agradece humedad ambiente'],
    ['Pilea', 'Interior', 7, 10, 30, 9, 4, 10, 'Indirecta brillante', 'Rotar la maceta cada tanto para crecimiento parejo'],
    ['Potus', 'Interior', 8, 12, 45, 9, 4, 10, 'Indirecta baja a media', 'Muy resistente, tolera olvidos de riego'],
  ];
  filas.forEach(function (f) {
    sh.appendRow(f);
    var fila = sh.getLastRow();
    sh.getRange(fila, 1, 1, f.length).setFontFamily('Arial').setFontSize(9)
      .setVerticalAlignment('middle').setHorizontalAlignment('center');
    sh.getRange(fila, 1).setFontWeight('bold').setHorizontalAlignment('left');
    sh.getRange(fila, 10).setHorizontalAlignment('left');
  });
  Logger.log('[OK] Hoja Especies creada con ' + filas.length + ' especies');
}

function perfilEspecie(especie) {
  if (!especie) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG_ESPECIES.sheet);
  if (!sh || sh.getLastRow() < 2) return null;
  var datos = sh.getDataRange().getValues();
  var buscado = String(especie).toLowerCase().trim();
  if (!buscado) return null;
  for (var i = 1; i < datos.length; i++) {
    var nombre = String(datos[i][0] || '').toLowerCase().trim();
    if (!nombre) continue;
    if (buscado.indexOf(nombre) >= 0 || nombre.indexOf(buscado) >= 0) {
      return {
        especie: datos[i][0], tipo: datos[i][1],
        riegoVerano: Number(datos[i][2]), riegoInvierno: Number(datos[i][3]),
        diasFert: Number(datos[i][4]), fertMesIni: Number(datos[i][5]), fertMesFin: Number(datos[i][6]),
        tempMin: datos[i][7] !== '' ? Number(datos[i][7]) : null,
        luz: datos[i][8], notas: datos[i][9],
        productoFert: datos[i][10] || '', dosisFert: datos[i][11] || '',
        podaDias: datos[i][12] !== '' && datos[i][12] != null ? Number(datos[i][12]) : null,
      };
    }
  }
  return null;
}

function mesEnTemporada_(mes, inicio, fin) {
  if (!inicio || !fin) return true;
  if (inicio <= fin) return mes >= inicio && mes <= fin;
  return mes >= inicio || mes <= fin; // rango que cruza fin de año (ej: 9 a 4)
}

// Devuelve la fecha del evento más reciente de un tipo (Fertiliz/Poda/plagas)
// para una planta, buscando en Registro Plantas.
function obtenerUltimoEventoPlanta_(idPlanta, tipoTexto) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shR = ss.getSheetByName(CFG_PLANTAS.sheetRegistro);
  if (!shR) return null;
  var datos = shR.getDataRange().getValues();
  var ultima = null;
  for (var i = 1; i < datos.length; i++) {
    var r = datos[i];
    if (!r[0] || !r[2]) continue;
    if (String(r[0]).trim() !== String(idPlanta).trim()) continue;
    if (String(r[3] || '').indexOf(tipoTexto) < 0) continue;
    var f = r[2] instanceof Date ? r[2] : new Date(r[2]);
    if (isNaN(f.getTime())) continue;
    if (!ultima || f > ultima) ultima = f;
  }
  return ultima;
}

// Si hay un evento más nuevo que lo que dice la ficha, actualiza
// "Última X" y recalcula "Próxima X" = fecha del evento + intervalo.
function actualizarProximoEvento_(shP, fila, idPlanta, tipoTexto, colUltima, colProxima, intervaloDias) {
  var fechaEvento = obtenerUltimoEventoPlanta_(idPlanta, tipoTexto);
  var actual = shP.getRange(fila, colUltima).getValue();
  var actualDate = actual ? new Date(actual) : null;

  // FIX: antes esta bandera no existía y "Próxima X" solo se calculaba
  // si la celda estaba vacía — una vez seteada la primera vez, un evento
  // nuevo actualizaba "Última X" pero "Próxima X" quedaba clavada para
  // siempre en el pasado (el trigger diario la seguía viendo vencida y
  // recreaba el recordatorio del calendario cada día sin parar).
  var cambioUltima = false;
  if (fechaEvento && (!actualDate || isNaN(actualDate.getTime()) || fechaEvento.getTime() > actualDate.getTime())) {
    shP.getRange(fila, colUltima).setValue(fechaEvento).setNumberFormat('DD/MM/YYYY');
    actualDate = fechaEvento;
    cambioUltima = true;
  }

  var proxima = shP.getRange(fila, colProxima).getValue();
  if ((cambioUltima || !proxima) && actualDate && !isNaN(actualDate.getTime())) {
    var nuevaProxima = new Date(actualDate);
    nuevaProxima.setDate(nuevaProxima.getDate() + intervaloDias);
    shP.getRange(fila, colProxima).setValue(nuevaProxima).setNumberFormat('DD/MM/YYYY');
  }
}

// ====================================================================
//  REEMPLAZA a la función que ya tenías con el mismo nombre.
// ====================================================================
function calcularUltimaAguaEfectiva(ultimoRiego, especie) {
  var resultado = { fecha: ultimoRiego, tipo: 'riego', mm: null };

  var perfil = perfilEspecie(especie);
  if (perfil && perfil.tipo === 'Interior') return resultado; // no cuenta la lluvia puertas adentro

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shClima = ss.getSheetByName(CFG.sheetClima);
  if (!shClima) return resultado;

  var climaDatos = shClima.getDataRange().getValues().slice(2);
  var ultimaLluvia = null;
  var mmUltimaLluvia = 0;

  for (var i = climaDatos.length - 1; i >= 0; i--) {
    var row = climaDatos[i];
    if (!row[0]) continue;
    var mm = Number(row[8]);
    if (mm >= UMBRAL_LLUVIA_MM) {
      ultimaLluvia = new Date(row[0]);
      mmUltimaLluvia = mm;
      break;
    }
  }

  if (ultimaLluvia) {
    var fechaRiego = ultimoRiego ? new Date(ultimoRiego) : null;
    if (!fechaRiego || ultimaLluvia > fechaRiego) {
      resultado = { fecha: ultimaLluvia, tipo: 'lluvia', mm: mmUltimaLluvia };
    }
  }
  return resultado;
}

// ====================================================================
//  REEMPLAZA a la función que ya tenías con el mismo nombre.
// ====================================================================
function actualizarFichaPlantas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shP = ss.getSheetByName(CFG_PLANTAS.sheetPlantas);
  var shR = ss.getSheetByName(CFG_PLANTAS.sheetRegistro);

  if (!shP) {
    Logger.log('[WARN] No existe hoja Plantas — ejecutar inicializarHojaPlantas primero');
    return;
  }

  // ── Paso 1: sincronizar plantas nuevas desde Registro Plantas (igual que antes) ──
  if (shR && shR.getLastRow() > 1) {
    var regDatos = shR.getDataRange().getValues().slice(1);
    var idsExistentes = {};
    if (shP.getLastRow() > 1) {
      var plantasDatos = shP.getDataRange().getValues().slice(1);
      plantasDatos.forEach(function (p) { if (p[0]) idsExistentes[String(p[0])] = true; });
    }

    regDatos.forEach(function (r) {
      if (!r[0] || !r[1]) return;
      var idPlanta = String(r[0]);
      var nombre = r[1];
      var tipoEvento = String(r[3] || '');
      if (tipoEvento.indexOf('Plantación') < 0 && tipoEvento.indexOf('Plantacion') < 0) return;
      if (idsExistentes[idPlanta]) return;

      var fechaPlantacion = r[2] ? new Date(r[2]) : new Date();
      var detalle = String(r[4] || '');
      var producto = String(r[5] || '');

      var perfil = perfilEspecie(nombre) || perfilEspecie(detalle);
      var diasFert = perfil ? perfil.diasFert : CFG_PLANTAS.diasFertilizante;
      var diasPodaEsp = perfil && perfil.podaDias ? perfil.podaDias : CFG_PLANTAS.diasPoda;

      var proxFert = new Date(fechaPlantacion); proxFert.setDate(proxFert.getDate() + diasFert);
      var proxPoda = new Date(fechaPlantacion); proxPoda.setDate(proxPoda.getDate() + diasPodaEsp);
      var proxPlagas = new Date(fechaPlantacion); proxPlagas.setDate(proxPlagas.getDate() + CFG_PLANTAS.diasRevisionPlagas);

      var fertGramos = '', fertFormula = '';
      var matchFert = producto.match(/(\d+)\s*g/i);
      if (matchFert) fertGramos = matchFert[1];
      var matchForm = producto.match(/(\d+-\d+-\d+)/);
      if (matchForm) fertFormula = matchForm[1];

      var exposicion = perfil ? perfil.luz :
        (detalle.indexOf('sol pleno') >= 0 ? 'Sol pleno' :
          detalle.indexOf('media sombra') >= 0 ? 'Media sombra' : 'Sol pleno');
      var tipoSuelo = detalle.indexOf('tierra directa') >= 0 ? 'Tierra directa' :
        detalle.indexOf('maceta') >= 0 ? 'Maceta' : 'Tierra directa';

      var nuevaFila = [
        idPlanta, nombre, '', nombre, fechaPlantacion,
        'Huerta', exposicion, tipoSuelo,
        fertGramos, fertFormula,
        fertGramos ? fechaPlantacion : '',
        fertGramos ? proxFert : '',
        '', proxPoda,
        fechaPlantacion, proxPlagas,
        fechaPlantacion,
        '',
        'Recién plantada 🌱',
        'Plantada ' + Utilities.formatDate(fechaPlantacion, CFG.tz, 'dd/MM/yyyy') + (producto ? '. ' + producto + '.' : '')
      ];

      shP.appendRow(nuevaFila);
      var filaNum = shP.getLastRow();
      [5, 11, 12, 13, 14, 15, 16, 17].forEach(function (col) {
        var cell = shP.getRange(filaNum, col);
        if (nuevaFila[col - 1] instanceof Date) cell.setNumberFormat('DD/MM/YYYY');
      });
      shP.getRange(filaNum, 1, 1, 20)
        .setFontFamily('Arial').setFontSize(9)
        .setVerticalAlignment('middle').setHorizontalAlignment('center');
      shP.getRange(filaNum, 2).setFontWeight('bold');
      shP.getRange(filaNum, 20).setHorizontalAlignment('left');
      shP.setRowHeight(filaNum, 22);
      colorearEstadoPlanta(shP, filaNum, 'Recién plantada');

      idsExistentes[idPlanta] = true;
      Logger.log('[OK] Planta agregada a ficha: ' + nombre + ' (ID ' + idPlanta + ')');
    });
  }

  // ── Paso 2: riego (por especie, sincronizado desde eventos) + fertilización/poda/plagas al día ──
  var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  var mes = hoy.getMonth() + 1;
  var esVerano = CFG_PLANTAS.mesesVerano.indexOf(mes) >= 0;

  if (shP.getLastRow() < 2) return;
  var datos = shP.getDataRange().getValues();

  for (var i = 1; i < datos.length; i++) {
    var fila = i + 1;
    if (!datos[i][0]) continue;
    var idPlanta = datos[i][0];
    var especie = datos[i][3] || datos[i][1] || '';
    var perfil = perfilEspecie(especie);

    var ultimoRiego = datos[i][16] ? new Date(datos[i][16]) : null;
    var riegoEvento = obtenerUltimoEventoPlanta_(idPlanta, 'Riego');
    if (riegoEvento && (!ultimoRiego || riegoEvento.getTime() > ultimoRiego.getTime())) {
      ultimoRiego = riegoEvento;
      shP.getRange(fila, 17).setValue(riegoEvento).setNumberFormat('DD/MM/YYYY');
    }

    var aguaEfectiva = calcularUltimaAguaEfectiva(ultimoRiego, especie);
    if (aguaEfectiva.fecha) {
      var fechaAgua = new Date(aguaEfectiva.fecha); fechaAgua.setHours(0, 0, 0, 0);
      var diasSinAgua = Math.floor((hoy - fechaAgua) / 86400000);
      var limiteRiego = perfil
        ? (esVerano ? perfil.riegoVerano : perfil.riegoInvierno)
        : (esVerano ? CFG_PLANTAS.diasSinRiegoMax : CFG_PLANTAS.diasSinRiegoInv);

      var textoContador = diasSinAgua + ' d' +
        (aguaEfectiva.tipo === 'lluvia' ? ' (lluvia ' + aguaEfectiva.mm + 'mm)' : ' (riego)');
      var cellDias = shP.getRange(fila, 18);
      cellDias.setValue(textoContador);

      if (diasSinAgua >= limiteRiego) cellDias.setBackground('#FF6B6B').setFontColor('#fff');
      else if (diasSinAgua >= limiteRiego * 0.7) cellDias.setBackground('#FFD166').setFontColor('#333');
      else cellDias.setBackground('#D8F3DC').setFontColor('#1B5E20');
    }

    actualizarProximoEvento_(shP, fila, idPlanta, 'Fertiliz', 11, 12, perfil ? perfil.diasFert : CFG_PLANTAS.diasFertilizante);
    actualizarProximoEvento_(shP, fila, idPlanta, 'Poda', 13, 14, perfil && perfil.podaDias ? perfil.podaDias : CFG_PLANTAS.diasPoda);
    actualizarProximoEvento_(shP, fila, idPlanta, 'plagas', 15, 16, CFG_PLANTAS.diasRevisionPlagas);
  }

  Logger.log('[OK] Ficha de plantas actualizada — ' + (datos.length - 1) + ' plantas');
}

// ====================================================================
//  REEMPLAZA a la función que ya tenías con el mismo nombre.
// ====================================================================
function verificarEventosPlantas(cal, manana) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shP = ss.getSheetByName(CFG_PLANTAS.sheetPlantas);
  var shClima = ss.getSheetByName(CFG.sheetClima);
  if (!shP || shP.getLastRow() < 2) return [];

  var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  var mes = hoy.getMonth() + 1;
  var esVerano = CFG_PLANTAS.mesesVerano.indexOf(mes) >= 0;

  var tempMin = null;
  if (shClima) {
    var climaDatos = shClima.getDataRange().getValues().slice(2);
    if (climaDatos.length > 0) tempMin = Number(climaDatos[climaDatos.length - 1][3]);
  }

  var CHULETA_PLAGAS =
    'Guía rápida:\n' +
    '• Cochinillas (bultitos blancos algodonosos): algodón con alcohol isopropílico directo sobre cada una, repetir cada 4-5 días 2-3 veces.\n' +
    '• Pulgones: jabón potásico o agua con unas gotas de jabón blanco, rociar toda la planta incl. envés.\n' +
    '• Ácaros/araña roja (punteado amarillento, telarañas finas): subir humedad ambiente + aceite de neem o acaricida específico.\n' +
    '• Mosca blanca: trampas amarillas pegajosas + jabón potásico.\n' +
    '• Hongos/manchas/oidio: retirar hojas afectadas, fungicida cúprico o bicarbonato de sodio diluido en agua con jabón.\n' +
    'Aplicar siempre a la tardecita, nunca con sol directo, y alejada de mascotas/niños hasta que seque.';

  var datos = shP.getDataRange().getValues().slice(1);
  var eventos = [];

  datos.forEach(function (p) {
    if (!p[0] || !p[1]) return;
    var nombre = p[1];
    var especie = p[3] || nombre;
    var perfil = perfilEspecie(especie);
    var esInterior = perfil && perfil.tipo === 'Interior';

    // ── HELADA / FRÍO ──────────────────────────────────────────────
    if (tempMin !== null) {
      if (esInterior && perfil.tempMin !== null) {
        if (tempMin <= perfil.tempMin + 2) {
          eventos.push({
            titulo: '🥶 FRÍO: alejar ' + nombre + ' de la ventana',
            desc: 'Temperatura mínima pronosticada: ' + tempMin + '°C.\n' +
              nombre + ' (' + especie + ') tolera hasta unos ' + perfil.tempMin + '°C.\n' +
              'Acción: alejarla de ventanas/corrientes de aire esta noche.',
            color: CalendarApp.EventColor.CYAN
          });
        }
      } else if (!esInterior && tempMin <= CFG_PLANTAS.tempHeladaUmbral) {
        var severa = tempMin <= CFG_PLANTAS.tempHeladaSevera;
        eventos.push({
          titulo: (severa ? '🧊 HELADA SEVERA' : '❄️ HELADA') + ': proteger ' + nombre + ' mañana',
          desc: 'Temperatura mínima registrada: ' + tempMin + '°C\n' +
            (severa
              ? 'RIESGO ALTO de daño en hojas y brotes.\nAcción: cubrir con tela antihelada, regar el suelo esta tarde (retiene calor).'
              : 'Riesgo moderado para cítrico joven.\nAcción: cubrir la planta esta noche con tela antihelada.'),
          color: severa ? CalendarApp.EventColor.RED : CalendarApp.EventColor.CYAN
        });
      }
    }

    // ── RIEGO ──────────────────────────────────────────────────────
    var ultimoRiego = p[16] ? new Date(p[16]) : null;
    var aguaEfectiva = calcularUltimaAguaEfectiva(ultimoRiego, especie);

    if (aguaEfectiva.fecha) {
      var fechaAgua = new Date(aguaEfectiva.fecha); fechaAgua.setHours(0, 0, 0, 0);
      var diasSinAgua = Math.floor((hoy - fechaAgua) / 86400000);
      var limiteRiego = perfil
        ? (esVerano ? perfil.riegoVerano : perfil.riegoInvierno)
        : (esVerano ? CFG_PLANTAS.diasSinRiegoMax : CFG_PLANTAS.diasSinRiegoInv);

      if (diasSinAgua >= limiteRiego) {
        var contextoAgua = aguaEfectiva.tipo === 'lluvia'
          ? 'Última agua efectiva: lluvia de ' + aguaEfectiva.mm + 'mm el ' +
            Utilities.formatDate(aguaEfectiva.fecha, CFG.tz, 'dd/MM/yyyy') +
            ' (umbral: ' + UMBRAL_LLUVIA_MM + 'mm)'
          : 'Último riego: ' + Utilities.formatDate(aguaEfectiva.fecha, CFG.tz, 'dd/MM/yyyy');

        eventos.push({
          titulo: '💧 RIEGO: ' + nombre + ' (' + diasSinAgua + ' días sin agua efectiva)',
          desc: nombre + ' lleva ' + diasSinAgua + ' días sin agua suficiente.\n' +
            contextoAgua + '\n' +
            'Límite para esta época: ' + limiteRiego + ' días (' + (esVerano ? 'verano' : 'invierno') + ').\n' +
            (esInterior ? 'Regar hasta que drene un poco por debajo de la maceta.' :
              'Cantidad sugerida: 10-15 litros por planta.\nAcción: regar mañana a la mañana temprano o al atardecer.'),
          color: CalendarApp.EventColor.BLUE
        });
      } else if (diasSinAgua >= limiteRiego * 0.7) {
        var diasRestantes = limiteRiego - diasSinAgua;
        eventos.push({
          titulo: '💧 RIEGO próximo: ' + nombre + ' (en ~' + diasRestantes + ' día(s))',
          desc: nombre + ' lleva ' + diasSinAgua + ' días sin agua suficiente.\n' +
            'Conviene regar en los próximos ' + diasRestantes + ' días.',
          color: CalendarApp.EventColor.TEAL
        });
      } else if (aguaEfectiva.tipo === 'lluvia') {
        Logger.log('[INFO] ' + nombre + ': sin alerta de riego — lluvia reciente de ' +
          aguaEfectiva.mm + 'mm hace ' + diasSinAgua + ' días');
      }
    }

    // ── FERTILIZACIÓN ──────────────────────────────────────────────
    var proxFert = p[11] ? new Date(p[11]) : null;
    var fueraDeTemporada = perfil && !mesEnTemporada_(mes, perfil.fertMesIni, perfil.fertMesFin);
    if (proxFert && !fueraDeTemporada) {
      proxFert.setHours(0, 0, 0, 0);
      var diasParaFert = Math.floor((proxFert - hoy) / 86400000);
      var sugerenciaFert = (perfil && perfil.productoFert)
        ? '\nProducto sugerido: ' + perfil.productoFert + '.\nDosis: ' + (perfil.dosisFert || 'según el envase') + '.'
        : '';
      if (diasParaFert <= 0) {
        eventos.push({
          titulo: '🌿 FERTILIZAR: ' + nombre + (diasParaFert < 0 ? ' (' + Math.abs(diasParaFert) + ' días atrasado)' : ''),
          desc: nombre + ' necesita fertilización.\n' +
            (perfil
              ? 'Según su perfil (' + especie + '): cada ' + perfil.diasFert + ' días, solo en temporada de crecimiento.'
              : 'Dosis para cítrico joven: 100-150g de 15-15-15 alrededor del tronco (a 20cm), incorporar con agua.\nFrecuencia: cada ' + CFG_PLANTAS.diasFertilizante + ' días.') +
            sugerenciaFert + '\n' +
            'Acción: fertilizar y registrar en \'Registro Plantas\'.',
          color: CalendarApp.EventColor.GREEN
        });
      } else if (diasParaFert <= 7) {
        eventos.push({
          titulo: '🌿 FERTILIZAR pronto: ' + nombre + ' (en ' + diasParaFert + ' días)',
          desc: 'La próxima fertilización es el ' + Utilities.formatDate(proxFert, CFG.tz, 'dd/MM/yyyy') + '.' + sugerenciaFert,
          color: CalendarApp.EventColor.TEAL
        });
      }
    }

    // ── REVISIÓN DE PLAGAS ─────────────────────────────────────────
    var proxPlagas = p[15] ? new Date(p[15]) : null;
    if (proxPlagas) {
      proxPlagas.setHours(0, 0, 0, 0);
      var diasParaPlagas = Math.floor((proxPlagas - hoy) / 86400000);
      if (diasParaPlagas <= 0) {
        eventos.push({
          titulo: '🐛 REVISIÓN PLAGAS: ' + nombre,
          desc: nombre + ' — revisión mensual de plagas y enfermedades.\n' +
            'Qué revisar: hojas (manchas, decoloración), envés (cochinillas, pulgones, ácaros), tallos.\n\n' +
            CHULETA_PLAGAS + '\n\n' +
            'Acción: registrar hallazgos en \'Registro Plantas\'.',
          color: CalendarApp.EventColor.YELLOW
        });
      }
    }

    // ── PODA ────────────────────────────────────────────────────────
    var proxPoda = p[13] ? new Date(p[13]) : null;
    if (proxPoda) {
      proxPoda.setHours(0, 0, 0, 0);
      var diasParaPoda = Math.floor((proxPoda - hoy) / 86400000);
      if (diasParaPoda <= 30 && diasParaPoda >= 0) {
        eventos.push({
          titulo: '✂️ PODA/LIMPIEZA se acerca: ' + nombre + ' (en ' + diasParaPoda + ' días)',
          desc: (esInterior
            ? 'Revisá y quitá hojas secas o amarillas de ' + nombre + '.'
            : 'Poda anual de formación de ' + nombre + '.\nMejor época para cítricos: ago-sep (fin de invierno).\nQué podar: ramas secas, cruzadas, las que crecen hacia adentro.\nNo más del 20-30% de la copa.'),
          color: CalendarApp.EventColor.ORANGE
        });
      }
    }
  });

  return eventos;
}

function cargarPlantasInterior() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shP = ss.getSheetByName(CFG_PLANTAS.sheetPlantas);
  var shR = ss.getSheetByName(CFG_PLANTAS.sheetRegistro);
  if (!shP || !shR) { Logger.log('[ERROR] Faltan hojas Plantas/Registro Plantas'); return; }

  var datosExistentes = shP.getDataRange().getValues();
  var maxId = 0;
  for (var i = 1; i < datosExistentes.length; i++) {
    var n = Number(datosExistentes[i][0]);
    if (!isNaN(n) && n > maxId) maxId = n;
  }

  var fechaRiego = new Date('2026-09-01T12:00:00'); // riego general que hiciste ayer
  var fechaHoy = new Date();
  var especies = ['Monstera', 'Palo de agua', 'Helecho nido de ave', 'Helecho serrucho', 'Pilea', 'Planta cebra', 'Pata de elefante'];

  especies.forEach(function (nombreEspecie, idx) {
    var id = maxId + 1 + idx;
    var perfil = perfilEspecie(nombreEspecie);

    var fila = [
      id, nombreEspecie, '', nombreEspecie, fechaHoy,
      'Interior', perfil ? perfil.luz : '', '',
      '', '',
      '', '',
      '', '',
      '', '',
      fechaRiego,
      '',
      'Recién agregada 🌱',
      'Cargada el ' + Utilities.formatDate(fechaHoy, CFG.tz, 'dd/MM/yyyy') + '. Ajustá ubicación y fecha real de adquisición desde la app.'
    ];
    shP.appendRow(fila);
    var filaNum = shP.getLastRow();
    [5, 17].forEach(function (col) { shP.getRange(filaNum, col).setNumberFormat('DD/MM/YYYY'); });
    shP.getRange(filaNum, 1, 1, 20)
      .setFontFamily('Arial').setFontSize(9)
      .setVerticalAlignment('middle').setHorizontalAlignment('center');
    shP.getRange(filaNum, 2).setFontWeight('bold');
    shP.getRange(filaNum, 20).setHorizontalAlignment('left');
    shP.setRowHeight(filaNum, 22);
    colorearEstadoPlanta(shP, filaNum, 'Recién agregada');

    var filaR = [id, nombreEspecie, fechaRiego, '💧 Riego', 'Riego general de todas las plantas de interior', '', '', '', '', ''];
    shR.appendRow(filaR);
    var filaRNum = shR.getLastRow();
    shR.getRange(filaRNum, 3).setNumberFormat('DD/MM/YYYY');
    shR.getRange(filaRNum, 1, 1, 10)
      .setFontFamily('Arial').setFontSize(9)
      .setVerticalAlignment('middle').setHorizontalAlignment('center');
    shR.getRange(filaRNum, 5).setHorizontalAlignment('left');
    shR.getRange(filaRNum, 10).setHorizontalAlignment('left');
    shR.setRowHeight(filaRNum, 20);

    Logger.log('[OK] Planta agregada: ' + nombreEspecie + ' (ID ' + id + ')');
  });

  Logger.log('[OK] ' + especies.length + ' plantas de interior cargadas. Ahora corré actualizarFichaPlantas() y sincronizarPlantasAFirestore().');
}

// ====================================================================
//  BACKFILL: trae a Firestore lo que está en la Sheet pero nunca se
//  sincronizó — específicamente las revolcadas viejas (desde el
//  05/05/2026) que cargaste directo en "Registro Revolcadas" antes
//  de que existiera la app, y por las dudas también "Sistemas".
//
//  POR QUÉ PASÓ: hasta ahora solo existía sincronizarPlantasAFirestore()
//  (Sheet → Firestore para Plantas). Para Sistemas y Revolcadas nunca
//  hubo un sync en esa dirección — la app solo veía lo que vos mismo
//  cargabas DESDE la app. Todo lo que ya estaba en la Sheet de antes
//  (o lo que cargues ahí directo en el futuro) se quedaba afuera.
//
//  CÓMO INSTALARLO:
//  1. Pegar todo este bloque al final del script.
//  2. Ejecutar sincronizarSistemasAFirestore() una vez.
//  3. Ejecutar sincronizarRevolcadasAFirestore() una vez — esta es la
//     que trae las revolcadas viejas. Es segura para correr más de
//     una vez: antes de crear algo, revisa qué ya existe en Firestore
//     (por sistema+fecha) y no duplica nada.
//  4. Si querés que esto se mantenga sincronizado solo de acá en
//     adelante (por si seguís cargando cosas directo en la Sheet),
//     ejecutar agregarTriggersSincroTodo() una vez — agrega los
//     triggers diarios que falten, sin duplicar los que ya tenías.
// ====================================================================

function sincronizarSistemasAFirestore() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG.sheetSistemas);
  if (!sh || sh.getLastRow() < 3) { Logger.log('[WARN] Sin datos en Sistemas'); return; }

  var datos = sh.getDataRange().getValues().slice(2);
  var enviados = 0;
  datos.forEach(function (row) {
    var id = row[0];
    if (!id || isNaN(Number(id))) return;

    var campos = {
      id: { integerValue: Number(id) },
      inicioC: { stringValue: fechaISO_(row[1]) },
      finC: { stringValue: fechaISO_(row[2]) },
      inicioE: { stringValue: fechaISO_(row[5]) },
      notas: { stringValue: String(row[9] || '') },
    };
    var mask = Object.keys(campos).map(function (k) { return 'updateMask.fieldPaths=' + k; }).join('&');
    var url = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT_ID +
      '/databases/(default)/documents/sistemas/' + id + '?' + mask;
    var resp = UrlFetchApp.fetch(url, {
      method: 'patch', contentType: 'application/json',
      payload: JSON.stringify({ fields: campos }), muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) Logger.log('[ERROR] Sistema ' + id + ': ' + resp.getResponseCode() + ' ' + resp.getContentText());
    else enviados++;
  });
  Logger.log('[OK] Sincronizados ' + enviados + ' sistemas a Firestore');
}

function sincronizarRevolcadasAFirestore() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG.sheetRevolc);
  if (!sh || sh.getLastRow() < 3) { Logger.log('[WARN] Sin datos en Registro Revolcadas'); return; }

  // 1) Traer qué revolcadas (sistema+fecha) ya existen en Firestore,
  //    para no duplicar las que la app ya sincronizó por su cuenta.
  var existentes = {};
  var pageToken = null;
  do {
    var listUrl = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT_ID +
      '/databases/(default)/documents/revolcadas?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '');
    var listResp = UrlFetchApp.fetch(listUrl, { muteHttpExceptions: true });
    var listJson = JSON.parse(listResp.getContentText());
    (listJson.documents || []).forEach(function (doc) {
      var f = doc.fields || {};
      var sis = f.sistema && (f.sistema.integerValue != null ? f.sistema.integerValue : f.sistema.doubleValue);
      var fec = f.fecha && f.fecha.stringValue;
      if (sis != null && fec) existentes[Number(sis) + '|' + fec] = true;
    });
    pageToken = listJson.nextPageToken || null;
  } while (pageToken);

  // 2) Recorrer la Sheet y crear en Firestore solo lo que falta.
  var datos = sh.getDataRange().getValues().slice(2);
  var creados = 0, saltados = 0;
  datos.forEach(function (row) {
    var sistema = row[0];
    if (!sistema || isNaN(Number(sistema))) return;
    var fechaRaw = row[1];
    if (!fechaRaw) return;
    var fecha = fechaRaw instanceof Date ? Utilities.formatDate(fechaRaw, CFG.tz, 'yyyy-MM-dd') : String(fechaRaw).substring(0, 10);
    var key = Number(sistema) + '|' + fecha;
    if (existentes[key]) { saltados++; return; }

    var campos = {
      sistema: { integerValue: Number(sistema) },
      fecha: { stringValue: fecha },
      obs: { stringValue: String(row[4] || '') },
    };
    var id = 'sh-' + sistema + '-' + fecha;
    var url = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT_ID +
      '/databases/(default)/documents/revolcadas/' + id;
    var resp = UrlFetchApp.fetch(url, {
      method: 'patch', contentType: 'application/json',
      payload: JSON.stringify({ fields: campos }), muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) Logger.log('[ERROR] Revolcada ' + key + ': ' + resp.getResponseCode() + ' ' + resp.getContentText());
    else { creados++; existentes[key] = true; }
  });
  Logger.log('[OK] Revolcadas nuevas cargadas a Firestore: ' + creados + ' (ya existían: ' + saltados + ')');
}

function sincronizarClimaAFirestore() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG.sheetClima);
  if (!sh || sh.getLastRow() < 3) { Logger.log('[WARN] Sin datos en Clima'); return; }

  var datos = sh.getDataRange().getValues().slice(2);
  var enviados = 0;
  datos.forEach(function (row) {
    if (!row[0]) return;
    var fecha = row[0] instanceof Date ? Utilities.formatDate(row[0], CFG.tz, 'yyyy-MM-dd') : String(row[0]).substring(0, 10);
    if (!fecha) return;

    var humMax = row[4], humMin = row[5];
    var humProm = row[6] !== '' && row[6] != null ? row[6]
      : (humMax !== '' && humMin !== '' ? Math.round((Number(humMax) + Number(humMin)) / 2) : '');

    var campos = {
      fecha: { stringValue: fecha },
      temp: numVal_(row[1]),
      tmax: numVal_(row[2]),
      tmin: numVal_(row[3]),
      humMax: numVal_(humMax),
      humMin: numVal_(humMin),
      hum: numVal_(humProm),
      lluvia: { stringValue: row[7] === '✅ Sí' ? 'si' : 'no' },
      mm: numVal_(row[8]),
      hsLluvia: numVal_(row[9]),
      viento: numVal_(row[10]),
      rafaga: numVal_(row[11]),
      dir: { stringValue: String(row[12] || '') },
      evapo: numVal_(row[13]),
      sol: numVal_(row[15]),
      notas: { stringValue: String(row[16] || '') },
    };
    var mask = Object.keys(campos).map(function (k) { return 'updateMask.fieldPaths=' + k; }).join('&');
    var id = 'c-' + fecha;
    var url = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT_ID +
      '/databases/(default)/documents/clima/' + id + '?' + mask;
    var resp = UrlFetchApp.fetch(url, {
      method: 'patch', contentType: 'application/json',
      payload: JSON.stringify({ fields: campos }), muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) Logger.log('[ERROR] Clima ' + fecha + ': ' + resp.getResponseCode() + ' ' + resp.getContentText());
    else enviados++;
  });
  Logger.log('[OK] Sincronizados ' + enviados + ' días de clima a Firestore');
}

function numVal_(v) {
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return { nullValue: null };
  return { doubleValue: Number(v) };
}

// ── REEMPLAZA a agregarTriggersSincroTodo() del archivo anterior ──────
// (agrega el trigger de clima; no toca ni duplica los que ya existían)
function agregarTriggersSincroTodo() {
  var yaExisten = {};
  ScriptApp.getProjectTriggers().forEach(function (t) { yaExisten[t.getHandlerFunction()] = true; });

  [
    { fn: 'sincronizarPlantasAFirestore', min: 30 },
    { fn: 'sincronizarSistemasAFirestore', min: 35 },
    { fn: 'sincronizarRevolcadasAFirestore', min: 40 },
    { fn: 'sincronizarClimaAFirestore', min: 45 },
  ].forEach(function (t) {
    if (yaExisten[t.fn]) { Logger.log('[SKIP] Ya existía trigger para ' + t.fn); return; }
    ScriptApp.newTrigger(t.fn).timeBased().atHour(7).nearMinute(t.min).everyDays(1).inTimezone(CFG.tz).create();
    Logger.log('[OK] Trigger creado para ' + t.fn + ' (~07:' + t.min + ')');
  });
}