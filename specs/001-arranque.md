# Spec 001 — Arranque del frontend web

## Estado

Propuesta · 25-09-2026

## Contexto

OposNavarra Web necesita una base ejecutable para desarrollar la presentación pública de la plataforma de tests, el área del opositor y el panel de administración. El backend y la app móvil viven en repositorios separados. Esta spec establece la estructura y las verificaciones iniciales sin adelantar funcionalidades de producto ni inventar contratos de la API.

Antes de implementar, leer `AGENTS.md` y `docs/constitution.md`.

## Objetivo

Crear un proyecto Next.js con App Router, React y TypeScript estricto que pueda ejecutarse localmente, compilarse y servir de base a las próximas specs. Debe tener navegación inicial, manejo básico de errores y una frontera clara para consumir la API del backend.

## Alcance

### Incluido

1. Inicializar el proyecto con Next.js, App Router, TypeScript, npm y ESLint. Fijar versiones compatibles de Node.js y dependencias en los archivos del repositorio y guardar el lockfile. No depender de versiones flotantes en CI.
2. Definir scripts `dev`, `build`, `start`, `lint`, `typecheck` y `test` en `package.json`. `npm test` debe terminar con éxito en un proyecto recién creado; no aceptar un script que ignore fallos o use `exit 0` para simular pruebas.
3. Configurar TypeScript estricto, alias de importación para el código fuente y una convención de organización: rutas en `src/app`, componentes compartidos en `src/components`, cliente HTTP y configuración en `src/lib`, y tipos comunes en `src/types` cuando hagan falta. Evitar carpetas vacías creadas solo para anticipar funcionalidades.
4. Crear un layout raíz en español (`lang="es"`) con título y descripción del proyecto, enlace a inicio y navegación accesible. Incluir una página de inicio pública mínima que presente OposNavarra como plataforma de tests y ofrezca una entrada visible a «Acceder», sin fingir que el registro ya funciona.
5. Definir las rutas de referencia `/`, `/acceder`, `/app` y `/admin`. Hasta que las specs correspondientes las implementen, las rutas pendientes deben mostrar un estado honesto de «Próximamente» o no ser navegables; no usar formularios o datos simulados que aparenten funcionar. La selección de oposición será parte del flujo de tests y se concretará en una spec posterior.
6. Añadir una pantalla de página inexistente y un límite de error recuperable para fallos de renderizado, con mensajes comprensibles en español. No exponer trazas técnicas al usuario.
7. Crear la configuración de URL base de la API mediante una variable de entorno documentada y validada. Centralizar un cliente HTTP preparado para peticiones JSON, códigos de error y cancelación; no codificar endpoints de negocio ni credenciales hasta disponer del contrato.
8. Documentar en `README.md` requisitos, instalación, variables de entorno, comandos y relación con el backend. Incluir `.env.example` sin valores secretos y excluir los archivos locales de entorno del control de versiones.
9. Configurar una base de pruebas automatizadas para utilidades y componentes con Vitest y React Testing Library. Incluir al menos una prueba útil sobre un comportamiento observable de la base creada, por ejemplo la navegación o la gestión de un error HTTP.

### Fuera de alcance

- Registro, confirmación de correo, inicio de sesión y autorización real.
- Selección de oposición para practicar, exámenes, preguntas, ejecución de tests, historial y puntuación.
- Importación CSV/ZIP, carga de imágenes y panel administrativo funcional.
- Base de datos, migraciones, endpoints nuevos, proxy de negocio o cambios en el backend.
- Pagos, analítica, notificaciones y publicación en producción.

## Decisiones técnicas de esta spec

- Usar npm y entregar `package-lock.json`. Fijar en el arranque una versión LTS de Node.js compatible con la versión de Next.js elegida; registrar el rango en `package.json` y la versión de desarrollo en un archivo de configuración del runtime, como `.nvmrc`.
- Instalar versiones estables compatibles al implementar la spec y fijarlas mediante lockfile. Registrar en el PR las versiones finalmente elegidas; esta spec no depende de un número concreto que pueda quedar obsoleto.
- Mantener páginas y layouts de App Router como componentes de servidor por defecto; introducir componentes cliente solo donde haya interacción o APIs del navegador.
- La URL de la API debe estar disponible únicamente en el entorno que la consuma. Si se decide llamar a la API desde el navegador, documentar explícitamente qué variable pública se usa y confirmar que no contiene secretos. No asumir un mecanismo de sesión antes de definir su contrato.
- No usar caché compartida para información privada cuando se implementen las áreas autenticadas. La política concreta de caché y autenticación se definirá en su spec.

## Comportamiento esperado

### Desarrollo local

1. La persona desarrolladora instala dependencias con `npm ci` y configura el entorno a partir de `.env.example`.
2. `npm run dev` levanta la web y `/` muestra la página pública inicial en español.
3. Las rutas aún no desarrolladas comunican su estado sin mostrar información inventada ni producir errores de compilación.
4. Ante un error de conexión o una respuesta HTTP fallida, el cliente HTTP devuelve una representación tratable por la interfaz sin filtrar credenciales ni volcar datos privados en consola.

### Errores y estados

- Una URL inexistente muestra una página 404 con forma de volver a inicio.
- Un fallo inesperado en una sección muestra una pantalla recuperable que permite reintentar o volver a inicio.
- Si falta una variable de entorno necesaria para una operación, el fallo debe ser explícito para desarrollo; no construir URLs inválidas ni mostrar detalles internos al usuario final.

## Criterios de aceptación

- [ ] El repositorio contiene Next.js con App Router, React, TypeScript estricto y configuración de ESLint; las versiones de runtime y dependencias quedan fijadas y documentadas.
- [ ] `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` terminan correctamente en un entorno limpio con la configuración documentada.
- [ ] La página `/` tiene `lang="es"`, título, descripción y navegación usable por teclado; se visualiza correctamente en ancho móvil y de escritorio.
- [ ] Las rutas previstas existen como estado pendiente explícito o sus enlaces están desactivados de manera accesible; ninguna simula autenticación, tests o administración funcional.
- [ ] Las páginas 404 y error muestran mensajes en español y una acción de recuperación.
- [ ] La configuración de la API está centralizada y documentada, sin URLs de producción ni secretos incrustados en el código. El cliente HTTP trata respuestas no satisfactorias y permite cancelar peticiones.
- [ ] `.env.example` y `README.md` permiten reproducir el arranque; los archivos locales con secretos están ignorados.
- [ ] Existe al menos una prueba automatizada sobre comportamiento observable y falla si ese comportamiento se rompe.

## Dependencias y preguntas para specs posteriores

- Contrato de autenticación: proveedor, cookies o tokens, confirmación de correo, expiración de sesión y recuperación de contraseña.
- Contrato y URL por entorno de la API; formato de errores, paginación y política de CORS si hay llamadas desde el navegador.
- Diseño visual y componentes de interfaz definitivos.
- Política de despliegue y variables de entorno de cada entorno.

Estas dependencias no bloquean el bootstrap; sí bloquean presentar como funcionales las rutas que las necesitan.

## Verificación al cerrar la spec

Ejecutar todos los comandos de los criterios de aceptación. Abrir la página inicial, las rutas previstas, una URL inexistente y el estado de error; revisar móvil, escritorio y navegación con teclado. Registrar resultados y cualquier dependencia pendiente del backend.
