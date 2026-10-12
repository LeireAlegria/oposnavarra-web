006 — Contratación y gestión de suscripciones
Objetivo
Implementar en OposNavarra la contratación y gestión de suscripciones, incluyendo frontend, backend y persistencia en Supabase. Actualizar la web de venta para presentar los tres planes y el acceso global a las convocatorias. La integración real con la pasarela de pago queda fuera de esta spec.
Dependencias y decisiones
- Se parte del proyecto de la spec 001, el esquema de la 002, la autenticación de la 003 y la web de venta de la 004.
- Se utiliza el término «convocatoria» en el producto y el modelo de datos.
- Una suscripción permite acceder a todas las convocatorias disponibles, incluidas las incorporadas durante su vigencia.
- La suscripción pertenece al usuario, sin relación con una convocatoria concreta.
- Esta spec sustituye, en las pantallas afectadas, el planteamiento anterior de acceso contratado por convocatoria.
- La plataforma requiere autenticación y correo verificado. Realizar tests requiere además acceso de suscripción vigente.
Planes
Código	Nombre	Precio por periodo	Duración	Renovación
mensual	Mensual	15 €	1 mes	Automática cada mes
semestral	Semestral	79 €	6 meses	Automática cada 6 meses
anual	Anual	120 €	12 meses	Automática cada año


Los importes se cobran por el periodo completo. Los tres planes ofrecen las mismas funcionalidades y acceso. La interfaz debe mostrar el importe total del periodo y evitar presentar una equivalencia mensual como si fuera el importe cobrado.
Alcance
Incluido
- Migraciones, restricciones, índices y políticas RLS para planes y suscripciones.
- Datos iniciales de los tres planes.
- Consulta pública de planes comercializables.
- Inicio de contratación autenticado y persistencia de la selección como pendiente, sin conceder acceso.
- Consulta de la suscripción propia y comprobación de acceso desde el backend.
- Cancelación de la renovación con confirmación y conservación del periodo pagado.
- Contrato interno para integrar posteriormente la confirmación de pagos y renovaciones.
- Actualización del apartado de planes de Inicio, página Planes, resumen de contratación y gestión de suscripción.
- Estados de carga, error, ausencia de suscripción y contratación pendiente.
Fuera de alcance
- Pasarela, captura de datos de pago, cobros y webhooks del proveedor.
- Facturas, devoluciones, prorrateos, cupones y pruebas gratuitas.
- Cambios de plan durante el periodo contratado.
- Planes por convocatoria y contratación simultánea de varios planes.
- Panel administrativo de planes o suscripciones.
- Implementación de la aplicación de tests; se proporciona la comprobación de acceso para su integración.
Reglas de negocio
1. Solo puede existir una suscripción pendiente o activa por usuario. Las finalizadas se conservan como historial técnico.
2. Una contratación pendiente no permite realizar tests.
3. El acceso requiere estado activo y una fecha actual dentro de [periodo_inicio, periodo_fin). Las fechas se evalúan en el servidor.
4. La caducidad del periodo impide el acceso aunque un proceso todavía no haya actualizado el estado persistido.
5. Cancelar la renovación marca cancelar_al_final_del_periodo = true; la suscripción continúa activa hasta el final del periodo pagado.
6. La cancelación debe ser idempotente: repetirla no cambia fechas ni produce nuevas acciones.
7. Solo una confirmación de pago validada por un componente de confianza puede activar o ampliar una suscripción. El paso del tiempo no amplía el acceso.
8. No se concede acceso por pulsar «Contratar», por un resultado enviado por el navegador ni por visitar una URL de éxito.
9. Los periodos son meses de calendario, no bloques de 30 días. Si el día de referencia no existe en el mes destino, se usa el último día de ese mes. La integración futura debe conservar la referencia original o utilizar las fechas confirmadas por el proveedor para evitar desplazamientos acumulados.
10. Se almacenan fechas con zona horaria en UTC y se presentan al usuario en su zona local.
11. Los importes contratados se conservan en la suscripción: modificar el catálogo no altera retrospectivamente sus condiciones. Los cambios de precio para futuras renovaciones quedan fuera de esta spec.
Modelo de datos
planes
Campo	Tipo propuesto	Reglas
id	uuid	Clave primaria
codigo	text	Único: mensual, semestral o anual
nombre	text	Obligatorio
precio_centimos	integer	Positivo
moneda	text	EUR en el MVP
duracion_meses	integer	1, 6 o 12
activo	boolean	Indica si admite nuevas contrataciones
orden	integer	Orden de presentación
created_at	timestamptz	Fecha de creación
updated_at	timestamptz	Fecha de actualización


