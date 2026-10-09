008 — Panel del administrador
Objetivo
Proporcionar a los administradores de OposNavarra un panel integrado en la aplicación para gestionar el catálogo, el banco de preguntas, los usuarios y los planes sin depender del dashboard de Supabase.
Las suscripciones serán exclusivamente de consulta. La consulta del histórico de tests queda fuera de este MVP.
1. Dependencias y alcance
Esta spec se apoya en la 002 (catálogo y banco de preguntas), la 003 (autenticación) y la 006 (planes y suscripciones). Debe reutilizar sus entidades y reglas, sin duplicarlas.
La tabla public.perfiles, definida en la 003, contiene el campo rol, con los valores permitidos usuario y admin. Esta spec reutiliza ese modelo. Antes de implementar, revisar las migraciones y las specs 003 y 006 para confirmar el resto de campos de perfiles, planes y suscripciones. No se introducirán estados de suscripción nuevos.
Incluye frontend, operaciones de backend, autorización y las migraciones necesarias para los permisos administrativos.
2. Tablas y operaciones
Tabla o entidad	Operaciones administrativas
convocatorias	Consultar, crear, editar, activar, desactivar y eliminar si no tiene dependencias.
temas	Consultar, crear, editar, activar, desactivar y eliminar si no tiene dependencias.
convocatoria_tema	Asociar, desvincular y modificar numero y orden.
examenes	Consultar, crear, editar y eliminar si no tiene dependencias.
convocatoria_examen	Asociar y desvincular.
preguntas	Consultar, crear, editar, eliminar y gestionar estado, origen y situación.
respuestas	Crear, editar y eliminar dentro de la edición de una pregunta, respetando sus reglas editoriales.
pregunta_tema	Asociar y desvincular.
planes	Consultar, crear, editar y retirar de la contratación mediante el mecanismo de disponibilidad de la 006. Eliminar solo si no tiene dependencias.
suscripciones	Consultar exclusivamente.
Cuentas de Supabase Auth	Consultar, crear, modificar, bloquear, desbloquear y eliminar mediante operaciones administrativas del servidor.
public.perfiles	Consultar y editar los campos definidos en la 003. Gestionar rol mediante una operación administrativa específica. Creación y eliminación coordinadas con la cuenta.


