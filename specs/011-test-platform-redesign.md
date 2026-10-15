# 011 — Rediseño de la plataforma de tests

**Archivo:** `specs/011-test-platform-redesign.md`  
**Proyecto:** OposNavarra  
**Tipo:** Mejora de interfaz y experiencia de usuario  
**Dependencias:** specs 002, 003, 006 y 007
**Referencia visual:** imagen de la plataforma de tests facilitada para esta especificación.

## 1. Objetivo

Rediseñar la interfaz de la plataforma en la que los usuarios realizan tests para ofrecer una experiencia de estudio moderna, intuitiva, accesible y coherente con el nuevo panel administrativo (spec 010).

La pantalla de realización de tests se inspirará en la referencia visual: cabecera superior, navegación lateral izquierda, tarjeta central con pregunta y respuestas, y panel derecho con temporizador, progreso y navegación entre preguntas.

Esta spec **mejora la presentación y la usabilidad** de la aplicación de tests definida en la spec 007. No sustituye sus reglas de negocio ni requiere rediseñar el modelo de datos.

## 2. Principios y restricciones

- Mantener React y la integración con Supabase existentes, respetando la estructura y convenciones del proyecto.
- Usar **Convocatoria** como entidad principal; no crear ni utilizar una capa de «Oposición».
- Mantener las relaciones actuales entre convocatorias, temas, exámenes y preguntas.
- No introducir nuevas tablas ni migraciones por motivos exclusivamente visuales.
- Preservar las comprobaciones de autenticación, suscripción activa, autorización y RLS.
- No mostrar si una respuesta es correcta o incorrecta durante el test; la corrección se presenta al finalizar.
- No incorporar en esta spec «Repasar errores» ni «Preguntas guardadas» si no están ya implementadas.
- Mostrar datos reales; no utilizar estadísticas o contenido ficticio en producción.

## 3. Diseño visual

### 3.1. Estilo

- Fondo general blanco roto o beige claro.
- Superficies blancas, bordes finos gris cálido y esquinas suavemente redondeadas.
- Rojo oscuro como acento en selección, navegación activa, botones principales y progreso.
- Títulos de estilo editorial y texto de lectura claramente legible.
- Espaciado generoso, iconos consistentes y estados interactivos visibles.
- Coherencia con los componentes y tokens visuales introducidos en la spec 013, sin acoplar la navegación del alumno a la administración.

### 3.2. Layout

**Cabecera superior:** marca OposNavarra, identificación del espacio de estudio, acceso a ayuda si ya existe y menú del usuario con cierre de sesión.

**Barra lateral izquierda:** bloque de convocatoria actual, acceso para cambiar de convocatoria cuando el flujo existente lo permita y navegación a las secciones implementadas:

- Mi cuaderno / inicio de la plataforma.
- Mis tests / configurar nuevo test.
- Historial de tests realizados.
- Mi progreso, únicamente si puede obtenerse de los datos existentes y está contemplado por la aplicación; en caso contrario, no mostrar un enlace inoperativo.

**Zona principal:** encabezado contextual, título, descripción y contenido de la página.

**Panel derecho durante el test:** temporizador, progreso y cuadrícula de navegación entre preguntas.

En escritorio se mostrarán las tres columnas. En tablet y móvil, la navegación y el panel de progreso deberán adaptarse sin restar espacio a la pregunta.

## 4. Pantalla de configuración de test

Rediseñar la pantalla previa a la realización conservando el comportamiento de la spec 007:

- Selección de convocatoria según el flujo existente.
- Selección de uno o varios temas; por defecto, todos los temas disponibles seleccionados.
- Selección del número de preguntas.
- Configuración del tiempo, incluida la modalidad sin límite si está soportada.
- Resumen de la configuración y botón claro para iniciar el test.
- Validaciones de disponibilidad de preguntas y de suscripción activa.

No modificar el algoritmo de selección de preguntas ni las reglas de creación de intentos.

## 5. Pantalla de realización de test

### 5.1. Encabezado

Mostrar título contextual (tema o test), temas seleccionados cuando corresponda, número total de preguntas y modalidad de tiempo. No asumir que todas las preguntas pertenecen a un único tema.

### 5.2. Tarjeta de pregunta

Cada pregunta se mostrará en una tarjeta con:

- Número actual y total de preguntas (por ejemplo, «Pregunta 08 / 20»).
- Enunciado completo.
- Opciones de respuesta claramente separadas, con identificadores A, B, C, etc. según las opciones reales.
- Selección única conforme al modelo de preguntas existente.
- Resaltado de la opción seleccionada, sin revelar la corrección antes de finalizar.
- Estados de foco, selección y deshabilitado accesibles.

No incluir imágenes ni grupos de preguntas en esta iteración.

### 5.3. Navegación

- Botones «Anterior» y «Siguiente».
- Navegación directa a cualquier pregunta desde la cuadrícula del panel de progreso.
- Posibilidad de dejar preguntas sin responder y cambiar respuestas antes de finalizar.
- Identificación visual de pregunta actual, respondida y pendiente.
- Botón de finalizar test con confirmación, especialmente si quedan preguntas sin responder.

La respuesta seleccionada debe conservarse al cambiar de pregunta. Reutilizar el mecanismo de estado y persistencia definido en la spec 007, evitando pérdida de respuestas por simples cambios de vista.

### 5.4. Temporizador

