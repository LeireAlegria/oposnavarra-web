015 — Mensajes de contacto en el panel administrativo
Objetivo
Sustituir el envío de correos del formulario de contacto por el almacenamiento de los mensajes en Supabase, permitiendo consultarlos y gestionar su estado de lectura desde el panel administrativo.

Esta spec sustituye el comportamiento de contacto definido en la 004 — Web de venta y amplía la 008 — Panel administrativo.
Alcance
- Guardar los mensajes enviados desde el formulario público de contacto.
- Crear la tabla public.mensajes_contacto mediante una migración.
- Añadir el apartado «Mensajes de contacto» al panel administrativo.
- Consultar el contenido completo de cada mensaje.
- Marcar mensajes como leídos o pendientes.
- Incorporar validación y protección frente a envíos automatizados o repetidos.
Formulario de contacto
El formulario estará disponible sin necesidad de iniciar sesión y tendrá estos campos obligatorios:
Campo	Validación
Nombre	Entre 1 y 120 caracteres, después de eliminar espacios exteriores.
Email	Dirección con formato válido y un máximo de 254 caracteres.
Mensaje	Entre 1 y 5.000 caracteres, después de eliminar espacios exteriores.


Las validaciones se realizarán tanto en el formulario como en el servidor.
Comportamiento del envío
1. El visitante completa el formulario.
2. La aplicación valida los campos.
3. El servidor comprueba las medidas contra abuso y guarda el mensaje.
4. Solo cuando el guardado se haya completado, se muestra: «Hemos recibido tu mensaje. Gracias por contactar con OposNavarra.»
5. Tras el envío correcto, se vacía el formulario.
Mientras se procesa el envío, el botón permanecerá deshabilitado para evitar pulsaciones repetidas.

Si se produce un error, se conservarán los datos introducidos y se mostrará un mensaje que permita volver a intentarlo. Si se supera el límite de envíos, se indicará que debe esperar antes de intentarlo de nuevo.

El envío no generará ningún correo electrónico.
Modelo de datos
Crear la tabla public.mensajes_contacto:
Campo	Tipo	Reglas
id	uuid	Clave primaria. Generado automáticamente.
nombre	text	Obligatorio.
email	text	Obligatorio.
mensaje	text	Obligatorio.
created_at	timestamptz	Obligatorio. Fecha del servidor, por defecto now().
leido	boolean	Obligatorio. Por defecto false.


Los límites de longitud también deberán aplicarse mediante restricciones en la base de datos.

Se añadirá un índice para facilitar el listado por fecha de creación descendente.

Los mensajes no estarán vinculados a una cuenta de usuario.
Panel administrativo
Añadir el apartado «Mensajes de contacto» a la navegación del panel existente.
Listado
El listado mostrará:
- Nombre.
- Email.
- Fecha y hora de recepción.
- Estado: «Pendiente» o «Leído».
- Acción para abrir el mensaje.
Los mensajes aparecerán del más reciente al más antiguo, con paginación de 25 registros. Los pendientes tendrán una distinción visual.

Se podrá filtrar por:
- Todos.
- Pendientes.
- Leídos.
Si no existen mensajes para la selección actual, se mostrará un estado vacío.
Detalle del mensaje
Al abrir un mensaje se mostrarán su nombre, email, fecha de recepción y contenido completo, conservando los saltos de línea.

El contenido se tratará como texto: no se interpretará HTML introducido por el visitante.

Abrir el mensaje no cambiará automáticamente su estado. Se ofrecerá una acción explícita:
- «Marcar como leído», cuando esté pendiente.
- «Marcar como pendiente», cuando esté leído.
El cambio se guardará en Supabase y se reflejará en el listado. Si falla, se mostrará el error sin presentar el cambio como completado.
Acceso y protección
- La consulta de mensajes y la modificación de su estado estarán disponibles exclusivamente desde el panel administrativo, reutilizando su mecanismo de acceso existente.
- Esta spec no incorpora un sistema de roles ni depende de perfiles.rol.
- El formulario público únicamente permitirá enviar los campos nombre, email y mensaje. El servidor establecerá id, created_at y leido.
- Los visitantes no podrán consultar mensajes ni modificar registros existentes.
- Las restricciones se aplicarán en el servidor y en el acceso a los datos; ocultar opciones en la interfaz no será suficiente.
- Las credenciales privilegiadas de Supabase nunca se expondrán en el cliente.
Protección frente a abuso
El envío se realizará mediante una operación de servidor que incluya:
- Un campo señuelo no visible para el visitante.
- Un límite de cinco envíos aceptados por dirección IP en una ventana de quince minutos.
- Rechazo de envíos con campos inválidos o que excedan los límites establecidos.
El control de frecuencia se aplicará en el servidor y funcionará entre distintas instancias de ejecución.
Sustitución del envío de correo
Se retirará del flujo de contacto la llamada que envía correos y se eliminarán las dependencias o variables de configuración que se utilicen exclusivamente para ese envío.

Otros posibles correos de la plataforma, como los de autenticación, quedan fuera de esta modificación.
Fuera de alcance
- Responder mensajes desde el panel.
- Enviar confirmaciones o avisos por correo.
- Eliminar mensajes.
- Adjuntar archivos.
- Añadir asuntos, categorías o asignaciones.
- Crear nuevos roles o modificar el sistema de acceso del panel.
Criterios de aceptación
1. Un visitante sin sesión puede enviar un formulario válido y se crea un único mensaje pendiente en Supabase.
2. La confirmación solo aparece cuando el mensaje se ha guardado correctamente.
3. Un envío correcto no genera ningún correo.
4. Los campos inválidos se rechazan tanto en el cliente como en el servidor.
5. Si el envío falla, el formulario conserva los datos introducidos.
6. El campo señuelo y el límite de frecuencia impiden los envíos que incumplan sus reglas.
7. El panel muestra los mensajes ordenados del más reciente al más antiguo, con paginación y filtro por estado.
8. Se puede abrir un mensaje y consultar su contenido completo.
9. Abrir un mensaje conserva su estado; las acciones explícitas permiten marcarlo como leído o pendiente y mantienen el cambio al recargar.
10. Los visitantes no pueden consultar mensajes ni modificar registros existentes.
11. El contenido introducido se muestra como texto y no ejecuta HTML ni scripts.
12. La funcionalidad reutiliza el acceso administrativo existente sin introducir perfiles.rol.