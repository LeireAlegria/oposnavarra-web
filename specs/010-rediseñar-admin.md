# 010 — Rediseño del panel de administración

**Archivo:** `specs/010-admin-interface-redesign.md`

## 1. Objetivo

Rediseñar la interfaz del panel de administración de OposNavarra, tomando como referencia visual el diseño proporcionado.

El objetivo es conseguir una interfaz moderna, profesional, intuitiva y consistente, orientada a facilitar la gestión diaria de los contenidos y usuarios de la plataforma.

Esta especificación amplía y mejora visualmente la spec `008-panel-administrativo`, sin sustituir sus funcionalidades ni modificar la lógica de negocio existente.

## 2. Alcance

La implementación incluirá:

- Nuevo layout administrativo.
- Barra superior con identidad de marca y menú de usuario.
- Menú lateral de navegación.
- Pantalla de vista general con estadísticas.
- Rediseño de las pantallas de gestión existentes.
- Componentes reutilizables para tablas, filtros, formularios y acciones.
- Adaptación responsive.
- Estados visuales de carga, error y ausencia de datos.

No se modificarán las páginas comerciales ni la aplicación de realización de tests.

## 3. Diseño visual

### 3.1. Estilo general

La interfaz seguirá una estética editorial, minimalista y profesional.

Características principales:

- Fondo general blanco roto o beige muy claro.
- Tarjetas y contenedores blancos.
- Bordes finos en tonos grises cálidos.
- Rojo oscuro como color principal de acento.
- Tipografía elegante para los títulos y legible para el contenido.
- Espaciado amplio entre elementos.
- Iconografía sencilla y consistente.
- Botones con bordes ligeramente redondeados.
- Estados activos claramente diferenciados.

Se utilizarán las fuentes, librerías de iconos y componentes disponibles en el proyecto siempre que permitan reproducir el diseño.

### 3.2. Estructura principal

El panel estará organizado en tres zonas:

**Barra superior**

Contendrá:

- Logotipo y nombre OposNavarra.
- Indicador de sección administrativa.
- Enlace «Ver plataforma».
- Avatar o iniciales del usuario.
- Nombre del administrador.
- Menú desplegable con opciones de cuenta y cierre de sesión.

No se mostrará un indicador de «Entorno de demostración» en producción.

**Menú lateral**

La navegación se organizará en los siguientes grupos:

Vista general:
- Vista general.

Contenido:
- Convocatorias.
- Temas.
- Exámenes.
- Banco de preguntas.

Comunidad y ventas:
- Usuarios.
- Suscripciones.
- Planes.

No existirá una entidad ni una sección denominada «Oposiciones».

El menú resaltará la sección activa y permitirá navegar entre las páginas administrativas implementadas.

**Área de contenido**

Cada página incluirá:

- Encabezado descriptivo.
- Título principal.
- Texto introductorio cuando corresponda.
- Acciones principales.
- Filtros y herramientas de búsqueda.
- Contenido principal.

## 4. Vista general

Será la página de entrada al panel administrativo.

### 4.1. Encabezado

Mostrará:

**Vista general**

Texto secundario:

«Organiza y gestiona el contenido de OposNavarra desde un único lugar».

Acciones rápidas:

- Nueva convocatoria.
- Crear examen.

Las acciones reutilizarán los formularios y flujos existentes.

### 4.2. Tarjetas de estadísticas

Se mostrarán indicadores con datos reales de Supabase:

- Convocatorias: número total.
- Temas: número total.
- Exámenes: número total.
- Preguntas: número total.
- Usuarios: número total.
- Suscripciones activas: número total.

Cada tarjeta contendrá un título, un icono y el valor correspondiente.

Solo se mostrarán indicadores secundarios cuando puedan calcularse con los datos existentes.

Las consultas deberán respetar los permisos administrativos y evitar transferir registros completos cuando únicamente se necesiten recuentos.

### 4.3. Tabla principal de convocatorias

Debajo de las estadísticas aparecerá una tabla con las convocatorias existentes.

La tabla incluirá:

- Nombre.
- Referencia o identificador visible, si existe.
- Número de temas asociados.
- Número de exámenes asociados.
- Estado, si está definido en el esquema.
- Fecha de última modificación, si existe.
- Acciones.

