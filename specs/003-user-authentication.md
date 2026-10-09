003 — Autenticación y perfiles de usuario — OposNavarra
Estado: borrador para revisión.
Fecha de revisión: 2026-10-09.
Identificador: 003-user-authentication.
Ruta prevista en el repositorio: specs/003-user-authentication/spec.md.
1. Objetivo
Permitir que los usuarios creen una cuenta, verifiquen su correo e inicien sesión en OposNavarra mediante Supabase Auth. Solo los usuarios autenticados y con el correo verificado podrán acceder a la plataforma de test.
La tabla public.perfiles representará al usuario dentro de la aplicación, vinculada uno a uno con su identidad en Supabase Auth. Permitirá relacionarlo con sus suscripciones y tests realizados y determinar su rol de usuario o administrador. La realización y el almacenamiento de tests, los pagos y los permisos por convocatoria corresponden a sus respectivas specs.
2. Decisiones acordadas
- Utilizar Supabase Auth como proveedor de autenticación.
- Crear public.perfiles con los campos id, rol, created_at y updated_at.
- Crear un perfil automáticamente por cada cuenta, con rol usuario por defecto.
- Reservar la asignación del rol admin a una operación privilegiada.
- Mantener un único rol por perfil y una única fuente de verdad: public.perfiles.rol. No crear una tabla usuario_roles ni un segundo modelo de roles en la spec 008.
- Registro e inicio de sesión mediante correo electrónico y contraseña.
- Verificación obligatoria del correo antes de acceder a la plataforma.
- Registro mínimo: correo, contraseña y confirmación de contraseña.
- No solicitar nombre ni otros datos personales en el registro.
- Entrada desde el botón «Acceder» de la web pública.
- Tras iniciar sesión, dirigir al usuario al inicio de la plataforma de test.
- Mantener la sesión entre visitas mientras siga siendo válida.
- Permitir recuperar la contraseña y cerrar sesión.
- La autenticación y el acceso a tests de una convocatoria son condiciones independientes. Esta spec no concede acceso de pago ni define la experiencia de un usuario sin suscripción.
3. Alcance
Incluido
- Pantallas de registro, inicio de sesión, verificación pendiente, recuperación y nueva contraseña.
- Procesamiento de enlaces de verificación y recuperación.
- Reenvío del correo de verificación.
- Persistencia, renovación y cierre de sesión mediante Supabase.
- Protección de páginas y operaciones privadas.
- Configuración de Supabase Auth, URLs autorizadas y correos en español.
- Estados de carga, validación, éxito y error.
- Tabla perfiles, restricciones, creación automática, actualización de fechas y políticas RLS mediante migraciones versionadas.
- Creación de perfiles para cuentas ya existentes, si las hubiera.
- Base de roles para la spec 008 del panel de administración.
Fuera del MVP
- Acceso con Google u otros proveedores externos.
- Acceso mediante códigos o enlaces sin contraseña.
- Autenticación multifactor.
- Cambio de correo y eliminación de cuenta desde la interfaz.
- Edición de perfil y cambio de contraseña desde un panel de cuenta. Sí se incluye restablecerla mediante recuperación.
- Pagos, suscripciones y permisos para realizar tests.
- Panel de administración y gestión de roles desde una interfaz. El rol y su asignación privilegiada sí forman parte de esta spec.
4. Navegación y pantallas
Las rutas siguientes son una propuesta; pueden adaptarse a las convenciones del repositorio sin modificar el comportamiento.
Ruta	Finalidad
/acceder	Inicio de sesión
/registro	Crear cuenta
/verificar-correo	Verificación pendiente y reenvío
/recuperar-contrasena	Solicitar recuperación
/nueva-contrasena	Establecer contraseña tras validar el enlace
/auth/callback	Procesar enlaces de autenticación
/plataforma	Inicio privado de la plataforma de test


