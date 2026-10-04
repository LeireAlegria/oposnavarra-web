# Spec 001 — Project Bootstrap

## 1. Objetivo

Crear la base técnica del repositorio único de OposNavarra sobre la que se desarrollarán las siguientes funcionalidades.

Al finalizar esta spec debe existir una aplicación Next.js funcional, ejecutable localmente y preparada para utilizar el stack definido en `docs/constitution.md`.

Esta spec no implementa funcionalidades de negocio.

---

## 2. Alcance

Esta spec incluye:

- inicialización de Next.js;
- configuración de TypeScript;
- configuración de Tailwind CSS;
- configuración de shadcn/ui;
- instalación y configuración de React Hook Form;
- instalación y configuración de Zod;
- instalación del cliente de Supabase;
- estructura inicial del proyecto;
- configuración de variables de entorno;
- configuración de lint y formato;
- configuración de tests;
- página inicial mínima;
- documentación mínima para ejecutar el proyecto localmente.

---

## 3. Fuera de alcance

Esta spec no debe implementar:

- modelo de datos de OposNavarra;
- migraciones de negocio;
- tablas de PostgreSQL;
- políticas RLS;
- autenticación;
- registro o login;
- gestión de usuarios;
- catálogo de tests;
- realización de tests;
- resultados;
- progreso del usuario;
- panel de administración;
- pagos o suscripciones;
- aplicación móvil;
- backend/API independiente;
- Supabase Edge Functions;
- despliegue en producción.

Estas funcionalidades se introducirán mediante specs posteriores.

---

## 4. Stack

La aplicación debe utilizar:

- Next.js;
- React;
- TypeScript;
- Tailwind CSS;
- shadcn/ui;
- React Hook Form;
- Zod;
- Supabase JavaScript Client.

Se utilizará Node.js como entorno de ejecución.

No introducir frameworks o librerías alternativas para resolver responsabilidades ya cubiertas por este stack.

---

## 5. Next.js

Crear una aplicación Next.js utilizando:

- App Router;
- TypeScript;
- carpeta `src/`;
- Tailwind CSS;
- alias `@/*`.

La aplicación debe poder ejecutarse mediante:

```bash
npm run dev
```

y generar correctamente un build de producción mediante:

```bash
npm run build
```

No utilizar Pages Router.

---

## 6. TypeScript

TypeScript debe utilizar configuración estricta.

Debe estar habilitado:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

El proyecto no debe contener errores TypeScript al finalizar la spec.

Evitar `any` salvo que exista una justificación explícita.

---

## 7. UI

### 7.1. Tailwind CSS

Tailwind CSS debe estar configurado y operativo.

Los estilos de la aplicación deben utilizar Tailwind como solución principal.

### 7.2. shadcn/ui

Inicializar shadcn/ui siguiendo su configuración recomendada para Next.js.

Añadir únicamente los componentes necesarios para validar que la integración funciona.

Como mínimo debe existir:

```text
Button
```

No instalar anticipadamente una colección completa de componentes.

Los componentes incorporados mediante shadcn/ui deben quedar dentro del repositorio.

---

## 8. Formularios y validación

Instalar y dejar disponibles:

- React Hook Form;
- Zod;
- integración entre ambos cuando sea necesaria.

No es necesario implementar un formulario real de negocio en esta spec.

No crear abstracciones genéricas de formularios anticipadamente.

---

## 9. Supabase

Instalar el cliente oficial de Supabase para JavaScript/TypeScript.

Preparar la configuración mínima necesaria para que futuras specs puedan utilizar Supabase.

La configuración debe obtenerse mediante variables de entorno.

Como mínimo contemplar:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Si la versión actual del SDK o configuración oficial utiliza una nomenclatura diferente para alguna clave pública, seguir la recomendación oficial vigente y reflejarla en `.env.example`.

No incluir credenciales reales en Git.

Crear:

```text
.env.example
```

con los nombres de las variables necesarias y valores vacíos o claramente ficticios.

Los archivos locales con secretos deben estar ignorados por Git.

No utilizar ni configurar `service_role` en código cliente.

---

## 10. Supabase CLI

Preparar el repositorio para gestionar Supabase mediante su CLI.

La estructura esperada es:

```text
supabase/
├── config.toml
└── migrations/
```

La carpeta `migrations/` puede permanecer vacía en esta spec.

