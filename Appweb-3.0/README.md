# Appweb 3.0

Backend robusto para reemplazar gradualmente Google Apps Script sin romper el flujo actual de VGV.

## Stack

- Node.js
- TypeScript
- Express
- Zod
- Prisma
- PostgreSQL para producción
- Store demo en memoria para desarrollo local

## Primer uso local

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

API local:

```text
http://localhost:3000
```

## Endpoints compatibles

```text
GET  /health
GET  /api/version
GET  /api/usuarios
GET  /api/choferes
GET  /api/camiones
GET  /api/proveedores
GET  /api/rutas-compra/diagnostico?patente=SWGR-35
POST /api/login
POST /api/entregas
POST /api/revision-ruta
```

## Login demo

```json
{
  "usuario": "rtito",
  "password": "demo123",
  "patente": "SWGR-35"
}
```

La respuesta mantiene la forma que usa la app actual:

```json
{
  "ok": true,
  "usuario": {
    "nombre": "Roberto Saavedra",
    "rol": "chofer",
    "asignacionCompra": {},
    "asignacionesCompra": [],
    "estadoCompra": {},
    "revisionRutaCompletaHoy": false
  }
}
```

## Migración sin romper App 2.1.3

1. Levantar esta API en local.
2. Probar endpoints con datos demo.
3. Migrar datos reales desde Sheets a PostgreSQL.
4. Cambiar el frontend para usar un adaptador de backend, manteniendo Apps Script como fallback.
5. Cuando esté estable, cambiar la URL definitiva.

## Base de datos

El esquema está en `prisma/schema.prisma`. Para producción:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```
