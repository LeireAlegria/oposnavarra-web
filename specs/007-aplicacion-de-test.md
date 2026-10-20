# 007 — Aplicación de Test

**Proyecto:** OposNavarra  
**Spec:** `007-aplicacion-test`  
**Estado:** Definida

---

## 1. Objetivo

Implementar la plataforma de realización de test de OposNavarra, permitiendo a los usuarios autenticados con una suscripción activa, y a las cuentas administradoras autorizadas, practicar preguntas tipo test de las convocatorias a las que tienen acceso.

En este MVP, los usuarios podrán:

- Configurar test personalizados por temas.
- Realizar test de exámenes oficiales completos.
- Seleccionar el número de preguntas en test por temas y el tiempo disponible.
- Realizar test con preguntas aleatorias.
- Guardar automáticamente sus respuestas.
- Recuperar test en curso.
- Consultar resultados y revisar respuestas.
- Consultar un historial de test realizados.

La implementación incluirá frontend, lógica de backend y las migraciones necesarias en Supabase.

---

## 2. Alcance

### 2.1. Incluido en el MVP

- Acceso desde el botón «Acceder» de la web comercial.
- Integración con la autenticación de Supabase.
- Control de acceso mediante suscripciones activas.
- Selección de convocatoria.
- Configuración de test por temas.
- Generación aleatoria de preguntas.
- Navegación entre preguntas.
- Temporizador opcional.
- Guardado automático de respuestas.
- Recuperación de test en curso.
- Finalización manual y automática.
- Corrección de test en el backend.
- Resultados generales y por temas.
- Revisión de preguntas y respuestas.
- Historial de test realizados.
- Creación de tres tablas nuevas en Supabase.
- Catálogo de exámenes oficiales disponibles.
- Políticas de seguridad RLS.
- Migraciones SQL versionadas.

### 2.2. Fuera del alcance

- Test gratuitos.
- Simulacros preconfigurados.
- Estadísticas avanzadas.
- Gráficos de evolución.
- Rankings y comparaciones entre usuarios.
- Explicaciones de respuestas generadas por IA.
- Exportación de resultados.
- Aplicación móvil nativa.
- Versionado o snapshots del contenido de preguntas y respuestas.

---

## 3. Dependencias

Esta spec utilizará las funcionalidades y tablas creadas en las especificaciones anteriores.

### Spec 002 — Database Foundation

- `convocatorias`
- `temas`
- `convocatoria_tema`
- `preguntas`
- Relaciones entre preguntas y temas.
- Tabla de respuestas de preguntas.
- Estado editorial de las preguntas.

### Spec 003 — User Authentication

- Supabase Auth.
- Registro e inicio de sesión.
- Verificación obligatoria del correo.
- Tabla `perfiles`.
- Protección de rutas autenticadas.

### Spec 006 — Subscription Management

- Tabla `planes`.
- Tabla `suscripciones`.
- Estados de suscripción.
- Fechas de vigencia.
- Relación entre suscripciones y convocatorias, cuando corresponda.
- Acceso a todas las convocatorias incluidas en el catálogo mediante una suscripción activa, conforme al modelo definido en la spec 006.

No se implementará ninguna lógica de cobro en esta spec.

---

## 4. Acceso a la plataforma

### 4.1. Punto de entrada

La cabecera de la web comercial tendrá un botón **«Acceder»**.

Comportamiento:

1. Si el usuario no está autenticado, será redirigido al inicio de sesión.
2. Si está autenticado, accederá a la plataforma de test.
3. La plataforma comprobará si tiene una suscripción activa.
4. Si tiene una suscripción activa, podrá acceder a las funcionalidades de test.
5. Si no tiene una suscripción activa, podrá consultar sus resultados históricos y acceder a los planes disponibles.
6. Las cuentas con `perfiles.rol = 'admin'`, autenticadas y con el correo verificado, podrán acceder a todas las funcionalidades de test sin una suscripción activa. Esta excepción no activa ni simula una suscripción.

### 4.2. Control de suscripción

Para iniciar o continuar un test será obligatorio:

- Tener una sesión autenticada válida.
- Tener una suscripción activa y vigente, salvo las cuentas administradoras autorizadas.
- Cumplir las condiciones de acceso definidas en la spec 006.

