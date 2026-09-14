// ============================================================
// VARIABLES GLOBALES
// ============================================================
console.log("✅ script_v2.js cargado correctamente");

let usuarioActivo = null;
let fotoBase64 = null;
let moduloActivo = "entregas";
let compraAsignada = null;
let revisionRutaCompletaHoy = false;
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzP04DM6clsY4oUASPu3HDRLdFlsjk4EwORNVcYMlC4hNPaPr2W4KsUGNOoecXJIUCr/exec";
const REVIEW_PASS = "1234";
const REVIEW_USER_ALIASES = ["admin1", "admin 1"];

const FORM_CONFIG = {
  entregas: {
    nombreModulo: "Entregas",
    screen: "screen-entregas",
    numero: "guia-numero",
    tipo: "tipoDocumento",
    datetime: "datetime-auto",
    preview: "photo-preview",
    placeholder: "photo-placeholder",
    camera: "camera-input",
    retake: "btn-retake",
    estados: "estado-opciones",
    estado: "estado",
    submit: "btn-submit",
    status: "submit-status"
  },
  proveedores: {
    nombreModulo: "Proveedores / Compras",
    screen: "screen-proveedores",
    numero: "compras-numero",
    tipo: "compras-tipo-documento",
    datetime: "compras-datetime",
    preview: "compras-preview",
    placeholder: "compras-placeholder",
    camera: "compras-camera",
    retake: "compras-retake",
    estados: "compras-estado-opciones",
    estado: "compras-estado",
    submit: "compras-submit",
    status: "compras-status"
  },
  revision: {
    nombreModulo: "Revisión previa de ruta",
    screen: "screen-revision",
    datetime: "revision-datetime",
    preview: "revision-preview",
    placeholder: "revision-placeholder",
    camera: "revision-camera",
    retake: "revision-retake",
    submit: "revision-submit",
    status: "revision-status"
  }
};

// ============================================================
// CHECKLIST — REVISIÓN PREVIA DE RUTA
// ============================================================
const CHECKLIST_REVISION = [
  {
    titulo: "Neumáticos y ruedas",
    nivel: "critico",
    nivelTexto: "Crítico",
    desc: "Garantizan estabilidad y seguridad en todo el trayecto.",
    items: [
      "Revisar presión de aire",
      "Inspeccionar cortes, deformaciones o desgaste",
      "Confirmar tuercas firmes",
      "Verificar rueda de repuesto en condiciones"
    ]
  },
  {
    titulo: "Sistema de frenos",
    nivel: "seguridad",
    nivelTexto: "Seguridad",
    desc: "Asegura capacidad de detener el vehículo en cualquier situación.",
    items: [
      "Comprobar nivel de aire en circuitos",
      "Revisar balatas y funcionamiento",
      "Detectar fugas",
      "Probar freno de mano"
    ]
  },
  {
    titulo: "Luces y señalización",
    desc: "Permiten visibilidad y comunicación con otros conductores.",
    items: [
      "Revisar faros delanteros y traseros",
      "Probar intermitentes",
      "Confirmar balizas"
    ]
  },
  {
    titulo: "Niveles de fluidos",
    desc: "Evitan fallas mecánicas y sobrecalentamiento.",
    items: [
      "Chequear aceite del motor",
      "Revisar refrigerante",
      "Verificar líquido de frenos",
      "Revisar hidráulico"
    ]
  },
  {
    titulo: "Parabrisas y limpiaparabrisas",
    desc: "Mantienen visibilidad clara en condiciones adversas.",
    items: [
      "Limpiar vidrio y revisar grietas",
      "Revisar estado de escobillas"
    ]
  },
  {
    titulo: "Suspensión y dirección",
    desc: "Garantizan estabilidad y control del camión.",
    items: [
      "Observar fugas en amortiguadores",
      "Revisar pernos sueltos",
      "Detectar juego excesivo en dirección"
    ]
  },
  {
    titulo: "Carga y sujeción",
    desc: "Evita riesgos en frenadas o curvas.",
    items: [
      "Confirmar distribución equilibrada",
      "Revisar lonas, correas o sellos",
      "Asegurar puertas y cierres"
    ]
  },
  {
    titulo: "Extintor y elementos de seguridad",
    desc: "Proveen respuesta inmediata ante emergencias.",
    items: [
      "Extintor vigente",
      "Triángulos de emergencia",
      "Chaleco reflectante",
      "Botiquín completo"
    ]
  }
];