La migración carga los precios 1500, 7900 y 12000 céntimos de forma reproducible, sin duplicar códigos. Un plan referenciado no se elimina; se desactiva cuando deje de comercializarse.
suscripciones
Campo	Tipo propuesto	Reglas
id	uuid	Clave primaria
usuario_id	uuid	FK a auth.users
plan_id	uuid	FK a planes
estado	text	pendiente, activa, vencida o cancelada
precio_centimos	integer	Copia del precio contratado
moneda	text	Copia de la moneda contratada
duracion_meses	integer	Copia de la duración contratada
periodo_inicio	timestamptz, nullable	Nulo mientras esté pendiente
periodo_fin	timestamptz, nullable	Nulo mientras esté pendiente
cancelar_al_final_del_periodo	boolean	false por defecto
cancelacion_solicitada_at	timestamptz, nullable	Momento de solicitud
created_at	timestamptz	Fecha de creación
updated_at	timestamptz	Fecha de actualización


- No existe convocatoria_id en esta tabla.
- Una suscripción activa requiere ambas fechas y periodo_fin > periodo_inicio.
- Los importes y las duraciones deben ser positivos.
- Un índice único parcial sobre usuario_id para estados pendiente y activa impide duplicados incluso con solicitudes concurrentes.
- Antes de crear una contratación, el backend reconcilia cualquier suscripción activa cuyo periodo haya terminado, dentro de la misma operación transaccional.
- cancelada representa una contratación pendiente abandonada o una suscripción cuyo periodo terminó después de cancelar la renovación. No se usa al solicitar la cancelación de una suscripción todavía vigente.
- vencida representa un periodo terminado sin una renovación confirmada y sin cancelación solicitada.
No se crea una tabla de pagos en esta spec. La trazabilidad e identificación de eventos de pago se definirán con la pasarela, antes de habilitar cobros reales.
Backend y seguridad
Implementar las operaciones utilizando las capacidades de Supabase y las convenciones del repositorio. Evitar añadir un servidor independiente si no es necesario.
Operación	Permiso	Resultado
Consultar planes	Público	Planes activos ordenados
Iniciar contratación(plan_id)	Usuario autenticado y verificado	Suscripción pendiente con condiciones tomadas del catálogo
Consultar mi suscripción	Usuario autenticado	Estado, condiciones, fechas y acceso efectivo
Cancelar renovación	Titular autenticado y verificado	Marca cancelación sin reducir el periodo
Abandonar contratación pendiente	Titular autenticado y verificado	Finaliza la selección pendiente para permitir otra
Comprobar acceso	Servidor o usuario autenticado para sí mismo	Resultado calculado con estado y fechas del servidor


