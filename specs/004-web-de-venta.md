004 — Web de venta de OposNavarra
Estado y objetivo
Estado: propuesta funcional lista para revisión e implementación, con los datos comerciales pendientes indicados al final.
Presentar OposNavarra, explicar qué ofrece la plataforma de test y orientar al visitante hacia una suscripción para una convocatoria concreta. La web de venta es pública y forma parte del mismo proyecto web que la plataforma de test, con una experiencia de navegación diferenciada.
Dependencias
- 001-project-bootstrap: estructura y tecnologías del proyecto.
- 002-database-foundation: convocatorias y catálogo académico.
- Spec 003 de autenticación: registro, inicio de sesión y verificación obligatoria del correo mediante Supabase.
- La compra y gestión de suscripciones se resolverán en una spec posterior.
- La aplicación de test se resolverá en la spec 007. Esta spec describe sus funcionalidades comerciales, sin implementarlas.
Consultar la constitución y las specs existentes antes de implementar. No modificar sus contratos como parte de esta tarea.
Alcance
- Cuatro páginas públicas: Inicio, Tests disponibles, Planes y Contacto.
- Cabecera y pie comunes, navegación adaptable a móvil y botón «Acceder».
- Catálogo inicial de una convocatoria: Administrativo de Navarra, con su denominación oficial concreta antes de publicar.
- Presentación de planes mensual y anual asociados a una convocatoria.
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
5. Resumen de los planes mensual y anual.
6. Llamadas a «Ver tests disponibles» y «Ver planes».
Reglas
- El contenido distingue las funcionalidades disponibles de las que todavía están en preparación.
- No presentar funciones pendientes como utilizables ni prometer aprobación de la convocatoria.
- Los planes y funcionalidades coinciden con los mostrados en sus páginas correspondientes.
- Los textos de producto emplean «convocatoria» como término del dominio.
Página Tests disponibles
Contenido
Mostrar las convocatorias comercialmente disponibles. En el MVP se presenta una sola, correspondiente a Administrativo de Navarra. Su ficha incluye:
- Denominación suficiente para identificar la convocatoria exacta.
- Descripción breve del contenido de preparación.
- Temas incluidos, cuando exista información verificada en el catálogo.
- Estado comercial: disponible para contratar o en preparación.
- Acción para consultar sus planes, conservando la convocatoria seleccionada.
Reglas
- La disponibilidad comercial se declara explícitamente; la existencia de una convocatoria en la base de datos no implica que esté a la venta.
- No publicar automáticamente todas las convocatorias de la base de datos.
- No exponer en esta página el banco de preguntas, las respuestas correctas ni información de usuarios.
- El catálogo podrá incorporar más convocatorias sin rediseñar la página.
- Si el catálogo está vacío, mostrar un mensaje comprensible y acceso a Contacto.
- Si falla una consulta necesaria, mostrar un error con opción de reintento; no interpretar el fallo como catálogo vacío.
- No incorporar filtros, buscador ni paginación para el catálogo de una sola convocatoria del MVP.
Página Planes
Contenido
Presentar dos modalidades para la convocatoria seleccionada:
Modalidad	Información necesaria
Mensual	Precio, moneda, periodo mensual y convocatoria incluida
Anual	Precio total anual, moneda, periodo anual y convocatoria incluida


Ambas modalidades ofrecen las mismas funcionalidades; cambia el periodo contratado. El precio anual se muestra como importe total. Si se incluye un equivalente mensual, se identifica como referencia, sin confundirlo con un cobro mensual. Solo mostrar ahorro si se calcula a partir de precios definidos y comparables.
Cada tarjeta identifica la convocatoria y explica que el acceso corresponde únicamente a ella. No sugerir que una suscripción incluye todo el catálogo presente o futuro.
Selección y destino
- Desde Tests disponibles se abre Planes con la convocatoria seleccionada, identificada mediante un ID estable en la URL, por ejemplo /planes?convocatoria=<id>.
- Al acceder directamente a Planes en el MVP se selecciona la única convocatoria publicada.
- Un identificador inexistente o no comercializado muestra un aviso y permite volver al catálogo.
- Con futuras convocatorias, la página permitirá elegir una antes de seleccionar el plan.
- Mientras no exista integración de compra, cada tarjeta muestra «Consultar plan mensual» o «Consultar plan anual» y conduce al formulario de Contacto con convocatoria y modalidad preseleccionadas.
- El formulario muestra ese contexto y permite al visitante modificarlo. Es información de consulta, no una reserva ni una compra.
- Cuando la spec de suscripciones aporte el flujo de compra, sustituirá este destino y podrá usar «Suscribirme», conservando convocatoria y modalidad.
- No crear checkout simulado, suscripciones ficticias ni confirmaciones de pago.
- Si los precios están pendientes, mostrar «Precio pendiente de publicación». La publicación comercial requiere precios aprobados y coherentes en todas las páginas.
Página Contacto
Campos
Campo	Obligatorio	Validación propuesta
Nombre	Sí	Entre 1 y 100 caracteres tras eliminar espacios exteriores
Correo electrónico	Sí	Formato válido y máximo de 254 caracteres
Mensaje	Sí	Entre 10 y 5.000 caracteres tras eliminar espacios exteriores
Convocatoria y modalidad	No	Valores válidos del catálogo comercial, si se incluyen