let revisionEstado = [];

function getFormConfig(modulo = "entregas") {
  return FORM_CONFIG[modulo] || FORM_CONFIG.entregas;
}
// ============================================================
// LOGIN CON GOOGLE SHEETS
// ============================================================

async function doLogin() {
  const user = document.getElementById("login-user").value.trim();
  const pass = document.getElementById("login-pass").value.trim();
  const patente = document.getElementById("patente").value.trim();
  const btn = document.querySelector(".btn-primary");
  const loginError = document.getElementById("login-error");
  const normalizedUser = user.toLowerCase();
  const isReviewUser = REVIEW_USER_ALIASES.includes(normalizedUser);
  const isLocalReviewHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  loginError.classList.add("hidden");

  if (!user || !pass) {
    loginError.classList.remove("hidden");
    return;
  }

  if (isReviewUser && pass === REVIEW_PASS) {
    usuarioActivo = {
      nombre: "Admin Revision",
      rol: "Administrador",
      asignacionCompra: null
    };
    compraAsignada = null;
    revisionRutaCompletaHoy = true;

    if (patente) {
      localStorage.setItem("patente", patente);
    } else {
      localStorage.setItem("patente", "REV-00-00");
    }

    mostrarMenu();
    return;
  }

  if (isLocalReviewHost) {
    alert("Modo revision local: usa usuario admin1 (o admin 1) y clave 1234.");
    return;
  }
 // 🔄 Animación de carga
  btn.disabled = true;
  btn.innerHTML = `
    <span class="loader"></span> Espere...
  `; 
try {
  const url = APPS_SCRIPT_URL;
    const payload = { accion: "login", usuario: user, password: pass, patente };
    const res = await fetch(url, {
      method: "POST",
      body: new URLSearchParams({ data: JSON.stringify(payload) })
    });
    const data = await res.json();

    if (data.ok) {
      usuarioActivo = data.usuario;
      compraAsignada = data.usuario.asignacionCompra || null;
      revisionRutaCompletaHoy = !!data.usuario.revisionRutaCompletaHoy || revisionRutaEstaMarcadaHoy(patente);
      localStorage.setItem("patente", patente);
      mostrarMenu();
    } else {
      loginError.classList.remove("hidden");
    }

  } catch (e) {
    alert("Error de conexión con el servidor.");
    console.error(e);
  }

  // 🔁 Restaurar botón
  btn.disabled = false;
  btn.textContent = "Ingresar";
}
// ============================================================
// NAVEGACIÓN
// ============================================================

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}

function fechaLocalClave(fecha = new Date()) {
  const ajustada = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return ajustada.toISOString().slice(0, 10);
}

function getRevisionRutaKey(patente = localStorage.getItem("patente")) {
  const usuario = usuarioActivo && usuarioActivo.nombre ? usuarioActivo.nombre : "sin-usuario";
  const patenteClave = patente || "sin-patente";
  return `revisionRuta:${fechaLocalClave()}:${usuario}:${patenteClave}`.toLowerCase();
}

function revisionRutaEstaMarcadaHoy(patente) {
  return localStorage.getItem(getRevisionRutaKey(patente)) === "completa";
}

function marcarRevisionRutaCompletaHoy(patente = localStorage.getItem("patente")) {
  revisionRutaCompletaHoy = true;
  localStorage.setItem(getRevisionRutaKey(patente), "completa");
}

function esLunesRevisionObligatoria() {
  return new Date().getDay() === 1 && !usuarioEsAdministrador();
}

function debeCompletarRevisionRuta() {
  return esLunesRevisionObligatoria() && !revisionRutaCompletaHoy;
}

