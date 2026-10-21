# Retos — Exámenes compartidos entre usuarios

## Objetivo

Permitir que un usuario cree un examen con preguntas del banco de OposNavarra, comparta un enlace y compita con varios participantes. Todos realizarán el mismo examen y los resultados se publicarán al cerrar el reto.

Esta spec amplía el motor de tests de la spec 007. No sustituye sus funcionalidades ni crea un segundo sistema de respuestas y corrección.

La numeración de esta spec se asignará al incorporarla al proyecto para evitar colisiones con las specs existentes.

## Alcance de la primera versión

- Crear retos con preguntas del banco existente.
- Definir el número total de participantes, incluido el creador.
- Compartir una invitación mediante enlace.
- Unirse con una cuenta y suscripción activa.
- Realizar un único intento por participante, en momentos diferentes.
- Guardar respuestas y permitir retomar el intento sin reiniciar su tiempo.
- Cerrar automáticamente al completar todas las plazas y finalizar todos los intentos.
- Permitir que el creador cierre manualmente el reto.
- Publicar clasificación y corrección únicamente tras el cierre.
- Consultar los retos creados y aquellos en los que se participa.

Quedan fuera: preguntas aportadas por usuarios, chat, búsqueda de amigos, envío automático de mensajes, equipos, premios y rankings globales. La incorporación de preguntas propias se abordará en otra spec.

## Reglas de acceso

- Para crear, unirse o comenzar un intento se requiere autenticación y suscripción activa, conforme al mecanismo de acceso existente.
- El creador se incorpora como participante y ocupa una plaza automáticamente.
- Un usuario no puede ocupar varias plazas ni repetir el examen de un mismo reto.
- La caducidad posterior de la suscripción no impide consultar resultados de un reto en el que ya se participa ni cerrar un reto propio. Un intento ya comenzado podrá finalizarse.
- El enlace permite solicitar la incorporación; no concede acceso a respuestas, correcciones ni resultados privados.

## Creación del reto

El formulario permite indicar:

| Campo | Regla |
| --- | --- |
| Título | Obligatorio; identifica el reto. |
| Convocatoria | Una convocatoria disponible para el usuario. |
| Temas | Uno o varios; todos seleccionados inicialmente. |
| Número de preguntas | Entero positivo, limitado por las preguntas elegibles. |
| Tiempo por participante | Duración válida según las reglas del motor de tests. |
| Participantes totales | Entero igual o superior a dos, incluyendo al creador. |

El servidor validará la configuración, seleccionará preguntas sin repeticiones y guardará su orden una sola vez. Todos recibirán las mismas preguntas, opciones en el mismo orden, duración y criterio de puntuación.

Si no hay preguntas suficientes, se informará al usuario y no se creará un reto incompleto. La creación del reto, sus preguntas y la plaza del creador será atómica.

La configuración queda bloqueada al crear el reto. El creador puede compartirlo antes de realizar su propio intento; no necesita terminar primero.

## Invitación e incorporación

- Se genera un enlace con un token aleatorio no predecible.
- El creador dispone de «Copiar enlace» y puede compartirlo por sus propios medios.
- Quien lo abra verá el título, creador, convocatoria, temas, número de preguntas, duración y si admite incorporaciones. No se mostrarán las preguntas antes de comenzar.
- Si no ha iniciado sesión, se conserva el destino para volver al reto después de autenticarse.
- La incorporación requiere una acción explícita «Unirme al reto».
- Solo se admiten incorporaciones mientras el reto esté abierto y haya plazas.
- Si el usuario ya participa, se abre su pantalla del reto sin consumir otra plaza.
- La última plaza se adjudica de forma atómica, evitando superar el límite ante solicitudes simultáneas.
- En esta versión cualquier usuario elegible que tenga el enlace puede unirse; no se verifica una identidad de invitado concreto.
- No se permite abandonar ni sustituir participantes en esta primera versión.

## Realización del examen

Cada participante puede comenzar cuando quiera mientras el reto esté abierto. El tiempo comienza al iniciar su propio intento y transcurre de forma continua, aunque cierre la página o pierda la conexión.

Se reutilizan la navegación, el guardado de respuestas y la entrega del motor de tests. Volver a entrar recupera el mismo intento y el tiempo restante; nunca crea un intento adicional.

El intento termina por entrega voluntaria, agotamiento del tiempo o cierre manual del reto. Al agotarse el tiempo se corrigen las respuestas guardadas, contando las restantes como preguntas en blanco. El servidor controla el plazo y rechaza respuestas tardías.

## Espera de resultados

Tras entregar, el participante verá:

> Has terminado el reto. Todavía hay participantes pendientes de finalizar.

No se mostrará cuántos faltan, quiénes han terminado, notas parciales, clasificación ni respuestas correctas. Si quedan plazas libres, también se mantendrá este estado de espera.

