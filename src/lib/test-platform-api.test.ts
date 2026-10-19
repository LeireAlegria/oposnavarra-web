import { afterEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc }),
}));

import {
  createOfficialTestAttempt,
  getOfficialExamCatalog,
  getTestHistory,
} from './test-platform-api';

afterEach(() => {
  vi.clearAllMocks();
});

describe('test-platform-api', () => {
  it('loads and validates the official exam catalog', async () => {
    const officialExam = {
      id: '00000000-0000-4000-8000-000000000011',
      name: 'Examen oficial',
      date: '2026-05-01',
      convocationId: '00000000-0000-4000-8000-000000000012',
      convocationName: 'Convocatoria',
      questionCount: 50,
    };
    rpc.mockResolvedValue({ data: [officialExam], error: null });

    await expect(getOfficialExamCatalog()).resolves.toEqual([officialExam]);
    expect(rpc).toHaveBeenCalledWith('consultar_catalogo_examenes_oficiales');
  });

  it('starts an official exam with its selected convocation and time limit', async () => {
    const attemptId = '00000000-0000-4000-8000-000000000013';
    rpc.mockResolvedValue({ data: { id: attemptId }, error: null });

    await expect(
      createOfficialTestAttempt({
        convocationId: '00000000-0000-4000-8000-000000000012',
        examId: '00000000-0000-4000-8000-000000000011',
        timeLimitSeconds: 1800,
      }),
    ).resolves.toBe(attemptId);
    expect(rpc).toHaveBeenCalledWith('crear_intento_test_oficial', {
      p_convocatoria_id: '00000000-0000-4000-8000-000000000012',
      p_examen_id: '00000000-0000-4000-8000-000000000011',
      p_tiempo_limite_segundos: 1800,
    });
  });

  it('uses the paginated history RPC and validates its response', async () => {
    rpc.mockResolvedValue({
      data: { items: [], hasMore: false },
      error: null,
    });

    await expect(getTestHistory(10, 20)).resolves.toEqual({
      items: [],
      hasMore: false,
    });
    expect(rpc).toHaveBeenCalledWith('listar_historial_test', {
      p_limite: 10,
      p_offset: 20,
    });
  });

  it('returns a clear Spanish message when the test migration is missing', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function in the schema cache',
      },
    });

    await expect(getTestHistory(10, 0)).rejects.toThrow(
      'Las operaciones de tests aún no están disponibles en la base de datos.',
    );
  });
});