function mostrarRecordatorioRevisionLunes() {
  if (!debeCompletarRevisionRuta()) return;

  const modalExistente = document.getElementById("modal-revision-lunes");
  if (modalExistente) return;

  const overlay = document.createElement("div");
  overlay.id = "modal-revision-lunes";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(10, 22, 29, 0.72)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "99999";
  overlay.style.padding = "20px";

  const modal = document.createElement("div");
  modal.style.width = "100%";
  modal.style.maxWidth = "420px";
  modal.style.background = "#ffffff";
  modal.style.borderRadius = "18px";
  modal.style.boxShadow = "0 20px 55px rgba(15, 81, 54, 0.28)";
  modal.style.border = "2px solid #0f5136";
  modal.style.padding = "24px 20px 18px";
  modal.style.textAlign = "center";

  const titulo = document.createElement("div");
  titulo.textContent = "Revisión previa obligatoria";
  titulo.style.fontSize = "22px";
  titulo.style.fontWeight = "800";
  titulo.style.color = "#0f5136";
  titulo.style.marginBottom = "10px";

  const texto = document.createElement("div");
  texto.textContent = "Hoy es lunes. Antes de salir a ruta, debes completar la revisión previa del camión.";
  texto.style.fontSize = "15px";
  texto.style.lineHeight = "1.5";
  texto.style.color = "#243244";
  texto.style.marginBottom = "18px";

  const boton = document.createElement("button");
  boton.textContent = "Ir a revisión";
  boton.style.width = "100%";
  boton.style.padding = "12px 16px";
  boton.style.border = "none";
  boton.style.borderRadius = "12px";
  boton.style.background = "linear-gradient(135deg, #0f5136 0%, #166f4d 45%, #1d8f60 100%)";
  boton.style.color = "#ffffff";
  boton.style.fontSize = "15px";
  boton.style.fontWeight = "700";
  boton.style.cursor = "pointer";
  boton.style.boxShadow = "0 8px 18px rgba(15,81,54,0.18)";
  boton.onclick = () => {
    overlay.remove();
    goToModule("revision");
  };

  modal.appendChild(titulo);
  modal.appendChild(texto);
  modal.appendChild(boton);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function mostrarMenu() {
  if (!usuarioActivo) return;

  const iniciales = usuarioActivo.nombre
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  document.getElementById("menu-avatar").textContent = iniciales;
  document.getElementById("menu-nombre").textContent = usuarioActivo.nombre;
  document.getElementById("menu-rol").textContent = usuarioActivo.rol;

  const ahora = new Date();
  document.getElementById("menu-fecha").innerHTML =
    `${ahora.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}<br>${ahora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;

  actualizarModuloProveedores();

  mostrarRecordatorioRevisionLunes();
  showScreen("screen-menu");
}

function usuarioEsAdministrador() {
  const rol = usuarioActivo && usuarioActivo.rol ? usuarioActivo.rol.toLowerCase() : "";
  return rol.includes("admin");
}

function puedeUsarModuloProveedores() {
  return usuarioEsAdministrador() || !!compraAsignada;
}

function actualizarModuloProveedores() {
  const card = document.querySelector('.module-card[data-module="proveedores"]');
  if (!card) return;

  const visible = puedeUsarModuloProveedores();
  card.classList.toggle("hidden", !visible);

  const badge = card.querySelector(".module-badge");
  if (badge) {
    badge.textContent = compraAsignada ? "Ruta asignada" : "Activo";
  }
}

function renderAsignacionCompra() {
  const panel = document.getElementById("compras-asignacion");
  if (!panel) return;

  if (!compraAsignada) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="asignacion-item">
      <span class="asignacion-label">Proveedor</span>
      <span class="asignacion-valor">${escapeHtml(compraAsignada.proveedor || "—")}</span>
    </div>
    <div class="asignacion-item">
      <span class="asignacion-label">Retiro</span>
      <span class="asignacion-valor">${escapeHtml(compraAsignada.fechaRetiro || "—")}</span>
    </div>
    <div class="asignacion-item">
      <span class="asignacion-label">Entrega obra</span>
      <span class="asignacion-valor">${escapeHtml(compraAsignada.fechaEntregaObra || "—")}</span>
    </div>
  `;
}

function escapeHtml(valor) {
  return valor.toString().replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function goToModule(mod) {
  if (!FORM_CONFIG[mod]) return;

  if (mod !== "revision" && debeCompletarRevisionRuta()) {
    mostrarRecordatorioRevisionLunes();
    return;
  }

  if (mod === "proveedores" && !puedeUsarModuloProveedores()) {
    alert("No tienes una ruta de compra asignada para este camión.");
    return;
  }

  moduloActivo = mod;

  if (mod === "revision") {
    resetFormRevision();
    showScreen(getFormConfig(mod).screen);
    return;
  }

  resetFormEntregas(mod);
  showScreen(getFormConfig(mod).screen);
  if (mod === "proveedores") renderAsignacionCompra();
  activarSeleccionEstado(mod);
}

function goBack(destino) {
  if (destino === "menu") {
    mostrarMenu();
  } else {
    showScreen("screen-" + destino);
  }
}

// ============================================================
// ESTADO DE ENTREGA
// ============================================================

function activarSeleccionEstado(modulo = "entregas") {
  const config = getFormConfig(modulo);
  document.querySelectorAll(`#${config.estados} .estado-box`).forEach(box => {
    box.onclick = () => {
      document.querySelectorAll(`#${config.estados} .estado-box`)
        .forEach(b => b.classList.remove("selected"));

      box.classList.add("selected");
      document.getElementById(config.estado).value = box.dataset.value;
    };
  });
}

// ============================================================
// FORMULARIO ENTREGAS
// ============================================================

function resetFormEntregas(modulo = "entregas") {
  const config = getFormConfig(modulo);
  fotoBase64 = null;
  moduloActivo = modulo;

  // Campos del formulario
  document.getElementById(config.numero).value = "";
  document.getElementById(config.estado).value = "";
  document.getElementById(config.tipo).value = "";

  // Reset estado visual
  document.querySelectorAll(`#${config.estados} .estado-box`).forEach(b => b.classList.remove("selected"));
  document.querySelectorAll(`#${config.screen} .btn-tipo-doc`).forEach(btn => btn.classList.remove("selected"));

  // Reset foto
  document.getElementById(config.preview).src = "";
  document.getElementById(config.preview).classList.add("hidden");
  document.getElementById(config.placeholder).style.display = "flex";
  document.getElementById(config.retake).style.display = "none";
  document.getElementById(config.camera).value = "";

  // Reset estado del botón de envío
  document.getElementById(config.status).classList.add("hidden");
  document.getElementById(config.submit).disabled = false;

  // Actualizar fecha/hora
  actualizarDatetime(modulo);
}

function actualizarDatetime(modulo = "entregas") {
  const config = getFormConfig(modulo);
  const ahora = new Date();
  const texto = ahora.toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }) + " · " + ahora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

  const el = document.getElementById(config.datetime);
  if (el) el.textContent = texto;
}

