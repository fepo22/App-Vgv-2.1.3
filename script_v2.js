// ============================================================
// VARIABLES GLOBALES
// ============================================================
console.log("✅ script_v2.js cargado correctamente");

let usuarioActivo = null;
let fotoBase64 = null;
let moduloActivo = "entregas";
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
  }
};

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
      rol: "Administrador"
    };

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
    const payload = { accion: "login", usuario: user, password: pass };
    const res = await fetch(url, {
      method: "POST",
      body: new URLSearchParams({ data: JSON.stringify(payload) })
    });
    const data = await res.json();

    if (data.ok) {
      usuarioActivo = data.usuario;
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

  showScreen("screen-menu");
}

function goToModule(mod) {
  if (!FORM_CONFIG[mod]) return;

  moduloActivo = mod;
  resetFormEntregas(mod);
  showScreen(getFormConfig(mod).screen);
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
}, 30000);

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
  resetFormEntregas(moduloActivo);
  showScreen(getFormConfig(moduloActivo).screen);
}
function doLogout() {
  // Limpia datos del usuario
  usuarioActivo = null;
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