No se permite editar identificadores, fechas de auditoría ni campos técnicos gestionados automáticamente por el sistema.
3. Acceso y autorización
El panel estará disponible en /admin para usuarios autenticados con el correo verificado y rol de administrador. No requiere una suscripción activa.
Los usuarios ordinarios no podrán acceder al panel ni ejecutar sus operaciones mediante llamadas directas al backend.
public.perfiles.rol será la única fuente de verdad de los permisos. Los únicos valores permitidos serán usuario y admin, conforme a la 003. No se creará usuario_roles ni otro almacenamiento de roles paralelo.
El servidor identificará al solicitante mediante su sesión validada y consultará su perfil asociado conforme a la relación definida en la 003. Solo rol = admin autoriza operaciones administrativas. Un perfil ausente, un rol inválido o un fallo al comprobarlo no concede acceso.
Las políticas RLS y cualquier función de autorización utilizarán ese mismo campo. Las funciones auxiliares, si son necesarias para evitar recursión en las políticas de perfiles, consultarán el perfil del usuario autenticado con permisos y alcance mínimos; no aceptarán una identidad arbitraria del cliente para autorizar al solicitante.
Los valores de rol enviados por el navegador o almacenados en metadatos editables no acreditan permisos. Una copia del rol en una sesión o token no sustituirá la comprobación vigente de perfiles.rol para operaciones administrativas.
Un usuario ordinario podrá editar únicamente los campos de su perfil permitidos en la 003, sin modificar rol. Se protegerá ese campo también frente a escrituras directas: una política RLS que permita editar el perfil propio no bastará por sí sola para autorizar cambios de rol. Se emplearán permisos de columnas, operaciones controladas o restricciones equivalentes.
Solo los administradores autorizados podrán cambiar perfiles.rol mediante una operación administrativa específica. La creación normal de cuentas establecerá rol = usuario; una petición de registro o de actualización de perfil no podrá elegir admin.
El primer administrador se asignará estableciendo perfiles.rol = admin mediante un procedimiento controlado del servidor, documentado y reproducible para una cuenta existente con correo verificado. No existirá un registro público como administrador ni credenciales incorporadas al repositorio.
Se impedirá eliminar, bloquear o retirar el rol al último administrador habilitado. Esta comprobación debe resistir operaciones concurrentes.
La protección de rutas del frontend se complementará con autorización en el servidor y políticas RLS para las tablas expuestas. Las credenciales privilegiadas de Supabase permanecerán exclusivamente en el servidor. Cada operación privilegiada comprobará la identidad y los permisos del solicitante antes de ejecutarse.
El rol de administrador no concederá permisos de escritura sobre suscripciones a través del panel, sus endpoints o las políticas destinadas a la administración. Los procesos autorizados de contratación y pagos conservarán los permisos que requieran la spec 006 y la spec de pasarela de pago.
4. Navegación y comportamiento común
El panel tendrá seis apartados: Convocatorias, Temas, Exámenes, Preguntas, Usuarios y Planes y suscripciones.
No será necesario crear pantallas independientes para las tablas de relaciones ni para las respuestas: se gestionarán desde las entidades correspondientes.
Los listados tendrán paginación, búsqueda, filtros adecuados a cada entidad y un orden estable. La búsqueda y la paginación se realizarán en el servidor para evitar descargar tablas completas.
Las pantallas mostrarán estados de carga, listas vacías, errores y confirmación del resultado de las operaciones. Los formularios conservarán los datos introducidos cuando falle el guardado y mostrarán errores comprensibles junto a los campos afectados.
Las eliminaciones y las acciones sensibles sobre usuarios requerirán una confirmación que identifique el registro y explique su efecto.
La interfaz estará en español y mantendrá las convenciones visuales y de formularios del proyecto. Será utilizable en escritorio y en pantallas pequeñas.
5. Convocatorias y temas
Los administradores podrán gestionar todos los campos editables definidos en la 002 y activar o desactivar convocatorias y temas.
Desde el detalle de una convocatoria podrán asociar temas existentes y modificar su numero y orden, ambos enteros positivos y únicos dentro de la convocatoria. La interfaz permitirá reorganizar los temas sin producir duplicados temporales; el guardado de una reorganización será atómico.
También podrán asociar y desvincular exámenes existentes. No se duplicarán temas ni exámenes para reutilizarlos en otra convocatoria.
El detalle de un tema mostrará sus convocatorias y permitirá consultar las preguntas asociadas mediante el listado de preguntas.
Desvincular un tema o un examen no elimina ninguna de esas entidades ni sus preguntas. La interfaz advertirá que cambia la disponibilidad de preguntas para la convocatoria afectada.
6. Exámenes
Los administradores podrán crear y editar los campos de examenes definidos en la 002, gestionar las convocatorias asociadas y consultar sus preguntas.
La asociación de una pregunta a un examen se gestionará desde la pregunta. Una pregunta podrá pertenecer como máximo a un examen. Se respetará la unicidad de examen_id + numero y la condición de número positivo cuando tenga valor.
7. Preguntas y respuestas
El listado permitirá buscar por enunciado y filtrar por convocatoria, tema, examen, estado, origen y situación. El filtro de convocatoria utilizará las relaciones de temas y exámenes establecidas en la 002, sin duplicar preguntas. El administrador podrá consultar también preguntas en revisión y desactivadas.
El formulario permitirá editar el enunciado, la explicación, la fuente, el examen y número opcionales, los temas asociados, el origen, la situación y el estado. Incluirá cuatro posiciones de respuesta y un selector de respuesta correcta.
Las preguntas nuevas se crearán en revision por defecto. Se permitirá guardar borradores incompletos en revisión, conforme a la 002.
La publicación exigirá exactamente cuatro respuestas, con órdenes del 1 al 4, textos obligatorios y exactamente una respuesta correcta. El sistema explicará qué condición impide publicar una pregunta.
Enunciado, respuestas y asociaciones se guardarán en una operación atómica: un fallo no debe dejar cambios parciales. La edición de una pregunta publicada debe conservar su validez; si se desea guardar una versión incompleta, deberá pasar a revisión en la misma operación.
Las reglas de publicación se garantizarán también en la base de datos, incluyendo las modificaciones y eliminaciones de respuestas de preguntas publicadas, no solo el cambio inicial de estado.
estado, origen y situacion serán conceptos independientes. Una pregunta anulada podrá publicarse si cumple las condiciones de la 002. No se creará una tabla convocatoria_pregunta.
Se mostrará que modificar una pregunta reutilizada afecta a todas las convocatorias en las que está disponible.
8. Usuarios
El listado permitirá buscar usuarios por correo y por los datos identificativos existentes en la 003, y filtrar por rol y estado de acceso.
El detalle mostrará los datos de cuenta pertinentes, el estado de verificación del correo, el rol y el estado de acceso. No mostrará contraseñas, tokens ni secretos.
Los administradores podrán:
- Crear una cuenta con los campos mínimos de la 003 e iniciar el flujo de invitación o establecimiento de contraseña, manteniendo la verificación obligatoria del correo.
- Modificar los campos de perfil existentes y solicitar un cambio de correo a través del flujo de verificación de Supabase Auth.
- Iniciar el flujo de recuperación de contraseña sin conocer la contraseña del usuario.
- Bloquear y desbloquear el acceso sin modificar su suscripción.
- Cambiar perfiles.rol entre usuario y admin mediante la operación específica de gestión de roles, respetando la protección del último administrador.
- Eliminar una cuenta cuando sus dependencias permitan hacerlo.
La creación de cuenta y perfil se coordinará para evitar cuentas o perfiles huérfanos. Los fallos parciales tendrán una estrategia de recuperación o compensación explícita.
El bloqueo debe impedir el acceso protegido también con sesiones emitidas anteriormente; el backend comprobará el estado de acceso cuando corresponda. Retirar el rol debe impedir nuevas operaciones administrativas aunque exista una sesión previa.
La eliminación de un usuario con suscripciones asociadas se rechazará en este MVP para conservar los registros y respetar su carácter de solo consulta. El panel ofrecerá el bloqueo como alternativa y explicará las dependencias. No eliminará suscripciones en cascada ni las cancelará en el proveedor de pagos.
9. Planes
El panel permitirá consultar, crear y editar planes utilizando los campos y reglas de la 006. Los planes existentes son mensual de 15 €, semestral de 79 € y anual de 120 €, con renovación al finalizar cada periodo según la 006.
Los cambios de precio o duración no modificarán retroactivamente periodos, importes ni condiciones ya contratadas. La implementación reutilizará el mecanismo de conservación de condiciones de la 006 y deberá verificarlo antes de habilitar estas ediciones. Si no existe, se añadirá mediante migración el mecanismo necesario, sin permitir ediciones manuales de suscripciones desde el panel.
Un plan con suscripciones asociadas no podrá eliminarse. Para retirarlo de futuras contrataciones se utilizará su mecanismo de disponibilidad, manteniendo las suscripciones existentes.
Esta spec no incluye crear precios o productos en Stripe, cambiar cobros ni sincronizar el catálogo con el proveedor. La spec de pasarela de pago deberá integrar ese comportamiento antes de utilizar cambios administrativos de planes en cobros reales.
10. Suscripciones: solo consulta
El administrador podrá consultar un listado paginado, buscar por usuario, filtrar por plan y estado y abrir el detalle de cada suscripción.
Se mostrarán el usuario, el plan, el estado y las fechas y datos de renovación que existan en la 006. No se inventarán campos ni estados adicionales para esta pantalla.
No se ofrecerán ni implementarán operaciones administrativas para crear, modificar, cancelar o eliminar suscripciones, conceder acceso manual ni ampliar su duración. Esta restricción se aplicará también a peticiones directas al backend.
11. Eliminaciones e integridad
Las eliminaciones nunca dejarán registros huérfanos ni borrarán contenido reutilizable de forma implícita.
Las convocatorias, temas y exámenes con dependencias no podrán eliminarse. Las asociaciones se retirarán explícitamente desde sus pantallas cuando proceda. Para convocatorias y temas se ofrecerá la desactivación como alternativa.
Eliminar una pregunta podrá eliminar sus propias respuestas y filas de pregunta_tema dentro de la misma operación, pero no sus temas ni su examen. Cualquier otra dependencia impedirá la eliminación. La interfaz recomendará desactivarla cuando se quiera retirarla del uso sin borrarla.
Las restricciones se garantizarán mediante claves foráneas y reglas del servidor. Si las migraciones existentes permiten cascadas incompatibles con esta spec, se ajustarán mediante una migración nueva.
12. Migraciones y verificación
Se reutilizarán las tablas de dominio existentes y public.perfiles de la 003. No se creará una tabla adicional de roles. Se conservará la restricción de perfiles.rol a usuario y admin. Los cambios necesarios de políticas, permisos, restricciones o funciones se introducirán mediante nuevas migraciones versionadas. No se modificarán migraciones ya aplicadas ni se dependerá de cambios manuales en el dashboard.
La implementación incluirá pruebas que acrediten que servidor y RLS utilizan perfiles.rol, que un usuario no puede modificar su propio rol mediante escrituras directas ni suplantarlo con metadatos o peticiones manipuladas, y que un perfil ausente no concede acceso. También incluirá pruebas de autorización, integridad editorial, guardado atómico, eliminaciones con dependencias, protección del último administrador y restricciones de escritura sobre suscripciones. Se verificará el flujo completo de una pregunta y las operaciones de usuario relevantes en un entorno de pruebas.
Las operaciones de cuentas que envíen invitaciones o recuperación de contraseña se probarán con un mecanismo de pruebas que evite envíos accidentales a usuarios reales.
13. Fuera de alcance
- Consulta o gestión del histórico de tests, resultados y respuestas de usuarios.
- Estadísticas, progreso y paneles analíticos.
- Escritura administrativa sobre suscripciones.
- Cobros, reembolsos y gestión de Stripe.
- Importación y exportación masiva de contenido.
- Imágenes y grupos de preguntas.
- Roles editoriales adicionales o permisos configurables por tabla.
- Historial de cambios o una nueva tabla de auditoría de acciones administrativas.
Se conservarán las fechas created_at y updated_at previstas en las specs existentes.
14. Criterios de aceptación
1. Un administrador autenticado y con correo verificado puede acceder a /admin sin necesitar una suscripción.
2. Un usuario ordinario o no autenticado no puede acceder a datos ni operaciones administrativas mediante rutas o peticiones directas.
3. public.perfiles.rol es la única fuente de verdad, admite únicamente usuario y admin, y no se crea usuario_roles ni otro modelo paralelo.
4. Servidor y políticas RLS comprueban ese campo; los usuarios ordinarios no pueden cambiarlo mediante edición de su perfil, peticiones directas ni metadatos manipulados. Las credenciales privilegiadas no llegan al navegador.
5. Existe un procedimiento documentado para asignar el primer administrador y no se puede dejar el sistema sin administradores habilitados.
6. Se pueden crear, editar, activar y desactivar convocatorias y temas, y gestionar exámenes.
7. Se pueden gestionar las asociaciones sin duplicar entidades ni asociaciones.
8. numero y orden de los temas se validan por separado y pueden reorganizarse sin guardados parciales.
9. Se pueden buscar y filtrar preguntas, incluyendo las preguntas no publicadas.
10. Una pregunta en revisión puede guardarse incompleta; una pregunta publicada siempre cumple las reglas de respuestas de la 002.
11. El guardado de preguntas, respuestas y asociaciones es atómico.
12. La disponibilidad por convocatoria se deriva de temas y exámenes sin duplicados ni una relación directa nueva.
13. Se pueden crear y editar cuentas y perfiles, iniciar recuperación de contraseña, bloquear, desbloquear y gestionar roles según las reglas de esta spec.
14. El bloqueo y la retirada de permisos se aplican también a usuarios con sesiones previas.
15. No se eliminan cuentas con suscripciones asociadas ni se modifica su suscripción al bloquearlas.
16. Los planes se pueden gestionar sin alterar las condiciones de suscripciones existentes ni eliminar planes referenciados.
17. Las suscripciones pueden consultarse, buscarse y filtrarse, pero las operaciones administrativas de escritura son rechazadas por el backend.
18. Las eliminaciones respetan las dependencias y nunca borran contenido reutilizable de forma implícita.
19. Los listados tienen paginación y los formularios presentan estados y errores comprensibles.
20. El panel no incluye histórico de tests ni estadísticas.
21. Las migraciones y las pruebas críticas pasan, junto con las comprobaciones de compilación, tipos y lint exigidas por el proyecto.