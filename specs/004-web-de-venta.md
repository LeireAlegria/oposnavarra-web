004 — Web de venta de OposNavarra
Estado y objetivo
Estado: propuesta funcional lista para revisión e implementación, actualizada al modelo de suscripción global acordado en la spec 006.
Presentar OposNavarra, explicar qué ofrece la plataforma de test y orientar al visitante hacia una única suscripción que da acceso a todas las convocatorias disponibles en la plataforma. La web de venta es pública y forma parte del mismo proyecto web que la plataforma de test, con una experiencia de navegación diferenciada.
Dependencias
- 001-project-bootstrap: estructura y tecnologías del proyecto.
- 002-database-foundation: convocatorias y catálogo académico.
- Spec 003 de autenticación: registro, inicio de sesión y verificación obligatoria del correo mediante Supabase.
- 006-subscription-management: modalidades, precios, contratación y gestión de la suscripción; tablas de planes y suscripciones.
- Spec 009 de pasarela de pago: integración del cobro y confirmación del pago.
- La aplicación de test se resolverá en la spec 007. Esta spec describe sus funcionalidades comerciales, sin implementarlas.
Consultar la constitución y las specs existentes antes de implementar. No modificar sus contratos como parte de esta tarea.
Alcance
- Cuatro páginas públicas: Inicio, Tests disponibles, Planes y Contacto.
- Cabecera y pie comunes, navegación adaptable a móvil y botón «Acceder».
- Catálogo inicial de una convocatoria: Administrativo de Navarra, con su denominación oficial concreta antes de publicar.
- Presentación de una suscripción global con modalidades mensual, semestral y anual.
- Enlaces al flujo de contratación definido por la spec 006 e integrado con la pasarela de la spec 009.
- Formulario de contacto con envío real y protección básica frente al spam.
- Estados de carga, error y ausencia de datos cuando corresponda.
- Accesibilidad, adaptación a distintos tamaños de pantalla y metadatos básicos por página.
Fuera de alcance
- Checkout, cobros, renovaciones, cancelaciones y activación de suscripciones.
- Configuración, realización, resultados e histórico de test.
- Cambios en el flujo de autenticación de la spec 003.
- Panel de administración del catálogo, planes o mensajes.
- Test gratuitos, códigos promocionales, testimonios inventados y métricas comerciales sin respaldo.
- Blog, newsletter, chat y sistema de atención mediante tickets.
Rutas y navegación
Página	Ruta propuesta	Acceso
Inicio	/	Público
Tests disponibles	/tests	Público
Planes	/planes	Público
Contacto	/contacto	Público


Las rutas se ajustarán a las convenciones del repositorio si ya están definidas, manteniendo cuatro destinos independientes.
La cabecera incluye el nombre o logotipo de OposNavarra, los cuatro enlaces y «Acceder». El logotipo lleva a Inicio. La página actual se identifica visualmente y de forma accesible. En móvil, todos los enlaces siguen disponibles mediante un menú operable con teclado.
«Acceder» envía a quien no tiene sesión al inicio de sesión de la spec 003, conservando como destino la entrada a la plataforma. Quien ya tiene una sesión válida continúa hacia esa entrada. La autorización para realizar test corresponde a la plataforma y exige una suscripción activa; este botón no concede acceso por sí mismo. Si la plataforma todavía no está implementada, se utiliza una pantalla explícita de disponibilidad pendiente, sin enlaces rotos ni test habilitados.
El pie incluye navegación secundaria, acceso a Contacto y enlaces a los documentos legales que estén disponibles. No crear enlaces a páginas inexistentes. La publicación comercial requiere disponer de los textos legales correspondientes, cuya redacción no forma parte de esta spec.
Página Inicio
Contenido
1. Presentación breve: qué es OposNavarra y para quién está pensado.
2. Necesidad que resuelve: practicar preguntas vinculadas a una convocatoria y revisar el resultado para orientar el estudio.
3. Funcionalidades de la plataforma prevista:
   - Test por temas.
   - Selección de número de preguntas y tiempo.
   - Selección de temas, inicialmente todos seleccionados.
   - Revisión del resultado y consulta de un histórico sencillo.