El contexto de una consulta sobre planes se muestra separado del mensaje para que el usuario pueda revisarlo. El formulario está disponible sin autenticación. Incluir información sobre el tratamiento de los datos y un enlace al texto de privacidad disponible antes de publicar.
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
- Mantener catálogo comercial, modalidades y precios en una fuente compartida para evitar discrepancias entre páginas. Para el MVP puede ser configuración tipada versionada que referencie IDs reales de convocatorias; no se exige crear tablas comerciales en esta spec.
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
2. Como visitante, quiero identificar qué convocatoria está disponible y qué contenido incluye antes de consultar sus planes.
3. Como visitante, quiero comparar las modalidades mensual y anual y saber exactamente qué acceso corresponde a cada una.
4. Como visitante, quiero enviar una consulta y recibir confirmación de que se ha enviado.
5. Como usuario registrado, quiero encontrar el acceso a la plataforma desde cualquier página comercial.
Criterios de aceptación
- CA-01: las cuatro páginas son públicas y accesibles desde la navegación común, sin exigir registro.
- CA-02: Inicio explica el producto, la necesidad, las funcionalidades y dirige al catálogo y a los planes.
- CA-03: Tests disponibles presenta solo el catálogo comercial declarado, inicialmente una convocatoria concreta de Administrativo de Navarra.
- CA-04: el enlace desde una convocatoria a Planes conserva su ID y la página muestra su denominación.
- CA-05: Planes diferencia mensual y anual, muestra los precios aprobados cuando existan y aclara que cada modalidad incluye únicamente la convocatoria seleccionada.
- CA-06: sin compra integrada, los botones de cada modalidad abren Contacto con el contexto visible de la consulta; no se crea una suscripción ni se muestra un pago completado.
- CA-07: «Acceder» conecta con el flujo de sesión de la spec 003 y no habilita test sin la autorización correspondiente.
- CA-08: Contacto valida nombre, correo y mensaje en cliente y servidor, con errores vinculados a los campos.
- CA-09: un envío válido llega al buzón configurado y solo se confirma tras la aceptación del servicio de envío.
- CA-10: los errores de envío conservan los datos; la carga impide duplicados desde la interfaz y el servidor limita abusos.
- CA-11: un ID comercial inválido, un catálogo vacío y un fallo de carga tienen respuestas diferenciadas y acciones para continuar.
- CA-12: navegación, selección de plan y envío del formulario funcionan en móvil y con teclado.
- CA-13: cada ruta admite apertura directa y recarga, y tiene título, descripción y contenido público indexable.
- CA-14: no se exponen claves secretas, preguntas privadas, respuestas correctas ni datos de usuarios.
- CA-15: los textos y llamadas a la acción reflejan el estado real del producto; las funciones pendientes se identifican como tales.
Verificación y finalización
- Ejecutar los controles de tipos, lint y build definidos por el repositorio.
- Comprobar navegación directa, recargas, contexto de convocatoria y modalidad, y estados de datos inválidos.
- Verificar el formulario con envío real a un buzón de prueba y casos de validación, fallo del proveedor y limitación de frecuencia.
- Comprobar mediante una petición directa que el servidor rechaza datos inválidos aunque se omita la validación del navegador.
- Revisar visualmente las cuatro páginas en móvil y escritorio y recorrer navegación y formulario con teclado.
- Añadir pruebas automatizadas útiles para los contratos de validación y procesamiento del envío según las herramientas existentes; evitar pruebas que solo repliquen contenido estático.
- Documentar variables de entorno y pasos de configuración del envío, sin valores secretos.
La implementación funcional se considera terminada cuando se cumplen los criterios aplicables y existe envío real. La publicación comercial requiere además cerrar los datos pendientes siguientes.
Datos pendientes antes de publicar
- ID y denominación exacta de la convocatoria inicial, y temas que pueden anunciarse como incluidos.
- Precios mensual y anual, moneda y condiciones comerciales aprobadas.
- Dirección receptora, proveedor de correo y remitente autorizado.
- Textos legales y de privacidad, y sus rutas.
- Estado real de disponibilidad de la plataforma y de la contratación.
Estos datos se configuran sin alterar el alcance funcional. No inventar importes, destinatarios, condiciones o contenido académico para completar la implementación.