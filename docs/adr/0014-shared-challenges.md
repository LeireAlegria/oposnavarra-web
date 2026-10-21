# 014 — Retos sobre el motor de tests

## Decisión

Los retos reutilizan los intentos, respuestas, RPC y fórmula del motor existente. No se crea un segundo sistema de corrección. Las nuevas tablas almacenan la configuración compartida, selección ordenada y plazas. Los intentos incorporan la referencia al reto, motivo de entrega, resultado calculado y corrección histórica.

Las RPC públicas del motor mantienen sus firmas. Sus implementaciones originales pasan a funciones privadas sin permiso de ejecución para clientes; envoltorios coordinan el bloqueo del reto antes del intento y aplican la frontera de publicación. La migración adapta expresamente el requisito de suscripción para que un intento de reto ya iniciado pueda continuar tras caducar el acceso. Los tests ordinarios mantienen su comportamiento.

## Consistencia y privacidad

- Crear el reto, sus preguntas y la plaza del creador es una transacción.
- Incorporación, inicio, guardado, entrega y cierre adquieren el bloqueo del reto antes de tocar su intento. La última plaza y el intento único quedan además protegidos mediante restricciones de unicidad.
- Las tablas nuevas no tienen permisos directos de cliente y tienen RLS activa. El enlace solo permite consultar el resumen por token o solicitar una plaza.
- Antes del cierre, el resumen del motor elimina el resultado, la consulta de un intento entregado devuelve preguntas vacías y el historial muestra espera sin nota cero. El creador tampoco recibe recuentos de pendientes ni clasificación.
- Al cerrar se entrega cualquier intento activo y se conserva la corrección individual, en la misma transacción que publica la clasificación. Las modificaciones posteriores del banco no alteran los resultados ni la revisión histórica.
- Mientras exista un reto abierto, los triggers bloquean cambios del enunciado y de las opciones/solución. Las referencias impiden eliminar físicamente preguntas históricas. Se puede desactivar una pregunta para excluirla de nuevos tests.
- Los alias se eligen explícitamente y no se derivan del correo. La clasificación solo expone alias y estadísticas agregadas; la corrección pertenece a su propietario.

## Reloj y tareas

`clock_timestamp()` es la autoridad tras obtener los bloqueos. La entrega usa la menor fecha entre vencimiento individual, cierre y hora actual. Una tarea `pg_cron` cada minuto resuelve intentos vencidos aunque el navegador no esté abierto. Las operaciones también resuelven vencimientos de forma inmediata antes de responder. Se necesita habilitar `pg_cron` al aplicar la migración; no hay servicio externo ni claves nuevas.

## Verificación y límites del entorno

`scripts/verify-challenges.mjs` ejecuta migraciones y casos funcionales en PostgreSQL embebido (PGlite instalado en una carpeta temporal). Sustituye únicamente autenticación/suscripción, aleatoriedad de pgcrypto y el adaptador del planificador. Verifica selección compartida, ocultación de soluciones, intento único, aforo, permisos por propietario, cierre, corrección histórica, vencimiento y regresión del test ordinario. Esta prueba no certifica el planificador ni concurrencia entre conexiones PostgreSQL.

Para ejecutar las carreras reales se incluye `scripts/verify-challenge-concurrency.mjs`, destinado a un proyecto Supabase de pruebas con tres cuentas elegibles. Requiere `RETO_TEST_ACCESS_TOKENS` con tres tokens de acceso, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Ejecutar con `node --env-file=.env.local scripts/verify-challenge-concurrency.mjs`. No utilizar cuentas de producción: crea retos de integración que cierra al terminar y conserva como histórico. Comprueba última plaza simultánea, inicio doble, cierre concurrente con guardado/entrega y cierre concurrente con incorporación.

En el entorno de desarrollo actual `supabase test db` está bloqueado por el análisis de `.env.local` y no hay navegadores conectados para revisar visualmente móvil/escritorio. Antes de desplegar, aplicar la migración en pruebas, comprobar el trabajo `oposnavarra-retos-vencidos` en Supabase Cron y ejecutar el recorrido de creador y dos invitados, incluyendo una sesión sin suscripción tras empezar.