Se incorporarán:

- Búsqueda por nombre.
- Filtros basados en campos reales.
- Ordenación.
- Paginación.
- Acceso a edición.
- Acción para crear una convocatoria.

Los datos serán reales, sin registros de demostración.

## 5. Pantallas de gestión

Todas las pantallas administrativas compartirán una estructura visual consistente.

### 5.1. Convocatorias

Permitirá consultar y gestionar las convocatorias conforme a la spec 008.

Incluirá una tabla con búsqueda, filtros, paginación y acciones.

Se conservarán las relaciones existentes con temas y exámenes.

### 5.2. Temas

Se rediseñará la gestión de temas existentes.

Debe mantenerse la posibilidad de que un tema pertenezca a varias convocatorias.

Las relaciones, números y órdenes definidos en `convocatoria_tema` seguirán gestionándose conforme al modelo existente.

### 5.3. Exámenes

Se rediseñará el listado y los formularios de exámenes.

Debe mantenerse la reutilización de exámenes entre distintas convocatorias.

### 5.4. Banco de preguntas

El banco de preguntas tendrá una interfaz especialmente orientada a gestionar grandes cantidades de registros.

Incluirá:

- Búsqueda.
- Filtros según los campos disponibles.
- Tabla paginada.
- Acceso a la edición.
- Acción de creación.
- Acciones de eliminación cuando estén permitidas.

Se respetará el modelo de preguntas definido en la spec 002.

No se añadirán imágenes ni grupos de preguntas.

### 5.5. Usuarios

Se rediseñará el listado de usuarios y las operaciones administrativas existentes.

Se utilizará `public.perfiles` para consultar la información de perfil.

El campo `perfiles.rol` será la única fuente de verdad para determinar los roles `usuario` y `admin`.

No se creará una tabla `usuario_roles`.

### 5.6. Suscripciones

Se mostrará un listado de suscripciones con la información disponible:

- Usuario.
- Plan.
- Estado.
- Fechas relevantes.
- Información de renovación, cuando esté disponible.

En este MVP, las suscripciones serán exclusivamente de consulta desde el panel administrativo.

No se permitirá modificarlas, cancelarlas ni renovarlas manualmente desde esta interfaz.

### 5.7. Planes

Se mostrarán los planes existentes:

- Mensual.
- Semestral.
- Anual.

La interfaz utilizará los datos reales de los planes y las funcionalidades administrativas ya implementadas.

No se modificará la integración con Stripe.

## 6. Componentes reutilizables

Se crearán o adaptarán componentes compartidos para evitar duplicaciones.

Componentes previstos:

- `AdminLayout`
- `AdminHeader`
- `AdminSidebar`
- `AdminPageHeader`
- `AdminStatCard`
- `AdminDataTable`
- `AdminSearchInput`
- `AdminFilters`
- `AdminStatusBadge`
- `AdminEmptyState`
- `AdminLoadingState`
- `AdminConfirmDialog`

Los nombres son orientativos y podrán adaptarse a la estructura actual del proyecto.

Antes de crear componentes nuevos se revisarán los existentes para reutilizarlos cuando sea posible.

## 7. Tablas y formularios

### 7.1. Tablas

Las tablas compartirán:

- Encabezados claramente identificados.
- Filas con espaciado cómodo.
- Ordenación cuando resulte aplicable.
- Búsqueda y filtros.
- Paginación.
- Acciones por registro.
- Estado vacío.
- Estado de carga.
- Estado de error.

La búsqueda, los filtros y la paginación deberán funcionar con consultas a Supabase cuando el volumen de datos lo requiera, evitando cargar innecesariamente todos los registros en el navegador.

### 7.2. Formularios

Los formularios tendrán un diseño consistente:

- Campos agrupados de manera lógica.
- Etiquetas claras.
- Indicadores de obligatoriedad.
- Mensajes de validación.
- Botones de guardar y cancelar.
- Indicadores durante el guardado.
- Confirmación visual de éxito o error.

Se conservarán las validaciones y reglas de negocio existentes.

Las operaciones destructivas requerirán confirmación.

## 8. Diseño responsive

