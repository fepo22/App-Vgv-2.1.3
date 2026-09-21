// ============================================================
// VGV SpA — Google Apps Script (Code.gs) FINAL SIMPLIFICADO
// + Módulo "Revisión previa de ruta"
// ============================================================
// Este archivo es tu Code.gs actual con el módulo de revisión ya integrado.
// Reemplaza el contenido completo de tu proyecto de Apps Script por este.

const SPREADSHEET_ID    = "1UDwJH8CtZUDufUI5rI9Gv7VeC9pvI62RXBJhw_8BK_0";
const SHEET_LOGIN_ID    = "14dsVF9EppWfPNUBwNssNh3Jvzi55VbvZam1d9dwynwM";
const SHEET_LOGIN_GID   = 0;
const HOJA_ENTREGAS     = "Entregas";
const HOJA_ENTREGAS_GID = 2040395718;
const PLANILLA_RUTAS_COMPRAS_ID = "1aYEK4dwxhkhIorgjAauH7_Ng1axc-kGrg5HjpTQtZnI";
const HOJA_RUTAS_COMPRAS_GID = 0;
const HOJA_RUTAS_COMPRAS = "Planificacion ruta compras";
const FOLDER_FOTOS_ID   = "16T8fmZkK_9Oen3i_otL3F2kCofMKkSIP";
const FOLDER_FOTOS_NAME = "VGV_Fotos_Entregas";
const BACKEND_VERSION = "vgv-rutas-compras-2026-09-21-01";

// --- Revisión previa de ruta ---
// Carpeta Drive raíz donde se guardan las fotos del tablero (subcarpetas por chofer)
const FOLDER_REVISION_ID     = "1WpoNqXDleXScuF6NJmdRucPIanzzKmen";
// Planilla y pestaña fijas para el registro semanal de revisión/odómetro
const PLANILLA_REVISION_ID   = "1aYEK4dwxhkhIorgjAauH7_Ng1axc-kGrg5HjpTQtZnI";
const HOJA_REVISION_RUTA_GID = 1864945872;
const HOJA_REVISION_RUTA     = "Registro Semanal";

// ============================================================
// ENTRYPOINT POST
// ============================================================
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const data = JSON.parse(e.parameter.data || "{}");
    const accion = data.accion;

    let respuesta = { ok: false, error: "Acción no válida" };

    if (accion === "login") {
      respuesta = login(data);
    }

    if (accion === "registrarEntrega") {
      respuesta = registrarEntrega(data);
    }

    if (accion === "registrarRevisionRuta") {
      respuesta = registrarRevisionRuta(data);
    }

    return output.setContent(JSON.stringify(respuesta));

  } catch (err) {
    logError(err, "doPost");
    return output.setContent(JSON.stringify({
      ok: false,
      error: err.message
    }));
  }
}

// ============================================================
// LOGIN
// A=usuario | B=clave | C=nombre | D=rol
// ============================================================
function login(data) {
  const usuario = (data.usuario || "").toString().trim().toLowerCase();
  const password = (data.password || "").toString().trim();
  const patente = (data.patente || "").toString().trim();

  if (!usuario || !password || !patente) {
    return {
      ok: false,
      error: "Faltan datos del login: usuario, contraseña y patente son obligatorios"
    };
  }

  try {
    const ss = SpreadsheetApp.openById(SHEET_LOGIN_ID);
    const hoja = getHojaLogin(ss);
    const rows = hoja.getDataRange().getValues();

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var user = (row[0] || "").toString().trim().toLowerCase();
      var pass = (row[1] || "").toString().trim();
      var nombre = (row[2] || "").toString().trim();
      var rol = (row[3] || "").toString().trim();

      if (user === usuario && pass === password) {
        var estadoCompra = evaluarEstadoCompraPatente(patente);
        var asignacionCompra = estadoCompra.asignacion;
        var asignacionesCompra = estadoCompra.asignaciones || [];
        var revisionRutaCompletaHoy = buscarRevisionRutaCompletaHoy(nombre, patente);

        logAccion("login", { usuario: usuario, patente: patente, estadoCompra: estadoCompra.estado });
        return {
          ok: true,
          version: BACKEND_VERSION,
          usuario: {
            nombre: nombre,
            rol: rol,
            asignacionCompra: asignacionCompra,
            asignacionesCompra: asignacionesCompra,
            estadoCompra: estadoCompra,
            revisionRutaCompletaHoy: revisionRutaCompletaHoy
          }
        };
      }
    }

    return {
      ok: false,
      version: BACKEND_VERSION,
      error: "Usuario o contraseña incorrectos"
    };

  } catch (err) {
    logError(err, "login");
    return { ok: false, error: err.message };
  }
}

