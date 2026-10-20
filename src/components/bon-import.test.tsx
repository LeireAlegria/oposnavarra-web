import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BonImport } from './bon-import';

const draft = {
  sourceUrl: 'https://bon.navarra.es/es/anuncio/-/texto/2025/101/21/', sourceId: '2025/101/21',
  name: 'Administrativo', description: 'Convocatoria oficial', organization: '', group: 'C', publicationDate: '2025-05-22', resolution: '', announcementCode: '', reviewed: false,
  blocks: [{ key: 'general', name: 'General', reference: '', topics: [{ key: 't1', number: 1, text: 'Contenido completo.', name: 'Contenido completo.', decision: 'new', topicId: null }] }],
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function extract(fetcher: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetcher);
  render(<BonImport topics={[]} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Importar desde el BON' }));
  fireEvent.change(screen.getByLabelText('URL del anuncio del BON'), { target: { value: draft.sourceUrl } });
  fireEvent.click(screen.getByRole('button', { name: 'Extraer convocatoria' }));
  await screen.findByLabelText('Texto oficial completo');
}
describe('BON draft workflow', () => {
  it('defaults to creating new topics, requires review and does not write on cancellation', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ draft, warnings: [] }) });
    await extract(fetcher);
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled();
    expect(screen.getByLabelText('Reutilización')).toHaveValue('new');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar borrador' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Texto oficial completo')).not.toBeInTheDocument();
  });
  it('keeps the operation key after a lost response and recovers the completed import', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ draft, warnings: [] }) }).mockRejectedValueOnce(new Error('Conexión interrumpida')).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'saved' }) });
    await extract(fetcher);
    fireEvent.change(screen.getByLabelText('Reutilización'), { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar confirmación' }));
    await waitFor(() => expect(screen.getByText(/Importación completada/)).toBeInTheDocument());
    expect(JSON.parse(fetcher.mock.calls[1][1].body).operationId).toBe(JSON.parse(fetcher.mock.calls[2][1].body).operationId);
  });
  it('allows correcting the preserved draft after a rejected confirmation', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ draft, warnings: [] }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Revisa los datos.' }) });
    await extract(fetcher);
    fireEvent.change(screen.getByLabelText('Reutilización'), { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Texto oficial completo')).toBeEnabled();
  });
});
