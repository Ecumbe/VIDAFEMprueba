# VIDAFEM Cloudflare Worker

Backend principal de VIDAFEM sobre Cloudflare Workers + Supabase.

## Estado actual

El Worker ya resuelve localmente la mayor parte del backend que antes vivia en Apps Script:

- autenticacion y sesiones
- pacientes, agenda y citas
- historia clinica y evolucion
- diagnosticos y adjuntos
- promociones, vacaciones e infografias
- perfil propio de paciente y medico
- operaciones de superadmin

## Estado de migracion

Arquitectura actual:

- el frontend de paciente sigue usando enlaces `wa.me` para WhatsApp
- el Worker guarda archivos e imagenes en Cloudflare R2 y los expone por `/files/...`
- los PDF de diagnostico se generan en el frontend y luego se almacenan en R2
- el PDF de evolucion del paciente sigue generandose en el navegador para descarga directa
- los correos automaticos de citas siguen siendo una responsabilidad pendiente fuera del Worker

Punto importante:

- `APPS_SCRIPT_API_URL` queda solo como puente heredado y debe considerarse opcional
- si vas a retirar Apps Script por completo, primero confirma que no quede ningun flujo oculto dependiendo del proxy

## Variables

Variables requeridas:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_TTL_SECONDS`
- `CORS_ALLOWED_ORIGINS`

Variable opcional heredada:

- `APPS_SCRIPT_API_URL`
  Solo para fallback temporal de acciones no migradas.

## Desarrollo local

1. Copia `.dev.vars.example` a `.dev.vars`
2. Completa los valores reales
3. Configura el bucket R2 por binding en `wrangler.toml`

## R2

Para diagnosticos, PDFs e imagenes, el Worker espera un binding R2 como este:

```toml
[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "vidafem-private"
```

## Sesiones

El Worker usa la tabla `public.worker_sessions` en Supabase.

Antes de desplegar, corre:

- [backend/supabase_worker_auth.sql](../backend/supabase_worker_auth.sql)

## Comandos

```bash
npm install
npm run dev
npm run check
npm run deploy
```

## Endpoints

GET:

- `/`
- `/health`
- `/?action=health`
- `/?action=ping`
- `/files/...`

POST:

- cuerpo JSON con `action`

Ejemplo login:

```json
{
  "action": "login",
  "usuario": "0927597777",
  "password": "1234"
}
```

Ejemplo `me`:

```json
{
  "action": "me",
  "session_token": "..."
}
```

## Siguiente cierre recomendado

1. mover correos transaccionales al Worker con un proveedor externo de email
2. decidir si los PDF seguiran generandose en navegador o pasaran a un flujo server-side
3. eliminar el puente final a Apps Script
4. retirar lecturas hibridas del frontend cuando ya no sean necesarias

## Nota

Hay una guia de cierre con hallazgos concretos en:

- [cloudflare-worker/MIGRACION_CIERRE.md](./MIGRACION_CIERRE.md)