// ============================================================
// REGISTRAR ENTREGA
// Guarda foto en Drive y datos en hoja Entregas
// Columna J = Módulo
// ============================================================
function registrarEntrega(data) {
  try {
    var numero = (data.numero || "").toString().trim();
    var usuario = (data.usuario || "").toString().trim();
    var rol = (data.rol || "").toString().trim();
    var fecha = (data.fecha || "").toString().trim();
    var hora = (data.hora || "").toString().trim();
    var estado = (data.estado || "").toString().trim();
    var patente = (data.patente || "").toString().trim();
    var tipoDocumento = (data.tipoDocumento || "").toString().trim();
    var moduloOrigen = normalizarModuloOrigen(data.moduloOrigen || data.modulo || "");
    var asignacionCompra = data.asignacionCompra || null;
    var foto64 = data.fotoBase64 || "";

    if (!numero) {
      return { ok: false, error: "Falta el número del documento" };
    }

    if (!foto64) {
      return { ok: false, error: "Falta la foto" };
    }

    var rootFolder = getOrCreateFolderByName(FOLDER_FOTOS_NAME);
    var dailyFolder = getOrCreateDailyFolder(rootFolder, fecha);

    var nombreArchivo = crearNombreArchivo(tipoDocumento, numero);
    var blob = base64ToBlob(foto64, "image/jpeg", nombreArchivo);
    var file = dailyFolder.createFile(blob);

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var hoja = getHojaEntregas(ss);

    asegurarEncabezadosEntregas(hoja);

    hoja.appendRow([
      fecha,          // A Fecha
      hora,           // B Hora
      usuario,        // C Usuario
      patente,        // D Patente
      tipoDocumento,  // E Tipo documento
      numero,         // F Número
      estado,         // G Estado
      rol,            // H Rol
      file.getUrl(),  // I Archivo
      moduloOrigen    // J Módulo
    ]);

    if (moduloOrigen === "Proveedores / Compras" && asignacionCompra && asignacionCompra.fila) {
      actualizarAsignacionCompra(asignacionCompra.fila, numero, file.getUrl());
    }

    logAccion("entrega", {
      numero: numero,
      usuario: usuario,
      modulo: moduloOrigen
    });

    return {
      ok: true,
      url: file.getUrl(),
      modulo: moduloOrigen
    };

  } catch (err) {
    logError(err, "registrarEntrega");
    return {
      ok: false,
      error: err.message
    };
  }
}