El panel deberá funcionar en escritorio, tablet y móvil.

En escritorio:

- Sidebar visible.
- Barra superior completa.
- Tarjetas distribuidas en varias columnas.
- Tablas con espacio suficiente.

En tablet:

- Sidebar compactable.
- Tarjetas reorganizadas.
- Contenido adaptable.

En móvil:

- Navegación lateral desplegable.
- Tarjetas en una o dos columnas según el espacio.
- Tablas con desplazamiento horizontal o representación adaptada.
- Formularios utilizables sin desplazamiento horizontal de la página.

Se evitará que los elementos interactivos resulten demasiado pequeños.

## 9. Arquitectura e integración

### 9.1. Frontend

Se utilizará el stack React existente.

El rediseño deberá respetar:

- La estructura de rutas actual.
- Los mecanismos de navegación.
- Los componentes y estilos reutilizables.
- La gestión de estado existente.
- Las convenciones del proyecto.

### 9.2. Supabase

Se reutilizarán las tablas, relaciones, consultas y operaciones actuales.

No se crearán nuevas tablas ni migraciones únicamente para implementar este rediseño.

Si alguna estadística no puede calcularse con el esquema actual, se omitirá o se adaptará sin inventar información.

### 9.3. Seguridad

Solo los usuarios con `perfiles.rol = 'admin'` podrán acceder al panel.

Se mantendrán las comprobaciones de autorización del servidor y las políticas RLS de Supabase.

Ocultar elementos de la interfaz no sustituirá las comprobaciones de seguridad.

## 10. Fuera de alcance

Esta especificación no incluirá:

- Creación de la entidad «Oposición».
- Modificaciones al modelo de convocatorias, temas, exámenes o preguntas.
- Nuevas funcionalidades de contratación.
- Modificaciones en Stripe.
- Nuevas funciones de gestión de suscripciones.
- Modificaciones en la plataforma de realización de tests.
- Cambios en la web comercial.
- Nuevas funcionalidades de negocio no previstas en las specs anteriores.

## 11. Criterios de aceptación

La implementación se considerará finalizada cuando:

1. El panel administrativo tenga un diseño visual coherente con la imagen de referencia.
2. La navegación lateral funcione correctamente.
3. La vista general muestre estadísticas reales.
4. La tabla principal muestre convocatorias reales.
5. Todas las pantallas administrativas existentes utilicen el nuevo diseño.
6. Las tablas permitan consultar, buscar, filtrar y paginar los datos cuando corresponda.
7. Los formularios existentes mantengan su funcionamiento.
8. El diseño sea responsive.
9. Los estados de carga, error y ausencia de datos estén correctamente representados.
10. Los usuarios sin permisos administrativos no puedan acceder al panel ni a sus operaciones.
11. Las suscripciones sigan siendo de solo lectura para los administradores.
12. No se hayan creado tablas, roles ni entidades innecesarias.
13. No existan regresiones funcionales respecto a la spec 008.

## 12. Estrategia de implementación

La implementación se realizará en este orden:

**Fase 1 — Estructura visual**

Crear el layout administrativo, la barra superior, el menú lateral y los estilos generales.

**Fase 2 — Vista general**

Implementar las tarjetas de estadísticas y la tabla principal de convocatorias utilizando datos reales.

**Fase 3 — Componentes compartidos**

Crear o adaptar las tablas, filtros, botones, indicadores de estado y formularios reutilizables.

**Fase 4 — Rediseño de las páginas**

Aplicar los nuevos componentes a convocatorias, temas, exámenes, preguntas, usuarios, suscripciones y planes.

**Fase 5 — Validación**

Comprobar el funcionamiento responsive, la accesibilidad, los permisos, las operaciones existentes y la ausencia de regresiones.

## 13. Resultado esperado

Al finalizar esta especificación, OposNavarra dispondrá de un panel de administración visualmente renovado, consistente y preparado para crecer.

El administrador podrá navegar fácilmente por los distintos apartados, consultar estadísticas de la plataforma y gestionar los contenidos desde una interfaz unificada.

El resultado deberá aproximarse visualmente a la referencia proporcionada, adaptándose a las entidades, relaciones y funcionalidades reales de OposNavarra.