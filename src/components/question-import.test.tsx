import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionImport } from './question-import';
import type { ImportPreview } from '@/lib/question-import/model';

const preview: ImportPreview = {
  rows: [
    {
      rowNumber: 2,
      number: null,
      text: '¿Cuál es la respuesta?',
      options: ['Uno', 'Dos', 'Tres', 'Cuatro'],
      correctAnswer: 'A',
      explanation: '',
      topic: '',
      issues: [],
    },
  ],
  catalog: {
    topics: [],
    duplicates: [],
    occupiedNumbers: [],
    examName: null,
    convocationNames: [],
  },
};
async function prepare(fetcher: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetcher);
  render(<QuestionImport exams={[]} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Importar preguntas' }));
  fireEvent.change(screen.getByLabelText('Procedencia'), {
    target: { value: 'generada_documentacion' },
  });
  fireEvent.change(screen.getByLabelText('Archivo de preguntas'), {
    target: { files: [new File(['xlsx'], 'preguntas.xlsx')] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Validar y revisar' }));
  await screen.findByText('¿Cuál es la respuesta?', { selector: 'summary' });
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('question import review flow', () => {
  it('requires an in-flow confirmation and academic review before sending the batch', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => preview })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ created: 1, excluded: 0 }) });
    await prepare(fetcher);
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 preguntas' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Importar 1 preguntas' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/He revisado el contenido/));
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 preguntas' }));
    await screen.findByText('Importación completada');
    expect(screen.getByRole('link', { name: 'Abrir preguntas importadas' })).toHaveAttribute(
      'href',
      '/admin?seccion=preguntas&estado=revision',
    );
  });
  it('does not silently resolve a unique topic match and prevents confirmation when all rows are excluded', async () => {
    const data = structuredClone(preview);
    data.rows[0].topic = 'Constitución';
    data.catalog.topics = [{ id: 't1', nombre: 'Constitución', descripcion: 'Contenido oficial' }];
    await prepare(vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    expect(screen.getByRole('button', { name: 'Importar 1 preguntas' })).toBeDisabled();
    fireEvent.click(screen.getByText('¿Cuál es la respuesta?', { selector: 'summary' }));
    fireEvent.change(screen.getByLabelText('Resolver tema de fila 2'), { target: { value: 't1' } });
    expect(screen.getByRole('button', { name: 'Importar 1 preguntas' })).toBeEnabled();
    fireEvent.click(screen.getByLabelText('Fila 2'));
    expect(screen.getByRole('button', { name: 'Importar 0 preguntas' })).toBeDisabled();
  });
  it('reuses the operation key after a lost response', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => preview })
      .mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ created: 1, excluded: 0 }) });
    await prepare(fetcher);
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 preguntas' }));
    fireEvent.click(screen.getByLabelText(/He revisado el contenido/));
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 preguntas' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar resultado de la importación' }));
    await screen.findByText('Importación completada');
    expect(fetcher.mock.calls[1][1].body.get('operationId')).toBe(
      fetcher.mock.calls[2][1].body.get('operationId'),
    );
  });
});
