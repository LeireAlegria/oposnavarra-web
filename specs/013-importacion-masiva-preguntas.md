# Importación masiva de preguntas mediante Excel

## Estado y objetivo

Spec funcional y técnica para implementar en OposNavarra. Numeración pendiente de asignar dentro del repositorio del proyecto.

Permitir que un administrador incorpore preguntas al banco mediante un archivo Excel, con validación y revisión antes de confirmar la carga.

La extracción de preguntas desde exámenes oficiales y su generación desde documentación se realizan fuera de OposNavarra, mediante una IA externa y revisión humana. Ambas vías utilizan la misma plantilla de importación.

## Alcance del MVP

- Descarga de plantilla `.xlsx`.
- Importación de preguntas con cuatro opciones y una respuesta correcta.
- Asociación opcional a un examen existente.
- Asociación opcional a temas existentes, con resolución supervisada.
- Validación, vista previa, detección de posibles duplicados y confirmación.
- Creación de preguntas y relaciones en una única transacción.

Quedan fuera: lectura de PDF, OCR, generación con IA dentro de la plataforma, preguntas con imágenes, grupos de preguntas, creación automática de exámenes o temas, edición de celdas dentro de la aplicación y actualización de preguntas existentes mediante Excel.

## Permisos

Acceso exclusivo para administradores. Reutilizar el mecanismo de autorización existente del proyecto, sin introducir otro modelo de roles.

Proteger tanto la interfaz como las operaciones del servidor y las políticas de acceso a los datos. Ocultar el botón no constituye autorización suficiente.

## Acceso y flujo

Desde el apartado administrativo de preguntas, añadir la acción **Importar preguntas**.

### 1. Preparar la importación

La pantalla permite descargar la plantilla y seleccionar:

- Procedencia obligatoria: `Examen oficial` o `Generadas desde documentación`.
- Referencia de la fuente, opcional: nombre del documento, URL o identificación de la versión utilizada.
- Examen de destino, opcional. Es obligatorio si la procedencia es un examen oficial.

El examen debe existir previamente. La selección del examen determina el contexto de sus convocatorias relacionadas; la importación no modifica esas relaciones.

Para preguntas generadas desde documentación se permite importar sin examen y asignar los temas correspondientes. La disponibilidad en convocatorias se deriva de las relaciones existentes del catálogo; no se crea una asociación directa nueva para resolver esta carga.

### 2. Subir y validar

Aceptar un único archivo `.xlsx`, de hasta 5 MiB y 1.000 filas de preguntas. Mostrar estos límites antes de la subida. Rechazar archivos vacíos, dañados, protegidos o de otro formato.

Validar estructura y contenido sin crear preguntas en el banco. Mostrar progreso y evitar acciones repetidas mientras se procesa.

### 3. Revisar

Mostrar un resumen con filas detectadas, válidas, con errores, con temas pendientes y con posibles duplicados. La vista previa debe permitir consultar el contenido completo, las opciones, la respuesta correcta, el tema y las incidencias de cada fila.

Permitir resolver temas y excluir filas completas. No permitir editar enunciados ni opciones dentro de esta pantalla: los errores de contenido se corrigen en el Excel y se vuelve a subir. Una nueva subida invalida la revisión anterior.

### 4. Confirmar

Habilitar **Importar N preguntas** únicamente cuando las filas incluidas no tengan errores ni decisiones pendientes. Solicitar una confirmación dentro del propio flujo con el resumen y el examen elegido, si existe.

Al finalizar, mostrar el número de preguntas creadas y excluidas, y un enlace al listado correspondiente. Si todas las filas están excluidas, no permitir confirmar.

## Contrato de la plantilla

El libro contendrá una hoja `Preguntas`, con encabezados en la primera fila. Se puede incluir una hoja `Instrucciones`, que no se procesa. No procesar otras hojas como preguntas.

