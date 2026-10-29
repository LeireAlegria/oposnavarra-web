import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ load: vi.fn(), update: vi.fn(), filter: vi.fn(), range: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => {
        const query = { eq: api.filter, order: () => query, range: api.range };
        api.filter.mockImplementation(() => query);
        return query;
      },
      update: api.update,
    }),
  }),
}));
import { ContactMessages } from './contact-messages';
const message = {
  id: 'contact-1',
  nombre: 'Ana',
  email: 'ana@example.com',
  mensaje: 'Primera línea\n<script>alert(1)</script>',
  created_at: '2026-10-29T12:00:00Z',
  leido: false,
};
beforeEach(() => {
  api.range.mockReset().mockResolvedValue({ data: [message], count: 1, error: null });
  api.update.mockReset();
  api.filter.mockReset();
});
afterEach(cleanup);
it('shows saved inquiries as plain text and changes state only after an explicit confirmed update', async () => {
  api.update.mockReturnValue({
    eq: () => ({
      select: () => ({ single: async () => ({ data: { ...message, leido: true }, error: null }) }),
    }),
  });
  render(<ContactMessages />);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir mensaje de Ana' }));
  expect(api.update).not.toHaveBeenCalled();
  const detail = screen.getByRole('region', { name: 'Detalle del mensaje' });
  expect(detail).toHaveTextContent('<script>alert(1)</script>');
  expect(document.querySelector('script')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Marcar como leído' }));
  await screen.findByRole('button', { name: 'Marcar como pendiente' });
  expect(api.update).toHaveBeenCalledWith({ leido: true });
});
it('keeps the previous status when saving fails and supports empty filtered results', async () => {
  api.update.mockReturnValue({
    eq: () => ({
      select: () => ({ single: async () => ({ data: null, error: { message: 'offline' } }) }),
    }),
  });
  render(<ContactMessages />);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir mensaje de Ana' }));
  fireEvent.click(screen.getByRole('button', { name: 'Marcar como leído' }));
  await screen.findByText('No se pudo cambiar el estado. Vuelve a intentarlo.');
  expect(screen.getByRole('button', { name: 'Marcar como leído' })).toBeEnabled();
  expect(
    within(screen.getByRole('region', { name: 'Detalle del mensaje' })).getByText('Pendiente'),
  ).toBeInTheDocument();
  api.range.mockResolvedValue({ data: [], count: 0, error: null });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'read' } });
  await screen.findByText('No hay mensajes para esta selección.');
  expect(api.filter).toHaveBeenCalledWith('leido', true);
});