No crear todavía tablas ni migraciones del dominio.

Las migraciones comenzarán en la spec dedicada a la base de datos.

---

## 11. Estructura inicial

La estructura debe aproximarse a:

```text
oposnavarra/
├── AGENTS.md
├── docs/
│   └── constitution.md
│
├── specs/
│   └── 001-project-bootstrap/
│       └── spec.md
│
├── src/
│   ├── app/
│   ├── components/
│   │   └── ui/
│   └── lib/
│
├── supabase/
│   ├── config.toml
│   └── migrations/
│
├── public/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── ...
```

No crear carpetas destinadas a funcionalidades que todavía no existen.

La estructura debe crecer cuando las specs posteriores lo requieran.

---

## 12. Página inicial

La ruta:

```text
/
```

debe renderizar una página mínima que confirme que la aplicación funciona.

Debe mostrar:

```text
OposNavarra
```

y un texto breve indicando que la aplicación está en desarrollo.

No diseñar todavía la landing page definitiva.

La página debe utilizar al menos un componente de shadcn/ui para verificar que la integración funciona correctamente.

---

## 13. Calidad de código

El proyecto debe disponer de comandos para:

```bash
npm run dev
npm run build
npm run lint
npm run format
npm test
```

`package.json` es la fuente de verdad para estos comandos.

### 13.1. Lint

Configurar ESLint de forma compatible con Next.js y TypeScript.

El proyecto debe finalizar sin errores de lint.

### 13.2. Formato

Configurar una herramienta de formato adecuada para TypeScript, React y los archivos habituales del proyecto.

No duplicar reglas de formato innecesariamente entre ESLint y el formatter.

### 13.3. Tests

Configurar una solución de tests compatible con Next.js y React.

Debe existir al menos un test sencillo que valide que la infraestructura de tests funciona.

Esta spec no requiere cobertura significativa.

El objetivo es evitar que una spec posterior tenga que introducir desde cero la infraestructura de testing.

---

## 14. README

Crear o actualizar `README.md` con instrucciones mínimas para:

1. instalar dependencias;
2. configurar las variables de entorno;
3. arrancar la aplicación;
4. ejecutar lint;
5. ejecutar tests;
6. generar el build.

No documentar todavía funcionalidades futuras.

---

## 15. Seguridad

Durante esta spec:

- no incluir secretos en Git;
- no utilizar credenciales de producción;
- no exponer claves privadas;
- no utilizar `service_role` en el navegador;
- no desactivar controles de seguridad para facilitar el desarrollo.

Las variables `NEXT_PUBLIC_*` deben contener exclusivamente valores que puedan ser expuestos al navegador.

---

## 16. Criterios de aceptación

La spec se considera completada cuando:

- [ ] Existe una única aplicación Next.js.
- [ ] Utiliza App Router.
- [ ] Utiliza TypeScript en modo estricto.
- [ ] Tailwind CSS funciona correctamente.
- [ ] shadcn/ui está inicializado.
- [ ] Existe al menos un componente `Button` de shadcn/ui.
- [ ] React Hook Form está instalado.
- [ ] Zod está instalado.
- [ ] El cliente de Supabase está instalado.
- [ ] Existe `.env.example`.
- [ ] No existen secretos versionados.
- [ ] El repositorio está preparado para Supabase CLI.
- [ ] Existe `supabase/config.toml`.
- [ ] Existe `supabase/migrations/`.
- [ ] No existen todavía migraciones de negocio.
- [ ] `/` renderiza correctamente.
- [ ] La página inicial utiliza al menos un componente de shadcn/ui.
- [ ] Existe infraestructura básica de tests.
- [ ] Existe al menos un test funcional.
- [ ] `npm run lint` termina correctamente.
- [ ] `npm test` termina correctamente.
- [ ] `npm run build` termina correctamente.
- [ ] No existen errores TypeScript.
- [ ] README contiene las instrucciones mínimas de desarrollo local.

---

## 17. Resultado esperado

Al finalizar esta spec debe existir un repositorio limpio y funcional que permita comenzar la implementación de OposNavarra sin tener que volver a configurar infraestructura básica.

El siguiente desarrollo podrá centrarse en el dominio y la base de datos, no en configurar herramientas.

La aplicación resultante todavía no constituye un producto funcional para usuarios finales.
