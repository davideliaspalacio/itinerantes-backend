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
   - Builder: `Dockerfile` (multi-stage, pnpm, `prisma generate`, `pnpm build` + `pnpm build:seed`,
     usuario no root).
   - **Arranque autosuficiente** (no depende de `preDeployCommand`, que en Railway no se ejecutó):
     el `ENTRYPOINT` de la imagen es `scripts/docker-entrypoint.sh`, que en cada arranque:
     1. `prisma migrate deploy` → si falla, el contenedor termina con error y Railway no da por
        sano el deploy (sigue la versión anterior).
     2. Seed idempotente compilado (`node dist/seed/prisma/seed.js`): catálogos de referencia
        (países, 32 estados y 2,478 municipios de México) siempre; ofertas demo solo con
        `SEED_DEMO_DATA=true`; usuarios demo **nunca** con `NODE_ENV=production`. Si falla, no arranca.
     3. `exec node dist/main`.
   - **No** configures "Start Command" ni "Pre-deploy Command" en la UI de Railway: un Start Command
     reemplaza el comando de la imagen y podría saltarse el entrypoint. `railway.json` ya no define
     ninguno de los dos.
   - Healthcheck: `GET /api/v1/health` (120 s de margen: migraciones + seed tardan unos segundos).
   - `numReplicas: 1` (las tareas programadas con `@nestjs/schedule` corren en proceso; no escalar
     horizontalmente sin mover los cron a un worker o usar un lock). Con más réplicas, pon
     `RUN_MIGRATIONS=false` y `RUN_SEED=false` en todas menos una.
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
CONTACT_INBOX_EMAIL=<buzón que recibe Contacto>       # si falta, se usa MAIL_TEAM_INBOX
IP_HASH_SECRET=<openssl rand -base64 32>            # HMAC de IPs de Contacto
TURNSTILE_SECRET_KEY=                               # opcional: activa el captcha de Contacto
STORAGE_ENDPOINT=... STORAGE_REGION=... STORAGE_BUCKET=... STORAGE_ACCESS_KEY_ID=... STORAGE_SECRET_ACCESS_KEY=...
STORAGE_PUBLIC_BASE_URL=                            # opcional: URL pública de imágenes (ver abajo)
SEED_DEMO_DATA=true                                 # ofertas demo para integrar el frontend (quitar al cargar datos reales)
```

   `PORT` lo inyecta Railway (la app lo lee). Los catálogos (países, estados y municipios) se cargan
   solos en cada arranque (entrypoint); en `NODE_ENV=production` el seed **no** crea usuarios demo.

   **Ofertas demo (`SEED_DEMO_DATA`)**: mientras no exista el panel (Fase 06), pon `SEED_DEMO_DATA=true`
   para que el frontend tenga el catálogo de ejemplo (diplomado, curso, taller, evento, convocatorias,
   Moodle). El seed hace upsert por `slug` en cada arranque: **sobrescribe** cambios hechos a esas
   ofertas demo. Al cargar datos reales, quita la variable (o `false`) y borra/archiva las ofertas demo
   desde el panel; el seed nunca borra ofertas.

   **Imágenes públicas (`STORAGE_PUBLIC_BASE_URL`)**: portadas, carrusel y fotos de docentes son de
   difusión. Recomendado: un bucket público aparte (Supabase: Storage → bucket público `eia-public`,
   `STORAGE_PUBLIC_BASE_URL=https://<ref>.supabase.co/storage/v1/object/public/eia-public`) o un CDN.
   Sin la variable, la API firma URLs de 7 días (funciona, pero no es cacheable y la URL cambia).
    La lista completa y documentada está en `.env.example`;
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

Reproduce el arranque de producción contra una BD **vacía** del Postgres de `docker compose`:

```bash
docker build -t eia-backend .
docker compose exec postgres psql -U eia -d postgres -c 'DROP DATABASE IF EXISTS eia_prodcheck' -c 'CREATE DATABASE eia_prodcheck'
printf 'NODE_ENV=production\nDATABASE_URL=postgresql://eia:eia@postgres:5432/eia_prodcheck?connect_timeout=30\nJWT_ACCESS_SECRET=%s\nMAIL_DRIVER=console\nSEED_DEMO_DATA=true\n' "$(openssl rand -hex 24)" > /tmp/eia.env
docker run --rm --name eia-prodcheck --network itinerantes-backend_default --env-file /tmp/eia.env -p 3100:3000 eia-backend
# Debe mostrar: migrate deploy → seed (23 países, 32 estados, 2,478 municipios, ofertas demo) → arranque.
curl http://localhost:3100/api/v1/health/ready
curl http://localhost:3100/api/v1/locations/countries
curl http://localhost:3100/api/v1/offers
```

Si la migración falla (p. ej. `DATABASE_URL` inválida o BD inaccesible), el contenedor termina con
código ≠ 0 sin levantar la API. Prisma espera 5 s por defecto para conectar: si la BD tarda en
responder (arranque en frío, red privada recién creada), agrega `?connect_timeout=30` a la URL.

## 6. Operación

- **Logs**: JSON (pino) con `requestId`; el cliente recibe el mismo id en `X-Request-Id` y en los errores.
- **Rollback**: Railway → Deployments → "Redeploy" de una versión anterior. Las migraciones de Prisma no
  se revierten solas: diseña migraciones compatibles hacia atrás (agregar antes de quitar).
- **Rate limit** detrás del proxy de Railway: `trust proxy` está activado para usar la IP real.
