# Mi camino — Recorrido de aprendizaje por convocatoria

Estado: propuesta lista para implementación.
Identificador funcional: `016-camino-jugable`.

## 1. Objetivo

Añadir a OposNavarra el apartado «Mi camino»: un recorrido visual por los temas de una convocatoria, con test cortos, retos progresivos, recompensas y desbloqueos. El usuario debe reconocer siempre dónde está, qué ha conseguido y cuál es su próximo objetivo.

La experiencia debe invitar a practicar durante unos minutos y volver para continuar aprendiendo. Completar el camino mide avance en este recorrido, no garantiza el dominio del temario ni una probabilidad de aprobar la oposición.

## 2. Alcance de la primera versión

- Un camino publicado por convocatoria, organizado por sus bloques y temas existentes.
- Una parada por tema y cuatro retos dentro de cada parada.
- Un repaso obligatorio al final de cada bloque.
- Desbloqueo secuencial, reintentos ilimitados y persistencia entre sesiones y dispositivos.
- Puntos de experiencia (XP), objetivo diario y racha de práctica.
- Preguntas del banco existente y reutilización del motor de test.
- Gestión administrativa de la configuración y publicación del camino.

No incluye clasificaciones, competición entre usuarios, premios semanales, monedas, vidas, compras de ventajas, notificaciones, preguntas generadas por IA ni integración de los retos entre amigos.

## 3. Acceso y convivencia con los test actuales

«Mi camino» aparece en la navegación de la plataforma de test. Requiere autenticación y suscripción activa, con la misma comprobación de acceso que los test actuales. La suscripción da acceso a todas las convocatorias disponibles.

El usuario elige una convocatoria y puede cambiar de camino sin perder sus avances. Al volver, se ofrece «Continuar» sobre el siguiente reto pendiente o el intento en curso.

Los bloqueos pertenecen exclusivamente al camino: los test libres mantienen la selección de temas existente. Sus resultados no desbloquean paradas ni otorgan XP en esta versión.

Al caducar la suscripción, el progreso y las recompensas permanecen. Se puede consultar el mapa y los resultados propios, pero no iniciar, reanudar ni finalizar intentos del camino hasta recuperar el acceso. La caducidad no debe marcar un intento como suspendido ni consumirlo.

## 4. Estructura y desbloqueos

El orden se obtiene de los bloques y temas asociados a la convocatoria; no se introduce una capa de «Oposición». Si el catálogo admite temas sin bloque, se muestran como un único tramo de temas, sin inventar una entidad de catálogo adicional.

1. El primer reto del primer tema está disponible desde el principio.
2. Superar un reto desbloquea el siguiente de esa parada.
3. Superar el cuarto reto completa el tema.
4. El tema siguiente se desbloquea al completar el anterior.
5. Al terminar el último tema de un bloque, se desbloquea su repaso; superarlo abre el bloque siguiente.
6. El repaso del último bloque completa el camino.

No se permiten saltos ni desbloqueos por XP. Un reto completado puede repetirse. Sus resultados posteriores nunca revocan un desbloqueo conseguido.

### Configuración inicial

| Reto | Preguntas | Condición | XP por primera superación |
| --- | ---: | --- | ---: |
| Primeros pasos | 5 | Finalizar y responder al menos una pregunta | 10 |
| Coge ritmo | 10 | Al menos 60 % de aciertos | 20 |
| Demuestra lo aprendido | 10 | Al menos 70 % de aciertos | 30 |
| Reto final del tema | 15 | Al menos 80 % de aciertos | 50 |
| Repaso de bloque | 15 | Al menos 80 % de aciertos | 75 |

Los valores son configurables por administradores antes de publicar. Los retos no tienen límite de tiempo en esta versión; se registra la duración y se muestra una estimación orientativa, sin prometer una duración exacta. No se añaden bonus de XP por tema o camino: las celebraciones son visuales.