setInterval(() => {
  if (document.getElementById(FORM_CONFIG.entregas.screen).classList.contains("active")) {
    actualizarDatetime("entregas");
  }
  if (document.getElementById(FORM_CONFIG.proveedores.screen).classList.contains("active")) {
    actualizarDatetime("proveedores");
  }
  if (document.getElementById(FORM_CONFIG.revision.screen).classList.contains("active")) {
    actualizarDatetime("revision");
  }
}, 30000);

// ============================================================
// REVISIÓN PREVIA DE RUTA — CHECKLIST
// ============================================================

function resetFormRevision() {
  const config = getFormConfig("revision");

  document.getElementById("revision-chofer").textContent = usuarioActivo ? usuarioActivo.nombre : "—";
  document.getElementById("revision-patente").textContent = localStorage.getItem("patente") || "—";

  revisionEstado = CHECKLIST_REVISION.map(cat => ({
    titulo: cat.titulo,
    nivelTexto: cat.nivelTexto || "",
    items: cat.items.map(texto => ({ texto, ok: false }))
  }));

  document.getElementById("revision-odometro").value = "";
  document.getElementById("revision-observaciones").value = "";

  fotoBase64 = null;
  document.getElementById(config.preview).src = "";
  document.getElementById(config.preview).classList.add("hidden");
  document.getElementById(config.placeholder).style.display = "flex";
  document.getElementById(config.retake).style.display = "none";
  document.getElementById(config.camera).value = "";

  document.getElementById(config.status).classList.add("hidden");
  document.getElementById(config.submit).disabled = false;

  renderChecklistRevision();
  actualizarDatetime("revision");
}