// ============================================================
// REGISTRAR REVISIÓN PREVIA DE RUTA
// Guarda foto del tablero en Drive (carpeta por chofer) y el
// resumen del checklist en la planilla PLANILLA_REVISION_ID
// ============================================================
function registrarRevisionRuta(data) {
  try {
    var chofer = (data.chofer || "").toString().trim();
    var rol = (data.rol || "").toString().trim();
    var patente = (data.patente || "").toString().trim();
    var fecha = (data.fecha || "").toString().trim();
    var hora = (data.hora || "").toString().trim();
    var checklist = data.checklist || [];
    var odometro = (data.odometro || data.kilometraje || "").toString().trim();
    var detalle = (data.detalle || data.observaciones || "").toString().trim();
    var foto64 = data.fotoBase64 || "";

    if (!chofer) {
      return { ok: false, error: "Falta el nombre del chofer" };
    }
    if (!patente) {
      return { ok: false, error: "Falta la patente" };
    }
    if (!foto64) {
      return { ok: false, error: "Falta la foto del tablero" };
    }
    if (!odometro) {
      return { ok: false, error: "Falta el odómetro" };
    }

    var totalItems = 0;
    var itemsOk = 0;
    checklist.forEach(function (cat) {
      (cat.items || []).forEach(function (item) {
        totalItems++;
        if (item.ok) itemsOk++;
      });
    });

    if (totalItems > 0 && itemsOk < totalItems) {
      return { ok: false, error: "El checklist no está completo (" + itemsOk + "/" + totalItems + ")" };
    }

    var carpetaRaiz = DriveApp.getFolderById(FOLDER_REVISION_ID);
    var carpetaChofer = getOrCreateSubfolder(carpetaRaiz, limpiarTextoArchivo(chofer));

    var nombreArchivo = crearNombreArchivoRevision(fecha, hora, patente);
    var blob = base64ToBlob(foto64, "image/jpeg", nombreArchivo);
    var file = carpetaChofer.createFile(blob);

    var ss = SpreadsheetApp.openById(PLANILLA_REVISION_ID);
    var hoja = getHojaRevisionRuta(ss);

    asegurarEncabezadosRevision(hoja);

    hoja.appendRow([
      fecha,            // A Fecha
      hora,             // B Hora
      chofer,           // C Chofer
      rol,              // D Rol
      patente,          // E Patente
      itemsOk,          // F Items OK
      totalItems,       // G Total items
      [
        "Odómetro: " + odometro,
        detalle
      ].filter(Boolean).join(" | ") // H Observaciones
    ]);

    logAccion("revision_ruta", {
      chofer: chofer,
      patente: patente
    });

    return {
      ok: true,
      url: file.getUrl()
    };

  } catch (err) {
    logError(err, "registrarRevisionRuta");
    return {
      ok: false,
      error: err.message
    };
  }
}

function getHojaRevisionRuta(ss) {
  var hojas = ss.getSheets();

  for (var i = 0; i < hojas.length; i++) {
    if (hojas[i].getSheetId() === HOJA_REVISION_RUTA_GID) {
      return hojas[i];
    }
  }

  var hoja = ss.getSheetByName(HOJA_REVISION_RUTA);
  return hoja ? hoja : ss.insertSheet(HOJA_REVISION_RUTA);
}

function asegurarEncabezadosRevision(hoja) {
  var encabezados = [
    "Fecha", "Hora", "Chofer", "Rol", "Patente",
    "Items OK", "Total Items", "Observaciones"
  ];

  if (hoja.getLastRow() === 0) {
    hoja.appendRow(encabezados);
    hoja.getRange(1, 1, 1, encabezados.length).setFontWeight("bold");
    return;
  }

  var rangoEncabezados = hoja.getRange(1, 1, 1, encabezados.length);
  var actuales = rangoEncabezados.getValues()[0];

  for (var i = 0; i < encabezados.length; i++) {
    if (!actuales[i]) {
      hoja.getRange(1, i + 1).setValue(encabezados[i]);
    }
  }

  hoja.getRange(1, 1, 1, encabezados.length).setFontWeight("bold");
}

function getOrCreateSubfolder(carpetaPadre, nombre) {
  var subFolders = carpetaPadre.getFoldersByName(nombre);
  return subFolders.hasNext() ? subFolders.next() : carpetaPadre.createFolder(nombre);
}

