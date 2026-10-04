# 002 — Database Foundation

## Objetivo

Establecer la base de datos inicial de OposNavarra para gestionar el catálogo de convocatorias y el banco reutilizable de preguntas tipo test.

La base de datos debe permitir:

- Gestionar convocatorias.
- Asociar temas a una o varias convocatorias.
- Asociar exámenes a una o varias convocatorias.
- Gestionar preguntas tipo test.
- Asociar preguntas a temas.
- Asociar preguntas a un examen cuando procedan de uno.
- Gestionar las cuatro respuestas de cada pregunta y determinar cuál es la correcta.
- Controlar el estado editorial de las preguntas.
- Gestionar la evolución del esquema mediante migraciones versionadas.

Esta spec no incluye usuarios, autenticación, suscripciones, realización de tests ni estadísticas.

---

# 1. Modelo de dominio

El contenido de OposNavarra se organiza alrededor de las siguientes entidades:

- Convocatorias
- Temas
- Exámenes
- Preguntas
- Respuestas

Los temas y los exámenes son reutilizables entre convocatorias.

Las preguntas no pertenecen directamente a una convocatoria. Su disponibilidad para una convocatoria se deriva de los temas y exámenes asociados a dicha convocatoria.

---

# 2. Convocatorias

Una convocatoria representa una convocatoria concreta para la que OposNavarra ofrece contenido de preparación.

Debe existir una tabla:

`convocatorias`

con los siguientes campos:

- `id`: UUID, clave primaria.
- `nombre`: texto obligatorio.
- `descripcion`: texto opcional.
- `organismo_convocante`: texto opcional.
- `ambito`: texto opcional.
- `categoria`: texto opcional.
- `grupo`: texto opcional.
- `fuente_oficial_url`: texto opcional.
- `informacion_url`: texto opcional.
- `activo`: booleano obligatorio, `true` por defecto.
- `created_at`: fecha y hora de creación.
- `updated_at`: fecha y hora de última modificación.

Una convocatoria inactiva debe conservarse en la base de datos.

No existe en el modelo de dominio ninguna entidad denominada `oposicion`.

---

# 3. Temas

Los temas representan unidades reutilizables de contenido.

Debe existir una tabla:

`temas`

con los siguientes campos:

- `id`: UUID, clave primaria.
- `nombre`: texto obligatorio.
- `descripcion`: texto opcional.
- `activo`: booleano obligatorio, `true` por defecto.
- `created_at`: fecha y hora de creación.
- `updated_at`: fecha y hora de última modificación.

Un tema puede pertenecer a múltiples convocatorias.

Una convocatoria puede contener múltiples temas.

---

# 4. Relación convocatoria-tema

Debe existir una tabla:

`convocatoria_tema`

que represente la relación N:M entre convocatorias y temas.

Debe contener:

- `convocatoria_id`: FK a `convocatorias`.
- `tema_id`: FK a `temas`.
- `numero`: entero positivo obligatorio.
- `orden`: entero positivo obligatorio.
- `created_at`: fecha y hora de creación.

La combinación:

`convocatoria_id + tema_id`

debe ser única y constituir la clave primaria.

Dentro de una misma convocatoria no puede repetirse `numero`.

Dentro de una misma convocatoria no puede repetirse `orden`.

`numero` representa la numeración del tema dentro de la convocatoria.

`orden` representa la posición en la que OposNavarra debe presentar dicho tema.

Ambos conceptos deben mantenerse separados.

---

# 5. Exámenes

Los exámenes representan exámenes que pueden utilizarse como fuente de preguntas.

Debe existir una tabla:

`examenes`

con:

- `id`: UUID, clave primaria.
- `nombre`: texto obligatorio.
- `fecha`: fecha opcional.
- `descripcion`: texto opcional.
- `url_examen`: texto opcional.
- `url_plantilla_respuestas`: texto opcional.
- `es_oficial`: booleano obligatorio, `true` por defecto.
- `created_at`: fecha y hora de creación.
- `updated_at`: fecha y hora de última modificación.

Un examen puede estar asociado a múltiples convocatorias.

Una convocatoria puede tener múltiples exámenes.

---

# 6. Relación convocatoria-examen

Debe existir una tabla:

`convocatoria_examen`

con:

- `convocatoria_id`: FK a `convocatorias`.
- `examen_id`: FK a `examenes`.
- `created_at`: fecha y hora de creación.

La combinación:

`convocatoria_id + examen_id`

debe ser única y constituir la clave primaria.

No se debe duplicar un examen para asociarlo a diferentes convocatorias.

---

# 7. Preguntas

Debe existir una tabla:

`preguntas`

con:

