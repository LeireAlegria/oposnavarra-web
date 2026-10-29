# OposNavarra — Página de venta y test gratuito

Estado: propuesta lista para revisión e implementación.
Fecha: 28 de octubre de 2026.
Nombre sugerido: `specs/017-landing-test-gratuito.md`.

## 1. Objetivo

Convertir la portada en una entrada a la práctica: el visitante entiende para quién es OposNavarra, prueba cinco preguntas sin registro, consulta su resultado y recibe una invitación a crear una cuenta para guardar ese primer avance.

Recorrido principal: portada → test gratuito → resultado y correcciones → registro → resultado guardado y siguiente acción disponible.

El éxito se medirá por usuarios que completan un primer test y se registran, además del uso posterior. No se promete un aumento de conversión sin medirlo.

## 2. Contexto y límites

La revisión de la web detectó mensajes de preparación en la portada y disponibilidad en el catálogo, referencias internas a «MVP», una tarjeta ilustrativa sin práctica y un recorrido que termina en planes antes de demostrar el producto.

Esta spec define el comportamiento deseado, no confirma qué funciones existen en el código. Antes de implementar, comprobar banco de preguntas, correcciones, autenticación, intentos, suscripciones y gestión administrativa actuales. Reutilizar sus fuentes de verdad y permisos. No introducir `perfiles.rol` ni otro sistema de roles por esta funcionalidad.

Se conserva la identidad visual: fondo claro, verde oscuro y coral. La prioridad es mejorar mensaje, demostración y recorrido.

## 3. Alcance

- Rediseño del contenido y jerarquía de la portada.
- Demostración pública de cinco preguntas del banco existente.
- Resultado y correcciones accesibles sin cuenta.
- Registro opcional con recuperación del resultado.
- Coherencia entre portada, catálogo y planes.
- Medición del embudo y estados de error.

Fuera de alcance: camino jugable, retos entre amigos, nuevas oposiciones, rediseño del área privada, cambios de precios o del modelo de suscripción. No anunciar estas funciones como disponibles hasta que lo estén.

## 4. Principios de producto

1. Ofrecer valor antes de solicitar datos.
2. Mostrar contenido y capacidades reales, sin cifras, testimonios o resultados inventados.
3. Una acción principal por sección.
4. Explicar por separado lo que incluye la prueba, una cuenta gratuita y una suscripción.
5. No bloquear el resultado ni las explicaciones detrás del registro.
6. La demostración gratuita no concede acceso al banco completo.

## 5. Portada

### 5.1 Cabecera

Logo a inicio. Navegación: Cómo funciona, Temario, Planes y Contacto. Enlace secundario «Iniciar sesión» y botón destacado «Probar gratis», dirigido a la demostración. En móvil se priorizan logo y acción principal, con el resto en menú accesible.

### 5.2 Primera pantalla

Mientras solo esté disponible Administrativo de Navarra, la portada se centra en esa oposición. Si se amplía el catálogo, la cabecera se adapta al contenido publicado; no se simula una variedad inexistente.

Texto propuesto:

> TESTS PARA ADMINISTRATIVO DE NAVARRA
>
> Prepara Administrativo de Navarra, pregunta a pregunta.
>
> Practica por temas, revisa tus respuestas y consulta tus resultados. Empieza con cinco preguntas gratis.

Publicar la descripción solo si estas capacidades están operativas.

- Acción principal: «Probar 5 preguntas gratis».
- Apoyo: «Sin registro · Sin tarjeta».
- Acción secundaria discreta: «Ver qué incluye» hacia el contenido de la página.
- Vista protagonista: pregunta real de la demostración, con sus opciones. La interacción inicia el mismo flujo de prueba y conserva la respuesta elegida; no debe haber dos demostraciones distintas.
- Si aún no se dispone de esa interacción integrada, utilizar una captura real accesible y el botón de inicio, sin controles falsos.