| Columna | Obligatoria | Regla |
| --- | --- | --- |
| `numero` | Si hay examen | Entero positivo que conserva la numeración original. |
| `enunciado` | Sí | Texto no vacío. |
| `opcion_a` | Sí | Texto no vacío. |
| `opcion_b` | Sí | Texto no vacío. |
| `opcion_c` | Sí | Texto no vacío. |
| `opcion_d` | Sí | Texto no vacío. |
| `respuesta_correcta` | Sí | Una única letra A, B, C o D. |
| `explicacion` | No | Texto de apoyo a la respuesta. |
| `tema` | No | Nombre de un tema existente; requiere resolución antes de asignarlo. |

Todos los encabezados deben estar presentes, aunque sus valores sean opcionales. Se pueden normalizar espacios exteriores y mayúsculas en encabezados; rechazar encabezados repetidos o desconocidos con un mensaje concreto.

Ignorar filas completamente vacías. Conservar saltos de línea del contenido y eliminar espacios exteriores. No ejecutar fórmulas ni aceptar fórmulas como contenido de las columnas importadas. Leer únicamente valores de texto y números admitidos por el contrato.

Si no hay examen, `numero` puede quedar vacío; si se informa, debe ser un entero positivo y no crea una relación con un examen.

## Validaciones

### Errores que bloquean una fila incluida

- Falta de enunciado o de alguna de las cuatro opciones.
- Respuesta correcta distinta de A, B, C o D. Aceptar minúsculas normalizándolas.
- Número ausente cuando se ha elegido examen, no entero o no positivo.
- Número repetido entre las filas incluidas para el mismo examen, o ya ocupado en ese examen.
- Dos opciones con el mismo texto tras normalizar espacios y mayúsculas.
- Valores incompatibles con los tipos o límites reales del esquema de base de datos.
- Fórmulas en celdas procesadas.

Mostrar siempre la fila original del Excel, la columna y una explicación accionable. Ejemplos: «Fila 12: falta opcion_c»; «Fila 18: respuesta_correcta debe ser A, B, C o D».

Las validaciones sintácticas no verifican que la respuesta sea académicamente correcta. La revisión del contenido y el contraste con la plantilla oficial definitiva corresponden al administrador antes de confirmar.

Las preguntas anuladas o incompatibles con el modelo deben retirarse del archivo o excluirse de la carga. Este MVP no añade gestión de anulaciones ni clasificación de preguntas de reserva.

## Resolución de temas

Buscar coincidencias entre los temas existentes normalizando espacios y mayúsculas. Una coincidencia única permite proponer el tema; varias coincidencias requieren selección explícita. Mostrar información suficiente para distinguir temas con nombres iguales.

Los selectores de temas de la revisión muestran nombres y descripciones completos en varias líneas, permiten buscar por ambos campos y mantienen visible la descripción del tema seleccionado. Deben adaptarse al ancho disponible y poder usarse con teclado.

Si no hay coincidencia, permitir elegir otro tema o dejar la pregunta sin tema de forma explícita. No crear temas automáticamente. Un valor vacío se importa sin tema y se indica en el resumen.

Permitir aplicar una resolución a todas las filas con el mismo valor de `tema`. La relación se guarda mediante el mecanismo del banco existente, respetando su cardinalidad.

En la revisión, permitir seleccionar un tema existente y aplicarlo explícitamente a todas las filas del archivo, incluidas las excluidas y las de tema vacío, independientemente de filtros y paginación. Esta acción sustituye las resoluciones anteriores, conserva las exclusiones y exige renovar la confirmación del lote. Después se permite ajustar el tema de cada fila.

## Posibles duplicados

Comparar las filas entre sí y con el banco existente utilizando enunciado y opciones normalizados. La normalización de comparación no debe modificar el texto que se guarda.

Marcar como posible duplicado una coincidencia del enunciado, aunque cambien las opciones. Mostrar la pregunta candidata, sus opciones y su respuesta para facilitar la revisión. No se exige búsqueda semántica en esta versión.

Cada coincidencia requiere excluir la fila o confirmar expresamente su creación como pregunta nueva. Si hay varias filas iguales dentro del archivo, permitir conservar una y excluir las demás. No fusionar, actualizar ni reutilizar preguntas automáticamente. Si se desea reutilizar una pregunta existente en otro examen, hacerlo con la gestión actual del banco, fuera de esta importación.

La confirmación de un posible duplicado no permite saltarse la unicidad de numeración del examen ni otras restricciones del modelo.