function crearNombreArchivoRevision(fecha, hora, patente) {
  var f = limpiarTextoArchivo(fecha || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"));
  var h = limpiarTextoArchivo((hora || "").replace(/:/g, "-"));
  var p = limpiarTextoArchivo(patente || "sin-patente");

  return f + "_" + h + "_" + p + ".jpg";
}

// ============================================================
// ENCABEZADOS
// ============================================================
function asegurarEncabezadosEntregas(hoja) {
  var encabezados = [
    "Fecha",
    "Hora",
    "Usuario",
    "Patente",
    "Tipo documento",
    "Número",
    "Estado",
    "Rol",
    "Archivo",
    "Módulo"
  ];

  if (hoja.getLastRow() === 0) {
    hoja.appendRow(encabezados);
    hoja.getRange(1, 1, 1, encabezados.length).setFontWeight("bold");
    return;
  }

  var rangoEncabezados = hoja.getRange(1, 1, 1, encabezados.length);
  var actuales = rangoEncabezados.getValues()[0];

  for (var i = 0; i < encabezados.length; i++) {
    if (!actuales[i]) {
      hoja.getRange(1, i + 1).setValue(encabezados[i]);
    }
  }

  hoja.getRange(1, 1, 1, encabezados.length).setFontWeight("bold");
}

function getHojaEntregas(ss) {
  var hojas = ss.getSheets();

  for (var i = 0; i < hojas.length; i++) {
    if (hojas[i].getSheetId() === HOJA_ENTREGAS_GID) {
      return hojas[i];
    }
  }

  var hoja = ss.getSheetByName(HOJA_ENTREGAS);

  if (hoja) {
    return hoja;
  }

  return ss.insertSheet(HOJA_ENTREGAS);
}

function getHojaRutasCompras(ss) {
  var hojas = ss.getSheets();
  var nombres = [HOJA_RUTAS_COMPRAS, "Planificación ruta compras", "Planificacion de Ruta", "Planificación de Ruta", "RutasCompras", "Rutas Compras", "Rutas compras", "ComprasRutas", "Compras Rutas"];

  for (var j = 0; j < nombres.length; j++) {
    var hoja = ss.getSheetByName(nombres[j]);
    if (hoja) return hoja;
  }

  for (var i = 0; i < hojas.length; i++) {
    if (hojas[i].getSheetId() === HOJA_RUTAS_COMPRAS_GID) {
      return hojas[i];
    }
  }

  return hojas[0] || null;
}

function evaluarEstadoCompraPatente(patente) {
  try {
    var ss = SpreadsheetApp.openById(PLANILLA_RUTAS_COMPRAS_ID);
    var hoja = getHojaRutasCompras(ss);
    if (!hoja || hoja.getLastRow() < 2) {
      return {
        asignacion: null,
        asignaciones: [],
        estado: "sin_planificacion",
        mensaje: "No hay filas de planificación cargadas"
      };
    }

    var rows = hoja.getDataRange().getValues();
    var columnas = resolverColumnasRutasCompras(rows[0]);
    var patenteNormalizada = normalizarClave(patente);
    var asignacionesPendientes = [];
    var coincidenciasCerradas = [];

    if (!patenteNormalizada) {
      return {
        asignacion: null,
        asignaciones: [],
        estado: "sin_patente",
        mensaje: "No se recibió patente para buscar planificación"
      };
    }

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var patenteRuta = normalizarClave(row[columnas.patente]);
      var guiaProveedor = (row[columnas.guiaProveedor] || "").toString().trim();
      var fotoGuia = (row[columnas.fotoGuia] || "").toString().trim();
      var coincidePatente = patenteNormalizada && patenteRuta === patenteNormalizada;

      if (coincidePatente && (!guiaProveedor || !fotoGuia)) {
        asignacionesPendientes.push({
          fila: i + 1,
          patente: row[columnas.patente] || "",
          conductor: row[columnas.conductor] || "",
          proveedor: row[columnas.proveedor] || "",
          fechaRetiro: formatearFechaHoja(row[columnas.fechaRetiro]),
          fechaEntregaObra: formatearFechaHoja(row[columnas.fechaEntregaObra])
        });
      }

      if (coincidePatente && guiaProveedor && fotoGuia) {
        coincidenciasCerradas.push({
          fila: i + 1,
          guiaProveedor: guiaProveedor,
          fotoGuia: fotoGuia
        });
      }
    }

    if (asignacionesPendientes.length) {
      return {
        asignacion: asignacionesPendientes[0],
        asignaciones: asignacionesPendientes,
        estado: "asignada",
        mensaje: "Ruta pendiente encontrada para la patente",
        fila: asignacionesPendientes[0].fila
      };
    }

    if (coincidenciasCerradas.length) {
      return {
        asignacion: null,
        asignaciones: [],
        estado: "ruta_cerrada",
        mensaje: "La patente existe en planificación, pero ya tiene guía y foto cargadas",
        coincidencias: coincidenciasCerradas
      };
    }

    return {
      asignacion: null,
      asignaciones: [],
      estado: "sin_ruta_para_patente",
      mensaje: "No hay planificación para la patente seleccionada"
    };
  } catch (err) {
    logError(err, "evaluarEstadoCompraPatente");
    return {
      asignacion: null,
      asignaciones: [],
      estado: "error",
      mensaje: err.message
    };
  }
}

