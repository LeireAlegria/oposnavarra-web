import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ rpc: vi.fn(), catalog: vi.fn() }));
vi.mock('@/lib/learning-path', () => ({ pathRpc: api.rpc }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ order: api.catalog }) }) }),
  }),
}));
import { LearningPathEditor } from './learning-path-editor';
const path = {
  id: 'path-1',
  convocationId: 'convocation-1',
  title: 'Mi camino',
  state: 'borrador',
  stops: [
    {
      id: 'stop-1',
      title: 'Tema uno',
      type: 'tema',
      blockId: 'block-1',
      challenges: [
        {
          id: 'challenge-1',
          title: 'Primeros pasos',
          questionCount: 5,
          criterion: 'finalizacion',
          threshold: 0,
          xp: 10,
        },
      ],
    },
  ],
};
beforeEach(() => {
  api.rpc.mockReset();
  api.catalog.mockResolvedValue({
    data: [{ id: 'convocation-1', nombre: 'Navarra' }],
    error: null,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);
it('generates only a draft and preserves its edits if publication fails', async () => {
  api.rpc
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([path])
    .mockRejectedValueOnce(new Error('Faltan preguntas'));
  render(<LearningPathEditor />);
  await screen.findByText('No hay caminos. Genera un borrador para empezar.');
  fireEvent.change(screen.getByLabelText('Convocatoria'), { target: { value: 'convocation-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generar borrador' }));
  await screen.findByText('Tema uno · Tema');
  expect(api.rpc.mock.calls[1][1].p_action).toBe('generate');
  fireEvent.change(screen.getByLabelText('Preguntas'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Validar y publicar' }));
  expect(api.rpc).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await screen.findByText(/Faltan preguntas/);
  expect(screen.getByLabelText('Preguntas')).toHaveValue(8);
  expect(api.rpc.mock.calls[2][1].p_rules[0].questionCount).toBe(8);
});
it('disables published rules and sends only title changes without regeneration', async () => {
  const published = { ...path, state: 'publicado' };
  api.rpc.mockResolvedValue([published]);
  render(<LearningPathEditor />);
  await waitFor(() =>
    expect(screen.getByLabelText('Camino').querySelectorAll('option')).toHaveLength(2),
  );
  fireEvent.change(screen.getByLabelText('Camino'), { target: { value: 'path-1' } });
  expect(screen.getByLabelText('Preguntas')).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Regenerar borrador desde el catálogo' }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nuevo título' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText('Cambios guardados.');
  expect(api.rpc.mock.calls[1][1]).toMatchObject({
    p_action: 'save',
    p_title: 'Nuevo título',
    p_rules: null,
  });
});
