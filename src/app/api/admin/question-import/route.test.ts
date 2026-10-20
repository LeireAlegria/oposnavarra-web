// @vitest-environment node
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => api }));
import { GET, POST } from './route';
import { IMPORT_HEADERS } from '@/lib/question-import/model';

const operationId = '00000000-0000-4000-8000-000000001301';
async function request(
  action = 'preview',
  rows: unknown[][] = [[null, 'Pregunta completa', 'A', 'B', 'C', 'D', 'a', '', '']],
  extras: Record<string, string> = {},
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Preguntas');
  sheet.addRow([...IMPORT_HEADERS]);
  rows.forEach((row) => sheet.addRow(row));
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const form = new FormData();
  form.set('file', new File([bytes], 'preguntas.xlsx'));
  form.set('action', action);
  form.set(
    'settings',
    JSON.stringify({ origin: 'generada_documentacion', reference: 'Manual v1', examId: null }),
  );
  if (action === 'confirm') {
    form.set('operationId', operationId);
    form.set('reviewed', 'true');
    form.set(
      'decisions',
      JSON.stringify(
        rows.map((_, index) => ({
          rowNumber: index + 2,
          included: true,
          topicId: null,
          topicResolved: true,
          duplicateAccepted: false,
        })),
      ),
    );
    form.set('duplicateSnapshots', '[]');
    form.set('topicSnapshots', '[]');
  }
  Object.entries(extras).forEach(([key, value]) => form.set(key, value));
  return new Request('http://localhost/api/admin/question-import', { method: 'POST', body: form });
}
beforeEach(() => {
  api.rpc.mockReset();
  api.rpc.mockImplementation(async (name: string) =>
    name === 'es_admin_actual'
      ? { data: true, error: null }
      : name === 'revisar_importacion_preguntas_admin'
        ? {
            data: {
              topics: [],
              duplicates: [],
              occupiedNumbers: [],
              convocationNames: [],
              examName: null,
            },
            error: null,
          }
        : { data: { created: 1, excluded: 0 }, error: null },
  );
});
describe('question import server boundary', () => {
  it('denies both operations and template downloads to non-administrators', async () => {
    api.rpc.mockResolvedValue({ data: false, error: null });
    expect((await GET()).status).toBe(403);
    expect((await POST(await request())).status).toBe(403);
    expect(api.rpc.mock.calls.every(([name]) => name === 'es_admin_actual')).toBe(true);
  });
  it('previews without writing and only confirms re-parsed included content', async () => {
    const response = await POST(await request());
    expect(response.status).toBe(200);
    expect(
      api.rpc.mock.calls.some(([name]) => name === 'confirmar_importacion_preguntas_admin'),
    ).toBe(false);
    const confirmation = await POST(await request('confirm'));
    expect(confirmation.status).toBe(200);
    const payload = api.rpc.mock.calls.find(
      ([name]) => name === 'confirmar_importacion_preguntas_admin',
    )![1].p_datos;
    expect(payload.rows[0]).toMatchObject({
      text: 'Pregunta completa',
      correctAnswer: 'A',
      options: ['A', 'B', 'C', 'D'],
    });
    expect(payload).toMatchObject({
      origin: 'generada_documentacion',
      reference: 'Manual v1',
      examId: null,
      totalRows: 1,
    });
    expect(payload.fileHash).toMatch(/^[a-f\d]{64}$/);
  });
  it('blocks formulas even when browser decisions claim review is complete', async () => {
    const response = await POST(
      await request('confirm', [
        [null, { formula: '1+1', result: 2 }, 'A', 'B', 'C', 'D', 'a', '', ''],
      ]),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain('Fila 2');
    expect(
      api.rpc.mock.calls.some(([name]) => name === 'confirmar_importacion_preguntas_admin'),
    ).toBe(false);
  });
  it('lets invalid rows be excluded and never sends them to the transaction', async () => {
    const decisions = [
      {
        rowNumber: 2,
        included: true,
        topicId: null,
        topicResolved: true,
        duplicateAccepted: false,
      },
      {
        rowNumber: 3,
        included: false,
        topicId: null,
        topicResolved: true,
        duplicateAccepted: false,
      },
    ];
    const response = await POST(
      await request(
        'confirm',
        [
          [null, 'Válida', 'A', 'B', 'C', 'D', 'a', '', ''],
          [null, '', '', '', '', '', '', '', 'Tema desconocido'],
        ],
        { decisions: JSON.stringify(decisions) },
      ),
    );
    expect(response.status).toBe(200);
    const payload = api.rpc.mock.calls.find(
      ([name]) => name === 'confirmar_importacion_preguntas_admin',
    )![1].p_datos;
    expect(payload.rows).toHaveLength(1);
    expect(payload.totalRows).toBe(2);
  });
  it('requires an exam for official provenance and a new review on database conflicts', async () => {
    const response = await POST(
      await request('preview', undefined, {
        settings: JSON.stringify({ origin: 'examen_oficial', reference: '', examId: null }),
      }),
    );
    expect(response.status).toBe(400);
    api.rpc.mockImplementation(async (name: string) =>
      name === 'es_admin_actual'
        ? { data: true, error: null }
        : {
            data: null,
            error: {
              code: '22023',
              message: 'Fila 2: el banco ha cambiado. Vuelve a revisar los posibles duplicados.',
            },
          },
    );
    const rejected = await POST(await request('confirm'));
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({
      needsReview: true,
      message: expect.stringContaining('Fila 2'),
    });
  });
});