- `id`: UUID, clave primaria.
- `examen_id`: FK opcional a `examenes`.
- `numero`: entero positivo opcional.
- `enunciado`: texto obligatorio.
- `explicacion`: texto opcional.
- `estado`: texto obligatorio.
- `origen`: texto obligatorio.
- `situacion`: texto obligatorio.
- `fuente_url`: texto opcional.
- `created_at`: fecha y hora de creación.
- `updated_at`: fecha y hora de última modificación.

## Estado

Los valores permitidos son:

- `revision`
- `publicada`
- `desactivada`

El valor por defecto debe ser:

`revision`

Solo las preguntas con estado `publicada` podrán utilizarse posteriormente para generar nuevos tests.

## Origen

Los valores permitidos son:

- `oficial`
- `propia`

El valor por defecto será:

`propia`

El origen de una pregunta debe almacenarse explícitamente y no inferirse a partir de `examen_id`.

## Situación

Los valores permitidos son:

- `ordinaria`
- `reserva`
- `anulada`

El valor por defecto será:

`ordinaria`

`estado` y `situacion` representan conceptos independientes.

Por ejemplo, una pregunta oficialmente anulada puede continuar publicada en OposNavarra:

`estado = publicada`

`situacion = anulada`

## Relación con exámenes

Una pregunta puede pertenecer como máximo a un examen.

Una pregunta propia puede no pertenecer a ningún examen.

Cuando una pregunta pertenece a un examen, `numero` representa su número dentro de dicho examen.

La combinación:

`examen_id + numero`

debe ser única.

Cuando `numero` tenga valor debe ser mayor que cero.

---

# 8. Respuestas

Todas las preguntas de OposNavarra son preguntas tipo test de cuatro opciones.

Debe existir una tabla:

`respuestas`

con:

- `id`: UUID, clave primaria.
- `pregunta_id`: FK obligatoria a `preguntas`.
- `orden`: entero obligatorio.
- `texto`: texto obligatorio.
- `es_correcta`: booleano obligatorio, `false` por defecto.
- `created_at`: fecha y hora de creación.
- `updated_at`: fecha y hora de última modificación.

`orden` únicamente puede tener valores entre `1` y `4`.

No puede existir más de una respuesta con el mismo `orden` para una misma pregunta.

Una pregunta publicable debe tener:

- Exactamente cuatro respuestas.
- Los órdenes `1`, `2`, `3` y `4`.
- Exactamente una respuesta con `es_correcta = true`.

Una pregunta en estado `revision` puede existir temporalmente sin cumplir estas condiciones para permitir su creación y edición.

El sistema debe impedir que una pregunta pase a `publicada` mientras no cumpla las reglas anteriores.

---

# 9. Relación pregunta-tema

Debe existir una tabla:

`pregunta_tema`

con:

- `pregunta_id`: FK a `preguntas`.
- `tema_id`: FK a `temas`.
- `created_at`: fecha y hora de creación.

La combinación:

`pregunta_id + tema_id`

debe constituir la clave primaria.

Una pregunta puede pertenecer a múltiples temas.

Un tema puede contener múltiples preguntas.

---

# 10. Disponibilidad de preguntas

No debe existir una relación directa entre preguntas y convocatorias.

En particular, no debe crearse una tabla:

`convocatoria_pregunta`

La disponibilidad de una pregunta para una convocatoria se deriva del contenido asociado a la convocatoria.

Una pregunta está disponible para una convocatoria cuando se cumple al menos una de estas condiciones:

1. La pregunta pertenece a un tema asociado a la convocatoria.
2. La pregunta pertenece a un examen asociado a la convocatoria.

Si una pregunta pertenece simultáneamente a un tema y a un examen asociados a la misma convocatoria, debe considerarse una única pregunta.

Una pregunta asociada a un tema está automáticamente disponible para todas las convocatorias que contengan dicho tema.

Una pregunta asociada a un examen está automáticamente disponible para todas las convocatorias que contengan dicho examen.

Solo las preguntas con estado `publicada` serán elegibles posteriormente para la generación de tests.

---

# 11. Relaciones

El modelo debe representar conceptualmente:

```text
                       CONVOCATORIAS
                            │
              ┌─────────────┴──────────────┐
              │                            │
              ▼                            ▼
      convocatoria_tema            convocatoria_examen
              │                            │
              ▼                            ▼
            TEMAS                       EXAMENES
              │                            │
              │                            │
              ▼                            ▼
        pregunta_tema ───────────────► PREGUNTAS
                                           │
                                           ▼
                                      RESPUESTAS
```

El esquema inicial contiene exactamente estas ocho tablas de dominio:

1. `convocatorias`
2. `temas`
3. `convocatoria_tema`
4. `examenes`
5. `convocatoria_examen`
6. `preguntas`
7. `respuestas`
8. `pregunta_tema`

