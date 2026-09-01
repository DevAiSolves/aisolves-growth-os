# Despliegue a producción

## 1. Base de datos

SQLite está bien para desarrollo, no para producción (sin escrituras
concurrentes, sin réplicas). Cambia dos líneas:

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"   // era "sqlite"
  url      = env("DATABASE_URL")
}
```

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
npx prisma migrate deploy
npm run db:seed
```

El esquema no usa tipos `Json`, `enum` ni arrays, así que el cambio de proveedor
no requiere ninguna otra modificación.

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

Cualquier plataforma que ejecute Node. En Vercel:

```bash
npm i -g vercel
vercel --prod
```

`npm run build` ya ejecuta `prisma generate`, así que el cliente de Prisma se
construye en cada despliegue.

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
