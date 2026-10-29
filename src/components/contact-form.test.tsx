import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ContactForm } from './contact-form';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('preserves content after failure and clears it only after confirmed storage', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Inténtalo de nuevo.' }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Hemos recibido tu mensaje. Gracias por contactar con OposNavarra.',
      }),
    });
  vi.stubGlobal('fetch', fetcher);
  render(<ContactForm />);
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'ana@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Hola' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));
  await screen.findByText('Inténtalo de nuevo.');
  expect(screen.getByLabelText('Mensaje')).toHaveValue('Hola');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));
  await screen.findByText('Hemos recibido tu mensaje. Gracias por contactar con OposNavarra.');
  expect(screen.getByLabelText('Mensaje')).toHaveValue('');
});
it('submits the actual hidden field and prevents repeated clicks while pending', async () => {
  const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
  vi.stubGlobal('fetch', fetcher);
  render(<ContactForm />);
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'ana@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'X' } });
  fireEvent.change(screen.getByLabelText('Si ves esto, ignóralo'), { target: { value: 'bot' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).honeypot).toBe('bot');
  expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
});