## Persistencia y compatibilidad con el banco

Reutilizar las entidades y relaciones definidas en la base de datos del proyecto para preguntas, opciones, respuestas correctas, temas y exámenes. Una fila incluida crea una pregunta, sus cuatro opciones y las relaciones resueltas.

Guardar la numeración en la relación entre examen y pregunta si así está definida en el modelo actual; no convertirla en una propiedad global de la pregunta.

No crear copias por convocatoria. Un examen o tema puede estar vinculado a varias convocatorias y debe mantener ese comportamiento.

Conservar por pregunta la procedencia y la referencia de fuente aportadas en el formulario. Reutilizar campos equivalentes si existen; en caso contrario, añadir campos opcionales `origen` y `referencia_fuente` a preguntas mediante migración. Los registros previos pueden mantenerlos nulos. Los valores nuevos de `origen` serán `examen_oficial` y `generada_documentacion`.

La explicación es opcional: reutilizar su campo existente o añadirlo como campo nullable si todavía no está disponible. Ajustar nombres y migraciones al esquema real antes de implementar; esta spec no presupone nombres de tablas intermedias que no se han revisado.

No es necesario conservar el archivo Excel original ni implementar un historial administrativo de importaciones en este MVP.

## Ejecución y consistencia

El frontend prepara la vista previa; el servidor debe validar de nuevo permisos, contenido, identificadores, relaciones y restricciones al confirmar. Nunca confiar únicamente en el resultado del navegador.

La escritura debe ejecutarse en una única transacción: si falla una pregunta o relación, no se guarda ninguna fila del lote. Una RPC o servicio de servidor puede coordinarla; no realizar inserciones independientes desde React.

Si el catálogo cambia entre revisión y confirmación —por ejemplo, desaparece un tema o se ocupa un número del examen— rechazar el lote con una incidencia comprensible y solicitar nueva revisión.

Evitar duplicaciones por doble clic o reintento tras pérdida de conexión mediante una clave de idempotencia por confirmación. Registrar la clave y el resultado de forma atómica con el lote, con unicidad por administrador y clave. Un reintento de la misma operación devuelve el resultado ya obtenido; reutilizar la clave con otro contenido debe rechazarse. Este registro técnico no implica una pantalla de histórico.

No exponer claves privilegiadas en el navegador. Tratar todo el contenido importado como texto y mantener los límites de tamaño y filas en el servidor.

## Criterios de aceptación

1. Un administrador puede descargar la plantilla y previsualizar un Excel válido sin que se creen preguntas.
2. Un usuario sin permisos no puede acceder ni ejecutar la importación directamente.
3. Los archivos incompatibles y los errores de filas muestran mensajes concretos y bloquean las filas incluidas.
4. Al excluir una fila errónea, las restantes pueden importarse si no quedan incidencias pendientes.
5. Un examen oficial exige seleccionar un examen existente y conserva la numeración de sus preguntas.
6. Las preguntas generadas pueden importarse sin examen y asignarse a temas existentes.
7. Un tema inexistente o ambiguo no se crea ni se asigna silenciosamente.
8. Los posibles duplicados requieren una decisión explícita antes de confirmar.
9. Se crean exactamente cuatro opciones y una respuesta correcta por pregunta importada.
10. Un fallo durante la escritura revierte preguntas, opciones y relaciones del lote completo.
11. Repetir la misma confirmación no crea preguntas adicionales.
12. Las convocatorias comparten las preguntas conforme al modelo actual, sin copias por convocatoria.
13. La procedencia, referencia y explicación se conservan cuando corresponda.
14. El resultado informa de las preguntas creadas y excluidas y permite abrir su listado.

## Verificación de la implementación

Comprobar con archivos representativos: carga válida con y sin examen; hojas o encabezados incorrectos; celdas vacías; fórmulas; respuestas inválidas; temas ambiguos; duplicados internos y existentes; numeración ocupada y límites de tamaño y filas.

Verificar especialmente en servidor la autorización, la reversión completa ante un fallo intermedio, los cambios concurrentes y la idempotencia ante dos confirmaciones simultáneas.