function renderChecklistRevision() {
  const contenedor = document.getElementById("revision-checklist");
  contenedor.innerHTML = revisionEstado.map((cat, catIdx) => `
    <div class="revision-categoria">
      <div class="revision-categoria-header">
        <div class="revision-categoria-titulo">
          <span class="revision-categoria-num">${catIdx + 1}</span>
          ${cat.titulo}
        </div>
        ${cat.nivelTexto ? `<span class="revision-nivel ${cat.nivelTexto === "Crítico" ? "critico" : "seguridad"}">${cat.nivelTexto}</span>` : ""}
      </div>
      <div class="revision-categoria-desc">${CHECKLIST_REVISION[catIdx].desc}</div>
      ${cat.items.map((item, itemIdx) => `
        <label class="revision-item ${item.ok ? "checked" : ""}" data-cat="${catIdx}" data-item="${itemIdx}">
          <input type="checkbox" ${item.ok ? "checked" : ""} onchange="toggleRevisionItem(${catIdx}, ${itemIdx})" />
          <span>${item.texto}</span>
        </label>
      `).join("")}
    </div>
  `).join("");

  actualizarProgresoRevision();
}

function toggleRevisionItem(catIdx, itemIdx) {
  const item = revisionEstado[catIdx].items[itemIdx];
  item.ok = !item.ok;
  renderChecklistRevision();
}

function actualizarProgresoRevision() {
  const total = revisionEstado.reduce((acc, cat) => acc + cat.items.length, 0);
  const completados = revisionEstado.reduce(
    (acc, cat) => acc + cat.items.filter(i => i.ok).length,
    0
  );

  document.getElementById("revision-progreso-texto").textContent = `${completados} / ${total} completados`;
  document.getElementById("revision-progreso-fill").style.width = `${total ? (completados / total) * 100 : 0}%`;
}

async function submitRevision() {
  const config = getFormConfig("revision");
  const total = revisionEstado.reduce((acc, cat) => acc + cat.items.length, 0);
  const completados = revisionEstado.reduce(
    (acc, cat) => acc + cat.items.filter(i => i.ok).length,
    0
  );

  if (completados < total) {
    alert(`Debes completar todos los puntos del checklist (${completados}/${total}).`);
    return;
  }
  if (!fotoBase64) {
    alert("Toma la foto del tablero.");
    return;
  }

  const odometro = document.getElementById("revision-odometro").value.trim();
  if (!odometro) {
    alert("Ingresa el odómetro para registrar la revisión.");
    return;
  }

  const patente = localStorage.getItem("patente");
  if (!usuarioActivo || !patente) {
    alert("Falta información del chofer o la patente.");
    return;
  }

  const detalle = document.getElementById("revision-observaciones").value.trim();

  const payload = {
    accion: "registrarRevisionRuta",
    modulo: "revision_ruta",
    chofer: usuarioActivo.nombre,
    rol: usuarioActivo.rol,
    patente,
    fecha: new Date().toLocaleDateString("es-CL"),
    hora: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
    odometro,
    checklist: revisionEstado,
    detalle,
    observaciones: detalle,
    fotoBase64
  };

  const btn = document.getElementById(config.submit);
  const status = document.getElementById(config.status);

  btn.disabled = true;
  btn.textContent = "Enviando...";
  status.textContent = "⏳ Guardando...";
  status.classList.remove("hidden");

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: new URLSearchParams({ data: JSON.stringify(payload) })
    });
    const data = await res.json();

    if (data.ok) {
      marcarRevisionRutaCompletaHoy(patente);
      document.getElementById("exito-guia").textContent = `Revisión — ${patente}`;
      mostrarMenu();
    } else {
      alert("Error al guardar: " + data.error);
    }
  } catch (e) {
    alert("Error de conexión.");
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Registrar revisión`;
}

// ============================================================
// FOTO 
// ============================================================
function triggerCamera(modulo = moduloActivo) {
  const config = getFormConfig(modulo);
  const input = document.getElementById(config.camera);
  input.value = ""; // reset obligatorio
  input.click();
}

async function handlePhoto(event) {
  const modulo = event.target.dataset.module || moduloActivo;
  const config = getFormConfig(modulo);
  const file = event.target.files[0];
  if (!file) return;

  // Comprimir imagen
  fotoBase64 = await comprimirImagen(file);

  // Mostrar preview
  const preview = document.getElementById(config.preview);
  preview.src = fotoBase64;
  preview.classList.remove("hidden");

  document.getElementById(config.placeholder).style.display = "none";
  document.getElementById(config.retake).style.display = "block";
}
function retakePhoto(modulo = moduloActivo) {
  const config = getFormConfig(modulo);
  fotoBase64 = null;

  const preview = document.getElementById(config.preview);
  preview.src = "";
  preview.classList.add("hidden");

  document.getElementById(config.placeholder).style.display = "flex";
  document.getElementById(config.retake).style.display = "none";
}
// ============================================================
// COMPRESIÓN DE IMAGEN (VERSIÓN SIMPLE Y ESTABLE)
// ============================================================
function comprimirImagen(file, maxWidth = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;

        // Redimensionar manteniendo proporción
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL("image/jpeg", quality);
        resolve(base64);

      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject("No se pudo cargar la imagen");
    };

    img.src = objectUrl;
  });
}

// ============================================================
// TIPO DE DOCUMENTO
// ============================================================

function seleccionarTipo(tipo, modulo = moduloActivo) {
  const config = getFormConfig(modulo);
  document.getElementById(config.tipo).value = tipo;

  document.querySelectorAll(`#${config.screen} .btn-tipo-doc`).forEach(btn => {
    btn.classList.remove("selected");
  });

  if (tipo === "guia") {
    document.querySelector(`#${config.screen} .btn-tipo-doc.guia`).classList.add("selected");
  } else {
    document.querySelector(`#${config.screen} .btn-tipo-doc.factura`).classList.add("selected");
  }
}