La web de venta seguirá siendo pública. El botón «Acceder» llevará a /acceder cuando no haya sesión válida y a /plataforma cuando el usuario esté autenticado y verificado. Mientras se comprueba la sesión, se mostrará un estado de carga sin contenido privado ni un formulario de acceso que parpadee innecesariamente.
5. Requisitos funcionales
RF-01. Registro mínimo
El formulario pedirá correo electrónico, contraseña y confirmación de contraseña. Ambos campos de contraseña estarán ocultos por defecto y permitirán mostrar su contenido.
Se validará el formato del correo, la política de contraseña y la coincidencia de ambos campos antes del envío. La confirmación de contraseña solo se utilizará en el formulario; no se almacenará.
Propuesta de política para el MVP: mínimo de 8 caracteres, configurado también en Supabase Auth. Cualquier requisito adicional habilitado en Supabase deberá indicarse en el formulario. La validación del cliente no sustituye la del proveedor.
Tras completar correctamente el registro, se mostrará «Revisa tu correo para activar tu cuenta» y se llevará al usuario al estado de verificación pendiente. No se concederá acceso a la plataforma antes de confirmar el correo.
No se duplicarán identidades existentes ni se presentarán errores técnicos del proveedor. Cuando la respuesta de Supabase oculte si una cuenta ya existe, la interfaz respetará ese comportamiento y ofrecerá iniciar sesión o recuperar la contraseña.
RF-02. Verificación de correo
El enlace enviado por Supabase se procesará en OposNavarra. Tras una verificación correcta, se mostrará una confirmación. Si el proceso establece una sesión válida, se continuará a la plataforma; en caso contrario, se ofrecerá iniciar sesión.
La pantalla de verificación pendiente incluirá reenvío y una opción para volver al inicio de sesión. Permitirá volver a indicar el correo cuando el usuario abra la pantalla sin el contexto del registro; no exigirá una sesión autenticada para solicitar el reenvío.
Los enlaces inválidos, caducados o ya utilizados mostrarán un mensaje comprensible y una opción para solicitar otro correo cuando corresponda. Un enlace fallido no dará acceso. Si el usuario ya está autenticado y verificado, se podrá continuar a la plataforma sin repetir la verificación.
El reenvío respetará los límites de Supabase. La interfaz bloqueará envíos duplicados mientras haya una solicitud en curso e informará cuando sea necesario esperar antes de reintentarlo.
RF-03. Inicio de sesión
El formulario pedirá correo y contraseña e incluirá enlaces a «Crear cuenta» y «He olvidado mi contraseña».
Con credenciales válidas y correo verificado, el usuario entrará en /plataforma. Con credenciales incorrectas, se mostrará «Correo o contraseña incorrectos». Cuando Supabase identifique un correo pendiente de confirmar, se ofrecerá acceder al flujo de verificación.
Un usuario con sesión válida que visite el registro o el inicio de sesión será dirigido al inicio de la plataforma.
RF-04. Recuperación de contraseña
El usuario introducirá su correo y solicitará un enlace. La respuesta será «Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña», independientemente de la existencia de la cuenta.
El enlace válido abrirá el formulario de nueva contraseña. Se pedirán contraseña y confirmación, con las mismas reglas del registro.
La sesión de recuperación no provocará una redirección automática que impida completar el formulario. La pantalla solo permitirá actualizar la contraseña después de validar el flujo de recuperación de Supabase; no bastará con visitar su URL.
Tras el cambio correcto, se mostrará una confirmación y se llevará al usuario al inicio de sesión. Se cerrará la sesión local utilizada para recuperar la contraseña. No se promete el cierre inmediato de sesiones en otros dispositivos.
Un enlace inválido, utilizado o caducado ofrecerá solicitar uno nuevo. Los fallos de red no se presentarán como cambios de contraseña completados.
RF-05. Sesión persistente
La gestión y renovación de la sesión utilizarán las herramientas de Supabase. Al recargar o volver a visitar la web, se conservará el acceso si la sesión sigue siendo válida.
La caducidad de un token de acceso no supondrá pedir credenciales si Supabase puede renovar correctamente la sesión. Si no puede recuperarse una sesión válida, se bloqueará el acceso privado y se mostrará el inicio de sesión con un mensaje adecuado.
Esta spec no fija una duración personalizada de sesión ni garantiza conservar respuestas de un test cuando la sesión termina; ese comportamiento corresponde a la spec de la aplicación de test.
RF-06. Cierre de sesión
La plataforma incluirá una acción visible «Cerrar sesión». Su alcance será la sesión del navegador actual, utilizando el mecanismo correspondiente de Supabase.
Tras completarse, se eliminará el estado privado local y se dirigirá a la página de inicio pública. No se mostrará información privada almacenada en caché al volver atrás. El cierre no eliminará la cuenta ni sus tests guardados.
Si falla la operación, se informará al usuario y no se anunciará un cierre remoto completado.
RF-07. Protección de acceso
Todas las páginas y operaciones privadas exigirán una identidad válida y correo verificado. Una visita directa a una URL privada tendrá la misma protección que la navegación desde «Acceder».
Ocultar botones o redirigir desde el navegador no será la única protección: los datos y las operaciones privadas deben aplicar controles en el servidor o la base de datos según la arquitectura existente.
La ausencia de sesión llevará al inicio de sesión. Cuando se pueda identificar de forma fiable un usuario no verificado, se mostrará el flujo de verificación; nunca se mostrará contenido privado durante esa comprobación.
RF-08. Perfil automático
Al crear una cuenta en Supabase Auth se creará un perfil en la misma transacción mediante un trigger de base de datos, incluso si el correo está pendiente de verificar. No se delegará su creación al navegador ni se esperará al primer inicio de sesión.
El perfil usará el mismo UUID de la cuenta y el rol fijo usuario. Los campos enviados por el cliente o sus metadatos no podrán elegir el rol. La verificación y los reenvíos no crearán nuevos perfiles.
Si falla la creación del perfil, el registro no se considerará completado y no quedará una cuenta nueva sin perfil. La interfaz mostrará un error recuperable, sin detalles internos. La función del trigger tendrá privilegios y un search_path controlados y no expondrá una operación privilegiada invocable por usuarios.
Si existen cuentas anteriores, la migración creará sus perfiles faltantes sin duplicar filas ni sobrescribir roles ya asignados.
RF-09. Roles de aplicación
Los roles permitidos serán usuario y admin. Se consultará perfiles.rol mediante una identidad validada y controles del servidor o la base de datos. No se confiará en valores del navegador ni en metadatos editables por el usuario para autorizar operaciones administrativas.
La promoción o retirada de un administrador se realizará mediante una operación privilegiada y documentada, fuera de la interfaz del MVP. El primer administrador deberá ser una cuenta existente identificada por UUID y verificada. No se incluirán contraseñas ni una cuenta administradora fija en migraciones o semillas.
La spec 008 dependerá del modelo creado por la 003: utilizará exclusivamente public.perfiles.rol para proteger sus páginas y operaciones. Si esa columna o tabla no existe, será una dependencia pendiente de la 003, no un motivo para crear usuario_roles desde la 008. La cláusula de la 008 que propone esa tabla alternativa deberá sustituirse por esta dependencia. Tener rol admin no exime de autenticarse ni verificar el correo, y esta spec no concede por ese rol una suscripción para realizar tests.
6. Modelo de datos
6.1. Tabla public.perfiles
Campo	Tipo	Restricciones y valor inicial
id	uuid	Clave primaria y clave foránea a auth.users.id; sin UUID independiente
rol	text	Obligatorio; CHECK para usuario o admin; por defecto usuario
created_at	timestamptz	Obligatorio; fecha de creación generada por la base de datos
updated_at	timestamptz	Obligatorio; fecha inicial generada por la base de datos y actualizada automáticamente en cada modificación


