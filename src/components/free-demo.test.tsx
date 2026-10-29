import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ operation: vi.fn() }));
vi.mock('@/lib/free-demo', async (original) => ({
  ...(await original<typeof import('@/lib/free-demo')>()),
  demoOperation: api.operation,
}));
import { FreeDemo } from './free-demo';
const options = Array.from({ length: 4 }, (_, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  text: `Opción ${i + 1}`,
}));
const question = { id: '00000000-0000-4000-8000-000000000010', text: 'Pregunta real', options };
const available = { version: 1, name: 'Administrativo', question };
const started = {
  id: '00000000-0000-4000-8000-000000000020',
  version: 1,
  name: 'Administrativo',
  state: 'started',
  expiresAt: '2026-10-30T10:00:00Z',
  answered: 0,
  score: 0,
  results: [],
  question,
};
const correction = {
  ...question,
  selectedOptionId: options[0].id,
  correctOptionId: options[0].id,
  explanation: 'Explicación revisada',
  reference: null,
  correct: true,
};
beforeEach(() => {
  api.operation.mockReset();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);
describe('free demonstration', () => {
  it('retains the preview selection, prevents duplicate checks and preserves it on network failure', async () => {
    api.operation.mockResolvedValueOnce(started).mockRejectedValueOnce(new Error('Sin conexión'));
    render(<FreeDemo available={available} autoRestore={false} />);
    fireEvent.click(screen.getByLabelText('Opción 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar respuesta' }));
    await screen.findByText('Sin conexión');
    expect(screen.getByLabelText('Opción 1')).toBeChecked();
    expect(api.operation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: 'answer', position: 0, option: options[0].id }),
    );
    api.operation.mockResolvedValueOnce({
      ...started,
      answered: 1,
      score: 1,
      results: [correction],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar respuesta' }));
    await screen.findByText('Explicación revisada');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente pregunta' }));
    expect(screen.getByText('Pregunta 2 de 5')).toBeInTheDocument();
  });
  it('shows all corrections without registration and links to existing auth with an opaque credential', async () => {
    const token = 'a'.repeat(64);
    window.history.replaceState(null, '', `/prueba-gratis#token=${token}`);
    api.operation.mockResolvedValueOnce({
      ...started,
      state: 'completed',
      answered: 5,
      score: 5,
      question: null,
      results: Array.from({ length: 5 }, (_, i) => ({
        ...correction,
        id: `00000000-0000-4000-8000-00000000003${i}`,
        text: `Pregunta ${i + 1}`,
      })),
    });
    render(<FreeDemo available={available} />);
    await screen.findByText('Tu resultado: 5 de 5');
    expect(screen.getAllByText('Explicación revisada')).toHaveLength(5);
    const link = screen.getByRole('link', { name: 'Crea tu cuenta y guarda este resultado' });
    expect(link.getAttribute('href')).toContain('/registro?next=');
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain(`#token=${token}&guardar=1`);
    expect(api.operation).toHaveBeenCalledOnce();
  });
  it('restores from a cross-device link, claims on return and does not claim twice after reload', async () => {
    const token = 'b'.repeat(64);
    window.history.replaceState(null, '', `/prueba-gratis#token=${token}&guardar=1`);
    const complete = {
      ...started,
      state: 'completed',
      answered: 5,
      score: 1,
      question: null,
      results: [correction],
    };
    api.operation
      .mockResolvedValueOnce(complete)
      .mockResolvedValueOnce({ ...complete, state: 'claimed' });
    render(<FreeDemo available={available} authenticated />);
    await screen.findByText('Resultado guardado como «Prueba gratuita».');
    expect(api.operation).toHaveBeenNthCalledWith(2, { action: 'claim', token });
    expect(
      screen.queryByRole('link', { name: 'Crea tu cuenta y guarda este resultado' }),
    ).not.toBeInTheDocument();
  });
  it('shows an expired recovery error without blocking access to the account', async () => {
    window.history.replaceState(null, '', `/prueba-gratis#token=${'c'.repeat(64)}&guardar=1`);
    api.operation.mockRejectedValueOnce(new Error('La prueba ha caducado. Puedes iniciar otra.'));
    render(<FreeDemo available={null} />);
    await screen.findByText('La prueba ha caducado. Puedes iniciar otra.');
    expect(
      screen.getByRole('link', { name: 'Inicia sesión para guardar el resultado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar una prueba nueva' })).toBeEnabled();
  });
  it('never renders pending solutions or interprets HTML in a question', async () => {
    render(
      <FreeDemo
        available={{ ...available, question: { ...question, text: '<script>alert(1)</script>' } }}
        autoRestore={false}
      />,
    );
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByText('Explicación revisada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comprobar respuesta' })).toBeDisabled();
    await waitFor(() => expect(api.operation).not.toHaveBeenCalled());
  });
});
