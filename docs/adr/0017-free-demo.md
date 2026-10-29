# ADR 0017 — Demostración pública de cinco preguntas

Estado: aceptado para la implementación de la spec 017.

La demostración es una excepción limitada al requisito de autenticación de los tests ordinarios,
registrada en la constitución. No concede una suscripción ni utiliza las tablas o estadísticas
ordinarias de tests. Reutiliza `es_admin_actual()` / `exigir_rol_admin()` sin añadir roles.

Las versiones, instantáneas, intentos y límites viven en el esquema `private`, con RLS y sin
permisos de tabla para visitantes ni usuarios. El banco sigue bajo sus políticas existentes.
Solo RPC controladas exponen una pregunta pendiente o correcciones ya entregadas. El catálogo
público expone nombres y cantidades, nunca opciones o soluciones del banco completo.

El servidor Next.js valida las peticiones y utiliza la clave de servicio solo para iniciar y
responder, después de obtener una IP única de una cabecera sobrescrita por el proxy de confianza.
Los límites se serializan en PostgreSQL y se comparten entre instancias. Los umbrales iniciales
son diez inicios y cien respuestas aceptadas por hora/IP; se configuran en `private.demo_settings`.
Los reintentos idénticos recuperan el mismo estado sin crear respuestas adicionales.

El navegador genera una credencial aleatoria de 256 bits antes del primer envío. Solo se guarda
su SHA-256 en la base de datos. La credencial se mantiene en memoria, sessionStorage y el fragmento
del enlace de continuidad; no se guardan respuestas ni datos personales en el navegador.
Esta persistencia mínima permite reintentos, recargas y transferencia entre dispositivos durante
24 horas. Si sessionStorage falla, siguen funcionando la pestaña y el enlace. No usar el ID del
intento como autorización. Una reclamación exige JWT y bloquea la fila; repetirla con el mismo
usuario es idempotente y otro usuario no puede apropiársela. Tras reclamar, la credencial deja
de funcionar sin la sesión del propietario.

Cada versión conserva una instantánea privada independiente de futuras ediciones o borrados del
banco. Un conjunto que deja de ser válido no permite nuevos inicios. Los intentos existentes
conservan el contenido hasta caducar, salvo invalidación explícita con aviso. Cambiar y publicar
la selección crea una versión nueva. La vista previa se compara al publicar para impedir publicar
contenido diferente del revisado. Por indicación del usuario, la migración selecciona inicialmente
cinco preguntas al azar con solución única y explicación, si existen; esa selección queda fija.
No se certifica una revisión editorial humana de esa selección automática.

`pg_cron`, ya utilizado en el proyecto, elimina cada minuto los intentos no reclamados caducados
y los contadores de frecuencia vencidos. Los intentos reclamados se conservan con la cuenta y
se eliminan en cascada al borrar su usuario. La credencial deja de autorizar exactamente a las
24 horas, incluso antes de la siguiente ejecución de limpieza.

No hay proveedor de analítica ni preferencias de consentimiento configurados. Se ofrece un
adaptador estricto que no envía eventos hasta conectar ambos. Las finalizaciones y guardados
tienen identificadores de evento generados una sola vez por el servidor para deduplicación;
no son credenciales del intento. No se añaden dependencias, SDK, cookies ni servicios externos.
La medición efectiva del embudo sigue siendo una dependencia de publicación.