function buscarAsignacionCompraActiva(conductor, patente, usuarioLogin) {
  return evaluarEstadoCompraPatente(patente).asignacion;
}

function actualizarAsignacionCompra(fila, guiaProveedor, fotoGuiaUrl) {
  var ss = SpreadsheetApp.openById(PLANILLA_RUTAS_COMPRAS_ID);
  var hoja = getHojaRutasCompras(ss);
  if (!hoja || fila < 2) return;

  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var columnas = resolverColumnasRutasCompras(encabezados);

  hoja.getRange(fila, columnas.guiaProveedor + 1).setValue(guiaProveedor);
  hoja.getRange(fila, columnas.fotoGuia + 1).setValue(fotoGuiaUrl);
}

function resolverColumnasRutasCompras(encabezados) {
  var mapa = {};

  for (var i = 0; i < encabezados.length; i++) {
    mapa[normalizarClave(encabezados[i])] = i;
  }

  return {
    patente: mapa.patente !== undefined ? mapa.patente : 0,
    conductor: mapa.conductor !== undefined ? mapa.conductor : 1,
    proveedor: mapa.proveedor !== undefined ? mapa.proveedor : 2,
    fechaRetiro: mapa.fecharetiro !== undefined ? mapa.fecharetiro : 3,
    fechaEntregaObra: mapa.fechaentregaobra !== undefined ? mapa.fechaentregaobra : 4,
    guiaProveedor: mapa.guiaproveedor !== undefined ? mapa.guiaproveedor : 5,
    fotoGuia: mapa.fotoguia !== undefined ? mapa.fotoguia : 6
  };
}

function diagnosticarRutaCompra(params) {
  try {
    var conductor = (params.conductor || "").toString().trim();
    var usuarioLogin = (params.usuario || "").toString().trim();
    var patente = (params.patente || "").toString().trim();
    var ss = SpreadsheetApp.openById(PLANILLA_RUTAS_COMPRAS_ID);
    var hoja = getHojaRutasCompras(ss);

    if (!hoja) {
      return { ok: false, error: "No se encontró la hoja de planificación" };
    }

    var rows = hoja.getDataRange().getValues();
    var columnas = resolverColumnasRutasCompras(rows[0] || []);
    var patenteNormalizada = normalizarClave(patente);
    var filas = [];

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var patenteRuta = normalizarClave(row[columnas.patente]);
      var conductorRuta = normalizarClave(row[columnas.conductor]);
      var guiaProveedor = (row[columnas.guiaProveedor] || "").toString().trim();
      var fotoGuia = (row[columnas.fotoGuia] || "").toString().trim();
      var coincidePatente = patenteNormalizada && patenteRuta === patenteNormalizada;

      if (patenteRuta || conductorRuta || row[columnas.proveedor]) {
        filas.push({
          fila: i + 1,
          patente: row[columnas.patente] || "",
          conductor: row[columnas.conductor] || "",
          proveedor: row[columnas.proveedor] || "",
          guiaProveedor: guiaProveedor,
          fotoGuia: fotoGuia,
          coincidePatente: !!coincidePatente,
          coincideConductor: false,
          pendiente: !guiaProveedor || !fotoGuia
        });
      }
    }

    return {
      ok: true,
      spreadsheetId: PLANILLA_RUTAS_COMPRAS_ID,
      hoja: hoja.getName(),
      sheetId: hoja.getSheetId(),
      columnas: columnas,
      conductorNormalizado: normalizarClave(conductor),
      usuarioNormalizado: normalizarClave(usuarioLogin),
      patenteNormalizada: patenteNormalizada,
      estadoCompra: evaluarEstadoCompraPatente(patente),
      asignacion: buscarAsignacionCompraActiva(conductor, patente, usuarioLogin),
      filas: filas.slice(0, 20)
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function normalizarClave(valor) {
  return (valor || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatearFechaHoja(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "dd-MM-yyyy");
  }

  return (valor || "").toString().trim();
}

function buscarRevisionRutaCompletaHoy(chofer, patente) {
  try {
    var ss = SpreadsheetApp.openById(PLANILLA_REVISION_ID);
    var hoja = getHojaRevisionRuta(ss);
    if (!hoja || hoja.getLastRow() < 2) return false;

    var rows = hoja.getDataRange().getValues();
    var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
    var choferNormalizado = normalizarClave(chofer);
    var patenteNormalizada = normalizarClave(patente);

    for (var i = rows.length - 1; i >= 1; i--) {
      var row = rows[i];
      var fechaRuta = normalizarFechaRevision(row[0]);
      var choferRuta = normalizarClave(row[2]);
      var patenteRuta = normalizarClave(row[4]);

      if (fechaRuta === hoy && choferRuta === choferNormalizado && patenteRuta === patenteNormalizada) {
        return true;
      }
    }

    return false;
  } catch (err) {
    logError(err, "buscarRevisionRutaCompletaHoy");
    return false;
  }
}

function normalizarFechaRevision(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyyMMdd");
  }

  var texto = (valor || "").toString().trim();
  var partes = texto.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);

  if (partes) {
    return partes[3] + completarDosDigitos(partes[2]) + completarDosDigitos(partes[1]);
  }

  return texto.replace(/\D/g, "");
}

