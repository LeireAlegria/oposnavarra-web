# OposNavarra Web

Frontend web de la plataforma OposNavarra, desarrollado con Next.js, React y TypeScript en App Router. Este proyecto proporciona la base ejecutable para la presentación pública, el acceso inicial y las áreas pendientes de desarrollo futuro.

## Objetivo del proyecto

La web sirve como capa de presentación para la plataforma de preparación de oposiciones de Navarra. En esta primera fase se deja una estructura base con:

- layout raíz en español
- navegación principal accesible
- página pública de inicio
- rutas de referencia para acceso, área del opositor y administración
- páginas de error y 404 con mensajes comprensibles
- cliente HTTP centralizado para consumir la API del backend
- pruebas automatizadas básicas con Vitest y Testing Library

No se incluyen todavía flujos reales de autenticación, tests o administración funcional; esas partes se dejarán para specs posteriores.

## Requisitos

- Node.js 20.9 o superior
- npm

## Instalación

1. Abre una terminal en la carpeta del proyecto.
2. Instala dependencias:

```bash
npm install
```

3. Copia el ejemplo de variables de entorno:

```bash
cp .env.example .env.local
```

4. Ajusta las variables necesarias para tu entorno local. En esta fase inicial la variable pública de la API queda documentada en `.env.example`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
```

## Variables de entorno

El proyecto usa la variable pública:

```env
NEXT_PUBLIC_API_BASE_URL=
```

Se deja vacía por defecto para evitar incrustar URLs de producción o secretos en el código. Cuando el backend esté disponible, se debe completar con la URL correcta del entorno de consumo.

## Estructura principal

- `src/app` — rutas, layouts y páginas de App Router
- `src/components` — componentes reutilizables
- `src/lib` — cliente HTTP y utilidades
- `src/types` — tipos compartidos cuando haga falta
- `specs/` — especificaciones del proyecto

## Desarrollo local

```bash
npm run dev
```

Y abre la URL mostrada por Next.js, normalmente:

- http://localhost:3000

## Validación

La base del proyecto debe poder ejecutarse con la validación mínima de la spec:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Relación con el backend

Este repositorio es independiente del backend. La comunicación con la API se centraliza en la librería HTTP del frontend para evitar duplicación y facilitar el manejo de errores y cancelación de peticiones.

## Estado actual

El proyecto está en fase de arranque inicial y se usa como base para las siguientes specs de funcionalidad de la aplicación.