El creador podrá ver el enlace y el control de cierre, pero tampoco tendrá acceso anticipado a respuestas, notas o cantidades de participantes pendientes. La confirmación del cierre no mostrará ese recuento.

## Cierre del reto

### Cierre automático

Se cierra cuando se han ocupado todas las plazas configuradas y todos sus participantes han terminado. Si quedan plazas libres, no se cierra automáticamente aunque todos los inscritos hayan terminado.

### Cierre manual por el creador

El creador dispone de «Cerrar reto y publicar resultados», incluso si no ha completado su propio examen.

Se solicita confirmación con este mensaje:

> Al cerrar el reto se entregarán los intentos en curso con las respuestas guardadas y se publicarán los resultados. Quienes no hayan empezado ya no podrán realizarlo. Esta acción no se puede deshacer.

| Situación | Resultado del cierre |
| --- | --- |
| Intento terminado | Se conserva su resultado. |
| Intento en curso | Se entrega con las respuestas guardadas; las restantes cuentan en blanco. |
| Participante sin comenzar | Figura como «No realizado», fuera de la clasificación. |
| Plaza sin ocupar | Deja de estar disponible. |

El cierre afecta a todos, incluido el creador. Después no se aceptan incorporaciones, nuevos intentos ni cambios de respuestas. El reto no se puede reabrir.

El cierre y la publicación serán atómicos e idempotentes. Si una respuesta, entrega o incorporación coincide con el cierre, el servidor resolverá el orden mediante transacciones y bloqueos sobre el reto. Nunca se guardarán cambios posteriores al cierre ni se publicarán resultados parcialmente cerrados.

No se introduce una fecha de caducidad automática en esta versión: el cierre manual resuelve los retos que quedan pendientes.

## Resultados y clasificación

Solo los participantes pueden consultar los resultados de un reto cerrado.

La clasificación mostrará nombre visible, posición, nota, aciertos, errores, preguntas en blanco y tiempo empleado. No se expondrán correos ni otros datos personales de la cuenta.

Se reutilizará la fórmula de puntuación del motor de tests, fijada para el reto al crearlo. Como regla inicial, se ordenará por nota descendente y, en caso de empate, por menor tiempo empleado. Si ambos valores coinciden, se compartirá posición.

Los intentos entregados por cierre manual se identificarán como tales. Su tiempo será el transcurrido hasta el cierre, limitado a su duración máxima. Si el plazo individual ya había vencido, se aplicará el vencimiento, no la hora posterior del cierre.

Cada participante podrá revisar su propia corrección pregunta por pregunta. Los demás verán sus resultados agregados, sin consultar sus respuestas individuales.

El listado de retos diferenciará abiertos y cerrados. Los intentos vinculados a retos podrán aparecer en el historial existente, identificados como «Reto», pero sin permitir consultar nota o corrección antes del cierre.

## Modelo de datos

### Adaptación al esquema existente

El catálogo de perfiles no contiene un nombre público. En esta implementación cada participante elige un alias visible al crear o unirse (sin correo), conservado en su plaza del reto. No se expone el correo ni se deriva el alias de él.

Se reutilizan `test_intentos`, `test_intento_temas`, `test_intento_preguntas` y las RPC del motor. Se añade la referencia al reto, el motivo de entrega y el resultado calculado. Al cerrar se conserva la representación de la corrección individual en el intento para que las ediciones posteriores del banco no alteren la revisión histórica; `reto_preguntas` solo contiene referencias, sin duplicar el banco.

Las duraciones son las del motor, incluido sin límite. El número admite enteros positivos hasta las preguntas elegibles y la capacidad actual de puntuación (999 preguntas por el tipo `numeric(5,2)` del motor). El vencimiento se resuelve al consultar/operar y mediante una tarea `pg_cron` cada minuto, usando siempre la fecha individual de vencimiento para la corrección y el tiempo empleado.

Los nombres siguientes son propuestos. Antes de implementar se revisarán las migraciones y las tablas reales de la spec 007 para reutilizarlas y adaptar sus nombres, sin duplicar intentos ni respuestas.

### `retos`

Un registro representa el examen compartido y su configuración.

- `id`.
- `creador_id`: usuario creador.
- `titulo`.
- `convocatoria_id`.
- `numero_preguntas`.
- `duracion_segundos`.
- `participantes_totales`, con restricción mínima de dos.
- Configuración de puntuación empleada por el motor existente.
- `token_invitacion`: único y aleatorio; no se incluirá en consultas generales.
- `estado`: `abierto` o `cerrado`.
- `creado_en`, `cerrado_en` y `motivo_cierre`: `automatico` o `manual`.

Los temas seleccionados se guardarán mediante una relación `reto_temas` con unicidad de `(reto_id, tema_id)`.

### `reto_preguntas`

Guarda qué preguntas del banco forman el examen común.

- `reto_id`.
- `pregunta_id`.
- `orden`.
- Unicidad de `(reto_id, pregunta_id)` y de `(reto_id, orden)`.

