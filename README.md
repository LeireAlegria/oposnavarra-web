# OposNavarra

Aplicación de práctica de tests para oposiciones de Navarra. Este repositorio contiene la aplicación Next.js y la configuración de Supabase.

## Requisitos

- Node.js 20.9 o superior
- npm

## Instalación

```bash
npm install
```

En PowerShell, copia el ejemplo como archivo local:

```powershell
Copy-Item .env.example .env.local
```

Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para tu proyecto local. No pongas claves privadas ni `service_role` en variables `NEXT_PUBLIC_*`.

## Desarrollo

```bash
npm run dev
```

Abre la URL que indique Next.js, normalmente `http://localhost:3000`.

## Verificaciones

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run format` formatea los archivos fuente y configuración compatibles.

## Supabase

La configuración local está en `supabase/config.toml` y el esquema se mantiene mediante migraciones en `supabase/migrations/`.

Docker solo es necesario para levantar el stack local completo de Supabase:

```bash
npm run db:start
npm run db:reset
npm run db:test
```

También puedes trabajar sin Docker contra un proyecto Supabase dedicado para pruebas. Autentícate con `npx supabase login`, vincúlalo con `npx supabase link --project-ref <project-ref>`, aplica las migraciones con `npm run db:push` y ejecuta `npx supabase test db --linked`. No ejecutes estos tests contra producción.

Para un PostgreSQL externo, define `SUPABASE_DB_URL` como una URL de conexión y pásala a la CLI. En PowerShell:

```powershell
$env:SUPABASE_DB_URL = "postgresql://usuario:contraseña@host:5432/postgres?sslmode=require"
npm run db:test -- --db-url "$env:SUPABASE_DB_URL"
```

La URL contiene una contraseña: no la guardes en Git ni en `.env.example`. En CI, la autenticación remota puede usar `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` como secretos. Para el uso interactivo, la CLI puede solicitar autenticación y contraseña; no hacen falta variables de entorno de base de datos.

La aplicación web usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example`. Son valores públicos para el cliente web y no son necesarios para aplicar migraciones o probar la base de datos.

## Contacto (spec 015)

Aplicar la migración `20261029000000_contact_messages.sql` antes de activar el formulario.
Configurar `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en el servidor y `CONTACT_IP_HEADER`
con el nombre de una cabecera que el proxy de entrada **sobrescriba siempre** con una única
IP del cliente (IPv4 o IPv6). No usar una cabecera que el visitante pueda controlar ni una
lista `X-Forwarded-For` sin normalizar. El origen debe aceptar tráfico únicamente desde
ese proxy. Sin una IP válida, el formulario falla de forma cerrada (503).

El límite compartido permite cinco guardados en quince minutos y se serializa por IP en
PostgreSQL. Se guardan huellas SHA-256, nunca IP en claro; las huellas caducadas se eliminan
en el siguiente envío. La transacción guarda conjuntamente el mensaje y el consumo del límite.
En `npm run dev` sobre localhost no es necesaria `CONTACT_IP_HEADER`: se utiliza un único
cupo compartido de desarrollo. La clave `SUPABASE_SERVICE_ROLE_KEY` y la migración siguen
siendo necesarias. En producción se exige la cabecera del proxy de confianza.
No se envían correos. Retirar `CONTACT_EMAIL_TO` y `RESEND_API_KEY` del despliegue.
El panel utiliza `es_admin_actual()` existente mediante RLS y solo permite actualizar `leido`.

## Landing y prueba gratuita (spec 017)

Aplicar `supabase/migrations/20261030000000_free_demo.sql` después de las migraciones existentes.
La migración selecciona una vez cinco preguntas al azar de una convocatoria activa, entre las
publicadas con cuatro opciones, una solución y explicación. Si no existen cinco válidas, la
prueba muestra indisponibilidad. No añade contenido ficticio al banco.

- Público: `/prueba-gratis`. Resultados guardados: `/prueba-gratis/resultados`.
- Administración: `/admin/prueba-gratis`, con búsqueda, orden, selección aleatoria, vista previa,
  confirmación de revisión, publicación versionada e invalidación.
- Configurar `SUPABASE_SERVICE_ROLE_KEY` solo en el servidor y `DEMO_IP_HEADER` (o
  `CONTACT_IP_HEADER`) con una única IP sobrescrita por el proxy. Bloquear acceso directo al
  origen. Sin IP válida, los inicios y respuestas fallan de forma cerrada.
- Límites compartidos configurables en `private.demo_settings`: diez inicios y cien respuestas
  aceptadas por IP/hora. Los reintentos idénticos no duplican puntuación ni registros.
- Supervisar el trabajo `oposnavarra-demo-cleanup` de pg_cron. La caducidad se comprueba también
  en cada operación; no depende del minuto de limpieza.

La confirmación usa el flujo de autenticación existente y conserva `next`. El callback acepta
PKCE y `token_hash` de tipo `email`. Para confirmar y establecer sesión directamente desde otro
dispositivo, configurar en Supabase una plantilla de confirmación basada en `TokenHash`:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirmar correo</a>
```