Para los retos con umbral, el mínimo exigido es `ceil(numero_preguntas × porcentaje / 100)`. Los errores y las preguntas en blanco cuentan como no acertadas; no hay penalización adicional. Se muestra el mínimo antes de empezar. Primeros pasos debe describirse como una iniciación, sin sugerir que completarlo demuestra conocimientos.

## 5. Experiencia de usuario

### Mapa

- Recorrido vertical con paradas conectadas, agrupaciones de bloque y desplazamiento cómodo en móvil.
- Estados distinguibles mediante icono y texto: bloqueada, disponible y completada.
- Un intento en curso se indica en el reto correspondiente, sin crear un segundo sistema de desbloqueo.
- La parada actual se destaca y muestra su progreso, por ejemplo «2 de 4 retos».
- Una parada bloqueada explica qué falta para abrirla.
- Cabecera con convocatoria, temas completados, porcentaje de avance, XP, objetivo diario y racha.
- Botón principal «Continuar» que lleva directamente al próximo paso.

El porcentaje del camino es `retos obligatorios superados / retos obligatorios publicados × 100`, incluyendo los repasos. También se muestra «X de Y temas completados» como una medida distinta. No se utilizan preguntas respondidas o XP para calcular ese porcentaje.

### Dentro de una parada

Se muestran el título del tema, sus cuatro retos, su estado, el requisito de superación, mejor resultado y acción disponible. La secuencia debe sentirse clara, sin obligar a volver al mapa después de cada intento.

### Durante el test

Reutilizar el motor y los componentes existentes: una pregunta por pantalla, avance visible y navegación por preguntas. Guardar las respuestas para poder continuar tras recargar o cambiar de dispositivo. No revelar soluciones antes de finalizar. Antes de entregar con preguntas sin contestar, solicitar confirmación.

Salir conserva el intento. Se permite abandonarlo expresamente y empezar otro, sin penalización ni recompensa. Solo puede existir un intento en curso por usuario y camino.

### Resultado

Mostrar aciertos, errores, preguntas en blanco, duración, requisito y resultado obtenido. Permitir revisar respuestas y explicaciones disponibles.

- Si supera: celebración breve, XP recién obtenida y siguiente reto desbloqueado.
- Si no supera: mensaje útil, diferencia respecto al mínimo y botón «Reintentar».
- Si repite uno superado: resultado y mejor marca, sin otorgar otra vez la recompensa.
- Al completar tema, bloque o camino: celebración específica y acceso claro al siguiente paso o al repaso libre de retos completados.

No usar mensajes humillantes, esperas artificiales ni pérdida de progreso. Las animaciones deben respetar la preferencia de movimiento reducido. El mapa, los diálogos y los test deben ser utilizables con teclado y lector de pantalla; el color no será el único indicador.

## 6. Selección de preguntas y repaso

Se utiliza el banco existente. Cada intento fija sus preguntas y orden al crearse; reanudarlo no los vuelve a sortear. No se repite una pregunta dentro del mismo intento.

Los retos de tema seleccionan preguntas activas vinculadas al tema dentro de la convocatoria. Los reintentos priorizan preguntas no vistas recientemente y pueden reservar hasta el 30 % para preguntas falladas anteriormente en ese tema y camino; si no hay suficientes, completan con el resto. La ausencia de alternativas nunca impide reintentar y no se promete un cuestionario totalmente distinto.

El repaso de bloque incluye todos sus temas, al menos una pregunta por tema, repartiendo el resto de forma equilibrada y redistribuyendo si un tema no tiene suficientes preguntas elegibles. Su cantidad efectiva se configura al publicar y debe ser al menos el número de temas del bloque; se informa al usuario de la cantidad real.

No se reduce silenciosamente la cantidad de preguntas. Si faltan preguntas, el administrador debe ajustar la configuración antes de publicar. Si dejan de estar disponibles después, el reto muestra una incidencia de contenido y no se registra un suspenso.

