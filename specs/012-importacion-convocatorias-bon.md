# Importación de convocatorias desde el BON y organización del temario por bloques

## Estado y objetivo

Spec funcional para OposNavarra. Su numeración se asignará al incorporarla al proyecto, utilizando el siguiente número disponible.

Permitir que un administrador cree una convocatoria y su temario a partir de una única URL del Boletín Oficial de Navarra (BON), mediante extracción, revisión y confirmación. Organizar todos los temarios como convocatoria → bloques → temas, manteniendo el catálogo reutilizable de temas.

Esta spec amplía el modelo de la spec 002 mediante una nueva migración y adapta las interfaces administrativas y de selección de temas.

## Alcance de la primera versión

- Introducir una URL del BON por operación.
- Extraer los datos de la convocatoria y el texto completo de los temas, agrupados por bloques.
- Revisar y editar el borrador antes de guardar.
- Crear temas nuevos o vincular temas existentes mediante decisión del administrador.
- Guardar la convocatoria, sus bloques, los temas nuevos y sus asociaciones en una única transacción.
- Gestionar bloques también en la edición manual de convocatorias.
- Mostrar los temas agrupados por bloques en la configuración de tests.
- Migrar las asociaciones existentes a un bloque General por convocatoria.

Quedan fuera: importación de varias URL, descubrimiento automático de anuncios, importación de exámenes o preguntas, Excel, PDF y OCR, sincronización periódica y aplicación automática de correcciones posteriores del BON. El borrador no necesita persistir entre sesiones.

## Permisos

Acceso exclusivo para administradores.

## Reglas del dominio

1. Cada bloque pertenece a una sola convocatoria y tiene nombre y orden.
2. Cada tema asociado a una convocatoria pertenece a un bloque de esa misma convocatoria.
3. El tema mantiene su identidad reutilizable y puede pertenecer a varias convocatorias.
4. El bloque, el número oficial y el orden se almacenan en la asociación con la convocatoria; no son atributos globales del tema.
5. El orden del tema es relativo al bloque. La visualización se ordena primero por bloque y después por tema.
6. Los números oficiales pueden repetirse entre bloques. No se utiliza la numeración para identificar globalmente un tema.
7. No se resume ni se recorta el contenido del tema durante la extracción. Solo se normalizan espacios y saltos de línea de presentación.
8. Vincular un tema existente no modifica su contenido ni sus otras asociaciones.
9. No se crean preguntas ni registros de exámenes a partir de la descripción de las pruebas en las bases.

## Modelo de datos

Los nombres de campos nuevos que aparecen aquí son la propuesta de esta spec. Antes de implementar se revisará el esquema real para reutilizar los campos equivalentes ya existentes y no duplicar datos.

### Nueva tabla: convocatoria_bloques

| Campo | Descripción |
|---|---|
| id | Clave primaria, siguiendo la convención existente. |
| convocatoria_id | Referencia obligatoria a la convocatoria. |
| nombre | Nombre completo del bloque, obligatorio. |
| orden | Entero positivo que establece la posición dentro de la convocatoria. |
| referencia_oficial | Etiqueta original opcional, por ejemplo Parte I. |

El orden es único dentro de una convocatoria. El nombre no se utiliza como identificador. La referencia oficial permite conservar las etiquetas originales al reordenar bloques.

### Adaptación de convocatoria_tema

- Incorporar bloque_id obligatorio tras la migración.
- Mantener numero como número o etiqueta oficial del tema, reutilizando el tipo actual cuando sea compatible.
- Mantener orden como entero positivo relativo al bloque, único dentro de este.
- Mantener la unicidad existente de convocatoria y tema: un mismo tema reutilizable no se asocia dos veces a la misma convocatoria en esta versión.
- Garantizar en la base de datos que el bloque pertenece a la convocatoria indicada en la asociación, mediante una restricción compuesta equivalente o una solución de integridad igualmente efectiva.
- Adaptar las restricciones anteriores que exigieran numero u orden únicos en toda la convocatoria para permitir que se reinicien por bloque.

Si el anuncio repite un contenido en varios bloques, se debe advertir en el borrador y resolverlo antes de confirmar; no se descartan entradas silenciosamente.

### Datos de origen de la convocatoria

Reutilizar o añadir los campos necesarios para conservar:

- URL canónica del anuncio importado.
- Identificador de origen estable obtenido de la ruta del anuncio, incluyendo año, número de boletín e identificador del anuncio.
- Código del anuncio, cuando figure en la publicación.
- Fecha de publicación, referencia de la resolución y número del BON.
- Fecha y hora de importación.

El identificador de origen tendrá unicidad para impedir importar dos veces el mismo anuncio, incluso mediante peticiones concurrentes. Las convocatorias manuales existentes podrán mantener estos campos vacíos.