La comprobación se realizará en el backend. La excepción de administración se basará en el rol actual de `public.perfiles`, nunca en datos enviados por el navegador. Los administradores podrán crear, continuar, finalizar y revisar tests conforme a las mismas reglas de contenido publicable; esta excepción no modifica el estado ni los permisos de facturación de su suscripción.

No será suficiente con ocultar funcionalidades desde el frontend.

### 4.3. Suscripción caducada

Cuando la suscripción deje de estar activa para una cuenta que no sea administradora:

- No se podrán iniciar nuevos test.
- No se podrán continuar test pendientes.
- Se podrá consultar el historial de resultados.
- Se podrán consultar notas y estadísticas guardadas.
- No se podrán revisar los enunciados y respuestas completos de test anteriores.

Los resultados históricos permanecerán almacenados.

### 4.4. Preparación para test gratuitos

La lógica de autorización deberá estar centralizada y desacoplada del motor de test.

En el MVP se permitirá el acceso mediante suscripción activa o mediante el rol de administrador autorizado, sin que este último conceda acceso de pago ni modifique las reglas de facturación.

En el futuro podrán incorporarse modalidades gratuitas sin modificar la lógica principal de generación, realización y corrección.

No se añadirán campos ni tablas específicos para test gratuitos en esta versión.

---

## 5. Pantalla principal

La plataforma tendrá cuatro apartados principales:

### Mis tests

Permite configurar y comenzar un nuevo test.

### Test oficiales

Permite seleccionar y realizar un examen oficial publicado.

### Test en curso

Muestra los test iniciados que todavía no han finalizado.

### Mis resultados

Muestra el historial de test finalizados.

Cuando corresponda, el usuario podrá seleccionar la convocatoria sobre la que quiere practicar.

Las convocatorias disponibles se obtendrán del catálogo existente.

---

## 6. Configuración del test

### 6.1. Test por temas

La modalidad de práctica personalizada será:

**Test por temas.**

El usuario podrá seleccionar uno o varios temas de una convocatoria y generar un test con preguntas asociadas a esos temas.

### 6.2. Número de preguntas

Opciones disponibles:

- 10 preguntas.
- 20 preguntas.
- 30 preguntas.
- 40 preguntas.
- 50 preguntas.

Valor por defecto: **20 preguntas**.

Las opciones superiores al número de preguntas disponibles estarán deshabilitadas.

Si existen menos de 10 preguntas disponibles, no se permitirá iniciar el test.

Si la selección de temas cambia y el número elegido deja de ser válido, el usuario deberá seleccionar una opción disponible.

### 6.3. Tiempo

Opciones disponibles:

- Sin límite.
- 10 minutos.
- 20 minutos.
- 30 minutos.
- 45 minutos.
- 60 minutos.

Valor por defecto: **Sin límite**.

Cuando se seleccione un tiempo:

- El temporizador comenzará al iniciar el test.
- Se mostrará una cuenta atrás.
- El tiempo continuará transcurriendo aunque se cierre el navegador.
- Al agotarse, el test finalizará automáticamente.

### 6.4. Selección de temas

La plataforma mostrará los temas asociados a la convocatoria.

Se utilizarán los campos `numero` y `orden` definidos en `convocatoria_tema`.

Comportamiento:

- Todos los temas estarán seleccionados por defecto.
- Se podrán seleccionar o deseleccionar individualmente.
- Existirá la opción «Seleccionar todos».
- Existirá la opción «Deseleccionar todos».
- Será obligatorio seleccionar al menos un tema.

La aplicación mostrará el número de preguntas disponibles para la selección actual.

Una pregunta asociada a varios temas seleccionados se contabilizará una sola vez.

### 6.5. Resumen

Antes de iniciar el test se mostrará:

- Convocatoria.
- Número de preguntas.
- Tiempo configurado.
- Número de temas seleccionados.
- Preguntas disponibles.

El botón principal será **«Comenzar test»**.

### 6.6. Test oficial

El apartado «Test oficiales» mostrará los exámenes oficiales publicados asociados a convocatorias activas. Cuando un examen esté asociado a más de una convocatoria, el usuario elegirá la convocatoria para aplicar su configuración de penalización.

Solo se ofrecerán exámenes con al menos una pregunta publicable para test. Un test oficial incluirá todas las preguntas asociadas a ese examen que estén publicadas y no anuladas; las preguntas de reserva se incluirán. Todas las preguntas incluidas deberán tener número y cuatro respuestas. El backend rechazará el inicio si el examen o su contenido deja de cumplir esas condiciones.