4. Convocatoria disponible en el MVP.
5. Resumen de la suscripción y sus modalidades mensual, semestral y anual, todas con el mismo acceso al catálogo completo.
6. Llamadas a «Ver tests disponibles» y «Ver planes».
Reglas
- El contenido distingue las funcionalidades disponibles de las que todavía están en preparación.
- No presentar funciones pendientes como utilizables ni prometer aprobación de la convocatoria.
- Los planes y funcionalidades coinciden con los mostrados en sus páginas correspondientes.
- Explicar que una suscripción activa permite practicar en todas las convocatorias disponibles, incluidas las que se incorporen al catálogo durante su vigencia. No hay compra individual de convocatorias.
- Los textos de producto emplean «convocatoria» como término del dominio.
Página Tests disponibles
Contenido
Mostrar las convocatorias incluidas en la suscripción global y disponibles para practicar. En el MVP se presenta una sola, correspondiente a Administrativo de Navarra. Su ficha incluye:
- Denominación suficiente para identificar la convocatoria exacta.
- Descripción breve del contenido de preparación.
- Temas incluidos, cuando exista información verificada en el catálogo.
- Estado del contenido: disponible en la plataforma o en preparación.
- Acción «Ver planes» hacia la página general de Planes, sin seleccionar una convocatoria para contratar.
Reglas
- La disponibilidad del contenido se declara explícitamente; la existencia de una convocatoria en la base de datos no implica que esté publicada para practicar.
- Una convocatoria en preparación se identifica como tal y no se anuncia como contenido ya accesible.
- Todas las convocatorias publicadas para practicar están incluidas en cualquiera de las modalidades de suscripción. No existen precios ni suscripciones por convocatoria.
- No publicar automáticamente todas las convocatorias de la base de datos.
- No exponer en esta página el banco de preguntas, las respuestas correctas ni información de usuarios.
- El catálogo podrá incorporar más convocatorias sin rediseñar la página.
- Si el catálogo está vacío, mostrar un mensaje comprensible y acceso a Contacto.
- Si falla una consulta necesaria, mostrar un error con opción de reintento; no interpretar el fallo como catálogo vacío.
- No incorporar filtros, buscador ni paginación para el catálogo de una sola convocatoria del MVP.
Página Planes
Modelo comercial
Existe una única suscripción a OposNavarra. Las modalidades cambian el precio y la duración del periodo contratado; todas incluyen las mismas funcionalidades y acceso a todas las convocatorias disponibles. No se vincula la suscripción a una convocatoria.
Modalidad	Precio total por periodo	Duración	Renovación
Mensual	15 €	1 mes	Automática al finalizar el periodo
Semestral	79 €	6 meses	Automática al finalizar el periodo
Anual	120 €	12 meses	Automática al finalizar el periodo


Estos importes son los acordados para la spec 006. La fuente de datos definitiva es la de planes definida allí: no mantener una copia independiente de los precios en esta web.
Presentación
- Mostrar las tres modalidades y su importe total por periodo, sin confundir pago semestral o anual con cobros mensuales.
- Indicar expresamente en todas ellas «Acceso a todas las convocatorias disponibles».
- Mostrar la renovación automática y enlazar a las condiciones y gestión de suscripción definidas por la spec 006.
- Si se muestra un equivalente mensual o un ahorro, calcularlo desde los precios vigentes e identificarlo como referencia; no sustituye al importe total cobrado.
- Las nuevas convocatorias publicadas se incluyen en la suscripción activa sin contratar una suscripción adicional.
- No ofrecer compras individuales, selección de convocatoria para pagar ni niveles de acceso diferentes por modalidad.
Selección y destino
- Desde Inicio o Tests disponibles se abre /planes, sin ID de convocatoria ni selector de convocatoria.
- Cada tarjeta permite continuar con la modalidad elegida al flujo de contratación de la spec 006 usando el identificador estable del plan.
- Reutilizar las rutas y reglas de autenticación de ese flujo; conservar la modalidad durante el inicio de sesión o registro cuando sea necesario.
- La integración con el pago corresponde a la spec 009. Esta spec no crea un checkout ni modifica sus reglas.
- Contacto no se utiliza como destino del botón de contratación ni como paso para activar una suscripción.
- Si la contratación todavía no está disponible, mostrar un estado explícito de disponibilidad pendiente y deshabilitar la acción de contratación. No simular compras ni sustituirlas por consultas al formulario.
- Para quien ya tiene una suscripción activa, reutilizar el comportamiento definido por la spec 006 para acceder a su gestión; no ofrecer una segunda suscripción simultánea.
- La selección de modalidad, una redirección o el regreso desde el proveedor de pago no acreditan una suscripción activa. El acceso depende del estado autorizado por las specs 006 y 009.
- Si falla la carga de planes, mostrar error y opción de reintento. Si no hay modalidades contratables, mostrar un estado de indisponibilidad sin inventar importes ni enlaces.
Página Contacto
Campos
Campo	Obligatorio	Validación propuesta
Nombre	Sí	Entre 1 y 100 caracteres tras eliminar espacios exteriores
Correo electrónico	Sí	Formato válido y máximo de 254 caracteres
Mensaje	Sí	Entre 10 y 5.000 caracteres tras eliminar espacios exteriores