La clave primaria garantiza como máximo un perfil por cuenta y el trigger garantiza su creación. La referencia a Auth utilizará ON DELETE CASCADE: si una operación privilegiada elimina una cuenta, se eliminará su perfil. No se incluye una interfaz de eliminación en este MVP. Las políticas de conservación o borrado de suscripciones y tests se definirán en sus specs, sin dar por supuesto que deben borrarse en cascada.
No se añadirán nombre, avatar, correo, contraseña ni una copia del estado de verificación. Auth seguirá siendo la fuente de correo, credenciales y verificación; perfiles será la fuente del rol de aplicación.
6.2. Relaciones con las siguientes specs
Relación	Regla
auth.users.id → perfiles.id	Una cuenta tiene un perfil con el mismo identificador
perfiles.id → suscripciones	Un perfil puede tener las suscripciones definidas en la spec 006
perfiles.id → tests realizados	Un perfil puede tener los tests definidos en la spec 007
perfiles.rol → panel administrativo	La spec 008 exigirá el rol admin en sus operaciones administrativas


Las futuras claves de usuario en suscripciones y tests referenciarán perfiles.id. Esta spec no crea esas tablas ni modifica tablas externas no disponibles; al implementar sus specs se revisarán sus referencias para mantener este criterio.
6.3. Acceso a perfiles
RLS estará habilitado en public.perfiles, junto con los privilegios mínimos necesarios.
- Sin autenticación: no se permite leer ni escribir perfiles.
- Usuario autenticado y verificado: solo puede consultar su propio perfil, identificado mediante auth.uid() = id.
- Ningún usuario, incluido un administrador mediante su sesión ordinaria, puede insertar, modificar o eliminar perfiles directamente. No hay campos editables por el usuario en este MVP.
- El trigger crea perfiles y una operación privilegiada controlada permite cambiar roles. El rol admin de aplicación no equivale a una clave de servicio.
- La consulta de perfiles de otros usuarios desde el panel, si fuera necesaria, se incorporará con permisos específicos en la spec 008; esta spec no abre una lectura global.
No basta con una política que permita actualizar el perfil propio: esa política podría permitir elevar el rol. Se denegará la escritura ordinaria en toda la tabla. Si se añaden campos editables en el futuro, se deberán proteger expresamente id, rol y las fechas.
La validación de correo confirmado se aplicará también al acceso privado a datos mediante un mecanismo fiable del servidor o la base de datos. No se almacenará esa condición en metadatos modificables por el usuario. Cualquier función auxiliar de autorización deberá evitar consultas RLS recursivas y exponer únicamente el resultado necesario.
6.4. Migraciones
Las migraciones incluirán tabla, restricciones, RLS, privilegios, funciones y triggers, actualización automática de updated_at y creación de perfiles faltantes para cuentas existentes. La configuración manual de Auth y SMTP se documentará por separado.
Se comprobará la aplicación desde una base limpia y sobre un entorno con cuentas existentes. Las funciones privilegiadas tendrán permisos de ejecución limitados y referencias de objetos explícitas.
6.5. Contrato de autorización con la spec 008
Cada perfil tendrá exactamente uno de los dos roles permitidos. admin habilita las operaciones administrativas que defina la 008; no requiere una segunda fila con rol usuario.
Las comprobaciones del servidor y las políticas RLS que necesiten identificar administradores consultarán la misma fuente: public.perfiles.rol para el UUID autenticado. Las funciones auxiliares podrán encapsular esa consulta, pero no mantendrán otra copia persistente del rol ni confiarán en una copia obsoleta almacenada en el cliente.
La 008 podrá añadir políticas y funciones necesarias para sus operaciones, evitando recursión RLS, pero no una tabla de asignación de roles ni permisos para que el usuario modifique su rol. Un perfil ausente, un rol no reconocido o un error al comprobarlo no concederán acceso administrativo.
Este MVP no incluye múltiples roles por usuario. Un cambio futuro a ese modelo requerirá una migración y una actualización coordinada de las specs, sustituyendo la fuente actual y evitando mantener ambas como autoridades independientes.
7. Integración y seguridad
- Supabase Auth será la fuente de identidad y de credenciales. No se creará un sistema propio de contraseñas, tokens o enlaces de recuperación.
- El identificador de Supabase Auth vinculará al usuario con los datos de la aplicación. No se utilizará el correo como clave de relación.
- public.perfiles será la tabla de usuarios de aplicación definida por esta spec. Si el repositorio ya contiene una implementación equivalente, deberá reconciliarse mediante migraciones sin duplicar identidades ni perder datos.
- Los datos asociados a usuarios deberán tener políticas RLS que impidan que una identidad acceda a registros de otra. Los cambios concretos en tablas de tests o suscripciones se coordinarán con sus specs.
- La condición de correo verificado deberá cubrir también las operaciones privadas; un rol autenticado por sí solo no sustituirá esa condición.
- Las claves secretas o de servicio no se expondrán en el navegador. No se usarán para eludir controles de acceso en solicitudes ordinarias de usuarios.
- No se registrarán contraseñas, tokens ni enlaces completos de autenticación en logs.
- Se utilizará el SDK oficial y la integración de sesión adecuada al framework del repositorio. En SSR, se aplicará la integración oficial mediante cookies y validación del lado servidor. No se confiará en un objeto de sesión sin validar para autorizar operaciones.
8. Configuración necesaria
- Habilitar correo y contraseña, el registro y la confirmación obligatoria del correo en Supabase Auth.
- Configurar la política de contraseña y mantenerla alineada con el formulario.
- Configurar la URL del sitio y las redirecciones autorizadas para los entornos utilizados. Evitar redirecciones externas introducidas por el usuario.
- Preparar plantillas en español para confirmación y recuperación, identificando claramente OposNavarra.
- Configurar un proveedor SMTP para enviar correos a usuarios reales en producción. El proveedor concreto queda pendiente y no altera el alcance funcional.
- Documentar las variables necesarias sin incluir secretos, junto con los pasos de configuración que no se puedan gestionar mediante el repositorio.
- Mantener los límites de solicitudes de Supabase y tratar sus respuestas sin reintentos automáticos ilimitados.
9. Interfaz y accesibilidad
- Mensajes y etiquetas en español, coherentes con el diseño existente.
- Formularios utilizables en móvil y escritorio, mediante teclado y con etiquetas accesibles.
- Permitir pegado y autocompletado de gestores de contraseñas.
- Mostrar errores junto al campo correspondiente y errores generales en un lugar visible.
- Indicar solicitudes en curso y evitar envíos duplicados.
- Diferenciar credenciales incorrectas, límites de envío y fallos de conexión, sin revelar detalles internos.
10. Criterios de aceptación
ID	Escenario	Resultado esperado
CA-01	Registro válido con correo nuevo	Cuenta creada en Supabase, correo enviado y pantalla de verificación pendiente; sin acceso privado
CA-02	Correo inválido, contraseña insuficiente o confirmación distinta	Error comprensible y formulario no enviado
CA-03	Usuario pendiente de verificar intenta acceder	Acceso denegado y opción de verificar el correo
CA-04	Enlace de confirmación válido	Correo verificado; continuación a plataforma con sesión válida o al inicio de sesión si no la hay
CA-05	Enlace de confirmación inválido o caducado	Mensaje de error y opción de reenvío; sin acceso concedido
CA-06	Solicitud de reenvío	Respuesta comprensible; se respetan límites y no se duplican solicitudes en curso
CA-07	Inicio de sesión válido con correo verificado	Acceso al inicio de la plataforma
CA-08	Credenciales incorrectas	Mensaje genérico; sin acceso privado
CA-09	Usuario autenticado y verificado pulsa «Acceder»	Entrada directa a plataforma
CA-10	Visita directa a página privada sin sesión	Redirección a inicio de sesión sin contenido privado visible
CA-11	Solicitud directa de datos privados sin autorización	Denegada aunque se omita la interfaz
CA-12	Recuperación con correo existente o inexistente	Mismo mensaje público; envío solo cuando proceda
CA-13	Recuperación válida y nueva contraseña correcta	Cambio confirmado; se puede iniciar sesión con la nueva contraseña y la anterior falla
CA-14	Visita directa a nueva contraseña sin recuperación válida	No permite actualizar la contraseña; ofrece solicitar enlace
CA-15	Enlace de recuperación inválido o caducado	No cambia la contraseña; ofrece nuevo enlace
CA-16	Recarga o nueva visita con sesión válida	Se conserva el acceso
CA-17	Sesión que ya no puede renovarse	Se bloquea el acceso y se solicita iniciar sesión
CA-18	Cierre de sesión correcto	Regreso a inicio público; recargar o volver atrás no muestra datos privados
CA-19	Usuario A solicita registros del usuario B	Operación denegada por los controles de datos
CA-20	Supabase o la conexión fallan	Mensaje recuperable, sin falso éxito y formulario disponible para reintentar