function completarDosDigitos(valor) {
  valor = valor.toString();
  return valor.length === 1 ? "0" + valor : valor;
}

function getHojaLogin(ss) {
  var hoja = ss.getSheetByName("Usuarios");

  if (hoja) {
    return hoja;
  }

  var hojas = ss.getSheets();

  for (var i = 0; i < hojas.length; i++) {
    if (hojas[i].getSheetId() === SHEET_LOGIN_GID) {
      return hojas[i];
    }
  }

  return ss.getSheets()[0];
}

// ============================================================
// UTILIDADES
// ============================================================
function getOrCreateFolderByName(name) {
  if (FOLDER_FOTOS_ID) {
    return DriveApp.getFolderById(FOLDER_FOTOS_ID);
  }

  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function getOrCreateDailyFolder(parentFolder, fecha) {
  var nombreCarpeta = fecha || Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

  var subFolders = parentFolder.getFoldersByName(nombreCarpeta);

  if (subFolders.hasNext()) {
    return subFolders.next();
  }

  return parentFolder.createFolder(nombreCarpeta);
}

function base64ToBlob(base64, contentType, filename) {
  var parts = base64.split(",");
  var data = parts.length > 1 ? parts[1] : parts[0];
  var bytes = Utilities.base64Decode(data);

  return Utilities.newBlob(bytes, contentType, filename);
}

function crearNombreArchivo(tipoDocumento, numero) {
  var tipo = (tipoDocumento || "documento").toString().trim();
  var doc = (numero || "sin-numero").toString().trim();

  tipo = limpiarTextoArchivo(tipo);
  doc = limpiarTextoArchivo(doc);

  return tipo + "_" + doc + "_" + Date.now() + ".jpg";
}

function limpiarTextoArchivo(texto) {
  return texto
    .toString()
    .replace(/[\\/:*?"<>|#%{}]/g, "-")
    .replace(/\s+/g, "_")
    .trim();
}

function normalizarModuloOrigen(modulo) {
  modulo = (modulo || "").toString().trim();

  if (modulo === "proveedores_compras" || modulo === "proveedores") {
    return "Proveedores / Compras";
  }

  if (modulo === "entregas") {
    return "Entregas";
  }

  return modulo || "Sin módulo";
}

// ============================================================
// AUDITORÍA
// ============================================================
function logAccion(tipo, detalle) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var hoja = ss.getSheetByName("LOGS");

    if (!hoja) {
      hoja = ss.insertSheet("LOGS");
      hoja.appendRow(["Fecha", "Tipo", "Detalle"]);
      hoja.getRange(1, 1, 1, 3).setFontWeight("bold");
    }

    hoja.appendRow([
      new Date(),
      tipo,
      JSON.stringify(detalle)
    ]);

  } catch (e) {
    // No hacer nada si falla el log
  }
}

function logError(error, contexto) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var hoja = ss.getSheetByName("ERRORES");

    if (!hoja) {
      hoja = ss.insertSheet("ERRORES");
      hoja.appendRow(["Fecha", "Contexto", "Error"]);
      hoja.getRange(1, 1, 1, 3).setFontWeight("bold");
    }

    hoja.appendRow([
      new Date(),
      contexto,
      error.toString()
    ]);

  } catch (e) {
    // No hacer nada si falla el log de error
  }
}