El `RedirectTo` construido por la aplicación ya contiene `?next=...`. Autorizar las URLs de
callback del despliegue en Supabase. Con la plantilla PKCE habitual, si falta el verificador
en el segundo dispositivo, se conserva el resultado y se ofrece iniciar sesión en la cuenta
confirmada. Un callback repetido conserva el destino de retorno.

Aplicar `Referrer-Policy: no-referrer` también en cualquier proxy/CDN. Desactivar captura de
URLs completas en analítica, registros y trazas de rutas de autenticación: `next` puede contener
la credencial de continuidad codificada. No registrar cuerpos de `/api/demo`, ni cabeceras de
sesión. La credencial es un secreto de acceso al resultado hasta su reclamación o caducidad.

La instrumentación en `src/lib/demo-analytics.ts` permanece inactiva. Conectar un proveedor
existente mediante `configureDemoAnalytics(sink, hasConsent)` desde la inicialización cliente,
respetando el consentimiento en cada evento y desactivando cualquier captura automática de URLs.
El adaptador rechaza atributos no incluidos en su contrato; no acepta correos, respuestas ni tokens.
Deduplicar `demo_completed` y `result_saved` por nombre e identificador de evento del servidor.
Falta configurar esa integración y la atribución de registros, uso a siete días y suscripciones;
no se dispone aún de una línea base de conversión. No interpretar los hooks preparados como
medición activa.

Verificación adicional necesaria antes de publicar: ejecutar `npm run db:test` en un entorno
Supabase local operativo con todas las migraciones; revisar el contenido elegido automáticamente;
confirmar correo en otro dispositivo; validar aislamiento de cuentas, caducidad, límites, errores
de red y vista de 360 px/tableta/escritorio con teclado. El entorno actual no dispone de navegador
automatizado ni una base de datos local utilizable. La CLI encuentra además un nombre de variable
con caracteres no admitidos en `.env.local`; este archivo no se ha modificado.

## Mi camino (spec 016)

Aplicar `supabase/migrations/20261031000000_learning_paths.sql` después de las migraciones
anteriores. No se publica ningún camino automáticamente. En `/admin/caminos`, seleccionar una
convocatoria, generar el borrador, revisar sus cuatro retos por tema y repasos de bloque,
ajustar las cantidades y condiciones y pulsar «Validar y publicar». La falta de contenido impide
publicar; no se reduce la cantidad de preguntas de forma silenciosa.

El apartado `/mi-camino` está disponible en la navegación de la plataforma. Reutiliza el motor y
el historial de tests con origen `camino`. El acceso para practicar usa la misma operación de
suscripción que los tests ordinarios (incluida la excepción administrativa existente). El mapa,
XP, racha y resultados propios permanecen consultables sin suscripción. No cambia precios ni
activa permisos de pago. Los tests libres y las pruebas gratuitas no conceden XP ni desbloqueos.

La estructura y reglas publicadas quedan congeladas. Solo se permite corregir el título y archivar.
No hay reinicio de progreso ni sustitución de un recorrido publicado. Un borrador sin intentos se
puede regenerar, con confirmación explícita. Los intentos archivados pendientes se pueden abandonar.
Los cambios de preguntas durante un intento lo invalidan sin penalización; las revisiones cerradas
usan el contenido actual y muestran aviso si cambió. Para retirar preguntas con historial, cambiar
su estado a desactivada y conservar sus opciones: no borrarlas físicamente.

Verificación preparada en `supabase/tests/database/learning-path.test.sql`: dos bloques y tres
temas, mínimos de superación, repasos, XP y cierre idempotentes, conflicto de versiones, aislamiento
de cuentas, caducidad de acceso, archivado, cambios de contenido, rachas en Madrid y horario de
verano/invierno, dos convocatorias y convivencia con tests libres. Las pruebas React cubren mapa,
estados bloqueados, recuperación, respuesta pendiente, conflicto, confirmación con blancos y XP
confirmada por el servidor. El componente de opciones se comparte con la plataforma de tests.

Pendiente antes de publicar: ejecutar esa suite SQL sobre todas las migraciones en Supabase local,
probar dos sesiones concurrentes y revisar manualmente móvil, tableta, escritorio y teclado con
contenido real. La CLI local sigue bloqueada por un nombre de variable no admitido en `.env.local`,
que no se ha modificado. El navegador automatizado no ofrece sesiones disponibles en este entorno.
