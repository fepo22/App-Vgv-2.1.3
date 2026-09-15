import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { env } from "./config/env.js";
import { findUser, getPurchaseRouteDiagnosis, providers, trucks, users } from "./data/demoStore.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.APP_ORIGIN === "*" ? true : env.APP_ORIGIN }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(morgan("dev"));

const loginSchema = z.object({
  usuario: z.string().min(1),
  password: z.string().min(1),
  patente: z.string().min(1)
});

const deliverySchema = z.object({
  numero: z.string().min(1),
  usuario: z.string().min(1),
  rol: z.string().optional().default(""),
  fecha: z.string().optional().default(""),
  hora: z.string().optional().default(""),
  estado: z.string().optional().default(""),
  patente: z.string().min(1),
  tipoDocumento: z.string().optional().default(""),
  moduloOrigen: z.string().optional(),
  modulo: z.string().optional(),
  asignacionCompra: z.unknown().optional(),
  fotoBase64: z.string().optional().default("")
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "Appweb 3.0 API" });
});

app.get("/api/version", (_req, res) => {
  res.json({ ok: true, version: "appweb-3.0-api-2026-09-15" });
});

app.get("/api/usuarios", (_req, res) => {
  res.json({
    ok: true,
    usuarios: users.map(user => ({ usuario: user.usuario, nombre: user.nombre, rol: user.rol }))
  });
});

app.get("/api/choferes", (_req, res) => {
  res.json({
    ok: true,
    choferes: users
      .filter(user => user.rol === "chofer" || user.rol === "admin")
      .map(user => ({ usuario: user.usuario, nombre: user.nombre }))
  });
});

app.get("/api/camiones", (_req, res) => {
  res.json({ ok: true, camiones: trucks.map(truck => ({ patente: truck.patente, modelo: truck.modelo })) });
});

app.get("/api/proveedores", (_req, res) => {
  res.json({ ok: true, proveedores: providers });
});

app.get("/api/rutas-compra/diagnostico", (req, res) => {
  const patente = String(req.query.patente ?? "");
  const diagnostico = getPurchaseRouteDiagnosis(patente);

  res.json({
    ok: true,
    spreadsheetId: "database",
    hoja: "purchase_routes",
    columnas: {
      patente: 0,
      conductor: 1,
      proveedor: 2,
      fechaRetiro: 3,
      fechaEntregaObra: 4,
      guiaProveedor: 5,
      fotoGuia: 6
    },
    patenteNormalizada: patente,
    estadoCompra: diagnostico,
    asignacion: diagnostico.asignacion,
    filas: diagnostico.filas
  });
});

app.post("/api/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Usuario, contraseña y patente son obligatorios" });
  }

  const user = findUser(parsed.data.usuario, parsed.data.password);
  if (!user) {
    return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos" });
  }

  const estadoCompra = getPurchaseRouteDiagnosis(parsed.data.patente);

  return res.json({
    ok: true,
    usuario: {
      nombre: user.nombre,
      rol: user.rol,
      asignacionCompra: estadoCompra.asignacion,
      asignacionesCompra: estadoCompra.asignaciones,
      estadoCompra,
      revisionRutaCompletaHoy: false
    }
  });
});

app.post("/api/entregas", (req, res) => {
  const parsed = deliverySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Faltan datos obligatorios para registrar la entrega" });
  }

  return res.status(201).json({
    ok: true,
    url: "pending-storage-adapter",
    modulo: parsed.data.moduloOrigen || parsed.data.modulo || "Sin módulo"
  });
});

app.post("/api/revision-ruta", (_req, res) => {
  return res.status(201).json({ ok: true, url: "pending-storage-adapter" });
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
});

app.listen(env.PORT, () => {
  console.log(`Appweb 3.0 API escuchando en http://localhost:${env.PORT}`);
});