Eliminar «Convocatoria del MVP», «En esta primera versión» y referencias técnicas del texto comercial.

### 5.3 Presentación y origen de OposNavarra

Requisito editorial: este texto debe ser de lo primero que vea el visitante. Incluir el bloque inmediatamente después del titular y la llamada principal, antes de «Cómo funciona» y del resto de secciones comerciales. No relegarlo al pie, a una página «Sobre nosotros», a un carrusel o a un acordeón cerrado.

La primera pantalla introduce la propuesta y el inicio de esta presentación. La historia completa continúa de forma natural al desplazarse. En móvil, evitar que una captura grande o un espacio decorativo desplace la presentación demasiado abajo. Mantener visible y fácil de localizar la acción de probar gratis.

Título del bloque: **Una plataforma que nace de la experiencia de una opositora**.

Texto aprobado como requisito de contenido, con ajustes de ortografía y redacción:

> OposNavarra es una plataforma creada para preparar online oposiciones que incluyen, al menos, un examen tipo test. Está diseñada pensando en los opositores y en mejorar sus condiciones de estudio y aprendizaje.
>
> OposNavarra nace de la iniciativa de Elisa, una de nuestras socias y opositora a Administrativo. Su experiencia de estudio, unida al conocimiento de un equipo de informáticos, nos llevó a crear una solución a muchos de los problemas que encontró al preparar sus oposiciones:
>
> - Plataformas de preguntas tipo test con poca calidad y difíciles de utilizar.
> - Plataformas de pago con un número insuficiente de preguntas, en ocasiones con errores y con explicaciones escasas.
> - Procesos de compra confusos, con añadidos a un paquete base.
> - Un exceso de correos electrónicos que no aportan valor al estudio.
> - La necesidad de instalar una aplicación para estudiar desde el móvil. Con OposNavarra puedes acceder directamente desde el navegador de tu smartphone.
>
> Por eso hemos creado OposNavarra: una plataforma para el opositor, centrada en la calidad y en la facilidad de uso.
>
> OposNavarra acaba de ver la luz. Incorporaremos nuevos tests de forma continua para ampliar el contenido y dar cabida a la mayoría de las oposiciones tipo test de Navarra.

Presentación visual:

- Párrafos breves, ancho de lectura contenido y lista fácil de recorrer.
- Destacar la historia de Elisa y las palabras «calidad» y «facilidad de uso» sin convertir todo el texto en una colección de tarjetas.
- Se puede utilizar una foto real de Elisa si se proporciona y autoriza su publicación; no inventar su imagen, testimonio o trayectoria.
- Mantener el texto completo visible, sin «Leer más» obligatorio.
- La ampliación del catálogo se presenta como compromiso futuro, no como disponibilidad actual. El catálogo sigue mostrando únicamente contenido realmente publicado.
- La referencia a correos expresa el problema que motivó la plataforma; no implica eliminar comunicaciones necesarias de cuenta, seguridad o contratación. Cualquier promesa comercial adicional sobre comunicaciones debe corresponder al funcionamiento real.
- Revisar «acaba de ver la luz» conforme evolucione el producto para evitar que el mensaje quede desactualizado.

### 5.4 Cómo funciona

Tres pasos, acompañados por vistas reales:

1. Elige un tema y practica.
2. Revisa tus respuestas y aprende de las correcciones.
3. Consulta tus resultados y continúa preparando tu oposición.

No afirmar seguimiento de errores, adaptación automática u otras capacidades sin implementación real.

### 5.5 Contenido disponible

Mostrar oposición, temas oficiales asociados y cantidad de preguntas publicadas cuando el dato sea fiable. Reutilizar los registros reales del catálogo y banco; no mantener cifras comerciales manuales duplicadas.

Distinguir «Disponible» y «Próximamente». Un contenido próximo no tiene botón de practicar ni se cuenta como contenido incluido utilizable. Si una convocatoria tiene disponibilidad parcial, indicar qué temas pueden practicarse.

