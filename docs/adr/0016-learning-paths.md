# ADR 0016 — Mi camino sobre el motor de tests existente

Estado: aceptado para la implementación de la spec 016.

`/mi-camino` utiliza las tablas `test_intentos`, `test_intento_temas` y
`test_intento_preguntas` del motor existente. Añade origen, referencias al camino y al reto,
versión de guardado y configuración de evaluación fijada al comenzar. No crea otro historial.
Los resultados de camino aparecen identificados en el historial existente y abren su revisión
especializada; los tests libres siguen usando sus operaciones y reglas anteriores.

Los estados adicionales abandonado e invalidado se admiten exclusivamente para intentos de
camino. Un índice parcial impide dos intentos en curso del mismo usuario y camino. Inicio,
guardado y cierre se ejecutan mediante RPC con identidad derivada de `auth.uid()`, comprobación
de acceso existente, correo confirmado y bloqueos transaccionales. La caducidad del acceso no
cierra ni suspende intentos. Sin acceso se mantienen el mapa y la revisión de resultados propios.

La creación serializa por usuario y camino. El guardado exige la versión confirmada del intento;
un conflicto devuelve el estado actual sin sobrescribirlo. El cliente conserva el cambio pendiente
en memoria y pide revisión antes de reenviarlo. No se ofrece modo offline ni se guardan respuestas
en almacenamiento persistente del navegador. Salir conserva las respuestas confirmadas; abandonar
es explícito y no concede recompensa. La finalización reutiliza la corrección del motor con
penalización cero, fija el resultado y el instante real del servidor y actualiza progreso, primera
superación, XP y actividad en la misma transacción. Los reintentos de cierre devuelven el resultado
existente. Las restricciones únicas impiden duplicar XP y actividad diaria.

Las reglas y la secuencia se obtienen de los bloques y temas reales. No hay dependencias editables:
el orden lineal define los prerrequisitos y evita ciclos. La publicación valida cuatro retos por
tema, un repaso por bloque, correspondencia con el catálogo y preguntas distintas suficientes.
El emparejamiento de cobertura reserva una pregunta diferente por tema, incluso si las preguntas
pertenecen a varios temas; el resto se reparte equilibradamente y se redistribuye al agotarse un
tema. Los reintentos priorizan preguntas menos recientes. No se implementa una cuota adicional de
falladas, que la spec permite como opción, ni se promete que todo el cuestionario sea diferente.

Un borrador sin intentos se puede regenerar explícitamente. Tras publicar, solo se corrige el título
o se archiva; no se crean versiones ni se migra progreso. Los cambios posteriores del orden en el
catálogo no reordenan las paradas. Los borradores archivados que nunca fueron publicados siguen
sin ser visibles para el opositor. Archivar un camino publicado conserva logros y permite abandonar
intentos pendientes, pero no practicarlos.

No se copian enunciados ni opciones. Cada pregunta asignada guarda una huella del contenido y
referencias a todas las opciones utilizadas. Un cambio relevante o pérdida de elegibilidad invalida
un intento en curso sin suspenso, XP ni actividad. Una revisión cerrada muestra el contenido actual,
avisa si cambió y conserva el resultado original. Las claves foráneas preservan preguntas con
historial y un trigger impide borrar sus opciones referenciadas. Para archivar una pregunta se
utiliza su estado desactivada, conservando las opciones; no se altera silenciosamente el contenido
histórico para simular que fue eliminado.

Las tablas de progreso, XP y actividad tienen RLS de propietario y permisos solo de lectura.
Las tablas de configuración se consultan a través de RPC; los borradores y escrituras están
reservados al mecanismo administrativo existente. Las antiguas entradas de guardado y cierre
rechazan intentos de camino para evitar saltarse el control de versión y los efectos de finalización.
No se añaden roles, claves privilegiadas, servicios externos ni dependencias.

La actividad usa la fecha de finalización en `Europe/Madrid`. La racha es común a todos los caminos;
si hoy no se ha practicado se conserva la de ayer, y tras un día completo sin actividad se muestra
cero. La mejor racha se deriva del historial diario. XP y porcentajes del camino se agregan desde
sus registros de superación y movimientos; no son contadores independientes editables.

Verificación pendiente de infraestructura: aplicar la migración y ejecutar las pruebas pgTAP en
Supabase operativo, incluyendo concurrencia real entre sesiones. En este entorno la CLI no puede
interpretar un nombre de variable de `.env.local` y no hay navegador automatizado disponible.
