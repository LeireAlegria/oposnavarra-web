011 — Integración de pagos con Stripe
Proyecto: OposNavarra
Identificador: 011-stripe-payments
Destino en el repositorio: specs/011-stripe-payments/spec.md
Estado: Especificación para implementación
1. Objetivo
Permitir contratar y renovar las suscripciones de OposNavarra mediante Stripe, sincronizando los cobros con Supabase y habilitando el acceso a la plataforma de tests únicamente durante los periodos pagados.
Esta spec conecta con cobros reales los planes, las suscripciones y la interfaz preparados en la spec 006. Stripe será la autoridad sobre los cobros y el ciclo de facturación; Supabase conservará la información necesaria para aplicar los permisos de acceso.
2. Dependencias y decisiones
- Autenticación de la spec 003: correo y contraseña, con correo verificado antes de contratar.
- Planes, suscripciones y alcance de acceso de la spec 006.
- Plataforma de tests y comprobaciones de acceso de la spec 007.
- React para el frontend y Supabase para base de datos, autenticación y Edge Functions.
- Stripe Checkout alojado para contratar y Stripe Billing para renovaciones automáticas.
- Stripe Customer Portal para gestionar la tarjeta, consultar facturas y cancelar la renovación.
Antes de implementar se leerán AGENTS.md, docs/constitution.md y las specs dependientes. Los nombres de tablas y campos de este documento son orientativos: se reutilizará el modelo existente, ampliándolo mediante migraciones, sin crear un segundo sistema de suscripciones.
El alcance por convocatoria se heredará de la 006. Integrar Stripe no cambia qué convocatorias incluye cada plan ni convierte los planes en compras por convocatoria.
3. Planes
Plan	Importe por cobro	Periodicidad	Renovación
Mensual	15 €	Cada mes	Automática
Semestral	79 €	Cada 6 meses	Automática
Anual	120 €	Cada año	Automática


Los importes son el total mostrado al usuario y cobrado por periodo, en EUR. No se añadirán recargos en Checkout. La configuración fiscal necesaria deberá validarse antes de activar producción; esta spec no determina el tratamiento fiscal del producto.
No habrá pruebas gratuitas, cupones, pagos fraccionados ni cambios de plan durante una suscripción vigente en este MVP. Cada cuenta podrá tener una única suscripción comercial vigente o pendiente de resolución. Los pagos iniciales se realizarán con tarjeta; otros métodos quedan fuera de alcance.
4. Contratación
1. El usuario selecciona un plan en la interfaz de la 006.
2. Si no está autenticado, se le dirige a autenticación conservando el plan seleccionado. Si no ha verificado su correo, debe verificarlo antes de continuar.
3. El frontend solicita una sesión de Checkout a una Edge Function autenticada, enviando únicamente el identificador interno del plan.
4. El backend valida el usuario, el plan publicado, su correspondencia con un precio autorizado de Stripe y la ausencia de otra suscripción incompatible.
5. Se obtiene o crea el Customer de Stripe asociado de forma única al usuario y se crea Checkout en modo suscripción.
6. El usuario paga en Stripe y vuelve a OposNavarra.
7. La página de retorno consulta Supabase y muestra «Estamos confirmando tu pago» hasta que la confirmación del backend esté disponible. Al confirmarse, muestra el plan, el periodo pagado y el acceso a la plataforma.
Volver a una URL de éxito o recibir checkout.session.completed por sí solo no habilitará acceso. La activación exige una factura de la suscripción confirmada como pagada y validada en el backend.
Si Checkout se abandona o expira, no se activa acceso. El usuario podrá retomar la contratación cuando la sesión anterior no permita producir un segundo cobro. Una confirmación lenta debe ofrecer actualizar el estado y volver a la cuenta, sin invitar a pagar otra vez.
5. Renovaciones y derecho de acceso
Stripe realizará los cobros automáticos; OposNavarra no ejecutará un cron de cargos. Cada factura de renovación pagada actualizará el periodo de acceso con las fechas verificadas de su suscripción y sus líneas de facturación. No se sumarán 30, 180 o 365 días calculados localmente.
Se conservarán por separado el estado de Stripe, la intención de cancelar la renovación y el final del periodo efectivamente pagado. Una actualización de la suscripción con un nuevo periodo de facturación no ampliará el acceso si no existe confirmación de pago correspondiente.
Situación	Comportamiento de acceso
Primer pago pendiente, fallido o pendiente de autenticación	Sin acceso
Periodo pagado vigente	Acceso según la 006
Cancelación de renovación	Acceso hasta el fin del periodo pagado
Renovación fallida	Sin ampliación del periodo; acceso solo hasta su vencimiento
Renovación recuperada y pagada	Restablecer acceso para el periodo confirmado
Periodo pagado vencido	Sin acceso, aunque el webhook de vencimiento no haya llegado