---

# 12. Integridad referencial

Todas las relaciones deben implementarse mediante claves foráneas.

Las tablas de relación deben impedir asociaciones duplicadas mediante claves primarias o restricciones `UNIQUE`.

Las eliminaciones deben configurarse de manera que no puedan dejar registros huérfanos.

Las decisiones concretas de `ON DELETE` deben favorecer la conservación del banco de preguntas y evitar eliminaciones accidentales de contenido reutilizable.

Las restricciones de integridad que puedan garantizarse razonablemente en PostgreSQL deben implementarse en la base de datos y no depender exclusivamente de la aplicación.

---

# 13. Identificadores

Las entidades principales deben utilizar UUID como identificador.

Los UUID deben generarse automáticamente por PostgreSQL.

Las tablas de relación utilizarán claves primarias compuestas cuando corresponda.

---

# 14. Fechas de auditoría

Las entidades modificables deben disponer de:

- `created_at`
- `updated_at`

`created_at` debe establecerse automáticamente al crear el registro.

`updated_at` debe actualizarse automáticamente cuando se modifica el registro.

La solución debe ser común y reutilizable para las tablas que necesiten este comportamiento.

---

# 15. Migraciones

El esquema de PostgreSQL debe gestionarse exclusivamente mediante migraciones versionadas almacenadas en el repositorio.

Debe existir una migración inicial que cree el esquema definido por esta spec.

Una migración que ya haya sido aplicada en un entorno compartido o producción no debe modificarse posteriormente.

Los cambios futuros de esquema deben realizarse mediante nuevas migraciones.

Las migraciones deben poder aplicarse de forma reproducible sobre una base de datos vacía.

La ejecución repetida del proceso de despliegue no debe volver a aplicar migraciones que ya hayan sido ejecutadas correctamente.

---

# 16. Supabase

PostgreSQL estará alojado en Supabase.

La implementación no debe depender de modificaciones manuales realizadas desde el dashboard de Supabase para crear o mantener el esquema.

El estado de la base de datos debe poder reconstruirse a partir de las migraciones almacenadas en el repositorio.

Esta spec no incluye:

- Supabase Auth.
- Usuarios.
- Row Level Security específica de usuarios.
- Supabase Storage.

Estas capacidades se introducirán cuando una spec posterior las necesite.

---

# 17. Fuera de alcance

Queda explícitamente fuera de esta spec:

- Usuarios.
- Autenticación.
- Autorización de usuarios.
- Suscripciones.
- Pagos.
- Acceso de usuarios a convocatorias.
- Generación de tests.
- Tests realizados.
- Respuestas de usuarios.
- Estadísticas.
- Progreso.
- Favoritos.
- Imágenes de preguntas.
- Grupos de preguntas.
- Preguntas relacionadas.
- Algoritmo de selección de preguntas.
- Panel de administración.

Estas funcionalidades deberán añadirse mediante specs y migraciones posteriores.

---

# 18. Criterios de aceptación

La spec se considera completada cuando:

1. Existe un sistema de migraciones versionadas en el repositorio.
2. Una base PostgreSQL vacía puede construirse exclusivamente ejecutando las migraciones.
3. Existen las ocho tablas definidas por esta spec.
4. Todas las claves primarias, claves foráneas, restricciones y relaciones definidas están implementadas.
5. Los UUID se generan automáticamente.
6. `created_at` y `updated_at` funcionan según lo especificado.
7. Un tema puede asociarse a múltiples convocatorias.
8. Un examen puede asociarse a múltiples convocatorias.
9. Una pregunta puede asociarse a múltiples temas.
10. Una pregunta puede asociarse como máximo a un examen.
11. No existe una relación directa `convocatoria_pregunta`.
12. No pueden duplicarse las relaciones convocatoria-tema, convocatoria-examen o pregunta-tema.
13. `numero` y `orden` se conservan como conceptos independientes en `convocatoria_tema`.
14. Una pregunta en revisión puede estar incompleta.
15. Una pregunta no puede publicarse si no tiene exactamente cuatro respuestas.
16. Una pregunta no puede publicarse si no tiene exactamente una respuesta correcta.
17. Los órdenes de las respuestas están restringidos a `1`, `2`, `3` y `4`.
18. Los estados, orígenes y situaciones de las preguntas están restringidos a los valores definidos.
19. Las preguntas disponibles para una convocatoria pueden obtenerse a través de sus temas y de sus exámenes sin producir duplicados.
20. El esquema puede desplegarse en PostgreSQL/Supabase sin realizar cambios manuales desde el dashboard.
21. Los tests automatizados del proyecto verifican las restricciones y relaciones críticas introducidas por esta spec.