- El backend obtiene la identidad de la sesión, no de un usuario_id confiado al cliente.
- El inicio de contratación valida que el plan siga activo y utiliza su precio del servidor.
- Si ya hay una suscripción activa vigente, no permite otra contratación. Si hay una pendiente, devuelve la existente o exige abandonarla antes de elegir otra.
- RLS permite lectura pública únicamente de planes activos y lectura de suscripciones únicamente al titular.
- El cliente no dispone de INSERT, UPDATE o DELETE directos sobre suscripciones ni escritura sobre planes.
- Las mutaciones se realizan mediante operaciones controladas con validaciones equivalentes, sin exponer credenciales privilegiadas al navegador.
- Las operaciones privilegiadas deben limitar permisos y validar propiedad, estado y concurrencia.
- La comprobación debe proteger también las operaciones que generan o permiten realizar tests; ocultar botones no constituye control de acceso.
Preparación para la pasarela
Definir una interfaz interna para aplicar una confirmación de pago validada que identifique la suscripción y el periodo confirmado. Debe validar fechas y transición de estado y evitar aplicar dos veces la misma confirmación. La persistencia de identificadores de eventos y el adaptador concreto se implementarán con la pasarela.
En esta spec no se expone una operación pública que active suscripciones. Las pruebas de activación y renovación usan fixtures o un adaptador de pruebas exclusivamente local. No se simula una compra exitosa en producción.
La cancelación persistida representa la intención del usuario. Antes de habilitar cobros reales, la integración de pasarela deberá transmitirla al proveedor y reflejar el resultado confirmado; una marca en la base de datos por sí sola no cancela un cobro externo.
Frontend
Web de venta
- Actualizar el apartado de planes de Inicio y la página Planes dentro de esta spec.
- Obtener precios y periodicidades de planes, sin duplicar importes en componentes.
- Mostrar los tres planes, importe por periodo, renovación automática y acceso a todas las convocatorias disponibles.
- Indicar que las nuevas convocatorias se incluyen mientras la suscripción esté vigente.
- Explicar que cancelar la renovación conserva el acceso hasta finalizar el periodo pagado.
- Corregir en las pantallas afectadas cualquier texto que vincule la compra a una convocatoria concreta.
- Mostrar un error recuperable si el catálogo no está disponible; no sustituirlo por precios inventados.
Contratación
1. El usuario selecciona un plan.
2. Si no ha iniciado sesión, se dirige al flujo de autenticación conservando la selección.
3. Si no ha verificado el correo, se dirige al flujo de verificación existente.
4. Se muestra un resumen con plan, precio total, duración, renovación automática y acceso incluido.
5. Al continuar, el backend registra o recupera la contratación pendiente.
6. Mientras no exista pasarela, se informa «El pago todavía no está disponible» y no se solicita información bancaria ni se concede acceso.
El usuario puede abandonar la selección pendiente y elegir otro plan. El frontend previene dobles envíos y el backend garantiza la unicidad.
Gestión de suscripción
Pantalla accesible desde la cuenta del usuario con:
- Plan y precio por periodo.
- Estado comprensible y fecha de finalización del periodo actual.
- Próxima renovación prevista si no se ha solicitado cancelación, sin presentarla como cobro confirmado.
- Mensaje de acceso global cuando la suscripción está vigente.
- Acción «Cancelar renovación» para una suscripción activa que todavía renueve.
- Confirmación con la fecha exacta hasta la que conservará acceso.
- Tras confirmar: mensaje «Tu suscripción no se renovará. Puedes acceder hasta…».
- Para ausencia de suscripción o periodo finalizado: enlace a los planes.
- Para una contratación pendiente: aviso de pago no disponible y opción de abandonar la selección.
No ofrecer cambio de plan ni reactivación de renovación en el MVP. Una suscripción con cancelación solicitada sigue bloqueando otra contratación hasta finalizar su periodo.
La interfaz debe ser responsive, accesible mediante teclado y coherente con los componentes, validación y estilos ya adoptados en el proyecto.
Criterios de aceptación
1. Inicio y Planes muestran mensual 15 €, semestral 79 € y anual 120 €, leyendo el catálogo persistido.
2. Los tres planes indican renovación automática y acceso a todas las convocatorias disponibles.
3. Un visitante puede consultar planes; contratar requiere sesión y correo verificado.
4. Seleccionar un plan genera una contratación pendiente y nunca activa el acceso.
5. Sin pasarela, el flujo informa de su indisponibilidad sin afirmar que se ha realizado un pago.
6. Solicitudes repetidas o concurrentes no generan suscripciones pendientes o activas duplicadas.
7. Un usuario solo puede leer su suscripción y no puede modificar directamente precio, estado ni fechas.
8. Una suscripción activa dentro de su periodo habilita acceso a todas las convocatorias disponibles.
9. Una suscripción pendiente, finalizada o fuera de su intervalo no permite realizar tests, aunque el frontend se manipule.
10. Cancelar la renovación conserva las fechas y el acceso; repetir la solicitud es seguro.
11. Al alcanzar periodo_fin, el acceso termina sin depender de una tarea programada.
12. Solo el componente de confianza preparado para pagos puede aplicar activaciones o renovaciones; no existe acceso público a esa capacidad.
13. El catálogo y las suscripciones se crean mediante migraciones reproducibles con restricciones y RLS.
14. La gestión muestra correctamente ausencia, pendiente, activa, cancelación solicitada y finalizada, junto con carga y errores recuperables.
Verificación
- Ejecutar las comprobaciones de tipos, lint, build y tests exigidas por el repositorio.
- Probar restricciones de unicidad con solicitudes concurrentes y las políticas RLS con dos usuarios y un visitante.
- Probar los límites exactos del periodo, cancelación idempotente y fechas de fin de mes.
- Probar el recorrido selección → autenticación/verificación → resumen → pendiente, conservando el plan seleccionado.
- Verificar visualmente Inicio, Planes y gestión en móvil y escritorio.
- Validar que los fixtures y adaptadores de pago de pruebas no habilitan activaciones en producción.
Entregables
- Migración Supabase con tablas, restricciones, índices, RLS y planes iniciales.
- Operaciones de backend para contratación pendiente, consulta, cancelación y acceso.
- Contrato interno documentado para la futura integración de pagos.
- Actualización de la web de venta y pantallas de contratación y gestión.
- Pruebas de seguridad y reglas de negocio y documentación necesaria para integrar la pasarela y la aplicación de tests.