# OposNavarra

Aplicación de práctica de tests para oposiciones de Navarra. Este repositorio contiene la aplicación Next.js y la configuración de Supabase.

## Requisitos

- Node.js 20.9 o superior
- npm

## Instalación

```bash
npm install
```

En PowerShell, copia el ejemplo como archivo local:

```powershell
Copy-Item .env.example .env.local
```

Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para tu proyecto local. No pongas claves privadas ni `service_role` en variables `NEXT_PUBLIC_*`.

## Desarrollo

```bash
npm run dev
```

Abre la URL que indique Next.js, normalmente `http://localhost:3000`.

## Verificaciones

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run format` formatea los archivos fuente y configuración compatibles.

## Supabase

La configuración local está en `supabase/config.toml` y el esquema se mantiene mediante migraciones en `supabase/migrations/`.

Docker solo es necesario para levantar el stack local completo de Supabase:

```bash
npm run db:start
npm run db:reset
npm run db:test
```

También puedes trabajar sin Docker contra un proyecto Supabase dedicado para pruebas. Autentícate con `npx supabase login`, vincúlalo con `npx supabase link --project-ref <project-ref>`, aplica las migraciones con `npm run db:push` y ejecuta `npx supabase test db --linked`. No ejecutes estos tests contra producción.

Para un PostgreSQL externo, define `SUPABASE_DB_URL` como una URL de conexión y pásala a la CLI. En PowerShell:

```powershell
$env:SUPABASE_DB_URL = "postgresql://usuario:contraseña@host:5432/postgres?sslmode=require"
npm run db:test -- --db-url "$env:SUPABASE_DB_URL"
```

La URL contiene una contraseña: no la guardes en Git ni en `.env.example`. En CI, la autenticación remota puede usar `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` como secretos. Para el uso interactivo, la CLI puede solicitar autenticación y contraseña; no hacen falta variables de entorno de base de datos.

La aplicación web usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example`. Son valores públicos para el cliente web y no son necesarios para aplicar migraciones o probar la base de datos.