No se almacena una copia del enunciado, siguiendo la decisión del historial de test. Se guardan referencias a preguntas y opciones, la respuesta elegida y el resultado corregido. Los resultados históricos permanecen estables aunque cambie el banco; la revisión usa el contenido actual y avisa si fue modificado. Las preguntas y opciones con intentos asociados se archivan en lugar de borrarse físicamente. Un intento con contenido modificado después de iniciarse se invalida sin penalizar y permite empezar otro; no revoca logros anteriores.

## 7. XP, objetivo diario y racha

La XP se obtiene únicamente en la primera superación de cada reto por usuario y camino. No concede acceso, ventajas académicas ni nuevas paradas por sí misma. Se muestra el total del camino actual; no hay niveles ni clasificación en esta versión.

El objetivo diario es finalizar un test del camino respondiendo al menos una pregunta, aunque no se supere. Un reintento válido también cuenta. Los intentos abandonados, invalidados o vacíos no cuentan. La XP y la actividad diaria se calculan por separado.

La racha cuenta días consecutivos con ese objetivo cumplido en cualquier camino. Solo se contabiliza una vez cada día y utiliza la fecha de finalización del servidor en `Europe/Madrid`. Al omitir un día, la racha actual se reinicia; no se pierden XP ni desbloqueos. Conservar también la mejor racha. Si hoy todavía no ha practicado, mostrar la racha vigente de ayer e invitar a mantenerla; tras un día completo sin actividad, mostrar cero.

## 8. Modelo de datos

Los nombres siguientes son propuestos. Antes de migrar, adaptar las referencias al esquema real y reutilizar las tablas del motor de test y del historial de la spec 007; no crear un historial paralelo.

### `caminos`

- `id`, `convocatoria_id`, `titulo`, `estado` (borrador, publicado, archivado).
- `created_at`, `published_at`.
- Como máximo un camino publicado por convocatoria.

### `camino_paradas`

- `id`, `camino_id`, `tipo` (tema, repaso_bloque), `orden`.
- `tema_id` para paradas de tema y `bloque_id` cuando corresponda.
- Un repaso referencia su bloque; los temas del bloque forman su ámbito.
- Orden único por camino y restricciones coherentes con el tipo.

### `camino_retos`

- `id`, `parada_id`, `orden`, `titulo`, `numero_preguntas`.
- `criterio_superacion` (finalizacion, porcentaje), `porcentaje_minimo`, `xp`.
- Orden único por parada; cantidades positivas, XP no negativa y porcentajes entre 0 y 100.

### Integración con intentos existentes

Añadir al intento una referencia opcional `camino_reto_id` y un origen que permita distinguir camino de test libre. Guardar el usuario, estado, fechas, preguntas y respuestas mediante las entidades existentes.

Persistir también la configuración de evaluación utilizada (cantidad, criterio, umbral y XP aplicable), el resultado, la condición de superado y las referencias/versiones de contenido necesarias para detectar cambios. Esto no supone copiar enunciados.

Estados necesarios: en curso, finalizado, abandonado e invalidado; mapearlos sobre los ya disponibles. Un intento finalizado es inmutable. Proteger con una restricción o mecanismo equivalente la unicidad del intento en curso por usuario y camino.

### `camino_retos_progreso`

- `usuario_id`, `reto_id`, clave única conjunta.
- `primer_intento_superado_id`, `superado_at`, `mejor_porcentaje`, `ultimo_intento_id`.
- Fila de superación vinculada a un intento válido del mismo usuario y reto.

La ausencia de superación significa pendiente. Disponible o bloqueado se calcula con las dependencias, sin almacenar banderas que puedan contradecirse. No se crea una tabla de preguntas comunes para cada reto: cada intento tiene su selección.

### `camino_xp_movimientos`

