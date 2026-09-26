# AGENTS.md — OposNavarra Web

## Proyecto

OposNavarra Web es una plataforma para practicar tests de oposiciones de Navarra desde el navegador. Incluye una página pública que explica el servicio, un área de opositores registrados para configurar, realizar, retomar y revisar tests, y un panel de administración para gestionar e importar preguntas y exámenes. Se desarrolla con Next.js, React, TypeScript y App Router; es un proyecto separado del backend y de la app móvil, consume la API del backend mediante HTTP y no accede directamente a la base de datos.

Las versiones de Next.js, TypeScript y Node.js se fijarán en la spec de arranque y en los archivos de configuración del repositorio. Se usará npm como gestor de paquetes.

## Comandos

- Ejecutar: `npm run dev`
- Tests: `npm test`
- Lint/formato: `npm run lint`
- Compilación: `npm run build`

Estos scripts se establecerán en la spec de arranque. Hasta entonces, comprobar `package.json`; no dar por superada una verificación si el script aún no existe.

## Estilo y convenciones

- Usar TypeScript con comprobación estricta. Concretar su versión en la spec de arranque.
- Seguir las convenciones de Next.js App Router para rutas, layouts y componentes de servidor y cliente; usar componentes cliente cuando la interacción lo requiera.
- Nombrar componentes y tipos en `PascalCase`, funciones y variables en `camelCase`, y constantes globales en `UPPER_SNAKE_CASE`.
- Escribir identificadores, nombres de archivos y comentarios técnicos en inglés. Mantener en español los textos visibles al usuario y los mensajes de validación de la interfaz.
- Dar nombres que describan el dominio: `opposition`, `exam`, `question`, `attempt` y `topic`; mantener un vocabulario consistente con el contrato de la API.
- Diseñar la interfaz adaptable a móvil y accesible con teclado, etiquetas visibles y mensajes de error comprensibles.

## Reglas

- Leer `docs/constitution.md` y la spec activa antes de tocar código. Si alguno no existe todavía, indicarlo y no inventar sus requisitos.
- Respetar el contrato publicado del backend. No inventar rutas, campos, reglas de puntuación ni estados; documentar cualquier dependencia pendiente.
- Centralizar las llamadas HTTP, la gestión de sesión y el tratamiento de errores. No acceder directamente a las tablas de Supabase desde la interfaz.
- Proteger las rutas de tests y del panel de administración según los permisos definidos en el backend; no considerar suficiente ocultar botones en la interfaz.
- No incluir claves privadas ni secretos en el código del cliente. No almacenar respuestas correctas antes de entregar un test salvo que el contrato y la spec lo requieran expresamente.
- No añadir dependencias, servicios externos, analítica, pagos ni funcionalidades fuera de la spec activa sin acordarlo primero.
- No modificar el backend, sus migraciones ni el repositorio de la app móvil como parte de una tarea del frontend web.

## Al terminar cualquier tarea

- Ejecutar lint y las pruebas disponibles, además de la compilación de producción cuando exista el script correspondiente.
- Comprobar manualmente el flujo afectado y sus estados de carga, vacío y error; revisar la vista en ancho móvil y escritorio cuando cambie la interfaz.
- Informar de los cambios, las verificaciones ejecutadas y las limitaciones o dependencias pendientes. Si un comando todavía no existe, señalarlo expresamente.
