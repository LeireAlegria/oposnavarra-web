# OposNavarra

Página web estática para presentar un servicio de preparación de oposiciones.

## Uso local

### Opción rápida

Abre el archivo `index.html` directamente en tu navegador. No requiere Node.js ni un proceso de compilación.

### Servidor local con JavaScript

El proyecto funciona en el navegador con HTML, CSS y JavaScript. No necesita Python, backend ni un archivo `.env`. Para probar correctamente la página principal y la ruta `/privacy`, necesitas tener instalado [Node.js](https://nodejs.org/):

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta:

	```powershell
	npx serve . -l 8000
	```

3. Abre [http://localhost:8000/](http://localhost:8000/) en el navegador.
4. La página de privacidad estará disponible en [http://localhost:8000/privacy/](http://localhost:8000/privacy/).

Para detener el servidor, pulsa `Ctrl+C` en la terminal. `npx` ejecuta el servidor JavaScript de forma temporal; no hace falta crear un proyecto Node ni instalar dependencias para esta web.

También puedes abrir `index.html` directamente para una revisión rápida o utilizar una extensión como **Live Server** en VS Code.

## Funcionalidades actuales

- Página principal responsive en `index.html`.
- Formulario de contacto gestionado en el navegador por `script.js`.
- Página de privacidad y condiciones en `/privacy/`.
- Estilos y diseño responsive en `styles.css`.

## Publicación

El proyecto está preparado para publicarse como sitio estático en GitHub Pages.