- `id`, `usuario_id`, `reto_id`, `intento_id`, `cantidad`, `created_at`.
- Unicidad por usuario y reto para impedir recompensas duplicadas.
- Total de XP calculado por suma de movimientos, con agregación si fuera necesaria.

### `camino_actividad_diaria`

- `usuario_id`, `fecha_local`, `primer_intento_id`, `created_at`.
- Unicidad por usuario y fecha; fecha calculada en servidor.

Las rachas se derivan de esta actividad. Los porcentajes agregados pueden resolverse mediante consultas o vistas; evitar contadores independientes sin un mecanismo transaccional de consistencia.

## 9. Operaciones de servidor y permisos

Toda evaluación y escritura de progreso se ejecuta en servidor mediante RPC de PostgreSQL o Edge Functions. React solicita acciones y presenta sus resultados; no decide desbloqueos, notas, XP ni fechas de actividad.

### Inicio o reanudación

Verificar identidad, suscripción activa, camino publicado, dependencias y disponibilidad del contenido. Si existe un intento en curso, devolverlo o indicar que debe reanudarse o abandonarse antes de abrir otro. Crear intento y selección de preguntas de forma atómica, sin exponer las soluciones.

### Guardado

Guardar respuestas del usuario con control de versión del intento para evitar que dos pestañas sobrescriban silenciosamente cambios. Solo se admiten opciones de las preguntas asignadas y cambios sobre intentos en curso propios.

### Finalización

En una transacción: bloquear el intento, comprobar acceso y validez del contenido, corregir respuestas, cerrar el resultado, actualizar mejor marca, registrar primera superación, conceder XP una sola vez y registrar actividad diaria si procede. Las solicitudes repetidas devuelven el mismo resultado sin duplicar efectos. Un fallo de red permite recuperar el resultado confirmado.

Aplicar RLS a datos personales: cada usuario solo consulta sus intentos, progreso, XP y actividad. No puede escribir directamente notas, recompensas o desbloqueos. El catálogo publicado se consulta mediante las políticas de acceso definidas; los borradores quedan reservados a administradores.

El panel administrativo reutiliza el mecanismo de autorización existente. No introducir `usuario_roles` ni exigir crear `perfiles.rol` para esta funcionalidad. La comprobación administrativa debe hacerse también en servidor. No exponer credenciales de servicio ni respuestas correctas en el cliente antes de la entrega.

## 10. Gestión administrativa y cambios del catálogo

Desde el admin se puede generar un borrador a partir del orden actual de bloques y temas, revisar el recorrido, configurar los retos y publicar. La generación es explícita: una carga de catálogo no publica automáticamente un camino.

Antes de publicar, validar:

- La convocatoria contiene temas y las referencias pertenecen a ella.
- El orden es único, los cuatro retos de cada tema existen y cada bloque tiene su repaso.
- Los requisitos y recompensas son válidos.
- Existe suficiente contenido elegible y el repaso puede representar todos los temas.
- No se exige un reto de otro camino ni hay dependencias circulares.

En esta primera versión, la estructura y las reglas de un camino publicado quedan congeladas. Se puede corregir su título y archivar el camino. Cambiar temas, orden, umbrales o recompensas requiere un futuro flujo explícito de versionado y migración de progreso, fuera del MVP; no borrar ni regenerar recorridos con usuarios avanzando.

Los cambios del orden en el catálogo no reordenan un camino publicado. Archivar un camino impide nuevos intentos, conserva el progreso y permite consultar resultados; cualquier intento en curso deja de ser reanudable y puede abandonarse sin penalización. No ofrecer un reinicio de progreso en esta versión.

## 11. Estados vacíos y errores