### Migración de datos existentes

1. Crear la tabla de bloques e introducir bloque_id inicialmente opcional.
2. Crear un bloque General, de orden 1, en cada convocatoria existente.
3. Asignar a ese bloque las asociaciones actuales, conservando su número y orden.
4. Comprobar y resolver explícitamente cualquier incompatibilidad con las nuevas restricciones antes de aplicarlas; no borrar asociaciones para completar la migración.
5. Activar las restricciones y hacer obligatorio bloque_id.

No se modifican las identidades de los temas, las preguntas, los resultados ni los tests existentes. La migración se entrega versionada en el repositorio.

## Flujo de importación

### 1. Introducir URL

En el área de convocatorias del panel administrativo, añadir Importar desde el BON. Mostrar un campo URL y la acción Extraer convocatoria.

Aceptar una sola URL HTTPS de anuncio en bon.navarra.es. Normalizar la barra final y los parámetros que no identifican el anuncio. Las variantes de idioma del mismo anuncio no deben crear identidades de origen distintas.

La lectura se realiza desde el servidor. Validar también el destino de cualquier redirección, limitar el tiempo y el tamaño de descarga y rechazar destinos ajenos al BON. No depender de que el navegador pueda leer el BON directamente.

### 2. Extraer un borrador

Identificar el anuncio principal, los datos de la convocatoria y la sección correspondiente al temario. No asumir que el temario siempre está en el anexo I ni confundir la numeración de las bases con temas.

Proponer los datos compatibles con el catálogo actual: nombre de presentación, denominación oficial, administración convocante, plazas, nivel y referencias de publicación, cuando estén disponibles. El nombre de presentación se puede editar. No inventar valores ni añadir campos de catálogo innecesarios solo porque aparezcan en el anuncio.

Extraer bloques, sus etiquetas y orden, y para cada tema su número oficial, posición y texto completo. Si el temario no tiene bloques explícitos, proponer un bloque General. No inventar un título separado del texto: si el catálogo exige título y descripción, mostrar la propuesta y conservar siempre el contenido íntegro.

Si hay varios posibles temarios, información ambigua o contenido incompleto, mostrarlo para revisión. Si no se puede identificar el temario, explicar el problema y permitir completar manualmente el borrador o cancelar. No presentar una extracción parcial como completa.

La extracción genera datos propuestos: no escribe aún en el catálogo. No requiere una tecnología concreta de extracción; la solución deberá cumplir las validaciones y los casos de aceptación.

### 3. Revisar y editar

Mostrar en la misma pantalla:

- Enlace al anuncio original y datos de la convocatoria.
- Bloques ordenados con sus temas.
- Totales de bloques y temas.
- Errores, advertencias y decisiones de reutilización pendientes.

Permitir editar datos, cambiar nombres y etiquetas de bloques, añadir o eliminar bloques y temas del borrador, mover temas entre bloques y reordenarlos. Cambiar el orden no renumera automáticamente los números oficiales. Al eliminar un bloque con temas se debe exigir moverlos o confirmar su eliminación del borrador.

Todos los campos obligatorios del modelo actual deben estar completos antes del guardado.

### 4. Resolver reutilización de temas

Para cada entrada, permitir Crear tema nuevo o Vincular tema existente. Mostrar candidatos por coincidencia de contenido o nombre junto al texto extraído y el contenido existente.

Una coincidencia no produce una vinculación automática, incluso si el texto parece idéntico. No utilizar solo el nombre de una ley como prueba de equivalencia. Cuando el contenido existente difiera del publicado, advertirlo y permitir crear un tema distinto.

Conservar el texto oficial extraído en la asociación convocatoria_tema, mediante un campo texto_oficial o equivalente. Así se preserva el alcance publicado para esa convocatoria aunque se vincule a un tema reutilizable. Este texto es metadato del temario, no una nueva entidad de preguntas.

Vincular un tema reutiliza sus relaciones actuales con preguntas según el comportamiento vigente del catálogo. La revisión debe hacer visible este efecto para que el administrador compruebe que el contenido es adecuado.

### 5. Confirmar y guardar

Mostrar el resumen de la operación: convocatoria, bloques, temas nuevos y temas reutilizados. La acción Confirmar importación envía el borrador revisado.

El servidor vuelve a validar todos los datos, referencias e integridad, y guarda en una única transacción de base de datos. No realizar una secuencia de escrituras independientes desde React.

Ante cualquier fallo, revertir toda la operación. Conservar el borrador en pantalla para corregir y reintentar. Desactivar la confirmación mientras se procesa y utilizar una clave de operación o mecanismo equivalente para que reintentar una petición no duplique registros.