### 5.6 Confianza

Explicar quién prepara o revisa las preguntas, cómo se actualiza el contenido y cómo comunicar una incidencia, únicamente con información verificable. Incluir testimonios solo si son reales y se dispone de autorización. Omitir la sección de opiniones si todavía no hay testimonios.

### 5.7 Planes

Reutilizar precios y condiciones del sistema de contratación. Mostrar importe cobrado, periodo, renovación y equivalente mensual, si procede. No duplicar precios en código comercial independiente.

Explicar junto a los planes qué incluye la demostración y qué requiere suscripción. No usar «Empieza gratis» en un botón que lleva directamente a pagar. El equivalente mensual nunca debe ocultar el total del cobro.

### 5.8 Preguntas frecuentes y cierre

Resolver: oposición cubierta, temas disponibles, alcance de la prueba, utilidad de registrarse, contenido de pago, funcionamiento de renovaciones y cancelación según condiciones reales.

Cierre: «Empieza con cinco preguntas» y botón «Probar gratis».

## 6. Test gratuito

### 6.1 Acceso y configuración

Ruta propuesta: `/prueba-gratis`. Es pública y no exige sesión, correo, tarjeta ni contratación. Una cuenta con sesión también puede utilizarla sin alterar sus permisos.

La prueba utiliza exactamente cinco preguntas publicadas y seleccionadas editorialmente del banco. En la primera entrega se utiliza un conjunto fijo versionado por convocatoria, para facilitar calidad y mantenimiento. No introduce generación aleatoria ni tests ilimitados.

Cada pregunta necesita enunciado, opciones, una respuesta correcta y explicación revisada. Cuando corresponda, añadir referencia normativa verificada. Esta entrega admite preguntas de respuesta única; no convierte automáticamente preguntas con otros formatos.

El conjunto no se publica hasta disponer de cinco preguntas válidas. Si deja de ser válido, no se inicia una prueba nueva y se presenta un mensaje claro con acceso al contenido disponible. Nunca mostrar un botón de prueba que conduce silenciosamente a pago.

### 6.2 Interacción

- Una pregunta por pantalla, indicador «Pregunta X de 5» y avance visible.
- Seleccionar respuesta y pulsar «Comprobar respuesta».
- El servidor corrige; mostrar acierto/error, opción correcta y explicación.
- La respuesta comprobada queda bloqueada y se puede pasar a la siguiente.
- El feedback no depende solo del color. Anunciar cambios a lectores de pantalla.
- Sin cronómetro ni penalización. Comunicar que es una demostración, no una simulación oficial de examen.
- Al terminar la quinta pregunta, mostrar el resumen automáticamente.
- No incluir ventanas de registro entre preguntas.

### 6.3 Resultado

Mostrar aciertos sobre cinco, porcentaje y las cinco preguntas con sus respuestas y explicaciones. Evitar rankings, predicciones de aprobado o conclusiones sobre el nivel general a partir de cinco preguntas.

Invitación principal para visitantes: «Crea tu cuenta y guarda este resultado». Texto de apoyo: «Registrarte no contrata una suscripción. Consulta los planes para acceder al contenido de pago».

Acción secundaria: «Ver qué incluye la suscripción». Permitir volver a revisar libremente las correcciones. Repetir la prueba es posible, pero informar de que utiliza las mismas preguntas y no representa una nueva evaluación.

Si ya existe sesión, ofrecer «Guardar resultado» y después el enlace al área personal. Un intento solo puede guardarse una vez.

## 7. Registro y continuidad

Utilizar el flujo de autenticación existente, con un destino de retorno permitido hacia el resultado. No crear un formulario paralelo ni ampliar datos obligatorios por esta iniciativa.

