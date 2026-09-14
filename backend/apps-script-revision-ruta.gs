// ============================================================
// BACKEND (Google Apps Script) — Módulo "Revisión previa de ruta"
// ============================================================
// Este archivo NO se ejecuta desde la app web: es el código que debes
// agregar/pegar en el proyecto de Apps Script que ya publica APPS_SCRIPT_URL
// (el mismo que atiende "login" y "registrarEntrega").
//
// Integración: en tu función doPost(e) existente, dentro del switch/if
// que lee payload.accion, agrega una rama para "registrarRevisionRuta"
// que llame a registrarRevisionRuta(payload) y devuelva su resultado.
//
// Ejemplo:
//   if (payload.accion === "registrarRevisionRuta") {
//     return respuestaJson(registrarRevisionRuta(payload));
//   }
//
// (Ajusta el nombre respuestaJson/ContentService según tu código actual).

// ID de la carpeta raíz de Drive donde se guardan las fotos de revisión:
// https://drive.google.com/drive/folders/1WpoNqXDleXScuF6NJmdRucPIanzzKmen
const CARPETA_RAIZ_REVISION_ID = "1WpoNqXDleXScuF6NJmdRucPIanzzKmen";

// Planilla donde se registra cada revisión:
// https://docs.google.com/spreadsheets/d/1HMYpFplf3eYdeo2OGsyluBsS7OoOn-OCL50_41l9fEU/edit
const PLANILLA_REVISION_RUTA_ID = "1HMYpFplf3eYdeo2OGsyluBsS7OoOn-OCL50_41l9fEU";

// Nombre de la hoja (pestaña) donde se registra cada revisión (se crea si no existe)
const HOJA_REVISION_RUTA = "RevisionRuta";

function registrarRevisionRuta(payload) {
  try {
    const chofer = (payload.chofer || "Sin_Nombre").trim();
    const patente = (payload.patente || "SIN-PATENTE").trim();
    const fecha = payload.fecha || Utilities.formatDate(new Date(), "GMT-4", "dd-MM-yyyy");
    const hora = payload.hora || Utilities.formatDate(new Date(), "GMT-4", "HH:mm");

    // 1) Obtener/crear la carpeta del chofer dentro de la carpeta raíz
    const carpetaChofer = obtenerOCrearCarpeta(CARPETA_RAIZ_REVISION_ID, sanitizarNombre(chofer));

    // 2) Guardar la foto del tablero, renombrada con fecha + patente
    const nombreArchivo = `${sanitizarNombre(fecha)}_${sanitizarNombre(hora).replace(":", "-")}_${sanitizarNombre(patente)}.jpg`;
    const archivo = guardarFotoBase64(carpetaChofer, payload.fotoBase64, nombreArchivo);

    // 3) Registrar la revisión en una hoja de cálculo (resumen + link a la foto)
    const totalItems = (payload.checklist || []).reduce((acc, cat) => acc + cat.items.length, 0);
    const itemsOk = (payload.checklist || []).reduce(
      (acc, cat) => acc + cat.items.filter(i => i.ok).length,
      0
    );

    const hoja = obtenerOCrearHoja(HOJA_REVISION_RUTA, [
      "Fecha", "Hora", "Chofer", "Patente", "Items OK", "Total items",
      "Observaciones", "Foto (link)"
    ]);

    hoja.appendRow([
      fecha,
      hora,
      chofer,
      patente,
      itemsOk,
      totalItems,
      payload.observaciones || "",
      archivo.getUrl()
    ]);

    return { ok: true, foto: archivo.getUrl() };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function obtenerOCrearCarpeta(idCarpetaPadre, nombre) {
  const padre = DriveApp.getFolderById(idCarpetaPadre);
  const existentes = padre.getFoldersByName(nombre);
  if (existentes.hasNext()) {
    return existentes.next();
  }
  return padre.createFolder(nombre);
}

function guardarFotoBase64(carpeta, fotoBase64, nombreArchivo) {
  const base64Limpio = fotoBase64.replace(/^data:image\/\w+;base64,/, "");
  const bytes = Utilities.base64Decode(base64Limpio);
  const blob = Utilities.newBlob(bytes, "image/jpeg", nombreArchivo);
  return carpeta.createFile(blob);
}

function obtenerOCrearHoja(nombre, encabezados) {
  const libro = SpreadsheetApp.openById(PLANILLA_REVISION_RUTA_ID);
  let hoja = libro.getSheetByName(nombre);
  if (!hoja) {
    hoja = libro.insertSheet(nombre);
    hoja.appendRow(encabezados);
  }
  return hoja;
}

function sanitizarNombre(texto) {
  return String(texto).trim().replace(/[\\/:*?"<>|]/g, "-");
}
