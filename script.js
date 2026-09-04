const form = document.querySelector('.contact-form');
const message = document.querySelector('.form-message');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const email = new FormData(form).get('email');
  message.textContent = `Gracias. Te escribiremos en ${email}.`;
  form.reset();
});