Conservar el intento al abrir registro, iniciar sesión, confirmar correo o volver desde un proveedor externo. La transferencia funciona mediante una credencial opaca de recuperación con caducidad de 24 horas; el enlace de continuidad debe permitir recuperar el intento si la confirmación se abre en otro dispositivo. No incluir respuestas, correo u otros datos personales en la URL. Proteger esa credencial de registros de analítica y de su envío por Referer.

Al completar la autenticación, el servidor asocia el intento al usuario autenticado. La operación es idempotente y atómica: volver atrás, recargar o recibir dos callbacks no genera duplicados. No admite asociar un intento ya reclamado por otra cuenta.

Guardar el resultado con etiqueta «Prueba gratuita», separado de intentos de examen ordinarios. No incorporarlo a estadísticas comparables de preparación ni modificar rachas, puntos, rankings o desbloqueos.

Si el intento caduca o falla su recuperación, el registro sigue siendo válido: informar de que el resultado no pudo guardarse y ofrecer repetir la prueba. No inventar un guardado exitoso ni bloquear el acceso a la cuenta.

Crear cuenta no activa una suscripción ni otorga acceso de pago. Tras guardar, mostrar confirmación y las siguientes acciones realmente disponibles, con el acceso a planes cuando corresponda.

## 8. Diseño técnico propuesto: React y Supabase

Adaptar nombres al esquema existente antes de crear migraciones. El siguiente es un contrato lógico, no una descripción de tablas ya implementadas.

### 8.1 Datos

| Entidad lógica | Datos mínimos | Reglas |
| --- | --- | --- |
| Conjunto de demostración | Convocatoria, versión, estado, cinco referencias ordenadas | Solo publicable con cinco preguntas válidas y corrección revisada |
| Intento de demostración | ID, versión, creación, caducidad, estado, propietario opcional | Credencial secreta almacenada como hash; nunca usar solo el ID como autorización |
| Respuestas del intento | Pregunta, opción elegida, orden, fecha, corrección | Una respuesta definitiva por pregunta; puntuación calculada por servidor |
| Instantánea del contenido | Enunciado, opciones, respuesta correcta y explicación de la versión | Privada en servidor; permite mantener resultados consistentes si cambia el banco |

Estados del intento: iniciado → completado → reclamado. La caducidad impide reclamar; los abandonados y los completados sin reclamar se eliminan tras 24 horas. Los reclamados siguen la política de conservación de resultados de la cuenta.

### 8.2 Operaciones del servidor

Implementar con Edge Functions o RPC controladas, siguiendo la arquitectura del proyecto:

1. Iniciar: validar conjunto, crear intento y emitir credencial de recuperación. Devolver únicamente contenido público de la primera pregunta.
2. Responder: validar credencial, vigencia, pregunta actual y opción; registrar una sola vez y devolver corrección y siguiente pregunta. Un reintento idéntico devuelve el mismo resultado; una opción diferente tras confirmar se rechaza.
3. Consultar: restaurar avance o resultado usando la credencial, sin volver a puntuar.
4. Reclamar: exigir JWT válido, intento completo y credencial válida; asociar una sola vez al usuario autenticado e invalidar la credencial pública.

No exponer respuestas correctas de preguntas pendientes en el HTML, bundle, payload inicial o endpoint público del banco. El conjunto de demostración sí será conocimiento accesible después de realizarlo; la protección busca impedir acceso al banco completo, no prometer secreto de esas cinco preguntas.

### 8.3 Acceso y abuso

- Mantener el banco completo y las instantáneas privadas bajo las políticas actuales.
- El rol público no puede listar intentos, leer respuestas ajenas ni actualizar puntuaciones o propietarios.
- Lectura de intentos reclamados limitada a su propietario y mecanismos administrativos existentes.
- Claves de servicio únicamente en servidor.
- Limitar en servidor inicios y respuestas, con umbrales configurables. Propuesta inicial: diez inicios por hora y origen, ajustable para redes compartidas; no usar solo una clave manipulable del navegador.
- Devolver errores útiles sin revelar existencia o propietarios de otros intentos.
- El borrado de una pregunta o convocatoria debe respetar intentos existentes mediante su instantánea, sin dejar relaciones rotas.

