# Despliegue — Railway + Supabase

Arquitectura de producción recomendada:

| Pieza | Servicio recomendado | Alternativas |
|---|---|---|
| API (este repo) | **Railway** (Dockerfile) | — |
| PostgreSQL | **Supabase** (Postgres administrado) | Neon, Railway Postgres |
| Archivos (S3) | **Supabase Storage** (API S3) | Cloudflare R2, AWS S3 |
| Correo | **Resend** | Cualquier SMTP (`MAIL_DRIVER=smtp`) |
| Pagos | Stripe (Fase 05) | — |

## 1. Base de datos en Supabase

1. Crea un proyecto en Supabase (región cercana a México, p. ej. `us-east-1` / `us-west-1`).
2. En **Project Settings → Database → Connection string** copia las URLs (reemplaza `[YOUR-PASSWORD]`):
   - **Transaction pooler** (puerto `6543`) → `DATABASE_URL` (la que usa la app).
   - **Session pooler** (puerto `5432`, host `*.pooler.supabase.com`) → `DIRECT_URL` (migraciones).
3. Formatos:

```env
# App (pooler en modo transacción)
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
# Migraciones (session pooler: compatible con IPv4 y con DDL)
DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Notas:
- `prisma.config.ts` usa `DIRECT_URL` (si existe) para `migrate deploy`; la app usa siempre
  `DATABASE_URL` vía el driver adapter `@prisma/adapter-pg` (Prisma 7 no usa `directUrl` en el schema).
- La "Direct connection" de Supabase (`db.<ref>.supabase.co:5432`) es **solo IPv6** salvo que compres el
  add-on IPv4; por eso se recomienda el **session pooler** como `DIRECT_URL` desde Railway.
- Con una sola instancia en Railway y 200–500 usuarios/mes, el pool por defecto de `pg` (10 conexiones)
  es suficiente. Si ves errores de conexiones, usa el **session pooler** también para `DATABASE_URL`.
- Respaldos: Supabase hace backups diarios en los planes de pago; actívalos antes de producción.

## 2. Almacenamiento en Supabase Storage (S3)

1. **Storage → New bucket**: `eia-prod` (privado; los archivos se comparten con URLs firmadas).
2. **Project Settings → Storage → S3 Connection**: habilita el acceso S3 y crea un **access key**.
3. Variables:

```env
STORAGE_ENDPOINT=https://<ref>.supabase.co/storage/v1/s3
STORAGE_REGION=<región del proyecto, p. ej. us-east-1>
STORAGE_BUCKET=eia-prod
STORAGE_ACCESS_KEY_ID=<access key id>
STORAGE_SECRET_ACCESS_KEY=<secret>
STORAGE_FORCE_PATH_STYLE=true
```

4. Para subidas directas desde el navegador con URL firmada (PUT), configura CORS del bucket si
   el proveedor lo requiere (R2 sí; permite `PUT, GET` desde `FRONTEND_URL`).

**Alternativa Cloudflare R2:** `STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
`STORAGE_REGION=auto`, `STORAGE_FORCE_PATH_STYLE=true`, credenciales de un API token R2 con permiso
de lectura/escritura del bucket.

## 3. Servicio en Railway

1. **New Project → Deploy from GitHub repo** y elige este repositorio. Railway detecta `railway.json`:
   - Builder: `Dockerfile` (multi-stage, pnpm, `prisma generate`, usuario no root).
   - `preDeployCommand`: `npx prisma migrate deploy` (aplica migraciones antes de cambiar el tráfico;
     si falla, el deploy se cancela y sigue corriendo la versión anterior).
   - Healthcheck: `GET /api/v1/health`.
   - `numReplicas: 1` (las tareas programadas con `@nestjs/schedule` corren en proceso; no escalar
     horizontalmente sin mover los cron a un worker o usar un lock).
2. **Variables** (Service → Variables). Mínimas:

```env
NODE_ENV=production
LOG_LEVEL=info
APP_PUBLIC_URL=https://<servicio>.up.railway.app   # o tu dominio propio
FRONTEND_URL=https://<frontend>
CORS_ORIGINS=https://<frontend>,https://www.<frontend>
DOCS_ENABLED=true                                   # /docs público; ponlo en false si no se desea
DATABASE_URL=...                                    # ver sección 1
DIRECT_URL=...
JWT_ACCESS_SECRET=<openssl rand -base64 48>
MAIL_DRIVER=resend
RESEND_API_KEY=re_...
MAIL_FROM="Escuela Itinerante del Agua <no-reply@<dominio-verificado>>"
MAIL_TEAM_INBOX=<buzón del equipo>
STORAGE_ENDPOINT=... STORAGE_REGION=... STORAGE_BUCKET=... STORAGE_ACCESS_KEY_ID=... STORAGE_SECRET_ACCESS_KEY=...
```

   `PORT` lo inyecta Railway (la app lo lee). La lista completa y documentada está en `.env.example`;
   si falta una variable obligatoria la app no arranca y el log indica cuál.
3. **Networking → Generate Domain** (o dominio propio con CNAME).
4. Verifica: `curl https://<dominio>/api/v1/health` y `.../api/v1/health/ready` (este último consulta la BD).

### Resend
Verifica el dominio en Resend (registros SPF/DKIM en tu DNS) y usa una dirección de ese dominio en
`MAIL_FROM`. Mientras no esté verificado, `MAIL_DRIVER=console` evita errores (solo registra en logs).

## 4. Alternativas de base de datos

- **Neon**: usa la cadena "pooled" (`-pooler` en el host) como `DATABASE_URL` y la cadena directa como
  `DIRECT_URL`. Añade `?sslmode=require`.
- **Railway Postgres**: agrega el plugin Postgres al proyecto y referencia
  `DATABASE_URL=${{Postgres.DATABASE_URL}}` (red privada). Sin pooler: deja `DIRECT_URL` vacío.

Gracias a Prisma, cambiar de proveedor es cambiar las URLs y correr `prisma migrate deploy`.

## 5. Probar la imagen localmente

```bash
docker build -t eia-backend .
printf 'DATABASE_URL=postgresql://eia:eia@postgres:5432/eia_dev\nJWT_ACCESS_SECRET=%s\nMAIL_DRIVER=console\n' "$(openssl rand -hex 24)" > /tmp/eia.env
docker run --rm --network itinerantes-backend_default --env-file /tmp/eia.env eia-backend npx prisma migrate deploy
docker run --rm --network itinerantes-backend_default --env-file /tmp/eia.env -p 3100:3000 eia-backend
curl http://localhost:3100/api/v1/health
```

## 6. Operación

- **Logs**: JSON (pino) con `requestId`; el cliente recibe el mismo id en `X-Request-Id` y en los errores.
- **Rollback**: Railway → Deployments → "Redeploy" de una versión anterior. Las migraciones de Prisma no
  se revierten solas: diseña migraciones compatibles hacia atrás (agregar antes de quitar).
- **Rate limit** detrás del proxy de Railway: `trust proxy` está activado para usar la IP real.