En el MVP no se añadirá un periodo de gracia gratuito. La política de reintentos y la acción final por impago se configurarán explícitamente en Stripe y se documentarán. El usuario verá el problema de pago y un enlace para resolverlo en el portal.
Las comprobaciones deben aplicarse en el backend y mediante RLS o funciones protegidas según la arquitectura existente. Ocultar botones en React no basta. Se conservarán el historial de tests y los datos del usuario al perder acceso.
6. Gestión de la suscripción
La sección de suscripción mostrará plan, estado comprensible, fin del acceso pagado, renovación prevista cuando proceda e incidencia de pago si existe.
Una Edge Function autenticada creará una sesión del Customer Portal para el Customer del usuario actual. No aceptará un Customer arbitrario enviado por el navegador.
El portal permitirá actualizar el método de pago, consultar documentos de facturación y cancelar al final del periodo. Se deshabilitarán cambios de plan, pausas y cancelaciones inmediatas en el flujo normal del MVP. Si se ofrece retirar una cancelación programada, debe sincronizarse también mediante webhooks.
Tras volver del portal se actualizará la vista desde Supabase. No se presumirá que el usuario ha realizado un cambio solo por haber visitado el portal.
7. Persistencia y migraciones
Ampliar el modelo de la 006 con lo necesario para guardar:
- Correspondencia única usuario–Customer de Stripe.
- Correspondencia de cada plan con su Product y Price de Stripe, diferenciando pruebas y producción.
- Identificador único de Subscription, estado original de Stripe, plan, fechas de facturación, fecha final de acceso pagado y cancelación programada.
- Facturas relevantes: identificador único, suscripción, moneda, importe, estado y periodo cubierto. No duplicar los datos completos de facturación de Stripe.
- Intentos de contratación necesarios para evitar sesiones concurrentes y permitir reintentos seguros.
- Registro de eventos: identificador único de Stripe, tipo, objeto relacionado, estado de procesamiento, fechas y error resumido.
Aplicar restricciones de unicidad e índices, además de RLS. El usuario podrá consultar sus propios datos y no podrá modificar importes, estados, identificadores de Stripe ni permisos. No almacenar números de tarjeta, CVC ni cuerpos completos de eventos sin una necesidad definida.
8. Webhooks y consistencia
Crear una Edge Function para recibir webhooks. Este endpoint no utiliza la sesión del usuario como autenticación: verificará la firma de Stripe sobre el cuerpo original antes de procesarlo.
Eventos mínimos:
- checkout.session.completed y checkout.session.expired: seguimiento de contratación.
- invoice.paid: confirmación inicial y renovaciones.
- invoice.payment_failed e invoice.payment_action_required: incidencias y acción requerida.
- customer.subscription.created, updated y deleted: ciclo de vida y cancelación.
- Eventos de reembolsos y disputas: registro y revisión operativa.
El procesamiento será idempotente y seguro frente a entregas concurrentes, repetidas o fuera de orden. Registrar un evento recibido no equivale a haberlo procesado: un intento fallido debe poder reintentarse. Se confirmará con HTTP 2xx después de completar el procesamiento o persistirlo en una cola durable; los fallos recuperables no deben perderse.
Validar usuario, Customer, Subscription, precio, moneda y factura antes de conceder acceso. Consultar el estado actual en Stripe cuando sea necesario para evitar que un evento antiguo sobrescriba un estado posterior. El vínculo con el usuario se establecerá desde el servidor; no se resolverá únicamente por correo electrónico.
Incluir un procedimiento administrativo reproducible para reconciliar una suscripción con Stripe y recuperar eventos fallidos sin duplicar cobros. No podrá invocarse libremente desde el navegador.
Los reembolsos y las disputas se registrarán para revisión en Stripe Dashboard; no se construirá un panel administrativo nuevo. No ampliarán acceso. Un reembolso parcial no reducirá automáticamente el periodo; un reembolso total del periodo vigente invalidará el acceso financiado por ese pago. La cancelación de cobros futuros debe gestionarse explícitamente en Stripe, ya que reembolsar no equivale a cancelar. Las disputas se marcarán para revisión sin revocación automática en este MVP.
9. Seguridad y configuración
- Claves secretas de Stripe, secreto de webhooks y credenciales privilegiadas de Supabase únicamente en backend.
- Validación de JWT para contratar y abrir el portal.
- Precios, URLs de retorno y alcance de acceso resueltos o permitidos por el servidor.
- Protección frente a dobles clics y peticiones concurrentes mediante persistencia e idempotencia; deshabilitar un botón no es suficiente.
- Entornos aislados de pruebas y producción, versión de API fijada y secretos documentados sin incluir sus valores.
- Logs con identificadores de correlación y errores útiles, sin secretos ni datos de tarjeta.
10. Criterios de aceptación
1. Una cuenta con correo verificado puede contratar cualquiera de los tres planes por el importe y la periodicidad indicados.
2. Un usuario anónimo o con correo sin verificar no puede crear Checkout.
3. Manipular el plan, el importe, el Customer o la URL de retorno no permite contratar una configuración no autorizada ni gestionar otra cuenta.
4. El primer pago confirmado habilita el acceso correcto; abandonar Checkout o visitar la URL de éxito no lo habilita.
5. Una renovación pagada actualiza una sola vez el periodo de acceso.
6. Una renovación fallida no extiende acceso; resolver el pago restablece el periodo que corresponda.
7. Cancelar evita nuevas renovaciones y conserva el acceso hasta el vencimiento pagado.
8. El vencimiento bloquea tests nuevos aunque falte un webhook, conservando el historial existente.
9. El portal solo permite gestionar la cuenta propia y las funciones habilitadas para el MVP.
10. Doble clic, solicitudes concurrentes y reintentos no generan suscripciones ni cobros duplicados.
11. Webhooks duplicados, retrasados o desordenados no corrompen estados ni amplían acceso indebidamente; los errores pueden recuperarse.
12. Una firma inválida se rechaza sin modificar datos.
13. Un reembolso total del periodo vigente retira el acceso de ese periodo; los reembolsos parciales y las disputas quedan registrados según la política anterior.
11. Verificación y entrega
Verificar en el entorno de pruebas de Stripe los pagos correctos, rechazos, autenticación adicional, abandonos, renovaciones de los tres planes, recuperación de impagos, cancelación al vencimiento y reembolsos. Utilizar Test Clocks donde resulte aplicable para avanzar periodos.
Añadir pruebas relevantes para firma e idempotencia de webhooks, acceso por periodo pagado, aislamiento entre usuarios y concurrencia de contratación. Ejecutar las comprobaciones de lint, tipos y tests exigidas por el repositorio.
Entregar frontend actualizado, Edge Functions, migraciones, pruebas y documentación de configuración, reintentos, reconciliación y paso a producción. Incluir los comandos de despliegue y las variables necesarias. No cargar tarjetas reales durante las pruebas ni activar cobros reales como parte de la verificación.
12. Fuera de alcance
Pasarela propia, PayPal, Redsys, Bizum, cambios de plan con prorrateos, cupones, pruebas gratuitas, pagos únicos, compras independientes por convocatoria, panel contable, automatización fiscal avanzada y política de tests gratuitos.
Referencias técnicas
- Suscripciones y webhooks
- Checkout para suscripciones
- Customer Portal
- Firmas, reintentos y orden de webhooks
Consultar estas referencias y la versión de API utilizada durante la implementación. Las reglas de producto de esta spec son decisiones de OposNavarra, no valores predeterminados del proveedor.