### 8.4 Gestión del contenido

Reutilizar el admin y sus permisos actuales para seleccionar, ordenar, previsualizar y publicar las cinco preguntas. Añadir controles mínimos si no existen; no crear un nuevo modelo de roles.

Cambiar el conjunto genera una versión nueva. Los intentos en curso mantienen su versión. Si se detecta un error grave, permitir invalidar la versión con un aviso al visitante y opción de reiniciar; no corregir retroactivamente resultados en silencio.

## 9. Experiencia móvil, accesibilidad y rendimiento

- Sin desplazamiento horizontal desde 360 px; comprobar también tableta y escritorio.
- Tipografía legible, controles táctiles amplios y foco visible.
- Navegación completa con teclado, opciones agrupadas semánticamente y mensajes de error asociados.
- Contraste WCAG AA, especialmente en botones coral y textos secundarios.
- Respetar reducción de movimiento; evitar animaciones que retrasen preguntas o resultados.
- Evitar imágenes pesadas y vídeo automático en portada; reservar espacio para imágenes para reducir saltos de contenido.
- La portada conserva texto comercial indexable aunque la demostración cargue después.

## 10. Estados y errores

| Situación | Comportamiento |
| --- | --- |
| Cargando pregunta | Indicador de carga; impedir doble envío |
| Pérdida de conexión | Conservar selección y ofrecer reintento sin duplicar respuesta |
| Recarga | Restaurar estado desde servidor si la credencial sigue vigente |
| Almacenamiento local no disponible | Permitir completar en la pestaña; informar de limitaciones de recuperación si afectan al usuario |
| Conjunto no disponible | Explicar indisponibilidad y ofrecer catálogo o contacto |
| Límite de solicitudes | Mensaje y tiempo de reintento; sin CAPTCHA por defecto |
| Intento caducado | Aviso y posibilidad de iniciar una prueba nueva |
| Registro cancelado | Mantener resultado accesible hasta caducidad |
| Fallo al guardar tras registro | Mantener acceso a la cuenta y ofrecer reintentar mientras sea válido |
| Usuario con sesión | Guardado explícito, sin formulario de registro |

## 11. Analítica

Utilizar la solución de analítica existente y sus preferencias de consentimiento. No enviar correos, textos libres, respuestas, credenciales ni URLs de recuperación a herramientas de analítica.

Eventos propuestos: vista de portada, clic en probar con ubicación del botón, prueba iniciada, pregunta completada con posición, prueba completada, inicio de registro desde resultado, registro completado, resultado guardado y acceso a planes. Incluir versión de landing y de demostración; los eventos del servidor permiten deduplicar finalizaciones.

Indicadores:

- Inicio de prueba / visitas elegibles a portada.
- Pruebas completadas / pruebas iniciadas.
- Nuevos registros desde la prueba / visitantes anónimos que completan la prueba, dentro de 24 horas.
- Resultados guardados / registros atribuidos a la prueba.
- Usuarios que completan un test ordinario durante los siete días siguientes al registro / registros desde la prueba.
- Suscripciones posteriores como indicador adicional, diferenciando conversión a cuenta y conversión a pago.

Separar usuarios con sesión, repeticiones y tráfico interno. Si no hay medición previa, comenzar con una línea base; comparar periodos equivalentes y fuentes de tráfico antes de atribuir cambios al rediseño. No fijar porcentajes objetivo sin datos.

## 12. Criterios de aceptación