El formulario sirve para consultas generales sobre el producto, el acceso y las suscripciones. No contrata ni activa suscripciones. Está disponible sin autenticación. Incluir información sobre el tratamiento de los datos y un enlace al texto de privacidad disponible antes de publicar.
Comportamiento
- Validar los campos en el cliente y repetir la validación en el servidor.
- Mostrar errores junto a cada campo y mantener los valores introducidos.
- Durante el envío, indicar progreso e impedir envíos duplicados desde el formulario.
- Tras la aceptación por el servicio de correo, mostrar una confirmación comprensible y vaciar los campos.
- La confirmación indica que la consulta se ha enviado; no garantiza que haya sido leída ni promete un plazo de respuesta no establecido.
- Ante error, conservar los campos y permitir reintentar.
- Ante limitación por frecuencia, informar de que debe esperar antes de volver a intentarlo.
Procesamiento del envío
Usar una función de servidor, preferentemente una Supabase Edge Function, que valide los datos y envíe el mensaje a la dirección de atención configurada mediante un proveedor de correo transaccional.
- Credenciales y dirección receptora se configuran en el servidor. Nunca exponer claves privilegiadas o del proveedor en el cliente.
- El destinatario es fijo y no puede establecerlo el visitante.
- Usar un remitente autorizado y el correo del visitante como dirección de respuesta, validado de forma segura.
- Tratar los campos como texto; no ejecutar ni insertar HTML proporcionado por el usuario.
- Aplicar límites de tamaño, un campo trampa y limitación de frecuencia verificada en el servidor.
- No registrar mensajes completos ni credenciales en los logs.
- Devolver errores comprensibles sin detalles internos del proveedor.
- Esta spec no requiere una tabla de mensajes ni un panel de consultas: la recepción se realiza por correo.
- El envío real y su configuración son parte del criterio de finalización; una confirmación simulada no cumple la spec.
Datos y arquitectura
- Reutilizar React, Tailwind CSS, shadcn/ui, React Hook Form y Zod conforme a las convenciones del proyecto.
- Reutilizar Supabase y el modelo de convocatorias de la spec 002.
- Reutilizar las tablas de planes y suscripciones y los contratos definidos por la spec 006. Esta spec no crea tablas comerciales alternativas ni una relación de suscripción por convocatoria.
- Inicio y Planes consumen la misma fuente de modalidades y precios. Antes de implementar la spec 006, pueden utilizarse datos provisionales centralizados para desarrollo, sin activar contratación; al integrarla deben sustituirse por su fuente definitiva.
- Separar el catálogo académico de la oferta comercial global: publicar una nueva convocatoria no crea un nuevo plan.
- Las lecturas públicas de planes solo exponen los campos necesarios de la oferta, nunca datos de suscripciones de otros usuarios.
- No inferir el acceso a preguntas a partir de la publicación del catálogo.
- Si se leen datos desde Supabase, ofrecer únicamente los campos públicos necesarios mediante los permisos adecuados; no ampliar el acceso al banco de preguntas.
- No incorporar otro backend, CMS ni panel de administración para resolver estas páginas.
Requisitos de experiencia y calidad
- Contenido principal en español y textos claros sobre convocatoria, modalidad y disponibilidad.
- Diseño usable en móvil, tableta y escritorio, sin desplazamiento horizontal en las páginas.
- Navegación y formulario operables mediante teclado, foco visible, etiquetas asociadas y errores accesibles.
- Jerarquía de encabezados coherente, contraste suficiente y texto alternativo para imágenes informativas.
- Título y descripción específicos por página. Las páginas públicas deben entregar contenido indexable mediante el mecanismo compatible con la arquitectura existente; no incorporar un framework nuevo solo para esta spec.
- La recarga y el acceso directo a cualquiera de las cuatro rutas funcionan en el alojamiento elegido.
- El formulario y los mensajes no dependen únicamente del color para comunicar su estado.
Historias de usuario
1. Como visitante, quiero entender qué ofrece OposNavarra para decidir si me sirve para preparar mi convocatoria.
2. Como visitante, quiero identificar qué convocatoria está disponible y qué contenido incluye y saber que está incluida en la suscripción.
3. Como visitante, quiero comparar precio y duración de las modalidades mensual, semestral y anual, sabiendo que todas dan acceso al catálogo completo.
4. Como visitante, quiero enviar una consulta y recibir confirmación de que se ha enviado.
5. Como usuario registrado, quiero encontrar el acceso a la plataforma desde cualquier página comercial.
Criterios de aceptación
- CA-01: las cuatro páginas son públicas y accesibles desde la navegación común, sin exigir registro.
- CA-02: Inicio explica el producto, la necesidad, las funcionalidades y dirige al catálogo y a los planes.
- CA-03: Tests disponibles presenta solo el catálogo comercial declarado, inicialmente una convocatoria concreta de Administrativo de Navarra.
- CA-04: el enlace desde Tests disponibles abre la página general de Planes sin exigir seleccionar una convocatoria.
- CA-05: Planes muestra mensual (15 €), semestral (79 €) y anual (120 €), con precio total por periodo, renovación automática y el mismo acceso a todas las convocatorias disponibles, conforme a los datos de la spec 006.
- CA-06: los botones conservan el plan elegido y conducen al flujo de la spec 006 conectado con la pasarela de la spec 009. Si no está disponible, muestran indisponibilidad; nunca derivan a Contacto ni simulan una compra.
- CA-07: «Acceder» conecta con el flujo de sesión de la spec 003 y no habilita test sin la autorización correspondiente.
- CA-08: Contacto valida nombre, correo y mensaje en cliente y servidor, con errores vinculados a los campos.
- CA-09: un envío válido llega al buzón configurado y solo se confirma tras la aceptación del servicio de envío.
- CA-10: los errores de envío conservan los datos; la carga impide duplicados desde la interfaz y el servidor limita abusos.
- CA-11: catálogo vacío, planes no disponibles y fallo de carga tienen mensajes diferenciados y acciones para continuar.
- CA-12: navegación, selección de plan y envío del formulario funcionan en móvil y con teclado.
- CA-13: cada ruta admite apertura directa y recarga, y tiene título, descripción y contenido público indexable.
- CA-14: no se exponen claves secretas, preguntas privadas, respuestas correctas ni datos de usuarios.
- CA-15: los textos y llamadas a la acción reflejan el estado real del producto; las funciones pendientes se identifican como tales.
- CA-16: ninguna página limita la suscripción a una convocatoria ni ofrece su compra individual. Las nuevas convocatorias publicadas quedan incluidas mientras la suscripción esté activa.
- CA-17: una suscripción activa conduce a la gestión definida por la spec 006; la web comercial no crea una segunda suscripción ni decide el estado de pago.
Verificación y finalización
- Ejecutar los controles de tipos, lint y build definidos por el repositorio.
- Comprobar navegación directa, recargas, conservación del plan elegido en el flujo de autenticación y contratación, y estados de carga fallida o indisponibilidad.
- Verificar el formulario con envío real a un buzón de prueba y casos de validación, fallo del proveedor y limitación de frecuencia.
- Comprobar mediante una petición directa que el servidor rechaza datos inválidos aunque se omita la validación del navegador.
- Revisar visualmente las cuatro páginas en móvil y escritorio y recorrer navegación y formulario con teclado.
- Añadir pruebas automatizadas útiles para los contratos de validación y procesamiento del envío según las herramientas existentes; evitar pruebas que solo repliquen contenido estático.
- Documentar variables de entorno y pasos de configuración del envío, sin valores secretos.
La implementación funcional se considera terminada cuando se cumplen los criterios aplicables y existe envío real. La publicación comercial requiere además cerrar los datos pendientes siguientes.
Datos pendientes antes de publicar
- ID y denominación exacta de la convocatoria inicial, y temas que pueden anunciarse como incluidos.
- Confirmar que los datos de planes de la spec 006 contienen los precios acordados (15 €, 79 € y 120 €) y sus tres periodos de renovación.
- Rutas y contratos concretos de contratación, gestión y pago de las specs 006 y 009.
- Condiciones comerciales y presentación final de los importes conforme a esas specs.
- Dirección receptora, proveedor de correo y remitente autorizado.
- Textos legales y de privacidad, y sus rutas.
- Estado real de disponibilidad de la plataforma y de la contratación.
Estos datos se configuran sin alterar el alcance funcional. No inventar importes, destinatarios, condiciones o contenido académico para completar la implementación.