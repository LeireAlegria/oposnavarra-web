AGENTS.md — OposNavarra

Proyecto

OposNavarra es una plataforma para practicar tests de oposiciones de Navarra. El repositorio único contiene la aplicación web Next.js y la configuración de Supabase. La aplicación móvil, si se desarrolla, será un cliente independiente. Las funcionalidades de negocio se implementarán únicamente cuando exista una spec activa.

Las versiones de Next.js, TypeScript y Node.js se fijarán en la spec de arranque y en los archivos de configuración del repositorio. Se usará npm como gestor de paquetes.

Comandos

Ejecutar: npm run dev

Tests: npm test

Lint: npm run lint

Formato: npm run format

Compilación: npm run build

Comprobación de tipos: npm run typecheck

Estilo y convenciones

Usar TypeScript con comprobación estricta. Concretar su versión en la spec de arranque.

Seguir las convenciones de Next.js App Router para rutas, layouts y componentes de servidor y cliente; usar componentes cliente cuando la interacción lo requiera.

Nombrar componentes y tipos en PascalCase, funciones y variables en camelCase, y constantes globales en UPPER_SNAKE_CASE.

Escribir identificadores, nombres de archivos y comentarios técnicos en inglés. Mantener en español los textos visibles al usuario y los mensajes de validación de la interfaz.

Dar nombres que describan el dominio: opposition, exam, question, attempt y topic; mantener un vocabulario consistente con las specs y el esquema de datos.

Diseñar la interfaz adaptable a móvil y accesible con teclado, etiquetas visibles y mensajes de error comprensibles.

Reglas

Leer docs/constitution.md y la spec activa antes de tocar código. Si alguno no existe todavía, indicarlo y no inventar sus requisitos.

No inventar modelos, reglas de negocio ni estados fuera de la spec activa.

Centralizar la creación del cliente Supabase y el acceso a datos. Las futuras políticas RLS deben ser la frontera de autorización; nunca incluir claves privadas ni la clave `service_role` en el cliente.

Proteger las operaciones de tests y administración mediante las políticas de acceso definidas en Supabase; no considerar suficiente ocultar botones en la interfaz.

No incluir claves privadas ni secretos en el código del cliente. No almacenar respuestas correctas antes de entregar un test salvo que el contrato y la spec lo requieran expresamente.

No añadir dependencias, servicios externos, analítica, pagos ni funcionalidades fuera de la spec activa sin acordarlo primero.

Mantener las migraciones de Supabase dentro de `supabase/migrations/`. No añadir migraciones de dominio antes de su spec.

Al terminar cualquier tarea

Ejecutar lint y las pruebas disponibles, además de la compilación de producción cuando exista el script correspondiente.

Comprobar manualmente el flujo afectado y sus estados de carga, vacío y error; revisar la vista en ancho móvil y escritorio cuando cambie la interfaz.

Informar de los cambios, las verificaciones ejecutadas y las limitaciones o dependencias pendientes. Si un comando todavía no existe, señalarlo expresamente.
