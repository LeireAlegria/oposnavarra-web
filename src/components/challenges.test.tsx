import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  getChallenge: vi.fn(),
  getInvitation: vi.fn(),
  listChallenges: vi.fn(),
  closeChallenge: vi.fn(),
  joinChallenge: vi.fn(),
  startChallenge: vi.fn(),
  createChallenge: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/challenges', async (original) => ({
  ...(await original<typeof import('@/lib/challenges')>()),
  ...api,
}));
import { Challenges } from './challenges';
import { CLOSE_CHALLENGE_WARNING, type Challenge } from '@/lib/challenges';
const challenge: Challenge = {
  id: '00000000-0000-4000-8000-000000000014',
  title: 'Reto compartido',
  status: 'abierto',
  creatorName: 'Creador',
  convocationName: 'Administrativo',
  topics: ['Tema 1'],
  questionCount: 20,
  durationSeconds: 600,
  canJoin: true,
  isParticipant: true,
  isCreator: true,
  attemptId: '00000000-0000-4000-8000-000000000015',
  attemptStatus: 'finalizado',
  invitationToken: 'a'.repeat(64),
  closedReason: null,
  closedAt: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  api.getChallenge.mockResolvedValue(challenge);
  api.getInvitation.mockResolvedValue({
    ...challenge,
    isCreator: false,
    isParticipant: false,
    attemptId: null,
    attemptStatus: null,
    invitationToken: undefined,
  });
  api.listChallenges.mockResolvedValue([]);
});
afterEach(cleanup);
describe('challenge screens', () => {
  it('shows a neutral waiting screen without scores or pending counts, including for the creator', async () => {
    render(<Challenges id={challenge.id} authenticated />);
    await screen.findByText(
      'Has terminado el reto. Todavía hay participantes pendientes de finalizar.',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Nota|Aciertos|quedan \d/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar reto y publicar resultados' }));
    expect(screen.getByText(CLOSE_CHALLENGE_WARNING)).toBeInTheDocument();
    expect(api.closeChallenge).not.toHaveBeenCalled();
    api.closeChallenge.mockResolvedValue({ ...challenge, status: 'cerrado', ranking: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre y publicar' }));
    await screen.findByRole('table');
    expect(api.closeChallenge).toHaveBeenCalledWith(challenge.id);
  });
  it('preserves the invitation destination for authentication and requires an explicit join', async () => {
    render(<Challenges token="token" authenticated={false} />);
    const link = await screen.findByRole('link', { name: 'Iniciar sesión para unirme' });
    expect(link).toHaveAttribute('href', '/acceder?next=%2Fretos%2Finvitacion%2Ftoken');
    expect(api.joinChallenge).not.toHaveBeenCalled();
  });
  it('lists an empty state and leaves results access available without a subscription', async () => {
    render(<Challenges authenticated canCreate={false} />);
    await screen.findByText(/No hay retos en esta vista/);
    expect(screen.getByRole('button', { name: 'Crear reto' })).toBeDisabled();
    const navigation = screen.getByRole('navigation', { name: 'Navegación de la plataforma' });
    expect(navigation.querySelector('[aria-current="page"]')).toHaveTextContent(
      'Retos compartidos',
    );
    expect(screen.getByRole('link', { name: /Test oficiales/ })).toHaveAttribute(
      'href',
      '/plataforma?section=oficiales',
    );
    const toggle = screen.getByRole('button', { name: 'Abrir navegación' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('link', { name: /Test oficiales/ }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