Las preguntas se presentarán en orden ascendente por su número original, sin selección aleatoria ni posibilidad de elegir cantidad o temas. La cantidad de preguntas se determinará por el contenido elegible del examen.

El usuario podrá elegir el tiempo entre las opciones definidas en el apartado 6.3, cuyo valor inicial será «Sin límite». El límite elegido se aplicará al intento y el backend finalizará automáticamente el test al agotarse.

Los exámenes oficiales utilizarán el mismo guardado automático, recuperación, finalización, corrección, historial y revisión que los test por temas. El intento conservará el examen oficial de origen y la convocatoria elegida, y mostrará esa información en curso, historial y resultados. No se enviarán respuestas correctas al navegador hasta que el intento haya finalizado.

---

## 7. Generación del test

La generación se realizará mediante lógica segura del backend de Supabase.

### 7.1. Proceso

Al pulsar «Comenzar test»:

1. Verificar la identidad del usuario.
2. Comprobar su suscripción.
3. Validar la convocatoria.
4. Validar los temas seleccionados.
5. Comprobar las preguntas disponibles.
6. Seleccionar aleatoriamente las preguntas.
7. Crear el registro del intento.
8. Guardar los temas seleccionados.
9. Guardar las preguntas y su orden.
10. Devolver los datos necesarios para comenzar.

La creación del intento y sus relaciones deberá realizarse de forma atómica.

Si ocurre un error, no deberá quedar un test creado parcialmente.

Para un test oficial, el backend validará convocatoria, examen oficial y contenido publicable completo, guardará el examen asociado al intento y persistirá todas sus preguntas ordenadas por su número original.

### 7.2. Selección de preguntas

Reglas:

- Solo se utilizarán preguntas publicadas.
- Las preguntas deberán pertenecer a los temas seleccionados.
- Los temas deberán pertenecer a la convocatoria.
- No se repetirán preguntas dentro de un mismo test.
- La selección será aleatoria.
- No será obligatorio repartir las preguntas proporcionalmente entre temas.
- El orden quedará fijado al crear el test.

### 7.3. Seguridad

Durante la realización del test, el frontend no recibirá:

- Identificadores que permitan deducir la respuesta correcta mediante consultas no autorizadas.
- Indicadores de corrección.
- Resultados calculados.
- Información sobre cuál es la opción correcta.

El backend será responsable de proteger esta información mediante permisos y operaciones específicas.

---

## 8. Realización del test

### 8.1. Presentación

Se mostrará una pregunta por pantalla.

Elementos:

- Número de pregunta actual.
- Total de preguntas.
- Enunciado.
- Cuatro opciones de respuesta.
- Botón «Anterior».
- Botón «Siguiente».
- Temporizador, si existe.
- Botón «Finalizar test».

### 8.2. Selección de respuestas

El usuario podrá:

- Seleccionar una respuesta.
- Cambiar una respuesta anterior.
- Dejar preguntas en blanco.
- Navegar libremente entre preguntas.

No se mostrará la corrección durante el test.

### 8.3. Guardado automático

Cada cambio de respuesta deberá persistirse en Supabase.

El usuario no tendrá que guardar manualmente.

La interfaz deberá mostrar adecuadamente los estados de guardado y los posibles errores.

El sistema deberá impedir que una respuesta se registre fuera de plazo o después de finalizar el test.

### 8.4. Finalización manual

Al pulsar «Finalizar test»:

- Se mostrará una confirmación.
- Se indicará cuántas preguntas están sin responder.
- El usuario podrá cancelar o confirmar.

Tras confirmar:

- Se bloquearán las respuestas.
- Se realizará la corrección.
- Se almacenarán los resultados.
- Se mostrará la pantalla de resultados.

### 8.5. Finalización automática

Si el test tiene tiempo limitado y este llega a cero:

- Se finalizará automáticamente.
- Se utilizarán las respuestas persistidas hasta el vencimiento.
- Las preguntas restantes se considerarán en blanco.
- Se calculará el resultado.
- Se mostrará la pantalla de resultados.

La expiración deberá comprobarse en el backend.

### 8.6. Recuperación

Los test en curso aparecerán en el apartado correspondiente.

Al recuperarlos:

- Se conservarán las mismas preguntas.
- Se mantendrá su orden.
- Se recuperarán las respuestas guardadas.
- Se calculará el tiempo restante.
- No se generarán preguntas nuevas.