- [ ] La primera pantalla identifica la oposición y permite iniciar la prueba sin registro.
- [ ] La presentación y la historia de Elisa aparecen al inicio, antes de «Cómo funciona», con el texto completo visible y sin quedar desplazadas por una imagen grande en móvil.
- [ ] El compromiso de ampliar el catálogo no presenta futuras oposiciones como disponibles.
- [ ] No aparecen mensajes internos de MVP ni contradicciones de disponibilidad.
- [ ] Los cinco ítems proceden del banco y tienen explicaciones revisadas.
- [ ] El visitante completa y revisa las cinco preguntas sin cuenta ni tarjeta.
- [ ] El servidor calcula las correcciones; el cliente no puede imponer puntuación.
- [ ] La prueba no permite acceder al banco completo ni listar intentos.
- [ ] Los reintentos de red no duplican respuestas ni resultados.
- [ ] Registro, confirmación de correo e inicio de sesión conservan el intento dentro de su vigencia, también mediante el enlace de continuidad en otro dispositivo.
- [ ] La reclamación del resultado es idempotente y no permite cambiar de propietario.
- [ ] Un fallo de recuperación no bloquea la cuenta ni muestra confirmaciones falsas.
- [ ] La cuenta gratuita no activa suscripción ni desbloquea permisos de pago.
- [ ] La demostración queda diferenciada de las estadísticas ordinarias.
- [ ] Los precios y el contenido disponible coinciden con las fuentes existentes.
- [ ] La experiencia funciona en móvil y con teclado, con feedback accesible.
- [ ] La analítica distingue visitas, pruebas, registros y uso posterior sin incluir secretos.
- [ ] Los intentos anónimos caducan y se eliminan según lo especificado.

## 13. Implementación y verificación

1. Auditar modelos y flujos existentes; confirmar funciones reales y acceso gratuito frente a pago.
2. Preparar las cinco preguntas y su revisión editorial.
3. Implementar versión de demostración, endpoints, políticas y limpieza de intentos.
4. Construir prueba, resultado y continuidad de autenticación.
5. Actualizar portada y coherencia del catálogo y planes.
6. Instrumentar eventos y verificar el recorrido completo en entorno de pruebas.
7. Publicar cuando contenido y flujo estén operativos; revisar el embudo tras reunir datos suficientes.

Verificaciones necesarias: integración del flujo anónimo hasta guardado, callback de autenticación en otro dispositivo, caducidad, doble callback, reintento de respuestas, intento de reclamar desde otra cuenta, acceso público al banco e intentos, invalidación de conjunto, pérdida de red y navegación móvil/teclado. Comprobar también que la contratación y sus permisos actuales no cambian.

## 14. Dependencias de salida

Antes de publicar deben estar confirmados: convocatoria y temas realmente disponibles, cinco preguntas válidas, explicaciones, capacidades del producto anunciadas, condiciones de los planes y flujo real de autenticación. Estos datos se obtienen del proyecto; no se rellenan con contenido supuesto.

Esta spec es independiente de las futuras funciones de camino y retos. Se puede implementar sin esperar a ellas y ampliarse cuando estén disponibles.

## 15. Acuerdos de implementación — 29 de octubre de 2026

- El usuario ha autorizado seleccionar cinco preguntas al azar del banco existente. La migración selecciona una vez entre preguntas publicadas, con cuatro opciones, una solución y explicación, y conserva ese conjunto como versión fija. No añade preguntas inventadas. Si no hay cinco válidas, no publica la demostración. La selección puede revisarse y sustituirse desde el panel.
- No existe solución de analítica ni gestor de consentimiento en el repositorio. El usuario ha elegido preparar la instrumentación sin realizar envíos. El adaptador queda desactivado hasta integrar ambos; no se incorpora un servicio externo.
- La excepción de acceso anónimo queda documentada en la constitución y en `docs/adr/0017-free-demo.md`. Los permisos de los tests ordinarios y las suscripciones se conservan.
- Antes de publicar quedan pendientes aplicar y verificar la migración en Supabase, revisar la selección real, configurar la cabecera de IP y la continuidad de confirmación de correo, y comprobar visualmente móvil, tableta, escritorio y teclado. Los requisitos de medición efectiva dependen de la integración futura acordada.