// ============================================================
// ENTRYPOINT GET
// ============================================================
function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const action = e.parameter.action;

    if (action === "getChoferes") {
      return output.setContent(JSON.stringify(getChoferes()));
    }

    if (action === "getUsuarios") {
      return output.setContent(JSON.stringify(getUsuarios()));
    }

    if (action === "getCamiones") {
      return output.setContent(JSON.stringify(getCamiones()));
    }

    if (action === "getProveedores") {
      return output.setContent(JSON.stringify(getProveedores()));
    }

    if (action === "diagnosticarRutaCompra") {
      return output.setContent(JSON.stringify(diagnosticarRutaCompra(e.parameter || {})));
    }

    if (action === "version") {
      return output.setContent(JSON.stringify({
        ok: true,
        version: BACKEND_VERSION
      }));
    }

    return output.setContent(JSON.stringify({
      ok: false,
      version: BACKEND_VERSION,
      error: "Acción no válida"
    }));

  } catch (err) {
    return output.setContent(JSON.stringify({
      ok: false,
      error: err.message
    }));
  }
}

// ============================================================
// CHOFERES DESDE HOJA USUARIOS
// ============================================================
function getUsuarios() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_LOGIN_ID);
    const sh = ss.getSheetByName("Usuarios") || getHojaLogin(ss);
    const data = sh.getDataRange().getValues();

    const usuarios = [];

    for (let i = 1; i < data.length; i++) {
      const usuario = (data[i][0] || "").toString().trim();
      const nombre = (data[i][2] || "").toString().trim();
      const rol = (data[i][3] || "").toString().trim();

      if (usuario && nombre) {
        usuarios.push({
          usuario: usuario,
          nombre: nombre,
          rol: rol || ""
        });
      }
    }

    return { ok: true, usuarios: usuarios };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getChoferes() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_LOGIN_ID);
    const sh = ss.getSheetByName("Usuarios");
    const data = sh.getDataRange().getValues();

    const choferes = [];

    for (let i = 1; i < data.length; i++) {
      const usuario = data[i][0];
      const nombre = data[i][2];
      const rol = data[i][3];
      const rolNormalizado = rol ? rol.toString().toLowerCase() : "";
      const usuarioEsAdminPrueba = usuario && usuario.toString().toLowerCase() === "admin";

      if (rolNormalizado.includes("chofer") || usuarioEsAdminPrueba) {
        choferes.push({
          usuario: usuario,
          nombre: nombre
        });
      }
    }

    return { ok: true, choferes: choferes };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================
// CAMIONES DESDE HOJA CAMIONES
// ============================================================
function getCamiones() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_LOGIN_ID);
    const sh = ss.getSheetByName("Camiones");
    const data = sh.getDataRange().getValues();

    const camiones = [];

    for (let i = 1; i < data.length; i++) {
      const patente = (data[i][0] || "").toString().trim();
      const modelo = (data[i][1] || "").toString().trim();

      if (patente) {
        camiones.push({
          patente: patente,
          modelo: modelo
        });
      }
    }

    return { ok: true, camiones: camiones };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================
// PROVEEDORES DESDE HOJA PROVEEDORES
// ============================================================
function getProveedores() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_LOGIN_ID);
    const sh = ss.getSheetByName("Proveedores");
    const data = sh.getDataRange().getValues();

    const proveedores = [];

    for (let i = 1; i < data.length; i++) {
      const nombre = data[i][0];

      if (nombre) {
        proveedores.push(nombre);
      }
    }

    return { ok: true, proveedores: proveedores };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}