// ============================================================
// ENVÍO DE ENTREGA
// ============================================================

async function submitEntrega(modulo = moduloActivo) {
  const config = getFormConfig(modulo);
  const numero = document.getElementById(config.numero).value.trim();
  const estado = document.getElementById(config.estado).value;
  const tipoDocumento = document.getElementById(config.tipo).value;
  const moduloOrigen = config.nombreModulo;

  if (!tipoDocumento) {
    alert("Selecciona si es guía o factura.");
    return;
  }
  if (!numero) {
    alert("Ingresa el número de documento.");
    return;
  }
  if (!fotoBase64) {
    alert("Toma o sube la foto.");
    return;
  }
  if (!estado) {
    alert("Selecciona el estado de la entrega.");
    return;
  }

  const payload = {
  accion: "registrarEntrega",
  numero,
  estado,
  tipoDocumento,
  modulo: modulo === "proveedores" ? "proveedores_compras" : "entregas",
  moduloOrigen,
  asignacionCompra: modulo === "proveedores" ? compraAsignada : null,
  usuario: usuarioActivo.nombre,
  rol: usuarioActivo.rol,
  fecha: new Date().toLocaleDateString("es-CL"),
  hora: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
  fotoBase64,
  patente: localStorage.getItem("patente")
};

  const btn = document.getElementById(config.submit);
  const status = document.getElementById(config.status);

  btn.disabled = true;
  btn.textContent = "Enviando...";
  status.textContent = "⏳ Guardando...";
  status.classList.remove("hidden");

  try {
const res = await fetch(APPS_SCRIPT_URL, {
  method: "POST",
  body: new URLSearchParams({ data: JSON.stringify(payload) })
});
    const data = await res.json();

    if (data.ok) {
      document.getElementById("exito-guia").textContent = numero;
      showScreen("screen-exito");
    } else {
      alert("Error al guardar: " + data.error);
    }

  } catch (e) {
    alert("Error de conexión.");
  }

  btn.disabled = false;
  btn.textContent = "Registrar entrega";
}
function nuevaEntrega() {
  if (moduloActivo === "revision") {
    resetFormRevision();
  } else {
    resetFormEntregas(moduloActivo);
  }
  showScreen(getFormConfig(moduloActivo).screen);
}
function doLogout() {
  // Limpia datos del usuario
  usuarioActivo = null;
  compraAsignada = null;
  revisionRutaCompletaHoy = false;
  localStorage.removeItem("patente");

  // Muestra mensaje visual
  const mensaje = document.createElement("div");
  mensaje.textContent = "✅ Sesión cerrada correctamente";
  mensaje.style.position = "fixed";
  mensaje.style.bottom = "20px";
  mensaje.style.left = "50%";
  mensaje.style.transform = "translateX(-50%)";
  mensaje.style.background = "#0d47a1";
  mensaje.style.color = "white";
  mensaje.style.padding = "10px 20px";
  mensaje.style.borderRadius = "6px";
  mensaje.style.fontWeight = "500";
  mensaje.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  mensaje.style.zIndex = "9999";
  document.body.appendChild(mensaje);

  // Oculta el mensaje después de 2 segundos
  setTimeout(() => mensaje.remove(), 2000);

  // Retorna al login
  showScreen("screen-login");
}