Si el tiempo ha expirado, el backend finalizará el test antes de permitir continuar.

---

## 9. Corrección

La corrección se realizará exclusivamente en el backend.

### 9.1. Clasificación

Cada pregunta tendrá uno de estos resultados:

- Correcta.
- Incorrecta.
- En blanco.

### 9.2. Penalización

La penalización será configurable por convocatoria.

Se utilizará un parámetro que represente la penalización aplicada por cada respuesta incorrecta.

Para una penalización de un tercio:

`puntuacion_neta = aciertos - (fallos / 3)`

La nota se calculará mediante:

`nota = (puntuacion_neta / numero_preguntas) * 10`

La nota final estará comprendida entre 0 y 10.

Se redondeará a dos decimales.

Las preguntas en blanco no penalizarán.

El porcentaje de aciertos será:

`porcentaje_aciertos = (aciertos / numero_preguntas) * 100`

### 9.3. Persistencia

Al finalizar se guardarán:

- Aciertos.
- Fallos.
- Preguntas en blanco.
- Puntuación neta.
- Nota.
- Porcentaje de aciertos.
- Tiempo empleado.
- Penalización aplicada.

Los resultados no se recalcularán automáticamente si posteriormente se modifica una pregunta o la regla de penalización.

---

## 10. Pantalla de resultados

### 10.1. Resumen general

Se mostrará:

- Nota sobre 10.
- Número total de preguntas.
- Aciertos.
- Fallos.
- Preguntas en blanco.
- Porcentaje de aciertos.
- Tiempo empleado.

La nota será el elemento visual principal.

### 10.2. Resultados por temas

Para cada tema que tenga preguntas en el test se mostrará:

- Número y nombre.
- Número de preguntas.
- Aciertos.
- Fallos.
- Preguntas en blanco.
- Porcentaje de aciertos.

Una pregunta asociada a varios temas podrá aparecer en el desglose de cada uno.

Sin embargo, solo se contabilizará una vez en el resultado global.

### 10.3. Acciones

Se mostrarán:

- «Revisar test».
- «Crear otro test».
- «Mis resultados».

---

## 11. Revisión del test

El usuario podrá revisar los test finalizados mientras tenga una suscripción activa. Las cuentas administradoras autorizadas podrán hacerlo aunque no tengan una suscripción activa.

Se mostrará una pregunta cada vez.

Para cada pregunta:

- Enunciado.
- Cuatro opciones.
- Respuesta seleccionada.
- Respuesta correcta.
- Estado de corrección.

Se podrá navegar entre preguntas mediante «Anterior» y «Siguiente».

La revisión será de solo lectura.

No se podrán modificar respuestas ni resultados.

Los enunciados y las opciones se obtendrán de las tablas originales de preguntas y respuestas.

No se almacenarán copias de su contenido en los intentos.

---

## 12. Historial de test

### 12.1. Pantalla «Mis resultados»

El usuario podrá consultar todos sus test finalizados.

Se mostrarán ordenados por fecha de finalización descendente.

Cada registro incluirá:

- Fecha.
- Convocatoria.
- Temas seleccionados.
- Número de preguntas.
- Nota.
- Aciertos.
- Fallos.
- Preguntas en blanco.

### 12.2. Consulta

Al seleccionar un test, se abrirá su pantalla de resultados.

El historial seguirá disponible aunque la suscripción haya caducado.

La revisión completa de preguntas requerirá una suscripción activa, salvo para las cuentas administradoras autorizadas.

### 12.3. Paginación

El historial deberá estar paginado.

No se cargarán todos los intentos simultáneamente.

### 12.4. Limitaciones

No se incluirán:

- Gráficos de evolución.
- Comparaciones entre usuarios.
- Exportación de resultados.
- Eliminación de test desde la interfaz.

---

## 13. Base de datos

Esta spec incorporará tres tablas nuevas mediante migraciones SQL versionadas de Supabase.

No se modificará retroactivamente la spec 002.

Los nombres de las claves foráneas se adaptarán a las tablas y columnas existentes.

### 13.1. Tabla `test_intentos`

Representa cada test iniciado por un usuario.

Campos:

| Campo                      | Tipo                 | Descripción                                        |
| -------------------------- | -------------------- | -------------------------------------------------- |
| `id`                       | uuid                 | Clave primaria                                     |
| `usuario_id`               | uuid                 | Referencia al usuario                              |
| `convocatoria_id`          | uuid                 | Convocatoria                                       |
| `examen_id`                | uuid nullable        | Examen oficial de origen; nulo para test por temas |
| `estado`                   | text                 | `en_curso` o `finalizado`                          |
| `numero_preguntas`         | integer              | Cantidad configurada                               |
| `tiempo_limite_segundos`   | integer nullable     | Duración configurada                               |
| `iniciado_en`              | timestamptz          | Fecha de inicio                                    |
| `expira_en`                | timestamptz nullable | Fecha límite                                       |
| `finalizado_en`            | timestamptz nullable | Fecha de finalización                              |
| `tiempo_empleado_segundos` | integer nullable     | Tiempo empleado                                    |
| `aciertos`                 | integer nullable     | Respuestas correctas                               |
| `fallos`                   | integer nullable     | Respuestas incorrectas                             |
| `en_blanco`                | integer nullable     | Sin responder                                      |
| `puntuacion_neta`          | numeric nullable     | Puntuación con penalización                        |
| `nota`                     | numeric nullable     | Nota sobre 10                                      |
| `porcentaje_aciertos`      | numeric nullable     | Porcentaje                                         |
| `penalizacion_aplicada`    | numeric nullable     | Penalización por error                             |

Restricciones:

- `numero_preguntas` debe ser positivo.
- `tiempo_limite_segundos` debe ser positivo cuando exista.
- Los contadores no pueden ser negativos.
- La suma de aciertos, fallos y preguntas en blanco debe coincidir con el total al finalizar.
- La nota debe estar entre 0 y 10.
- Los campos de resultados deberán estar completos cuando el estado sea `finalizado`.
- `finalizado_en` será obligatorio para un test finalizado.
- `expira_en` se calculará a partir del inicio y el tiempo límite.

### 13.2. Tabla `test_intento_temas`

Almacena los temas seleccionados al crear el test.

| Campo             | Tipo | Descripción                  |
| ----------------- | ---- | ---------------------------- |
| `test_intento_id` | uuid | Referencia a `test_intentos` |
| `tema_id`         | uuid | Referencia a `temas`         |

La clave primaria será compuesta:

`(test_intento_id, tema_id)`

No se permitirá duplicar un tema dentro del mismo intento.

### 13.3. Tabla `test_intento_preguntas`

Almacena las preguntas seleccionadas y las respuestas del usuario.

| Campo                       | Tipo          | Descripción                           |
| --------------------------- | ------------- | ------------------------------------- |
| `id`                        | uuid          | Clave primaria                        |
| `test_intento_id`           | uuid          | Referencia al intento                 |
| `pregunta_id`               | uuid          | Referencia a la pregunta              |
| `orden`                     | integer       | Posición de la pregunta               |
| `respuesta_seleccionada_id` | uuid nullable | Respuesta elegida                     |
| `resultado`                 | text nullable | `correcta`, `incorrecta`, `en_blanco` |

Restricciones:

- Una pregunta no podrá repetirse dentro del mismo intento.
- Dos preguntas no podrán tener el mismo orden dentro del intento.
- El orden deberá ser positivo.
- La respuesta seleccionada deberá pertenecer a la pregunta correspondiente.
- El resultado solo podrá establecerse mediante la corrección del backend.
- No se podrán modificar respuestas de test finalizados.

### 13.4. Integridad referencial

Las relaciones deberán garantizar que:

- Un intento pertenece a un usuario.
- Un intento corresponde a una convocatoria.
- Un intento oficial conserva el examen de origen; los intentos por temas no tienen examen asociado.
- Los temas del intento existen.
- Las preguntas del intento existen.
- Las respuestas seleccionadas pertenecen a sus preguntas.

No se permitirá eliminar físicamente preguntas o respuestas que estén referenciadas por intentos históricos.

La eliminación de un usuario deberá respetar la política de conservación de datos personales del proyecto.

### 13.5. Sin snapshots de preguntas

**Decisión explícita del MVP: no almacenar copias de los enunciados ni de las respuestas.**

Los intentos guardarán únicamente las referencias necesarias.

Consecuencias aceptadas:

- Si se modifica el enunciado de una pregunta, la revisión histórica mostrará el enunciado actualizado.
- Si se modifica el texto de una respuesta, se mostrará su versión actual.
- Si cambia cuál es la respuesta correcta, la revisión mostrará la corrección actual de la pregunta, mientras que el resultado histórico conservará la calificación originalmente calculada.
- Los resultados guardados no se recalcularán automáticamente.
- Las preguntas y respuestas utilizadas en test históricos no podrán eliminarse físicamente.

No se implementará versionado de preguntas en esta spec.

### 13.6. Índices

Se crearán los índices necesarios para:

- Consultar intentos por usuario.
- Consultar intentos por estado.
- Obtener el historial ordenado por fecha.
- Consultar preguntas de un intento.
- Consultar temas de un intento.

Se priorizarán índices compuestos cuando respondan a las consultas principales.

---

## 14. Seguridad en Supabase

### 14.1. Row Level Security

Las tres tablas nuevas tendrán RLS habilitado.

Los usuarios solo podrán acceder a los datos que les pertenecen.

Las políticas deberán impedir:

- Consultar intentos de otros usuarios.
- Modificar respuestas de otros usuarios.
- Modificar resultados calculados.
- Acceder a información de corrección antes de finalizar.
- Saltarse las restricciones de suscripción.

### 14.2. Operaciones de backend

La creación, guardado de respuestas y finalización se implementarán mediante operaciones seguras de Supabase.

Podrán utilizarse funciones PostgreSQL o Supabase Edge Functions según las necesidades de cada operación.

La implementación deberá garantizar:

- Validación de identidad.
- Validación de suscripción.
- Validación de propiedad del intento.
- Transacciones para operaciones compuestas.
- Corrección exclusivamente en el backend.
- Finalización idempotente.
- Protección contra modificaciones fuera de plazo.

### 14.3. Protección de respuestas correctas

El usuario no deberá poder obtener la respuesta correcta de preguntas pendientes mediante consultas directas a Supabase.

Las políticas y las operaciones de lectura deberán proteger la información de corrección, no solamente ocultarla en la interfaz.

### 14.4. Expiración de test

El backend será la autoridad sobre los plazos.

Un test cuyo tiempo haya expirado no podrá aceptar nuevas respuestas aunque el navegador no haya ejecutado la finalización automática.

La finalización de test expirados deberá poder ejecutarse cuando el usuario vuelva a acceder o consulte sus resultados, sin depender exclusivamente de que mantenga abierta la página.

---

## 15. Frontend

Se utilizará el stack definido para OposNavarra:

- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- React Hook Form.
- Zod.
- Supabase JavaScript Client.

### 15.1. Componentes principales

La implementación deberá contemplar:

- Pantalla principal de la plataforma.
- Selector de convocatoria.
- Formulario de configuración de test.
- Selector de temas.
- Vista de realización.
- Componente de pregunta.
- Temporizador.
- Confirmación de finalización.
- Pantalla de resultados.
- Desglose por temas.
- Revisión de test.
- Historial.
- Listado de test en curso.
- Catálogo y configuración de test oficiales.

### 15.2. Experiencia de usuario

La interfaz deberá:

- Ser responsive.
- Funcionar correctamente en móvil y escritorio.
- Mostrar estados de carga.
- Mostrar errores comprensibles.
- Indicar fallos de guardado.
- Evitar pérdidas accidentales de respuestas.
- Mantener una navegación clara.
- Ser accesible mediante teclado.

---

## 16. Pruebas

Se implementarán pruebas automatizadas de las reglas de negocio principales.

### Generación

- Generación con diferentes números de preguntas.
- Selección de varios temas.
- Preguntas compartidas entre temas.
- Ausencia de preguntas duplicadas.
- Cantidad insuficiente de preguntas.
- Preguntas no publicadas.
- Acceso a convocatorias válidas.
- Exámenes oficiales asociados a convocatorias activas.
- Preguntas oficiales completas y ordenadas por número original.
- Rechazo de exámenes con preguntas incluidas sin número o sin cuatro respuestas.
- Rechazo de inicios con examen no oficial o no asociado a la convocatoria seleccionada.

### Realización

- Guardado de respuestas.
- Cambio de respuesta.
- Preguntas sin responder.
- Recuperación de test.
- Finalización manual.
- Expiración del temporizador.
- Intentos de responder después de finalizar.

### Corrección