Al terminar, mostrar el resumen y un enlace a la convocatoria creada. Una respuesta perdida tras una confirmación correcta debe poder resolverse identificando la operación ya completada.

## Duplicados y nuevas publicaciones

- Si el anuncio ya está importado, bloquear una segunda creación y enlazar la convocatoria existente.
- Comprobar el origen antes de extraer cuando sea posible y de nuevo al guardar.
- Si una convocatoria manual parece coincidir, mostrar una advertencia y permitir cancelar para revisar; no fusionarla automáticamente.
- Una corrección o modificación publicada en otra URL no se tratará automáticamente como convocatoria nueva ni como actualización. Si se detecta ese tipo de anuncio, informar de que no está soportado en esta versión y detener la importación.
- No sobrescribir convocatorias, bloques ni temas existentes mediante esta funcionalidad.

## Edición manual y uso en tests

La gestión manual permitirá crear y ordenar bloques, asociar temas, moverlos entre bloques y editar su número y orden en la convocatoria. Antes de eliminar un bloque con temas se exigirá mover o desvincular sus temas explícitamente. Desvincular un tema no elimina el registro reutilizable ni sus preguntas.

En la selección de temas para crear un test, mostrar los bloques en orden y sus temas en orden interno. Mantener todos los temas seleccionados por defecto, como establece el comportamiento actual. Los bloques organizan la selección; no cambian la generación, las reglas de acceso ni la corrección de tests. Evitar seleccionar la misma pregunta más de una vez cuando el comportamiento actual contemple varios temas relacionados.

## Errores y validaciones

Bloquear la confirmación ante campos obligatorios vacíos, bloques sin nombre, órdenes inválidos o repetidos dentro de su ámbito, temas sin contenido, referencias inexistentes, temas asociados repetidos o bloques de otra convocatoria. Un bloque debe contener al menos un tema al confirmar.

Un número oficial repetido dentro de un bloque debe marcarse para revisión y resolverse antes de confirmar. Los números pueden reiniciarse en bloques distintos y no tienen que ser consecutivos.

Mostrar mensajes específicos para URL inválida, dominio no admitido, descarga fallida, contenido no compatible, ausencia de temario y anuncio ya importado. No introducir contenido descargado como HTML ejecutable en la interfaz.

## Caso de referencia

Fuente: https://bon.navarra.es/es/anuncio/-/texto/2025/101/21/

La revisión realizada para esta spec identifica la convocatoria de administrativo de 585 plazas, Resolución 1322/2025, publicada en el BON 101 de 22 de mayo de 2025, código F2507100.

| Bloque | Orden | Temas | Numeración oficial |
|---|---:|---:|---|
| Actividad administrativa | 1 | 5 | 1–5 |
| Normativa básica en la Administración de la Comunidad Foral de Navarra | 2 | 18 | 1–18 |
| Informática | 3 | 4 | 1–4 |

Resultado esperado: una convocatoria, tres bloques y 27 entradas de temario, con texto íntegro y orden conservado. El número de temas nuevos depende de las decisiones de reutilización del administrador.

## Criterios de aceptación

1. El caso de referencia genera el borrador esperado con tres bloques y 27 temas, sin confundir las bases o las pruebas con temas o exámenes.
2. Se puede corregir el borrador, mover temas y reordenar bloques antes de guardar.
3. La numeración se reinicia por bloque sin conflictos y el orden visual respeta ambos niveles.
4. Vincular un tema existente conserva su identidad, contenido y asociaciones previas; el texto oficial de esta convocatoria se conserva por separado.
5. No se crea ningún registro del catálogo al extraer, editar o cancelar el borrador.
6. La confirmación válida guarda toda la estructura; un error provoca la reversión completa.
7. Repetir la confirmación, reintentar tras una respuesta perdida o importar simultáneamente el mismo anuncio no duplica datos.
8. Las variantes equivalentes de URL detectan el anuncio ya importado.
9. Una URL no admitida o una extracción fallida produce un mensaje claro y no genera registros parciales.
10. Las convocatorias existentes quedan agrupadas en General, conservando temas, números y orden.
11. La gestión manual y la selección de temas en tests muestran y respetan los bloques.
12. No se puede asociar un tema a un bloque de otra convocatoria, tampoco mediante una petición directa al servidor.
13. Los temarios sin bloques explícitos se proponen en General; las ambigüedades o extracciones incompletas requieren revisión antes de confirmar.

## Entregables de implementación

- Migración versionada y adaptación del acceso a datos.
- Servicio de extracción desde el BON y validación del borrador.
- Operación transaccional de confirmación con protección frente a duplicados y reintentos.
- Interfaz de importación, revisión y resultado.
- Gestión manual de bloques y adaptación del selector de temas.
- Pruebas centradas en extracción del caso de referencia, integridad, reutilización, migración y guardado atómico.
