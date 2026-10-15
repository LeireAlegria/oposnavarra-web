import { afterEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc }),
}));

import { getTestHistory } from './test-platform-api';

afterEach(() => {
  vi.clearAllMocks();
});

describe('test-platform-api', () => {
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