- Mostrar **tiempo restante** en tests con límite y **tiempo transcurrido** en tests sin límite.
- Mantener el comportamiento de pausa, agotamiento del tiempo y finalización que ya establezca la spec 007; no introducir una pausa nueva solo por aparecer en la imagen de referencia.
- Evitar reinicios accidentales del contador al navegar entre preguntas.
- Mostrar un estado claro cuando el tiempo se agote.

### 5.5. Progreso

Mostrar el porcentaje de preguntas respondidas, el número respondido y el número pendiente. El porcentaje de progreso se calcula sobre respuestas registradas, no sobre preguntas visitadas.

### 5.6. Navegador de preguntas

Cuadrícula numerada con estados distinguibles para:

- Pregunta actual.
- Pregunta respondida.
- Pregunta pendiente.

Los estados no dependerán exclusivamente del color. El panel se actualizará al seleccionar o modificar respuestas.

## 6. Resultados

Rediseñar la pantalla de resultados, manteniendo el cálculo y la persistencia de la spec 007.

Mostrar, según los datos y reglas existentes:

- Número total de preguntas.
- Respuestas correctas, incorrectas y sin responder.
- Porcentaje de aciertos y puntuación si corresponde.
- Tiempo empleado.
- Revisión por pregunta, con respuesta del usuario y respuesta correcta.

No modificar el sistema de corrección ni almacenar copias de los enunciados.

## 7. Historial

Rediseñar el historial sencillo definido en la spec 007. Mostrar fecha, configuración, número de preguntas, resultado y enlace al detalle cuando esos datos estén disponibles.

Las consultas deben recuperar únicamente los intentos del usuario autorizado y respetar las políticas RLS existentes. No crear nuevos registros históricos ni nuevas métricas para justificar el diseño.

## 8. Componentes reutilizables

Crear o adaptar, según la arquitectura existente:

- `StudentLayout`
- `StudentHeader`
- `StudentSidebar`
- `TestConfigurationForm`
- `TestQuestionCard`
- `TestAnswerOption`
- `TestTimer`
- `TestProgressCard`
- `TestQuestionNavigator`
- `TestResultsSummary`
- `TestHistoryTable`

Los nombres son orientativos. Priorizar reutilización de componentes existentes, separación entre presentación y lógica, y una única fuente de verdad para respuestas y progreso.

## 9. Responsive y accesibilidad

- **Escritorio:** sidebar, contenido central y panel derecho visibles.
- **Tablet:** sidebar compactable y panel de progreso reubicable.
- **Móvil:** pregunta como contenido principal, navegación lateral desplegable y acceso claro al temporizador y al navegador de preguntas.
- Controles táctiles suficientemente grandes, navegación por teclado y foco visible.
- Etiquetas accesibles para respuestas y navegación numerada.
- Contraste adecuado y estados que no dependan únicamente del color.
- Evitar desplazamiento horizontal de la página y pérdida de contexto al abrir paneles.

## 10. Integración, seguridad y datos

- Reutilizar los servicios, hooks, rutas y consultas existentes de React/Supabase.
- Mantener el acceso a realización de tests condicionado a autenticación y suscripción activa.
- Mantener la autorización del servidor y RLS; no confiar únicamente en controles visuales.
- No crear tablas nuevas, no alterar `perfiles.rol` y no modificar Stripe.
- No introducir la entidad «Oposición»: mostrar siempre «Convocatoria» cuando se haga referencia a la entidad del catálogo.

## 11. Fuera de alcance

- Repaso de errores como funcionalidad nueva.
- Guardado o marcado persistente de preguntas como funcionalidad nueva.
- Nuevos tipos de test o algoritmos de selección.
- Cambios en puntuación y corrección.
- Cambios en planes, pagos y suscripciones.
- Cambios en el panel administrativo o la web comercial.
- Nuevas tablas, migraciones o entidades de dominio.

## 12. Criterios de aceptación

1. La interfaz se aproxima visualmente a la referencia facilitada.
2. Se conserva la navegación y configuración de tests de la spec 007.
3. Las preguntas y respuestas usan el nuevo diseño sin mostrar corrección anticipada.
4. El usuario puede navegar entre preguntas, cambiar respuestas y dejar preguntas pendientes.
5. El panel de progreso y la cuadrícula reflejan fielmente el estado del test.
6. El temporizador respeta el modo configurado y las reglas existentes.
7. La finalización y los resultados funcionan sin cambios en el cálculo.
8. El historial existente continúa accesible y muestra datos reales del usuario.
9. La interfaz es usable en escritorio, tablet y móvil y es accesible mediante teclado.
10. Se mantienen las restricciones de suscripción, autorización y RLS.
11. No se introduce la capa «Oposición», ni nuevas tablas, ni funciones fuera de alcance.
12. No hay regresiones respecto a la spec 007.

## 13. Plan de implementación

**Fase 1 — Layout y navegación:** crear cabecera, sidebar y estilos generales.

**Fase 2 — Realización de test:** rediseñar tarjeta de pregunta, respuestas, controles de navegación, temporizador y panel de progreso.

**Fase 3 — Configuración y resultados:** aplicar los componentes visuales a los flujos existentes.

**Fase 4 — Historial y pantallas complementarias:** unificar estilos y navegación.

**Fase 5 — Validación:** probar responsive, accesibilidad, estado de respuestas, temporizador, resultados, historial y restricciones de acceso.

## 14. Resultado esperado

La plataforma de tests de OposNavarra ofrecerá una experiencia visual unificada, clara y centrada en el estudio, sin alterar las reglas de negocio ni la estructura de datos existentes. El diseño permitirá al usuario concentrarse en las preguntas, orientarse durante el test y consultar sus resultados con facilidad.