| CA-21 | Cuenta nueva creada | Exactamente un perfil con el mismo UUID y rol usuario, antes de verificar el correo |
| CA-22 | Registro envía rol admin en metadatos | El perfil conserva el rol usuario |
| CA-23 | Verificar o reenviar correo | No crea perfiles duplicados ni cambia el rol |
| CA-24 | Usuario consulta su perfil y el de otra cuenta | Solo obtiene el suyo y únicamente con correo verificado |
| CA-25 | Usuario intenta insertar, modificar o borrar perfiles por API | Operación denegada, incluida la modificación de su propio rol |
| CA-26 | Administrador usa la API ordinaria para cambiar roles | Operación denegada; exige el mecanismo privilegiado documentado |
| CA-27 | Operación privilegiada asigna rol válido | Cambio persistido y updated_at actualizado; created_at se mantiene |
| CA-28 | Intento de rol distinto de usuario o admin | Restricción de base de datos lo rechaza |
| CA-29 | Migración con cuentas anteriores | Crea perfiles faltantes sin duplicados ni sobrescritura de roles existentes |
| CA-30 | Error del trigger durante un registro nuevo | Registro fallido sin una cuenta nueva parcialmente creada |
| CA-31 | Cuenta verificada sin perfil por inconsistencia | No se inventa un perfil o rol en el cliente; error recuperable y operaciones dependientes del perfil bloqueadas |
| CA-32 | Se integra el panel de la spec 008 | Todas las comprobaciones de administrador utilizan perfiles.rol; no se crea usuario_roles ni otra fuente persistente de roles |
| CA-33 | Falta perfil, rol reconocido o comprobación de autorización | No se concede acceso administrativo |
| CA-34 | Se cambia un rol por el mecanismo privilegiado | Las nuevas decisiones de autorización consultan el rol vigente, sin depender de una copia del navegador |
11. Validación de implementación
Se comprobarán los flujos completos de registro, verificación, inicio y cierre de sesión y recuperación con un entorno de pruebas de Supabase y cuentas de prueba. Se verificarán también acceso directo a rutas y datos privados, aislamiento entre dos usuarios, renovación de sesión y enlaces inválidos.
Se verificarán también la creación transaccional del perfil, la recuperación de cuentas preexistentes, las restricciones de roles, las fechas y la imposibilidad de elevar privilegios tanto por metadatos como por solicitudes directas.
Las verificaciones automatizadas se centrarán en controles de acceso y transiciones críticas. Se ejecutarán los comandos de calidad definidos en el repositorio. La entrega documentará las pruebas realizadas y cualquier configuración externa pendiente.
12. Dependencias y puntos de encaje
- Proyecto Supabase disponible y configuración de la aplicación para utilizarlo.
- Pantalla de inicio de la plataforma como destino tras autenticarse; su contenido pertenece a la spec de tests.
- Integración del botón «Acceder» en la web pública.
- Revisión de la constitución, del esquema de usuarios vigente y de las convenciones del repositorio antes de implementar. No se han adjuntado estos documentos para esta redacción.
- Selección del proveedor SMTP antes de cerrar la configuración de producción.
- La spec 008 debe eliminar su alternativa de crear usuario_roles y declarar dependencia de public.perfiles.rol. Esta revisión modifica la 003; no constituye una edición del documento 008.
13. Referencias técnicas
- Supabase: datos de usuario y creación automática de perfiles
- Supabase: autenticación con contraseña
- Supabase: sesiones
- Supabase: integración del cliente en SSR
- Supabase: Row Level Security
- Supabase: SMTP propio
Documentación de autenticación consultada el 2026-10-05; integración de perfiles revisada el 2026-10-09. Los valores propuestos de rutas y política de contraseña son decisiones de este borrador, no decisiones previas del proyecto.