- Sin camino publicado: «El recorrido de esta convocatoria todavía no está disponible», con acceso a test libres.
- Sin contenido suficiente: explicación de disponibilidad, sin consumir intentos ni aplicar un suspenso.
- Sin suscripción: mostrar la acción de contratación existente y conservar el progreso.
- Sin conexión: indicar qué respuestas están pendientes de sincronizar; no mostrar confirmación de guardado o recompensa hasta recibirla del servidor. No se ofrece modo sin conexión.
- Camino completado: mostrar el logro y permitir repetir retos, sin nuevos XP.
- Conflicto entre pestañas: recuperar el estado confirmado y avisar antes de sobrescribir respuestas.

## 12. Criterios de aceptación

1. Un usuario con suscripción activa entra en un camino nuevo y solo puede comenzar su primer reto.
2. Completar Primeros pasos con al menos una respuesta abre Coge ritmo; entregar todo en blanco no lo supera ni cumple el objetivo diario.
3. Un reto de 15 preguntas al 80 % exige 12 aciertos; los blancos cuentan como no acertados.
4. No superar un reto conserva todos los logros anteriores y permite reintentarlo sin esperas.
5. La primera superación del reto final completa el tema y abre el siguiente paso definido, incluido el repaso de bloque.
6. El repaso incluye todos los temas del bloque y es necesario para abrir el siguiente bloque.
7. Repetir o finalizar simultáneamente un reto no duplica XP ni actividad diaria.
8. Recargar o cambiar de dispositivo recupera preguntas, orden y respuestas confirmadas del intento en curso.
9. Un resultado peor en un reto ya superado no bloquea de nuevo el camino.
10. Hacer test libres no altera los desbloqueos ni las recompensas del camino.
11. El objetivo diario y las rachas se calculan con fechas del servidor en Europe/Madrid, también al cambiar de día y de horario estacional.
12. Dos convocatorias mantienen avances independientes; la racha diaria es común.
13. Un usuario no puede leer progreso ajeno ni manipular XP, aciertos o desbloqueos por acceso directo a la API.
14. Si caduca la suscripción, se conserva el progreso y se impiden las operaciones de práctica hasta recuperar el acceso.
15. El admin no puede publicar un camino incompleto o sin preguntas suficientes.
16. Un cambio de contenido durante un intento lo invalida sin suspenso ni recompensa; los resultados cerrados no se recalculan.
17. El porcentaje incluye retos de tema y repasos, y llega al 100 % solo al superar todos los obligatorios.
18. El recorrido funciona en móvil, con teclado y con movimiento reducido.

## 13. Implementación y validación

1. Revisar el esquema real de catálogo, suscripciones, intentos y autorización administrativa.
2. Añadir migraciones, restricciones, índices y políticas RLS sin duplicar el historial existente.
3. Implementar creación, guardado y finalización de intentos con transacciones e idempotencia.
4. Incorporar generación y validación administrativa de borradores.
5. Crear mapa, parada, resultado y componentes de XP, objetivo y racha.
6. Probar evaluación y redondeo, dependencias, permisos, concurrencia, reanudación, fechas y disponibilidad de contenido.
7. Validar el recorrido completo con al menos dos bloques y varios temas, así como su convivencia con los test libres y las suscripciones.

La spec define una funcionalidad nueva. No modifica por sí sola las specs cerradas ni implica que las tablas o funciones descritas estén implementadas.

## 14. Implementación en el repositorio

- Migración: `supabase/migrations/20261031000000_learning_paths.sql`.
- Área del opositor: `/mi-camino`; gestión administrativa: `/admin/caminos`.
- Reutiliza el motor y el historial existentes, con origen y referencias de camino. El componente de opciones es compartido con la plataforma de tests.
- La generación es explícita y crea solo borradores. Los borradores sin intentos se pueden regenerar; una publicación congela reglas y estructura.
- Decisiones técnicas y protección de referencias: `docs/adr/0016-learning-paths.md`.
- Queda pendiente aplicar y ejecutar las pruebas SQL en Supabase operativo, comprobar concurrencia real y validar visualmente móvil, tableta, escritorio y teclado. La implementación no se considera validada para publicación hasta completar esas verificaciones.