No almacena una copia del enunciado ni de las opciones. Todos los intentos deben usar exactamente esta selección y orden.

Para conservar la igualdad del examen, mientras haya un reto abierto se bloquearán los cambios de enunciado, opciones, respuesta correcta y eliminación de sus preguntas. Si fuera necesario corregir una, se creará otra pregunta en el banco. Las preguntas referenciadas se conservarán mediante archivado, sin eliminación física que rompa el histórico. No se cambiarán silenciosamente las notas de retos cerrados por una edición posterior del banco.

### `reto_participantes`

Relaciona cada usuario con su plaza y su intento.

- `id`.
- `reto_id`.
- `usuario_id`.
- `unido_en`.
- `intento_id`: referencia al intento del motor de tests; puede ser nulo hasta comenzar.
- Unicidad de `(reto_id, usuario_id)` y de `intento_id` cuando exista.

El estado de realización se obtiene del intento. Un participante sin intento al cerrar se considera «No realizado». Se evitará mantener estados duplicados que puedan contradecirse.

### Intentos y respuestas existentes

Cada persona tiene su propio intento con fechas, respuestas y resultado. Se reutilizan las tablas del motor existente y se añade, si hace falta, el motivo de entrega (`voluntaria`, `tiempo_agotado`, `cierre_reto`).

Ejemplo: un reto con veinte preguntas y tres participantes tiene un reto, veinte referencias a preguntas y tres participantes. Si todos comienzan, habrá tres intentos distintos. Una misma pregunta puede tener una respuesta diferente en cada intento.

La relación con el reto debe ser consultable por el servidor para aplicar las restricciones de acceso al historial, corrección y resultados.

## Backend y seguridad

Las operaciones de crear, unirse, comenzar, guardar, entregar y cerrar se validarán en el servidor mediante los mecanismos existentes de Supabase (funciones SQL/RPC o Edge Functions según el proyecto).

- Comprobar identidad, suscripción cuando corresponda, pertenencia y estado del reto.
- Aplicar RLS y permisos coherentes en todas las tablas relacionadas.
- Impedir escrituras directas que permitan añadir plazas, modificar preguntas o reabrir retos.
- Calcular notas y tiempos en el servidor; no confiar en valores enviados por el navegador.
- Antes del cierre, devolver a cada participante únicamente sus datos operativos necesarios, sin resultados ni correcciones.
- Proteger también los accesos a tablas del banco y endpoints existentes: ocultar la corrección en la interfaz no basta si la respuesta correcta se puede consultar directamente.
- Después del cierre, permitir resultados agregados a los participantes y corrección individual solo a su propietario.
- Revalidar en el servidor la selección y el orden al comenzar cada intento.
- Resolver con transacciones las carreras de última plaza, creación de intento, última entrega y cierre manual.
- Usar la hora del servidor como autoridad y resolver intentos vencidos aunque el navegador esté cerrado.

## Pantallas

1. **Retos:** listado de creados y participaciones, estado y acción para crear.
2. **Crear reto:** formulario de configuración.
3. **Invitación:** resumen y acción para unirse; avisos de reto cerrado o sin plazas.
4. **Detalle del reto:** configuración, acceso al intento, enlace del creador y cierre manual.
5. **Examen:** interfaz existente adaptada al contexto del reto.
6. **Espera:** confirmación de entrega y mensaje sin recuento de pendientes.
7. **Resultados:** clasificación y acceso a la corrección propia.

## Criterios de aceptación

- El creador ocupa una de las plazas configuradas.
- No es posible crear un reto con menos de dos plazas ni con preguntas insuficientes.
- Todos reciben las mismas preguntas y condiciones.
- Dos incorporaciones simultáneas no superan el aforo.
- Cada usuario dispone de un único intento y no puede reiniciar su tiempo.
- Las respuestas se conservan al recargar o retomar el examen.
- El agotamiento del tiempo se aplica aunque el usuario haya cerrado la página.
- Antes del cierre no se exponen notas, soluciones, clasificación ni cantidades de participantes pendientes, tampoco desde el historial o las API.
- El reto se cierra automáticamente solo con todas las plazas ocupadas y todos los intentos finalizados.
- El creador puede cerrarlo con plazas libres o participantes pendientes, previa confirmación sin recuentos.
- El cierre entrega intentos en curso, marca como no realizados los no comenzados y bloquea nuevas acciones.
- Dos solicitudes de cierre producen un único resultado coherente.
- Los resultados cerrados son visibles para sus participantes; cada uno solo consulta sus respuestas individuales.
- Las preguntas de un reto abierto no pueden cambiar de contenido o solución.
- Los tests ordinarios siguen funcionando conforme a la spec 007.

## Validación de implementación

Incluir pruebas de integración para permisos, ocultación de soluciones, última plaza concurrente, intento único, vencimiento, cierre concurrente con guardado/entrega y cierre con participantes sin comenzar. Verificar el recorrido completo con creador y dos invitados, así como la regresión del test ordinario.
