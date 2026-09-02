# Despliegue a producción

## 1. Base de datos

El esquema ya es PostgreSQL. Necesitas una instancia gestionada.

**Vercel + Neon (lo más rápido, tiene free tier):**
Vercel dashboard → tu proyecto → **Storage** → **Create Database** → **Neon**.
Vercel inyecta `DATABASE_URL` y `DATABASE_URL_UNPOOLED` automáticamente.
Añade a mano `DIRECT_URL` con el mismo valor que `DATABASE_URL_UNPOOLED`.

**Cualquier otro Postgres (Supabase, RDS, Railway):**

```bash
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"
```

`DATABASE_URL` es la cadena **pooled** que usa la app en runtime.
`DIRECT_URL` es la **directa**, y sirve solo para migraciones: Prisma no puede
correr DDL a través de un pooler en modo transacción.

Aplica el esquema una vez:

```bash
DATABASE_URL="<directa>" DIRECT_URL="<directa>" npx prisma migrate deploy
npm run db:seed
```

> **Volumen de eventos.** La tabla `Event` crece rápido: cuenta ~200-400 filas
> por visitante interesado. Con tráfico significativo, particiona por
> `occurredAt` o mueve los eventos de más de 90 días a almacenamiento frío. Los
> agregados de `Visitor` ya están denormalizados, así que el dashboard no
> depende de retener el stream completo.

## 2. Variables de entorno

```bash
npx auth secret          # genera AUTH_SECRET
```

Copia `.env.example` y rellena. Mínimo imprescindible para producción:

| Variable | Necesaria para |
|---|---|
| `DATABASE_URL` | Todo |
| `AUTH_SECRET` | Sesiones |
| `NEXT_PUBLIC_SITE_URL` | URLs canónicas, `event_source_url` del CAPI |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Login con Google |
| `ADMIN_EMAILS` | Acceso al dashboard de agencia |
| `META_PIXEL_ID` / `META_CAPI_TOKEN` | Conversions API |

## 3. OAuth

**Google** — <https://console.cloud.google.com> → APIs & Services → Credentials →
OAuth client ID (Web).
Redirect URI: `https://TU-DOMINIO/api/auth/callback/google`

**Facebook** — <https://developers.facebook.com> → tu app → Facebook Login →
Settings.
Redirect URI: `https://TU-DOMINIO/api/auth/callback/facebook`

### Permisos de activos (etapa 2)

Los scopes de `business_management`, `ads_read` y Google Business Profile
requieren **revisión de la app** en cada plataforma. Están comentados en
`src/lib/auth.ts`; descoméntalos cuando la revisión esté aprobada.

Mientras tanto el flujo de onboarding registra la *solicitud* y el acceso se
completa por invitación de partner desde el Business Manager del cliente — que es
como opera cualquier agencia seria de todos modos: el cliente conserva la
propiedad de sus activos.

## 4. Píxeles

1. Meta Events Manager → tu píxel → Settings → *Generate access token*.
2. Prueba con `META_TEST_EVENT_CODE` y la pestaña **Test Events**.
3. **Borra `META_TEST_EVENT_CODE` antes de ir a producción.** Con esa variable
   puesta, los eventos se quedan en la pestaña de test y **nunca llegan al
   optimizador**. Es el fallo silencioso más caro de esta integración.
4. Confirma en Events Manager que aparecen como *Browser + Server* en una sola
   fila (deduplicación correcta), no como dos filas separadas.

## 5. Despliegue

El proyecto de Vercel está enlazado al repo de GitHub: cada push a `main`
despliega solo. `npm run build` ejecuta `prisma generate`, así que el cliente de
Prisma se reconstruye en cada despliegue.

**Las migraciones NO corren en el build a propósito.** Un `migrate deploy`
automático puede aplicar DDL destructivo a producción durante un despliegue
rutinario. Se ejecuta a mano tras cambiar el esquema:

```bash
DATABASE_URL="<directa>" npx prisma migrate deploy
```

### Checklist post-despliegue

- [ ] `DATABASE_URL` y `DIRECT_URL` puestas en Vercel
- [ ] `AUTH_SECRET` generado con `npx auth secret`
- [ ] `NEXT_PUBLIC_SITE_URL` con el dominio real (lo usa `event_source_url` de CAPI)
- [ ] Callbacks OAuth actualizados al dominio de producción
- [ ] `ADMIN_EMAILS` con tu email o no podrás entrar al dashboard
- [ ] `META_TEST_EVENT_CODE` **borrada**

### Cabeceras

`next.config.ts` fija `Cache-Control: no-store` en `/api/*` — el colector nunca
debe cachearse — más `X-Frame-Options`, `X-Content-Type-Options` y
`Referrer-Policy`.

## 6. Verificación post-despliegue

```bash
# El colector responde y puntúa
curl -X POST https://TU-DOMINIO/api/track \
  -H 'Content-Type: application/json' \
  -d '{"anonId":"test-anon-id-123","sessionId":"test-session-123",
       "events":[{"eventId":"11111111-1111-4111-8111-111111111111",
                  "name":"page.view","category":"page","weight":1,
                  "occurredAt":'"$(date +%s000)"',"path":"/","metadata":{}}],
       "consent":{"granted":true,"analytics":true,"ads":true,"personalization":true}}'
```

Debe devolver `{"ok":true,"accepted":1,"score":...,"temperature":"COLD",...}`.

Después, en el navegador: scroll → gate → aceptar → final → widget → enviar. Y
comprobar que el lead aparece en `/dashboard/admin`.
