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

La configuración local está en `supabase/config.toml` y las migraciones se guardan en `supabase/migrations/`. No hay migraciones de dominio en esta fase. La aplicación usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example`.
