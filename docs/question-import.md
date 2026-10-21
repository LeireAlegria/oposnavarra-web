# Importación de preguntas (spec 013)

Desde **Administración → Preguntas → Importar preguntas**, descarga la plantilla, selecciona procedencia y examen si corresponde, y sube un archivo `.xlsx` de hasta 5 MiB y 1.000 filas. La hoja `Preguntas` debe conservar todos los encabezados; las demás hojas no se importan. La plantilla contiene instrucciones y no incluye preguntas de ejemplo que se puedan importar accidentalmente.

La revisión conserva las filas originales, permite filtrar incidencias, excluir filas y resolver temas individualmente o para todas las filas con el mismo nombre normalizado. Incluso una coincidencia única requiere aceptar el tema. Los duplicados se comparan por enunciado y opciones normalizados y requieren confirmación expresa o exclusión. El contenido solo se corrige en Excel: una nueva subida invalida la revisión anterior.

## Instalación y modelo

Aplicar `supabase/migrations/20261021000000_bulk_question_import.sql` después de las migraciones existentes. No necesita claves privilegiadas ni nuevas variables de entorno. Se utiliza la sesión administrativa y las políticas existentes.

- `preguntas.examen_id` y `numero` representan la numeración de esa pregunta dentro del examen existente. No se crean copias por convocatoria.
- Se reutiliza `preguntas.origen`: `examen_oficial` se guarda como `oficial` y `generada_documentacion` como `propia`. La información visible de procedencia mantiene la convención del banco.
- Se reutiliza `explicacion` y se añade `referencia_fuente` nullable para referencias documentales, URL o versiones. `fuente_url` conserva su uso previo como enlace.
- Todas las preguntas se crean con `estado = revision` y `situacion = ordinaria`, cuatro respuestas y exactamente una correcta.
- `pregunta_tema` mantiene su cardinalidad actual. Esta plantilla permite elegir un tema por fila o dejarla sin tema explícitamente.

## Consistencia

`revisar_importacion_preguntas_admin` solo consulta el catálogo. `confirmar_importacion_preguntas_admin` valida y escribe el lote completo en una transacción. Ambas exigen administración también ante llamadas directas.

El endpoint vuelve a leer el archivo al confirmar; no acepta enunciados ni opciones enviados como JSON por el navegador. Comprueba límites del archivo y del contenido descomprimido antes de interpretar XML, rechaza fórmulas, objetos y protección, y no ejecuta HTML ni fórmulas.

La RPC vuelve a comprobar referencias, números, resoluciones de temas y duplicados. Compara el contenido del tema y las versiones de las preguntas candidatas con lo revisado; los cambios requieren nueva revisión. La unicidad de `(examen_id, numero)` sigue siendo la última frontera de integridad.

El registro técnico `importaciones_preguntas_operaciones` está protegido mediante RLS y sin permisos directos para clientes. Su clave primaria es `(administrador_id, clave)`. Guarda el hash del contenido y el resultado atómicamente: una repetición idéntica recupera el resultado; otra carga con la misma clave se rechaza. Los bloqueos transaccionales serializan las confirmaciones concurrentes. No se conserva el Excel ni se añade un histórico administrativo.

ExcelJS 4.4.0 se ejecuta en el servidor para generar y leer `.xlsx`; no se añade su peso al navegador. Su dependencia `uuid` se fija mediante override en 11.1.1 para evitar la vulnerabilidad de versiones anteriores. La implementación no añade servicios externos.

## Verificaciones

Los tests de Vitest cubren plantilla, encabezados, hojas, fórmulas, protección, límites, contenido, exclusiones, autorización del endpoint, revisión y recuperación tras pérdida de conexión. `supabase/tests/database/bulk-question-import.test.sql` cubre permisos, resultados, conservación de metadatos, numeración, idempotencia, cambios del catálogo y rollback por fallo durante la escritura.

Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y, con Supabase local disponible, `npm run db:test`. Antes de desplegar, aplicar la migración y verificar una importación real desde una sesión administradora en escritorio y móvil. Las pruebas SQL necesitan que Supabase CLI pueda interpretar las variables locales y acceder a PostgreSQL; no se deben sustituir por una afirmación de validación de infraestructura.
