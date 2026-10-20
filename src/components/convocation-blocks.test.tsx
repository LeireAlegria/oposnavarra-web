import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => api }));
import { ConvocationBlocks } from './convocation-blocks';

const blocks = [
  { id: 'b1', nombre: 'Derecho', orden: 1, referencia_oficial: 'Parte I' },
  { id: 'b2', nombre: 'Informática', orden: 2, referencia_oficial: 'Parte II' },
];
const topics = [
  { id: 't1', nombre: 'Constitución' },
  { id: 't2', nombre: 'Procedimiento' },
  { id: 't3', nombre: 'Ofimática' },
];
const relations = [
  {
    tema_id: 't1',
    bloque_id: 'b1',
    numero: 1,
    orden: 1,
    texto_oficial: 'Contenido íntegro de Constitución.',
  },
  { tema_id: 't2', bloque_id: 'b1', numero: 7, orden: 2, texto_oficial: null },
  { tema_id: 't3', bloque_id: 'b2', numero: 1, orden: 1, texto_oficial: null },
];
function mockLoad(error = false, empty = false) {
  api.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        order: () =>
          Promise.resolve({
            data: empty ? [] : table === 'convocatoria_bloques' ? blocks : relations,
            error: error ? {} : null,
          }),
      }),
    }),
  }));
}
async function load() {
  render(<ConvocationBlocks convocationId="c1" topics={topics} onSaved={vi.fn()} />);
  await screen.findByRole('button', { name: /BLOQUE 1/ });
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mockLoad();
  api.rpc.mockResolvedValue({ error: null });
});

describe('syllabus management', () => {
  it('shows compact blocks, reorders topics without renumbering and saves only on request', async () => {
    await load();
    expect(screen.getByRole('button', { name: /BLOQUE 2/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Subir tema 7 de Derecho' }));
    expect(api.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Cambios guardados.');
    const payload = api.rpc.mock.calls[0][1];
    expect(
      payload.p_relaciones.find((item: { tema_id: string }) => item.tema_id === 't2'),
    ).toMatchObject({ numero: 7, orden: 1 });
    expect(
      payload.p_relaciones.find((item: { tema_id: string }) => item.tema_id === 't1'),
    ).toMatchObject({ numero: 1, orden: 2, texto_oficial: 'Contenido íntegro de Constitución.' });
  });
  it('flags duplicate official numbers after moving a topic and lets changes be discarded', async () => {
    await load();
    fireEvent.click(screen.getByText('Constitución'));
    const topic = screen.getByText('Constitución').closest('details')!;
    fireEvent.change(within(topic).getByLabelText('Mover a otro bloque'), {
      target: { value: 'b2' },
    });
    expect(screen.getByRole('button', { name: /BLOQUE 2/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(screen.getAllByText(/Este número ya está usado/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(screen.queryByText(/Este número ya está usado/)).not.toBeInTheDocument();
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it('preserves edits when saving fails and permits retrying', async () => {
    api.rpc.mockResolvedValueOnce({ error: {} }).mockResolvedValueOnce({ error: null });
    await load();
    fireEvent.click(screen.getByRole('button', { name: 'Subir tema 7 de Derecho' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Cambios guardados.');
    expect(api.rpc.mock.calls[0][1]).toEqual(api.rpc.mock.calls[1][1]);
  });
  it('offers a retry after loading fails and handles an empty syllabus', async () => {
    mockLoad(true);
    render(<ConvocationBlocks convocationId="c1" topics={topics} onSaved={vi.fn()} />);
    await screen.findByRole('alert');
    mockLoad(false, true);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await screen.findByText('Organiza tu temario');
    fireEvent.click(screen.getByRole('button', { name: '+ Añadir bloque' }));
    expect(screen.getByLabelText('Nombre del bloque')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nombre del bloque'), { target: { value: 'General' } });
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });
});