- Todas las respuestas correctas.
- Todas las respuestas incorrectas.
- Todas las respuestas en blanco.
- Combinaciones de resultados.
- Penalización configurable.
- Nota mínima y máxima.
- Redondeo de resultados.
- Resultados por temas.
- Preguntas compartidas entre varios temas.

### Seguridad

- Usuario sin autenticar.
- Usuario sin suscripción.
- Suscripción caducada.
- Acceso a intentos de otros usuarios.
- Modificación no autorizada de resultados.
- Consulta anticipada de respuestas correctas.
- Finalización concurrente.
- Intentos de guardar respuestas fuera de plazo.

---

## 17. Criterios de aceptación

### Acceso

- [ ] El botón «Acceder» permite entrar en la plataforma.
- [ ] La plataforma requiere autenticación.
- [ ] Los usuarios con suscripción activa y las cuentas administradoras autorizadas pueden iniciar test.
- [ ] La falta de suscripción no limita el acceso de las cuentas administradoras a las funcionalidades de test.
- [ ] Un usuario sin suscripción puede consultar sus resultados históricos.

### Configuración

- [ ] Se pueden seleccionar los temas.
- [ ] Todos los temas están seleccionados por defecto.
- [ ] Se puede seleccionar el número de preguntas.
- [ ] Se puede seleccionar el tiempo.
- [ ] Se muestra el número de preguntas disponibles.
- [ ] No se pueden generar test con una configuración inválida.
- [ ] El apartado «Test oficiales» permite seleccionar un examen oficial asociado a una convocatoria activa.
- [ ] Cada test oficial incluye todas las preguntas publicadas y no anuladas del examen en orden numérico, sin selección de cantidad o temas.
- [ ] Se puede elegir el límite de tiempo para un test oficial, incluyendo «Sin límite».
- [ ] Los intentos oficiales guardan y muestran su examen de origen en curso e historial.

### Realización

- [ ] Las preguntas se generan aleatoriamente.
- [ ] No existen preguntas duplicadas.
- [ ] Se muestra una pregunta por pantalla.
- [ ] Se pueden seleccionar y modificar respuestas.
- [ ] Las respuestas se guardan automáticamente.
- [ ] Se puede recuperar un test en curso.
- [ ] Se puede finalizar manualmente.
- [ ] Los test con tiempo finalizan al expirar.

### Resultados

- [ ] La corrección se realiza en el backend.
- [ ] Se aplica la penalización configurada.
- [ ] Se muestra la nota sobre 10.
- [ ] Se muestran aciertos, fallos y preguntas en blanco.
- [ ] Se muestra el porcentaje de aciertos.
- [ ] Se muestra el tiempo empleado.
- [ ] Se muestran los resultados por temas.
- [ ] Se pueden revisar las respuestas con sus permisos correspondientes.

### Historial

- [ ] Cada test queda asociado a su usuario.
- [ ] Los test finalizados permanecen guardados.
- [ ] Se puede consultar el historial.
- [ ] El historial está paginado.
- [ ] Los resultados siguen disponibles tras caducar la suscripción.
- [ ] Los resultados históricos no cambian al editar preguntas.
- [ ] No se almacenan copias de enunciados ni respuestas.

### Base de datos

- [ ] Existe la tabla `test_intentos`.
- [ ] Existe la tabla `test_intento_temas`.
- [ ] Existe la tabla `test_intento_preguntas`.
- [ ] Las tablas tienen claves foráneas y restricciones.
- [ ] Se han creado los índices necesarios.
- [ ] RLS está habilitado.
- [ ] Las migraciones están versionadas.
- [ ] La creación y finalización de test mantienen la integridad transaccional.

---

## 18. Definición de terminado

La spec estará completada cuando:

1. Las tres tablas estén creadas mediante migraciones.
2. Las relaciones, restricciones, índices y políticas RLS estén implementadas.
3. El backend permita generar test de forma segura.
4. El usuario pueda configurar y realizar test.
5. Las respuestas se guarden y puedan recuperarse.
6. El temporizador funcione y se valide desde el backend.
7. La corrección se realice correctamente.
8. Los resultados se almacenen y puedan consultarse.
9. El desglose por temas funcione.
10. La revisión respete los permisos de suscripción.
11. El historial muestre los test finalizados.
12. Las pruebas principales estén implementadas y superadas.
13. La aplicación sea usable desde móvil y escritorio.
14. No se hayan incorporado funcionalidades fuera del alcance del MVP.
