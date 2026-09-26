# Constitución — OposNavarra Web

## 1. Propósito y alcance

OposNavarra Web es una plataforma de práctica de tests para oposiciones de Navarra. Su finalidad es que el opositor configure tests, haga exámenes oficiales, guarde intentos, consulte resultados y repase sus respuestas. La web tiene una presentación pública del servicio y un panel para administrar las preguntas y los exámenes; no es un buscador ni un portal informativo de convocatorias. El repositorio contiene exclusivamente el frontend web en Next.js, React y TypeScript. La API y la aplicación móvil son proyectos independientes.

Esta constitución fija reglas duraderas. Cada funcionalidad debe estar definida en una spec antes de implementarse; las decisiones técnicas con consecuencias duraderas se documentan en `docs/adr/`.

## 2. Fuente de verdad y límites

- El backend es la fuente de verdad para usuarios, permisos, oposiciones, convocatorias, temas, exámenes, preguntas, intentos y resultados.
- El frontend consume contratos explícitos de la API. No consulta ni modifica directamente las tablas de la base de datos ni duplica las reglas de negocio como autoridad.
- Las notas, penalizaciones, estados de publicación, selección de preguntas y transiciones de un intento se calculan o validan en el backend. La web puede mostrar cálculos orientativos únicamente si la spec lo define y los identifica como tales.
- Si el contrato necesario no existe o es ambiguo, documentar la dependencia y acordar el cambio con el repositorio del backend antes de improvisar endpoints o estructuras.

## 3. Acceso y protección de datos

- La parte pública explica qué ofrece OposNavarra y qué oposiciones cuentan con tests. Su navegación debe conducir al registro y al inicio de sesión. Configurar y realizar tests, consultar intentos y acceder al panel requiere autenticación. El correo debe estar confirmado antes de iniciar un test.
- Solo la cuenta con permisos de administración puede acceder a las operaciones del panel. Las restricciones visuales de la web no sustituyen la autorización de la API.
- Mantener los secretos en el servidor y exponer al navegador únicamente la configuración pública indispensable. No incluir claves privadas, credenciales ni datos sensibles en el código cliente, el historial del repositorio o los registros.
- No enviar al navegador respuestas correctas de un intento activo cuando ello permita conocer la solución antes de entregarlo. Mostrar soluciones y nota tras la finalización autorizada por el backend.
- Tratar los datos personales de forma mínima y evitar guardar información de sesión o respuestas en almacenamiento persistente del navegador salvo decisión documentada y justificada.

## 4. Experiencia del opositor

- La web debe ser usable con teclado, lectores de pantalla y tamaños de pantalla habituales de móvil y escritorio. Formularios, estados y errores tendrán etiquetas y mensajes comprensibles en español.
- Un test en curso se guarda en el backend y puede retomarse desde otro dispositivo. Salir del test y entregarlo son acciones distintas. En la primera versión no hay límite de tiempo.
- En práctica se eligen uno o varios temas y una cantidad total de preguntas; no se filtra por convocatoria. Si hay preguntas relacionadas, se presentan con su contexto completo y se informa del número definitivo antes de empezar.
- Antes de entregar, se informa de las preguntas sin contestar. Después se muestran aciertos, fallos, blancos, nota, regla de penalización aplicada y revisión de respuestas.
- En exámenes oficiales se aplica la penalización configurada para la convocatoria; sin configuración, cada fallo resta un tercio del valor de un acierto. Los tests de práctica aplican esa regla general de un tercio.
- Las operaciones de guardar, entregar y retomar deben mostrar estados de carga, éxito y error sin hacer creer al usuario que una respuesta se guardó cuando la API no lo confirmó.

## 5. Administración y publicación

- La primera versión contempla una sola cuenta administradora. No introducir roles adicionales sin una spec.
- Los exámenes se importan mediante un ZIP con CSV e imágenes referenciadas por nombre de archivo; la respuesta correcta se incluye en el CSV. El panel ofrece archivos de ejemplo, valida el paquete y permite revisar una vista previa con errores antes de confirmar.
- Las preguntas importadas quedan en revisión. Solo las preguntas activas y publicadas pueden incorporarse a nuevos tests de práctica. La previsualización debe mostrar el contenido como lo verá el opositor.
- La importación no debe dar por publicada ninguna pregunta automáticamente ni informar de éxito parcial como si fuera una operación completa. El comportamiento ante errores y duplicados se define en la spec de importación y en el contrato de la API.

## 6. Arquitectura del frontend

- Usar Next.js con App Router y TypeScript estricto. Emplear componentes de servidor y de cliente según las necesidades de datos e interacción de cada pantalla.
- Centralizar el acceso HTTP, los tipos de contrato, la sesión y la traducción de errores de la API a mensajes de interfaz.
- Mantener separadas la navegación pública, el área del opositor y el panel de administración; compartir componentes cuando su comportamiento sea realmente común.
- Evitar dependencias o servicios externos que no respondan a una necesidad descrita en la spec. Registrar en un ADR las decisiones que condicionen varias funcionalidades o sean difíciles de revertir.
- No asumir que el renderizado del servidor, la caché o la navegación del cliente sustituyen una autorización del backend. Los datos privados no deben aparecer en contenido público ni en cachés compartidas.

## 7. Calidad y entrega

- Cada spec incluirá comportamiento observable, estados de error y criterios de aceptación. Cubrir con pruebas los flujos y reglas que puedan fallar de forma significativa; evitar pruebas que solo repitan detalles internos.
- Antes de cerrar una tarea, ejecutar las verificaciones disponibles de tipos, lint, pruebas y compilación. Comprobar manualmente los flujos afectados en móvil y escritorio y con navegación por teclado cuando cambie la interfaz.
- Mantener textos visibles en español, claros y consistentes. No mostrar identificadores internos, errores técnicos o trazas al usuario final.
- Documentar las dependencias del backend, limitaciones conocidas y verificaciones no ejecutadas. No declarar terminada una funcionalidad si sus criterios de aceptación dependen de una API aún inexistente.

## 8. Precedencia y cambios

En caso de conflicto, aplicar las instrucciones del usuario, esta constitución, los ADR vigentes, la spec activa y después las convenciones locales del código. Un cambio de una regla de esta constitución requiere actualizar el documento y revisar las specs y ADR afectados antes de implementar comportamiento incompatible.
