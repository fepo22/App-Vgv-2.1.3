import { normalizeKey } from "../lib/normalize.js";

export type UserRole = "admin" | "chofer" | "operador";

export type AppUser = {
  id: string;
  usuario: string;
  password: string;
  nombre: string;
  rol: UserRole;
};

export type Truck = {
  id: string;
  patente: string;
  modelo: string;
};

export type PurchaseRoute = {
  id: string;
  fila: number;
  patente: string;
  conductor: string;
  proveedor: string;
  fechaRetiro: string;
  fechaEntregaObra: string;
  guiaProveedor: string;
  fotoGuia: string;
};

export const users: AppUser[] = [
  { id: "usr-admin", usuario: "admin", password: "admin123", nombre: "Admin Pruebas", rol: "admin" },
  { id: "usr-roberto", usuario: "rtito", password: "demo123", nombre: "Roberto Saavedra", rol: "chofer" }
];

export const trucks: Truck[] = [
  { id: "trk-swgr35", patente: "SWGR-35", modelo: "Mercedez Benz" }
];

export const providers = ["Hoffens"];

export const purchaseRoutes: PurchaseRoute[] = [
  {
    id: "route-001",
    fila: 2,
    patente: "SWGR-35",
    conductor: "Roberto Saavedra",
    proveedor: "Hoffens",
    fechaRetiro: "15-09-2026",
    fechaEntregaObra: "16-09-2026",
    guiaProveedor: "",
    fotoGuia: ""
  }
];

export function findUser(usuario: string, password: string): AppUser | undefined {
  const usuarioKey = usuario.trim().toLowerCase();
  return users.find(user => user.usuario.toLowerCase() === usuarioKey && user.password === password.trim());
}

export function getPendingPurchaseRoutesByPlate(patente: string): PurchaseRoute[] {
  const patenteKey = normalizeKey(patente);
  return purchaseRoutes.filter(route => {
    const samePlate = normalizeKey(route.patente) === patenteKey;
    const pending = !route.guiaProveedor.trim() || !route.fotoGuia.trim();
    return samePlate && pending;
  });
}

export function getPurchaseRouteDiagnosis(patente: string) {
  const patenteNormalizada = normalizeKey(patente);
  const filas = purchaseRoutes.map(route => ({
    fila: route.fila,
    patente: route.patente,
    conductor: route.conductor,
    proveedor: route.proveedor,
    guiaProveedor: route.guiaProveedor,
    fotoGuia: route.fotoGuia,
    coincidePatente: normalizeKey(route.patente) === patenteNormalizada,
    coincideConductor: false,
    pendiente: !route.guiaProveedor.trim() || !route.fotoGuia.trim()
  }));
  const asignaciones = getPendingPurchaseRoutesByPlate(patente);

  return {
    estado: asignaciones.length ? "asignada" : "sin_ruta_para_patente",
    mensaje: asignaciones.length ? "Ruta pendiente encontrada para la patente" : "No hay planificación para la patente seleccionada",
    asignacion: asignaciones[0] ?? null,
    asignaciones,
    filas
  };
}
